/**
 * PageGrade Outreach Autopilot  (Google Sheets + Apps Script, free)
 * -----------------------------------------------------------------
 * Runs inside your own Google account and sends from the Gmail account that owns the sheet.
 *
 * What it does
 *  - Find emails: visits each prospect's website (home, contact and about pages), fills in a
 *    public contact email and notes any company number it sees.
 *  - Sends personalised plain-text emails in small batches during your sending hours.
 *  - Sends up to two follow-ups in the same thread when nobody replies.
 *  - Stops as soon as someone replies, opts out or an email bounces. Opt-outs go on the
 *    "Do not contact" tab for good.
 *  - Keeps a log and a small dashboard.
 *
 * It never emails a row until you set "OK to email" to Yes.
 * Setup steps are on the "Start here" tab and in SETUP.txt.
 */

var SHEET = {
  prospects: 'Prospects',
  settings: 'Settings',
  dnc: 'Do not contact',
  log: 'Log',
  dashboard: 'Dashboard',
};

var COL = {
  email: 'Email',
  firstName: 'First name',
  company: 'Company',
  website: 'Website',
  city: 'City',
  niche: 'Niche',
  track: 'Track',
  ok: 'OK to email',
  reportLink: 'Report link',
  fixes: 'Fixes',
  status: 'Status',
  firstSent: 'First sent',
  lastSent: 'Last sent',
  followUps: 'Follow-ups',
  thread: 'Thread',
  note: 'Script note',
  notes: 'Notes',
};

var STATUS = {
  ready: 'Ready',
  sent: 'Sent',
  replied: 'Replied',
  optedOut: 'Opted out',
  bounced: 'Bounced',
  noReply: 'No reply',
  skipped: 'Skipped',
};

// Placeholders with a sensible default when the cell is empty. All others must be filled in.
var DEFAULTS = { first_name: 'there', city: 'your area', niche: 'local' };

var EMAIL_RE = /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/i;
var FREE_MAIL_RE = /^(gmail|googlemail|outlook|hotmail|live|msn|yahoo|ymail|icloud|me|mac|aol|proton|protonmail|pm|gmx|zoho)\./i;
var RESERVED_RE = /@([a-z0-9-]+\.)*(example\.(com|org|net)|test|invalid|localhost)$/i;
var OPT_OUT_RE = /\b(unsubscribe|remove me|take me off|opt(-|\s)?out|stop (emailing|contacting|sending|messaging)|please stop|not interested|no,? thanks|no,? thank you|don'?t (email|contact|message)|do not (email|contact|message))\b/i;
var BOUNCE_FROM_RE = /mailer-daemon|postmaster@|mail delivery (subsystem|system)/i;
var AUTO_SUBJECT_RE = /^(automatic reply|auto(-|\s)?reply|autoreply|out of (the )?office|away from the office|i am out of|i'm out of)/i;
var LOW_PRIORITY_RE = /^(jobs?|careers?|recruit(ment|ing)?|hr|accounts?|billing|invoices?|finance|support|help|helpdesk|press|media|pr|legal|admin)@/i;
var CONTACT_RE = /^(hello|hi|hey|info|contact|enquiries|enquiry|inquiries|inquiry|team|studio|office|mail|sales|new-?business|newbiz|work|projects|business|general|talk|start)@/i;
var ROW_COLOURS = { replied: '#fff4c2', optedOut: '#eeeeee', bounced: '#f8d7da' };

// ------------------------------------------------------------------ Menu

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Outreach')
    .addItem('Find emails for new rows', 'findEmails')
    .addItem('Preview next email', 'previewNext')
    .addItem('Send a test email to me', 'sendTestToMe')
    .addSeparator()
    .addItem('Send next batch now', 'sendNow')
    .addItem('Check replies now', 'checkRepliesNow')
    .addSeparator()
    .addItem('Start autopilot (runs every hour)', 'startAutopilot')
    .addItem('Stop autopilot', 'stopAutopilot')
    .addToUi();
}

/** Runs every hour once the autopilot is on. Sends only inside your sending hours. */
function autopilot() {
  run_({ manual: false });
}

/** Menu: send now, ignoring sending hours and Paused, but never the daily limit. */
function sendNow() {
  toast_(run_({ manual: true }).message);
}

function checkRepliesNow() {
  var done = withLock_(function () {
    var t = table_();
    var ctx = context_(t);
    var n = checkReplies_(t, ctx, Date.now());
    dashboard_(t);
    return n;
  });
  if (done === null) return;
  toast_(done ? done + ' prospect' + (done === 1 ? '' : 's') + ' updated (replies, opt-outs or bounces).' : 'No new replies.');
}

function startAutopilot() {
  removeTriggers_();
  ScriptApp.newTrigger('autopilot').timeBased().everyHours(1).create();
  toast_('Autopilot is on. It runs every hour and only sends during your sending hours.');
}

function stopAutopilot() {
  var n = removeTriggers_();
  toast_(n ? 'Autopilot is off.' : 'Autopilot was not running.');
}

function previewNext() {
  var ui = SpreadsheetApp.getUi();
  var next = nextReady_();
  if (!next) { ui.alert('Nothing is ready to send. A row needs an email address and "OK to email" set to Yes.'); return; }
  if (next.error) { ui.alert('Row ' + next.row + ' is not ready', next.error, ui.ButtonSet.OK); return; }
  ui.alert('Next email (row ' + next.row + ')', 'To: ' + next.to + '\nSubject: ' + next.subject + '\n\n' + next.body, ui.ButtonSet.OK);
}

function sendTestToMe() {
  var ui = SpreadsheetApp.getUi();
  var next = nextReady_();
  if (!next) { ui.alert('Nothing is ready to send. A row needs an email address and "OK to email" set to Yes.'); return; }
  if (next.error) { ui.alert('Row ' + next.row + ' is not ready', next.error, ui.ButtonSet.OK); return; }
  var me = Session.getEffectiveUser().getEmail();
  GmailApp.sendEmail(me, '[Test for ' + next.to + '] ' + next.subject, next.body, mailOptions_(settings_()));
  toast_('Test sent to ' + me + '. Nothing was sent to the prospect.');
}

/** Menu: fill in public contact emails from each website. Never sets "OK to email". */
function findEmails() {
  var t = table_();
  var deadline = Date.now() + 240000; // Apps Script stops any run after 6 minutes
  var checked = 0, found = 0;
  for (var i = 0; i < t.rows.length; i++) {
    if (Date.now() > deadline || checked >= 40) break;
    var r = t.rows[i];
    if (!needsLookup_(t, r)) continue;
    var res = scanSite_(str_(t, r, COL.website), deadline + 30000);
    checked++;
    if (res.best) { set_(t, r, COL.email, res.best); found++; }
    note_(t, r, 'Checked ' + Utilities.formatDate(new Date(), tz_(), 'd MMM') + ': ' + res.summary);
    SpreadsheetApp.flush();
  }
  var more = t.rows.some(function (r) { return needsLookup_(t, r); });
  toast_('Checked ' + checked + ' website' + (checked === 1 ? '' : 's') + ', found ' + found + ' email address' + (found === 1 ? '' : 'es') + '.' +
    (more ? ' Run it again for the rest.' : '') + ' Check each row, then set "OK to email" to Yes.');
}

// ------------------------------------------------------------------ Main run

function run_(opts) {
  var out = withLock_(function () {
    var s = settings_();
    var t = table_();
    var ctx = context_(t);
    tidyCounters_();
    checkReplies_(t, ctx, Date.now());
    finishSequences_(t, s);

    var now = nowParts_();
    var from = num_(s, 'Send from hour', 9);
    var until = num_(s, 'Send until hour', 17);
    var weekdaysOnly = yes_(setting_(s, 'Weekdays only', 'Yes'));
    var inHours = now.hour >= from && now.hour < until && !(weekdaysOnly && now.weekday > 5);

    if (!opts.manual) {
      if (yes_(setting_(s, 'Paused', 'No'))) { dashboard_(t); return { sent: 0, message: 'Paused in Settings.' }; }
      if (!inHours) { dashboard_(t); return { sent: 0, message: 'Outside sending hours.' }; }
    }

    var daily = Math.max(0, Math.floor(num_(s, 'Daily limit', 10)));
    var hours = Math.max(1, until - from);
    var perRun = opts.manual ? daily : Math.max(1, Math.ceil(daily / hours));
    var budget = Math.min(perRun, daily - sentToday_(), MailApp.getRemainingDailyQuota() - 2);
    if (budget <= 0) { dashboard_(t); return { sent: 0, message: 'Daily limit reached. More tomorrow.' }; }

    var followed = 0, sent = 0, waiting = 0;
    // Follow-ups first: those people have already heard from you.
    for (var i = 0; i < t.rows.length && budget > 0; i++) {
      var r = t.rows[i];
      var step = followUpDue_(t, r, s);
      if (step > 0 && sendFollowUp_(t, r, s, ctx, step)) { budget--; followed++; pause_(opts); }
    }
    for (var j = 0; j < t.rows.length && budget > 0; j++) {
      var row = t.rows[j];
      var check = eligible_(t, row, ctx);
      if (!check) continue;
      if (check.skip) {
        if (check.final) set_(t, row, COL.status, STATUS.skipped);
        note_(t, row, check.skip);
        continue;
      }
      if (sendFirst_(t, row, s, ctx)) { budget--; sent++; pause_(opts); } else { waiting++; }
    }
    dashboard_(t);
    var msg = 'Sent ' + sent + ' new email' + (sent === 1 ? '' : 's') + ' and ' + followed + ' follow-up' + (followed === 1 ? '' : 's') + '.';
    if (waiting) msg += ' ' + waiting + ' row' + (waiting === 1 ? ' is' : 's are') + ' waiting for missing details (see Script note).';
    if (sent || followed || waiting) log_('Run', '', msg);
    return { sent: sent + followed, message: msg };
  });
  return out || { sent: 0, message: 'The autopilot is busy. Try again in a minute.' };
}

function eligible_(t, r, ctx) {
  var status = str_(t, r, COL.status);
  if (status && status.toLowerCase() !== STATUS.ready.toLowerCase()) return null;
  var email = str_(t, r, COL.email).toLowerCase();
  if (!email || !yes_(get_(t, r, COL.ok))) return null;
  if (!EMAIL_RE.test(email)) return { skip: 'Waiting: the email address looks wrong' };
  if (RESERVED_RE.test(email)) return { skip: 'Example address: replace it with a real one' };
  if (blocked_(ctx.dnc, email)) return { skip: 'On the Do not contact tab', final: true };
  if (ctx.contacted[email]) return { skip: 'Already contacted in another row', final: true };
  var domain = email.split('@')[1];
  if (!FREE_MAIL_RE.test(domain) && ctx.domains[domain]) return { skip: 'Someone at ' + domain + ' was already contacted', final: true };
  return { ok: true };
}

function sendFirst_(t, r, s, ctx) {
  var email = str_(t, r, COL.email).toLowerCase();
  var m = compose_(t, r, s, 0);
  if (m.error) { note_(t, r, 'Waiting: ' + m.error); return false; }
  var message = GmailApp.createDraft(email, m.subject, m.body, mailOptions_(s)).send();
  var now = new Date();
  set_(t, r, COL.status, STATUS.sent);
  set_(t, r, COL.firstSent, now);
  set_(t, r, COL.lastSent, now);
  set_(t, r, COL.followUps, 0);
  setText_(t, r, COL.thread, message.getThread().getId());
  note_(t, r, '');
  ctx.contacted[email] = true;
  var domain = email.split('@')[1];
  if (!FREE_MAIL_RE.test(domain)) ctx.domains[domain] = true;
  bumpSent_();
  log_('Sent', email, m.subject);
  return true;
}

function followUpDue_(t, r, s) {
  if (str_(t, r, COL.status) !== STATUS.sent) return 0;
  var done = Number(get_(t, r, COL.followUps) || 0);
  if (done >= maxFollowUps_(s)) return 0;
  var days = daysSince_(get_(t, r, COL.lastSent));
  if (days < 0 || days < gapDays_(s)) return 0;
  return done + 1;
}

function sendFollowUp_(t, r, s, ctx, step) {
  var email = str_(t, r, COL.email).toLowerCase();
  if (blocked_(ctx.dnc, email)) {
    set_(t, r, COL.status, STATUS.optedOut);
    note_(t, r, 'On the Do not contact tab');
    return false;
  }
  var m = compose_(t, r, s, step);
  if (m.error) { note_(t, r, 'Waiting: ' + m.error); return false; }
  var thread = threadById_(str_(t, r, COL.thread));
  var subject = 'Re: ' + stripRe_(thread ? thread.getFirstMessageSubject() : m.subject);
  if (thread && advancedGmail_()) {
    sendInThread_(thread, email, subject, m.body, clean_(setting_(s, 'Your name', '')));
  } else {
    GmailApp.sendEmail(email, subject, m.body, mailOptions_(s));
  }
  set_(t, r, COL.followUps, step);
  set_(t, r, COL.lastSent, new Date());
  note_(t, r, '');
  bumpSent_();
  log_('Follow-up ' + step, email, subject);
  return true;
}

/** Marks rows "No reply" once every follow-up has gone and the last wait has passed. */
function finishSequences_(t, s) {
  var max = maxFollowUps_(s), gap = gapDays_(s);
  t.rows.forEach(function (r) {
    if (str_(t, r, COL.status) !== STATUS.sent) return;
    var days = daysSince_(get_(t, r, COL.lastSent));
    if (Number(get_(t, r, COL.followUps) || 0) >= max && days >= gap) set_(t, r, COL.status, STATUS.noReply);
  });
}

function maxFollowUps_(s) { return Math.max(0, Math.min(2, Math.floor(num_(s, 'Follow-ups', 2)))); }
function gapDays_(s) { return Math.max(1, num_(s, 'Days between emails', 4)); }
function pause_(opts) { Utilities.sleep(opts.manual ? 1500 : 3000 + Math.floor(Math.random() * 6000)); }

function nextReady_() {
  var s = settings_(), t = table_(), ctx = context_(t);
  for (var i = 0; i < t.rows.length; i++) {
    var r = t.rows[i];
    var check = eligible_(t, r, ctx);
    if (!check || check.skip) continue;
    var m = compose_(t, r, s, 0);
    if (m.error) return { row: r.row, error: 'Waiting: ' + m.error };
    return { row: r.row, to: str_(t, r, COL.email).toLowerCase(), subject: m.subject, body: m.body };
  }
  return null;
}

// ------------------------------------------------------------------ Writing emails

function compose_(t, r, s, step) {
  var track = str_(t, r, COL.track) || 'Agency';
  var subjectKey = track + ' subject';
  var bodyKey = step === 0 ? track + ' email' : track + ' follow-up ' + step;
  var subjectTpl = String(setting_(s, subjectKey, '')).trim();
  var bodyTpl = String(setting_(s, bodyKey, '')).trim();
  var footerTpl = String(setting_(s, 'Footer', '')).trim();
  if (!subjectTpl) return { error: 'add a "' + subjectKey + '" row to Settings' };
  if (!bodyTpl) return { error: 'add a "' + bodyKey + '" row to Settings' };
  if (!footerTpl) return { error: 'add a Footer to Settings (your name, company, address and how to opt out)' };
  var data = data_(t, r, s);
  var subject = render_(subjectTpl, data);
  var body = render_(bodyTpl, data);
  var footer = render_(footerTpl, data);
  var missing = unique_(subject.missing.concat(body.missing, footer.missing));
  if (missing.length) return { error: 'fill in ' + missing.join(', ') };
  return { subject: subject.text.replace(/\s+/g, ' ').trim(), body: body.text.trim() + '\n\n' + footer.text.trim() };
}

function data_(t, r, s) {
  return {
    first_name: clean_(str_(t, r, COL.firstName)).split(/\s+/)[0],
    company: clean_(str_(t, r, COL.company)),
    website: domainOf_(clean_(str_(t, r, COL.website))),
    city: clean_(str_(t, r, COL.city)),
    niche: clean_(str_(t, r, COL.niche)),
    report_link: clean_(str_(t, r, COL.reportLink)),
    fixes: clean_(str_(t, r, COL.fixes)),
    your_name: clean_(setting_(s, 'Your name', '')),
    company_line: clean_(setting_(s, 'Company line', '')),
    postal_address: clean_(setting_(s, 'Postal address', '')),
    sample_link: clean_(setting_(s, 'Sample report link', '')),
    privacy_link: clean_(setting_(s, 'Privacy link', '')),
    booking_link: clean_(setting_(s, 'Booking link', '')),
  };
}

function render_(template, data) {
  var missing = [];
  var text = String(template).replace(/\{([a-z_]+)\}/gi, function (match, key) {
    var k = key.toLowerCase();
    var v = data[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    if (DEFAULTS.hasOwnProperty(k)) return DEFAULTS[k];
    missing.push(data.hasOwnProperty(k) ? k.replace(/_/g, ' ') : '{' + key + '} (not a known placeholder)');
    return match;
  });
  return { text: text.replace(/\r\n?/g, '\n'), missing: missing };
}

/** Settings or cells that still show a [placeholder] count as empty. */
function clean_(v) {
  var x = String(v === null || v === undefined ? '' : v).trim();
  return /^\[[\s\S]*\]$/.test(x) ? '' : x;
}

function mailOptions_(s) {
  var name = clean_(setting_(s, 'Your name', ''));
  return name ? { name: name } : {};
}

function stripRe_(subject) { return String(subject || '').replace(/^\s*((re|fwd?|aw)\s*:\s*)+/i, '').trim(); }

function advancedGmail_() {
  try { return typeof Gmail !== 'undefined' && !!Gmail.Users && !!Gmail.Users.Messages; } catch (e) { return false; }
}

/** Sends a follow-up inside the original thread (needs the Gmail API service turned on). */
function sendInThread_(thread, to, subject, body, name) {
  var ids = [];
  thread.getMessages().forEach(function (m) {
    var id = '';
    try { id = m.getHeader('Message-ID') || m.getHeader('Message-Id') || ''; } catch (e) { id = ''; }
    if (id) ids.push(id);
  });
  var me = Session.getEffectiveUser().getEmail();
  var display = '';
  if (name) display = (/^[\x20-\x7e]*$/.test(name) ? '"' + name.replace(/["\\]/g, '') + '"' : mimeWord_(name)) + ' ';
  var headers = [
    'From: ' + display + '<' + me + '>',
    'To: ' + to,
    'Subject: ' + mimeWord_(subject),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  if (ids.length) { headers.push('In-Reply-To: ' + ids[ids.length - 1]); headers.push('References: ' + ids.join(' ')); }
  var encoded = Utilities.base64Encode(body, Utilities.Charset.UTF_8).replace(/(.{76})/g, '$1\r\n');
  var raw = headers.join('\r\n') + '\r\n\r\n' + encoded;
  Gmail.Users.Messages.send({ raw: Utilities.base64EncodeWebSafe(raw), threadId: thread.getId() }, 'me');
}

function mimeWord_(text) {
  var s = String(text || '');
  return /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Utilities.base64Encode(s, Utilities.Charset.UTF_8) + '?=';
}

// ------------------------------------------------------------------ Replies, opt-outs, bounces

function checkReplies_(t, ctx, started) {
  var mine = myAddresses_();
  var changed = 0;
  var n = t.rows.length;
  if (!n) return 0;
  // Start where the last run stopped, so big sheets still get every row checked.
  var props = PropertiesService.getScriptProperties();
  var start = Number(props.getProperty('replyCursor') || 0) % n;
  for (var k = 0; k < n; k++) {
    var i = (start + k) % n;
    if (Date.now() - started > 180000) { props.setProperty('replyCursor', String(i)); return changed; } // leave time for sending
    var r = t.rows[i];
    var st = str_(t, r, COL.status);
    // Late replies count too: rows marked "No reply" are still watched for 45 days.
    if (st !== STATUS.sent && !(st === STATUS.noReply && daysSince_(get_(t, r, COL.lastSent)) <= 45)) continue;
    var thread = threadById_(str_(t, r, COL.thread));
    if (!thread) continue;
    var outcome = classifyThread_(thread, mine);
    if (!outcome) continue;
    var email = str_(t, r, COL.email).toLowerCase();
    if (outcome.type === 'bounced') {
      set_(t, r, COL.status, STATUS.bounced);
      colour_(t, r, ROW_COLOURS.bounced);
      note_(t, r, 'Bounced: check the address');
      log_('Bounced', email, '');
    } else if (outcome.type === 'optout') {
      set_(t, r, COL.status, STATUS.optedOut);
      colour_(t, r, ROW_COLOURS.optedOut);
      note_(t, r, 'Opted out: "' + outcome.snippet + '"');
      if (!blocked_(ctx.dnc, email)) { addDnc_(email, 'Replied: ' + outcome.snippet); ctx.dnc[email] = true; }
      log_('Opted out', email, outcome.snippet);
    } else {
      set_(t, r, COL.status, STATUS.replied);
      colour_(t, r, ROW_COLOURS.replied);
      note_(t, r, 'Replied: "' + outcome.snippet + '"');
      log_('Replied', email, outcome.snippet);
    }
    changed++;
  }
  props.setProperty('replyCursor', '0');
  return changed;
}

function classifyThread_(thread, mine) {
  var messages = thread.getMessages();
  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    var from = String(m.getFrom() || '').toLowerCase();
    if (fromMe_(from, mine)) continue;
    if (BOUNCE_FROM_RE.test(from)) return { type: 'bounced' };
    if (isAutoReply_(m)) continue;
    var text = newText_(m.getPlainBody());
    var snippet = text.replace(/\s+/g, ' ').slice(0, 80);
    if (OPT_OUT_RE.test(text) || /^\s*(no|nope|stop)\W*$/i.test(text)) return { type: 'optout', snippet: snippet };
    return { type: 'reply', snippet: snippet };
  }
  return null;
}

function fromMe_(from, mine) {
  var match = from.match(/<([^>]+)>/);
  var addr = (match ? match[1] : from).trim();
  return mine.indexOf(addr) !== -1;
}

function myAddresses_() {
  var list = [String(Session.getEffectiveUser().getEmail() || '').toLowerCase()];
  try { GmailApp.getAliases().forEach(function (a) { list.push(String(a).toLowerCase()); }); } catch (e) { /* no aliases */ }
  return list.filter(function (x) { return !!x; });
}

function isAutoReply_(m) {
  function header(name) { try { return String(m.getHeader(name) || '').toLowerCase(); } catch (e) { return ''; } }
  var auto = header('Auto-Submitted');
  if (auto && auto !== 'no') return true;
  if (header('Precedence') === 'auto_reply' || header('X-Autoreply') === 'yes') return true;
  return AUTO_SUBJECT_RE.test(String(m.getSubject() || '').trim());
}

/** Keeps only the new part of a reply (drops quoted text and signatures). */
function newText_(body) {
  var lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var trimmed = lines[i].trim();
    if (/^>/.test(trimmed)) break;
    if (/^on\b.*\bwrote:$/i.test(trimmed)) break;
    if (/wrote:$/i.test(trimmed) && out.length && /^on\b/i.test(out[out.length - 1].trim())) { out.pop(); break; }
    if (/^-{2,}\s*original message\s*-{2,}$/i.test(trimmed) || /^_{5,}$/.test(trimmed) || trimmed === '--') break;
    if (/^(sent from my |get outlook for )/i.test(trimmed)) break;
    if (/^from:\s/i.test(trimmed) && out.length) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

// ------------------------------------------------------------------ Finding emails on websites

function needsLookup_(t, r) {
  return !str_(t, r, COL.email) && !!clean_(str_(t, r, COL.website)) && str_(t, r, COL.note).indexOf('Checked') !== 0;
}

function scanSite_(website, deadline) {
  var base = origin_(clean_(website));
  if (!base) return { best: '', summary: 'the website address looks wrong' };
  var host = domainOf_(base);
  if (robotsBlocksAll_(base)) return { best: '', summary: 'the site asks robots not to visit, so check it by hand' };
  var pages = ['', '/contact', '/contact-us', '/about', '/about-us'];
  var emails = [], seen = {}, text = '', loaded = 0;
  for (var i = 0; i < pages.length; i++) {
    if (deadline && Date.now() > deadline) break;
    var html = fetchText_(base + pages[i]);
    if (html === null) continue;
    loaded++;
    text += ' ' + html;
    extractEmails_(html).forEach(function (e) { if (!seen[e]) { seen[e] = true; emails.push(e); } });
    // Stop once there's a good address on the site's own domain (not jobs@, accounts@ and so on).
    if (emails.some(function (e) { return sameSite_(e, host) && !LOW_PRIORITY_RE.test(e); })) break;
  }
  if (!loaded) return { best: '', summary: 'could not load the website' };
  var own = emails.filter(function (e) { return sameSite_(e, host); });
  var candidates = own.length ? own : emails.filter(function (e) { return FREE_MAIL_RE.test(e.split('@')[1]); });
  var best = pickBest_(candidates);
  var summary = (emails.length ? 'found ' + emails.slice(0, 4).join(', ') : 'no email address on the site') + ' \u00b7 ' + companyHint_(text);
  return { best: best, summary: summary };
}

function origin_(url) {
  var u = String(url || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  var m = u.match(/^(https?:\/\/[^\/?#\s]+)/i);
  return m && m[1].indexOf('.') !== -1 ? m[1].toLowerCase() : '';
}

function domainOf_(url) {
  return String(url || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/[\/?#].*$/, '').toLowerCase();
}

function sameSite_(email, host) {
  var d = email.split('@')[1] || '';
  var h = host.replace(/^www\./, '');
  return d === h || d.slice(-(h.length + 1)) === '.' + h || h.slice(-(d.length + 1)) === '.' + d;
}

function fetchText_(url) {
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() >= 400) return null;
    var headers = res.getHeaders() || {};
    var type = String(headers['Content-Type'] || headers['content-type'] || '');
    if (type && !/html|text|xml/i.test(type)) return null;
    return res.getContentText().slice(0, 800000);
  } catch (e) {
    return null;
  }
}

function robotsBlocksAll_(base) {
  var txt = fetchText_(base + '/robots.txt');
  if (!txt) return false;
  var applies = false, blocked = false;
  txt.split(/\r?\n/).forEach(function (line) {
    var l = line.replace(/#.*/, '').trim();
    var m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) return;
    var key = m[1].toLowerCase(), value = m[2].trim();
    if (key === 'user-agent') applies = value === '*';
    else if (applies && key === 'disallow' && value === '/') blocked = true;
  });
  return blocked;
}

function extractEmails_(html) {
  var s = String(html)
    .replace(/&#0*64;|&#x0*40;|&commat;|%40/gi, '@')
    .replace(/\s*[\[\(\{]\s*at\s*[\]\)\}]\s*/gi, '@')
    .replace(/\s*[\[\(\{]\s*dot\s*[\]\)\}]\s*/gi, '.');
  var matches = s.match(/[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}/gi) || [];
  var out = [], seen = {};
  matches.forEach(function (raw) {
    var e = raw.toLowerCase().replace(/^(u00[0-9a-f]{2}|x22|x27)+/, '').replace(/^[._%+'-]+/, '');
    if (!EMAIL_RE.test(e)) return;
    if (/\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|json|mp4|webm|pdf|woff2?)$/i.test(e)) return;
    if (/@\d+x\./.test(e) || RESERVED_RE.test(e)) return;
    var domain = e.split('@')[1];
    if (/(^|\.)(sentry\.io|wixpress\.com|sentry-next\.wixpress\.com)$/.test(domain)) return;
    if (/@(domain|email|yourdomain|yoursite|mysite|website|company|godaddy|squarespace|shopify|wordpress)\./i.test(e)) return;
    if (/^(no-?reply|do-?not-?reply|donotreply|privacy|gdpr|dpo|abuse|postmaster|webmaster|hostmaster|mailer-daemon)@/i.test(e)) return;
    if (!seen[e]) { seen[e] = true; out.push(e); }
  });
  return out;
}

/** Prefers a named person, then a general contact address, then anything else. */
function pickBest_(list) {
  if (!list.length) return '';
  function score(e) { return LOW_PRIORITY_RE.test(e) ? 0 : CONTACT_RE.test(e) ? 1 : 2; }
  var best = list[0];
  list.forEach(function (e) { if (score(e) > score(best)) best = e; });
  return best;
}

function companyHint_(html) {
  var text = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');
  var num = text.match(/\b(?:company|registration|registered|reg\.?)\s*(?:no\.?|number|num\.?|#)\s*[:.]?\s*((?:SC|NI|OC|SO|NC|R0)?\d{6,8})\b/i) ||
    text.match(/\b(?:england|wales|scotland|northern ireland)\b[^.]{0,60}?\b(?:no\.?|number)\s*[:.]?\s*((?:SC|NI|OC|SO|NC|R0)?\d{6,8})\b/i);
  if (num) return 'company number ' + num[1].toUpperCase() + ' on the site: confirm on Companies House';
  if (/\b(ltd|limited|llp|plc)\b/i.test(text)) return '"Ltd" or "LLP" on the site: confirm on Companies House';
  if (/\b(inc|llc|corp)\b/i.test(text)) return 'looks like a US company (Inc or LLC)';
  return 'no company details found: check before emailing';
}

// ------------------------------------------------------------------ Sheet helpers

function ss_() { return SpreadsheetApp.getActive(); }
function tz_() { return ss_().getSpreadsheetTimeZone() || Session.getScriptTimeZone(); }

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { toast_('The autopilot is busy. Try again in a minute.'); return null; }
  try { return fn(); } finally { lock.releaseLock(); }
}

function table_() {
  var sh = ss_().getSheetByName(SHEET.prospects);
  if (!sh) throw new Error('There is no "' + SHEET.prospects + '" tab.');
  var values = sh.getDataRange().getValues();
  if (!values.length) throw new Error('The Prospects tab needs its header row.');
  var header = values[0].map(function (h) { return String(h).trim(); });
  var idx = {};
  header.forEach(function (h, i) { if (h && !idx.hasOwnProperty(h)) idx[h] = i; });
  var missing = Object.keys(COL).map(function (k) { return COL[k]; }).filter(function (c) { return !idx.hasOwnProperty(c); });
  if (missing.length) throw new Error('The Prospects tab is missing these columns: ' + missing.join(', '));
  var rows = [];
  for (var i = 1; i < values.length; i++) rows.push({ row: i + 1, v: values[i] });
  return { sh: sh, idx: idx, rows: rows, width: header.length };
}

function get_(t, r, col) { return r.v[t.idx[col]]; }
function str_(t, r, col) { var v = get_(t, r, col); return v === null || v === undefined ? '' : String(v).trim(); }
function set_(t, r, col, value) { r.v[t.idx[col]] = value; t.sh.getRange(r.row, t.idx[col] + 1).setValue(value); }
function setText_(t, r, col, value) { r.v[t.idx[col]] = value; t.sh.getRange(r.row, t.idx[col] + 1).setNumberFormat('@').setValue(value); }
function note_(t, r, text) { if (str_(t, r, COL.note) !== text) set_(t, r, COL.note, text); }
function colour_(t, r, colour) { t.sh.getRange(r.row, 1, 1, t.width).setBackground(colour); }

function settings_() {
  var sh = ss_().getSheetByName(SHEET.settings);
  if (!sh) throw new Error('There is no "' + SHEET.settings + '" tab.');
  var s = {};
  sh.getDataRange().getValues().forEach(function (r) {
    var k = String(r[0] || '').trim().toLowerCase();
    if (k) s[k] = r[1];
  });
  return s;
}
function setting_(s, key, fallback) { var v = s[String(key).toLowerCase()]; return v === '' || v === null || v === undefined ? fallback : v; }
function num_(s, key, fallback) { var n = Number(setting_(s, key, fallback)); return isFinite(n) ? n : fallback; }
function yes_(v) { return /^(y|yes|true|1)$/i.test(String(v === null || v === undefined ? '' : v).trim()); }
function unique_(list) { var seen = {}; return list.filter(function (x) { if (seen[x]) return false; seen[x] = true; return true; }); }

function context_(t) {
  var ctx = { dnc: dnc_(), contacted: {}, domains: {} };
  t.rows.forEach(function (r) {
    if (!str_(t, r, COL.firstSent)) return;
    var e = str_(t, r, COL.email).toLowerCase();
    if (!e) return;
    ctx.contacted[e] = true;
    var d = e.split('@')[1];
    if (d && !FREE_MAIL_RE.test(d)) ctx.domains[d] = true;
  });
  return ctx;
}

function dnc_() {
  var sh = ss_().getSheetByName(SHEET.dnc);
  var list = {};
  if (!sh) return list;
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    var v = String(values[i][0] || '').trim().toLowerCase();
    if (v.indexOf('@') !== -1) list[v] = true;
  }
  return list;
}

function blocked_(dnc, email) {
  var e = String(email || '').toLowerCase();
  var at = e.indexOf('@');
  return !!(dnc[e] || (at !== -1 && dnc[e.slice(at)]));
}

function addDnc_(email, reason) {
  var sh = ss_().getSheetByName(SHEET.dnc);
  if (sh) sh.appendRow([email, reason || '', new Date()]);
}

function threadById_(id) {
  if (!id) return null;
  try { return GmailApp.getThreadById(id); } catch (e) { return null; }
}

function log_(what, email, detail) {
  var sh = ss_().getSheetByName(SHEET.log);
  if (sh) sh.appendRow([new Date(), what, email || '', detail || '']);
}

function toast_(message) { try { ss_().toast(message, 'Outreach', 10); } catch (e) { /* no UI when run by a trigger */ } }

function removeTriggers_() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'autopilot') { ScriptApp.deleteTrigger(tr); n++; }
  });
  return n;
}

// ------------------------------------------------------------------ Time and counters

function nowParts_() {
  var d = new Date(), tz = tz_();
  return {
    day: Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
    hour: Number(Utilities.formatDate(d, tz, 'H')),
    weekday: Number(Utilities.formatDate(d, tz, 'u')), // 1 = Monday ... 7 = Sunday
  };
}

/** Days since a date cell. Returns -1 when the cell is empty or not a date. */
function daysSince_(v) {
  if (v === '' || v === null || v === undefined) return -1;
  var time = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return isFinite(time) ? (Date.now() - time) / 86400000 : -1;
}

function sentToday_() {
  return Number(PropertiesService.getScriptProperties().getProperty('sent:' + nowParts_().day) || 0);
}

function bumpSent_() {
  var props = PropertiesService.getScriptProperties();
  var key = 'sent:' + nowParts_().day;
  props.setProperty(key, String(Number(props.getProperty(key) || 0) + 1));
}

function tidyCounters_() {
  var props = PropertiesService.getScriptProperties();
  var keep = 'sent:' + nowParts_().day;
  Object.keys(props.getProperties()).forEach(function (k) { if (k.indexOf('sent:') === 0 && k !== keep) props.deleteProperty(k); });
}

// ------------------------------------------------------------------ Dashboard

function dashboard_(t) {
  var sh = ss_().getSheetByName(SHEET.dashboard);
  if (!sh) return;
  var contacted = 0, inSequence = 0, optedOut = 0, bounced = 0, noReply = 0, skipped = 0, notSent = 0;
  t.rows.forEach(function (r) {
    var st = str_(t, r, COL.status);
    if (st === STATUS.skipped) { skipped++; return; }
    if (!str_(t, r, COL.firstSent)) {
      if (str_(t, r, COL.email) || str_(t, r, COL.website)) notSent++;
      return;
    }
    contacted++;
    if (st === STATUS.sent) inSequence++;
    else if (st === STATUS.optedOut) optedOut++;
    else if (st === STATUS.bounced) bounced++;
    else if (st === STATUS.noReply) noReply++;
  });
  var replied = contacted - inSequence - optedOut - bounced - noReply;
  var rows = [
    ['Outreach dashboard', ''],
    ['Updated', new Date()],
    ['Emails sent today (follow-ups included)', sentToday_()],
    ['Prospects contacted', contacted],
    ['Waiting for a reply', inSequence],
    ['Replied (including statuses you set)', replied],
    ['Opted out', optedOut],
    ['Bounced', bounced],
    ['No reply after follow-ups', noReply],
    ['Skipped (duplicates, do-not-contact)', skipped],
    ['Not sent yet', notSent],
    ['Reply rate', contacted ? replied / contacted : 0],
    ['Opt-out rate', contacted ? optedOut / contacted : 0],
    ['Bounce rate', contacted ? bounced / contacted : 0],
  ];
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(2, 2).setNumberFormat('d mmm yyyy, hh:mm');
  sh.getRange(12, 2, 3, 1).setNumberFormat('0.0%');
}
