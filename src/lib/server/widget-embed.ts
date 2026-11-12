import { GOALS } from '../engine/catalog';
import { widgetCopy, type Widget } from './widget';

/**
 * The lead widget as agencies' visitors see it: one self-contained HTML page
 * (inline CSS and vanilla JS, no framework bundle) that loads fast inside an
 * iframe on any website. Every agency-supplied string is HTML-escaped here, and
 * the script only ever writes report text with textContent.
 */

export type EmbedBrand = { name: string; color: string; logoUrl: string | null; whiteLabel: boolean };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** JSON that is safe inside a <script> element. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const DEFAULT_ACCENT = '#15803d';
const accentOf = (color: string) => (/^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : DEFAULT_ACCENT);
/** The accent mixed 12% into white, for tinted backgrounds and focus rings (no color-mix, for older browsers). */
export function softOf(accent: string): string {
  const mix = (i: number) => Math.round(255 + (parseInt(accent.slice(i, i + 2), 16) - 255) * 0.12).toString(16).padStart(2, '0');
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}

/** frame-ancestors for a widget: our own app (for the preview) plus the agency's sites, or anywhere if it has not listed any. */
export function frameAncestors(hosts: string[]): string {
  if (!hosts.length) return "'self' *";
  const sources = new Set<string>(["'self'"]);
  for (const host of hosts) {
    sources.add(`https://${host}`);
    // People type "agency.co.uk" and mean the www site too, and the other way round.
    if (!host.startsWith('*.')) sources.add(`https://${host.startsWith('www.') ? host.slice(4) : `www.${host}`}`);
  }
  return [...sources].join(' ');
}

export function embedCsp(nonce: string, ancestors: string, https: boolean): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "connect-src 'self'",
    "form-action 'none'",
    "base-uri 'none'",
    `frame-ancestors ${ancestors}`,
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export const embedHeaders = (csp: string): Record<string, string> => ({
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': csp,
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
});

const STYLES = `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;background:transparent}
body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#18181b;-webkit-font-smoothing:antialiased}
.pg{max-width:640px;margin:0 auto;padding:4px}
.card{background:#fff;border:1px solid #e4e4e7;border-radius:14px;box-shadow:0 1px 2px rgb(16 24 20/.05),0 8px 24px -12px rgb(16 24 20/.12);padding:24px}
@media (max-width:480px){.card{padding:18px}}
.brand{display:flex;align-items:center;gap:10px;min-height:28px;margin-bottom:16px}
.brand img{max-height:36px;max-width:180px;object-fit:contain}
.brand span{font-weight:650;font-size:15px}
h1{font-size:22px;line-height:1.25;letter-spacing:-.01em;margin:0 0 6px}
h2{font-size:16px;line-height:1.3;margin:0 0 4px}
p{margin:0}
.muted{color:#52525b}
.small{font-size:12.5px;color:#71717a}
form{margin-top:18px;display:grid;gap:14px}
.row{display:grid;gap:14px;grid-template-columns:1fr 1fr}
@media (max-width:480px){.row{grid-template-columns:1fr}}
label{display:block;font-size:13.5px;font-weight:550;color:#27272a;margin-bottom:5px}
input,select{width:100%;height:44px;border:1px solid #d4d4d8;border-radius:9px;background:#fff;padding:0 12px;font:inherit;color:inherit}
select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,#71717a 50%),linear-gradient(135deg,#71717a 50%,transparent 50%);background-position:calc(100% - 17px) 19px,calc(100% - 12px) 19px;background-size:5px 5px;background-repeat:no-repeat;padding-right:32px}
input:focus,select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--soft)}
input[aria-invalid=true]{border-color:#dc2626}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 20px;border:0;border-radius:10px;background:var(--accent);color:#fff;font:inherit;font-weight:600;cursor:pointer;text-decoration:none}
.btn:hover{filter:brightness(.93)}
.btn:disabled{opacity:.6;cursor:wait}
.btn.block{width:100%}
.link{background:none;border:0;padding:0;font:inherit;color:var(--accent);font-weight:550;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.error{border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:9px;padding:10px 12px;font-size:14px}
.field-error{color:#dc2626;font-size:13px;margin-top:5px}
.notice{font-size:12.5px;color:#71717a}
.notice a{color:inherit}
.run{display:flex;align-items:center;gap:14px}
.spin{width:22px;height:22px;border-radius:50%;border:3px solid var(--soft);border-top-color:var(--accent);animation:spin .8s linear infinite;flex:none}
@keyframes spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.spin{animation-duration:3s}}
.timer{margin-left:auto;font:13px ui-monospace,SFMono-Regular,Menlo,monospace;color:#71717a}
.head{display:flex;gap:18px;align-items:center}
@media (max-width:480px){.head{flex-direction:column;text-align:center}}
.ring{flex:none;width:96px;height:96px;position:relative}
.ring svg{width:96px;height:96px;transform:rotate(-90deg)}
.ring b{position:absolute;inset:0;display:grid;place-items:center;font-size:28px;font-weight:700;letter-spacing:-.02em}
.track{stroke:#f4f4f5}
.good{stroke:#16a34a;color:#15803d}.ok{stroke:#d97706;color:#b45309}.poor{stroke:#ea580c;color:#c2410c}.bad{stroke:#dc2626;color:#b91c1c}
.bars{display:grid;gap:9px;margin-top:6px}
.bar-label{display:flex;justify-content:space-between;font-size:13px;color:#3f3f46}
.bar{height:6px;border-radius:9px;background:#f4f4f5;overflow:hidden;margin-top:4px}
.bar i{display:block;height:100%;border-radius:9px;background:currentColor}
.section{margin-top:20px;padding-top:18px;border-top:1px solid #f4f4f5}
ol{list-style:none;padding:0;margin:10px 0 0;display:grid;gap:12px}
li{display:flex;gap:10px}
.num{flex:none;width:24px;height:24px;border-radius:50%;background:#f4f4f5;display:grid;place-items:center;font-size:12px;font-weight:650;color:#52525b}
.chip{display:inline-block;font-size:11.5px;font-weight:600;border-radius:6px;padding:1px 7px;margin-right:6px}
.chip.critical{background:#fef2f2;color:#b91c1c}.chip.major{background:#fffbeb;color:#b45309}.chip.minor{background:#f4f4f5;color:#52525b}
.cta{margin-top:20px;border-radius:12px;background:var(--soft);padding:18px}
.cta .btn{margin-top:12px}
.mt{margin-top:14px}
h2[tabindex="-1"]:focus{outline:none}
.foot{text-align:center;margin-top:10px;font-size:12px;color:#a1a1aa}
.foot a{color:inherit}
[hidden]{display:none!important}
`;

/** Runs in the iframe. Talks only to our own API; report text is set with textContent, never as HTML. */
const SCRIPT = `
(function () {
  var cfg = JSON.parse(document.getElementById('pg-config').textContent);
  var $ = function (id) { return document.getElementById(id); };
  var VIEWS = ['pg-form-view', 'pg-run-view', 'pg-result-view', 'pg-fail-view'];
  var STORE = 'pagegrade-audit-' + cfg.id;
  var STAGES = { starting: 'Opening the page', 'capture-desktop': 'Loading the page on a desktop screen', 'capture-desktop-retry': 'The page was still changing, taking a slower look', 'capture-mobile': 'Loading the page on a phone', analyse: 'Running the checks', write: 'Summing up', finalise: 'Scoring the page' };
  var SEVERITY = { critical: 'Critical', major: 'Major', minor: 'Minor' };
  var lastHeight = 0;
  function resize() {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (h === lastHeight) return;
    lastHeight = h;
    try { parent.postMessage({ type: 'pagegrade:resize', id: cfg.id, height: h }, '*'); } catch (e) {}
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(document.body);
  window.addEventListener('load', resize);
  // A parent that started listening after our first message (the in-app preview hydrates late) asks again.
  window.addEventListener('message', function (e) { if (e.data && e.data.type === 'pagegrade:measure') { lastHeight = 0; resize(); } });
  function show(id) {
    VIEWS.forEach(function (v) { $(v).hidden = v !== id; });
    resize();
    if (id !== 'pg-form-view') { var h = $(id).querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) {} } }
  }
  function save(v) { try { if (v) sessionStorage.setItem(STORE, JSON.stringify(v)); else sessionStorage.removeItem(STORE); } catch (e) {} }
  function restore() { try { return JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch (e) { return null; } }
  function hostOf(u) { try { var x = new URL(/^https?:\\/\\//i.test(u) ? u : 'https://' + u); return (x.hostname.replace(/^www\\./, '') + (x.pathname === '/' ? '' : x.pathname)).slice(0, 80); } catch (e) { return u.slice(0, 80); } }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function tone(s) { return s >= 80 ? 'good' : s >= 60 ? 'ok' : s >= 40 ? 'poor' : 'bad'; }

  var form = $('pg-form'), btn = $('pg-submit'), formError = $('pg-error');
  function fieldError(name, message) {
    ['url', 'email', 'name'].forEach(function (f) {
      var input = form.elements[f], note = $('pg-' + f + '-error');
      var on = f === name && message;
      if (input) input.setAttribute('aria-invalid', on ? 'true' : 'false');
      if (note) { note.textContent = on ? message : ''; note.hidden = !on; }
    });
  }
  function fail(message, field) {
    fieldError(field, message);
    formError.textContent = field === 'url' || field === 'email' || field === 'name' ? '' : message;
    formError.hidden = !formError.textContent;
    if (field && form.elements[field]) form.elements[field].focus();
    resize();
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = { url: form.elements.url.value.trim(), goal: form.elements.goal.value, name: form.elements.name.value.trim(), email: form.elements.email.value.trim(), hp: form.elements.company_site.value, source: document.referrer || '' };
    if (!data.url) return fail('Enter the address of the page you want checked.', 'url');
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(data.email)) return fail('Enter your email address, so we can send you the results.', 'email');
    fail('', null);
    btn.disabled = true;
    btn.textContent = 'Starting…';
    fetch(cfg.api + '/audits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify(data) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (body) { if (!res.ok) throw body; return body; }); })
      .then(function (body) {
        var audit = { id: body.id, key: body.key, host: hostOf(data.url), started: Date.now() };
        save(audit);
        run(audit);
      })
      .catch(function (body) { fail(body && body.error ? String(body.error) : 'Could not start the check. Please try again.', body && body.field); })
      .then(function () { btn.disabled = false; btn.textContent = cfg.button; });
  });

  var ticker = null;
  function run(audit) {
    $('pg-run-host').textContent = audit.host;
    $('pg-run-stage').textContent = 'Starting';
    show('pg-run-view');
    clearInterval(ticker);
    var tick = function () { var s = Math.max(0, Math.round((Date.now() - audit.started) / 1000)); $('pg-timer').textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };
    tick();
    ticker = setInterval(tick, 1000);
    var delay = 2000;
    var poll = function () {
      fetch(cfg.api + '/audits/' + encodeURIComponent(audit.id), { headers: { 'X-Widget-Key': audit.key }, credentials: 'omit', cache: 'no-store' })
        .then(function (res) { if (res.status === 404) throw { gone: true }; if (!res.ok) throw {}; return res.json(); })
        .then(function (v) {
          delay = 2000;
          if (v.status === 'complete' && v.result) { clearInterval(ticker); result(v, audit); return; }
          if (v.status === 'failed') { clearInterval(ticker); $('pg-fail-text').textContent = v.errorMessage || 'The page did not load for us.'; show('pg-fail-view'); return; }
          $('pg-run-stage').textContent = v.status === 'queued' ? 'Waiting for a free browser' + (v.queuePosition ? ' · position ' + v.queuePosition : '') : (STAGES[v.stage] || 'Working on it');
          setTimeout(poll, document.hidden ? 6000 : delay);
        })
        .catch(function (err) {
          if (err && err.gone) { clearInterval(ticker); save(null); show('pg-form-view'); return; }
          delay = Math.min(delay * 2, 15000);
          setTimeout(poll, delay);
        });
    };
    setTimeout(poll, 1500);
  }

  function ring(score) {
    var NS = 'http://www.w3.org/2000/svg', r = 42, c = 2 * Math.PI * r;
    var wrap = el('div', 'ring ' + tone(score)), svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 96 96');
    svg.setAttribute('aria-hidden', 'true');
    [['track', c], [tone(score), c * Math.max(0, Math.min(100, score)) / 100]].forEach(function (p) {
      var circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', '48'); circle.setAttribute('cy', '48'); circle.setAttribute('r', String(r));
      circle.setAttribute('fill', 'none'); circle.setAttribute('stroke-width', '8'); circle.setAttribute('stroke-linecap', 'round');
      circle.setAttribute('class', p[0]);
      circle.setAttribute('stroke-dasharray', p[1] + ' ' + c);
      svg.appendChild(circle);
    });
    wrap.appendChild(svg);
    wrap.appendChild(el('b', null, String(score)));
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', 'Score ' + score + ' out of 100');
    return wrap;
  }

  function result(v, audit) {
    var r = v.result, box = $('pg-result');
    box.textContent = '';
    var head = el('div', 'head');
    head.appendChild(ring(r.score));
    var text = el('div');
    text.appendChild(el('p', 'small', audit.host));
    text.appendChild(el('h2', null, r.verdict));
    text.appendChild(el('p', 'muted', r.summary));
    head.appendChild(text);
    box.appendChild(head);

    var areas = el('div', 'section');
    areas.appendChild(el('h2', null, 'Score by area'));
    var bars = el('div', 'bars');
    r.categories.forEach(function (c) {
      var row = el('div'), label = el('div', 'bar-label');
      label.appendChild(el('span', null, c.label));
      label.appendChild(el('span', null, c.score == null ? '–' : String(c.score)));
      var bar = el('div', 'bar ' + (c.score == null ? '' : tone(c.score))), fill = el('i');
      fill.style.width = (c.score == null ? 0 : Math.max(2, c.score)) + '%';
      bar.appendChild(fill);
      row.appendChild(label);
      row.appendChild(bar);
      bars.appendChild(row);
    });
    areas.appendChild(bars);
    box.appendChild(areas);

    var issues = el('div', 'section');
    issues.appendChild(el('h2', null, r.topIssues.length ? 'The biggest problems' : 'No major problems found'));
    if (r.topIssues.length) {
      var list = el('ol');
      r.topIssues.forEach(function (issue, i) {
        var item = el('li'), body = el('div');
        item.appendChild(el('span', 'num', String(i + 1)));
        body.appendChild(el('p', null, issue.title));
        var meta = el('p', 'small');
        meta.appendChild(el('span', 'chip ' + (SEVERITY[issue.severity] ? issue.severity : 'minor'), SEVERITY[issue.severity] || issue.severity));
        meta.appendChild(document.createTextNode('How to fix it is in the full report'));
        body.appendChild(meta);
        item.appendChild(body);
        list.appendChild(item);
      });
      issues.appendChild(list);
    }
    var more = r.issueCount - r.topIssues.length;
    if (more > 0) issues.appendChild(el('p', 'small', '+ ' + more + ' more issue' + (more === 1 ? '' : 's') + ' in the full report'));
    box.appendChild(issues);
    show('pg-result-view');
  }

  $('pg-again').addEventListener('click', reset);
  $('pg-retry').addEventListener('click', reset);
  function reset() { save(null); form.elements.url.value = ''; show('pg-form-view'); form.elements.url.focus(); }

  var saved = restore();
  if (saved && saved.id && saved.key) run(saved); else show('pg-form-view');
})();
`;

export type EmbedPage = { widget: Widget; brand: EmbedBrand | null; nonce: string; appUrl: string };

export function embedHtml({ widget, brand, nonce, appUrl }: EmbedPage): string {
  const copy = widgetCopy(widget);
  const accent = accentOf(brand?.color ?? '');
  const who = brand?.name || 'The owner of this website';
  const whiteLabel = !!brand?.whiteLabel;
  const goals = Object.entries(GOALS).map(([id, g]) => `<option value="${esc(id)}"${id === 'lead' ? ' selected' : ''}>${esc(g.label)}</option>`).join('');
  const logo = brand?.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.name || 'Logo')}">`
    : brand?.name ? `<span>${esc(brand.name)}</span>` : '';
  const cta = widget.ctaUrl
    ? `<a class="btn" href="${esc(widget.ctaUrl)}" target="_blank" rel="noopener">${esc(copy.ctaLabel)}</a>`
    : '';
  const privacy = widget.privacyUrl ? ` <a href="${esc(widget.privacyUrl)}" target="_blank" rel="noopener">Privacy policy</a>.` : '';
  const config = { id: widget.id, api: `/api/embed/${widget.id}`, button: copy.buttonLabel };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(copy.headline)}</title>
<style nonce="${nonce}">:root{--accent:${accent};--soft:${softOf(accent)}}${STYLES}</style>
</head><body>
<main class="pg">
<div class="card">
${logo ? `<div class="brand">${logo}</div>` : ''}
<section id="pg-form-view">
  <h1>${esc(copy.headline)}</h1>
  <p class="muted">${esc(copy.intro)}</p>
  <form id="pg-form" novalidate>
    <div>
      <label for="pg-url">Your website</label>
      <input id="pg-url" name="url" inputmode="url" autocomplete="url" placeholder="yourbusiness.co.uk" maxlength="2048" required aria-describedby="pg-url-error">
      <p id="pg-url-error" class="field-error" hidden></p>
    </div>
    <div>
      <label for="pg-goal">What should visitors do on that page?</label>
      <select id="pg-goal" name="goal">${goals}</select>
    </div>
    <div class="row">
      <div><label for="pg-name">Your name</label><input id="pg-name" name="name" autocomplete="name" maxlength="80"><p id="pg-name-error" class="field-error" hidden></p></div>
      <div><label for="pg-email">Your email</label><input id="pg-email" name="email" type="email" autocomplete="email" maxlength="254" required aria-describedby="pg-email-error"><p id="pg-email-error" class="field-error" hidden></p></div>
    </div>
    <div class="hp" aria-hidden="true"><label for="pg-company-site">Leave this empty</label><input id="pg-company-site" name="company_site" tabindex="-1" autocomplete="off"></div>
    <p id="pg-error" class="error" role="alert" hidden></p>
    <button id="pg-submit" class="btn block" type="submit">${esc(copy.buttonLabel)}</button>
    <p class="notice">Free, in about a minute. ${esc(who)} will get your name, email and page address with the full report, and may contact you about it.${privacy}</p>
  </form>
</section>
<section id="pg-run-view" hidden aria-live="polite">
  <div class="run"><span class="spin" aria-hidden="true"></span><div><h2>Checking <span id="pg-run-host"></span></h2><p id="pg-run-stage" class="small">Starting</p></div><span id="pg-timer" class="timer">0:00</span></div>
  <p class="small mt">Most checks take about a minute. We open the page in a real browser, on a desktop screen and on a phone.</p>
</section>
<section id="pg-result-view" hidden>
  <div id="pg-result"></div>
  <div class="cta">
    <h2>Want the fixes?</h2>
    <p class="muted">${esc(who)} has the full report for this page: every problem with a step-by-step fix, rewritten headlines and buttons, and annotated screenshots.${cta ? '' : ' Expect to hear from them soon.'}</p>
    ${cta}
  </div>
  <p class="small mt"><button id="pg-again" class="link" type="button">Check another page</button></p>
</section>
<section id="pg-fail-view" hidden>
  <h2>We could not check that page</h2>
  <p id="pg-fail-text" class="muted"></p>
  <p class="mt"><button id="pg-retry" class="btn" type="button">Try another page</button></p>
</section>
<noscript><p class="error">Turn on JavaScript to run the free website check.</p></noscript>
</div>
${whiteLabel ? '' : `<p class="foot">Website check by <a href="${esc(appUrl)}/" target="_blank" rel="noopener">PageGrade</a></p>`}
</main>
<script type="application/json" id="pg-config">${scriptJson(config)}</script>
<script nonce="${nonce}">${SCRIPT}</script>
</body></html>`;
}

/** Shown when a widget does not exist, is switched off, or its owner's plan no longer includes it. */
export function unavailableHtml(nonce: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Website check unavailable</title>
<style nonce="${nonce}">:root{--accent:${DEFAULT_ACCENT};--soft:${softOf(DEFAULT_ACCENT)}}${STYLES}</style></head>
<body><main class="pg"><div class="card"><h2>This website check is not available right now</h2><p class="muted">Please get in touch with the owner of this website directly.</p></div></main></body></html>`;
}

/**
 * /embed.js: finds every element with data-pagegrade-widget="w_…" and puts the widget
 * in it as an iframe that grows and shrinks with its content.
 */
export function loaderScript(appUrl: string): string {
  return `/* PageGrade lead widget loader */
(function () {
  var script = document.currentScript;
  var base = ${JSON.stringify(appUrl)};
  try { if (script && script.src) base = new URL(script.src).origin; } catch (e) {}
  var frames = [];
  function mount() {
    var nodes = document.querySelectorAll('[data-pagegrade-widget]');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i], id = node.getAttribute('data-pagegrade-widget') || '';
      if (node.getAttribute('data-pagegrade-mounted') || !/^w_[A-Za-z0-9_-]{10,30}$/.test(id)) continue;
      node.setAttribute('data-pagegrade-mounted', '1');
      var frame = document.createElement('iframe');
      frame.src = base + '/embed/' + id;
      frame.title = node.getAttribute('data-title') || 'Free website check';
      frame.setAttribute('loading', 'lazy');
      frame.style.cssText = 'display:block;width:100%;max-width:640px;height:560px;border:0;margin:0 auto;background:transparent;color-scheme:light;overflow:hidden';
      node.appendChild(frame);
      frames.push(frame);
    }
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== base || !e.data || e.data.type !== 'pagegrade:resize') return;
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) frames[i].style.height = Math.max(200, Math.min(4000, Number(e.data.height) || 0)) + 'px';
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
`;
}
