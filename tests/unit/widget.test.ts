import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, now } from '@/lib/server/db';
import { createUser, findUserById, updateUser, type User, type UserFields } from '@/lib/server/users';
import { claimNextReview, completeReview, createReviews, failReview, listReviews, listScoreHistory, usageFor } from '@/lib/server/reviews';
import {
  MAX_ALLOWED_HOSTS, WIDGET_INFLIGHT_MAX, cleanLink, deleteWidgetLead, ensureWidget, listWidgetLeads, notifyWidgetLead, parseAllowedHosts, publicWidget,
  setWidgetLeadStatus, startWidgetAudit, updateWidget, visitorMessage, widgetAuditView, widgetLeadCounts, widgetLeadsCsv, widgetLimit, widgetUsage, type NewWidgetAudit,
} from '@/lib/server/widget';
import { embedCsp, embedHtml, frameAncestors, loaderScript, softOf } from '@/lib/server/widget-embed';
import { WIDGET_AUDITS } from '@/lib/plans';
import raw from '@/content/sample/report.json';
import type { Report } from '@/lib/engine/report';

const REPORT = raw as unknown as Report;

// Page addresses are checked with a DNS lookup; every test host is public.
vi.mock('node:dns/promises', () => ({ lookup: async () => [{ address: '93.184.216.34', family: 4 }] }));

let seq = 0;
function newUser(fields: UserFields = {}): User {
  const user = createUser({ email: `widget${++seq}@example.com`, name: 'Test', passwordHash: 'x' });
  if (Object.keys(fields).length) updateUser(user.id, fields);
  return findUserById(user.id)!;
}
const agency = (fields: UserFields = {}) => newUser({ plan: 'agency', plan_status: 'active', ...fields });
const visitor = (fields: Partial<NewWidgetAudit> = {}): NewWidgetAudit => ({ url: `https://lead${++seq}.example.com/`, goal: 'lead', name: 'Sam Lead', email: `sam${seq}@example.org`, source: 'https://agency.example.com/audit', ...fields });

function start(owner: User, fields: Partial<NewWidgetAudit> = {}) {
  const widget = ensureWidget(owner.id);
  return { widget, ...startWidgetAudit(widget, owner, visitor(fields)) };
}
/** Pretends the worker picked the review up, without depending on what else is queued. */
function run(reviewId: string, worker = 'test-worker') {
  db().prepare("UPDATE reviews SET status = 'running', locked_by = ?, lease_until = ?, attempts = attempts + 1 WHERE id = ?").run(worker, now() + 60_000, reviewId);
  return worker;
}
const finish = (reviewId: string) => completeReview(reviewId, run(reviewId), REPORT, 1000);
/** Takes every queued review out of the way, so a queue test sees only its own. */
const clearQueue = () => db().prepare("UPDATE reviews SET status = 'failed', error_code = 'test' WHERE status IN ('queued', 'running')").run();

describe('lead widget: who gets it', () => {
  it('is an Agency feature with its own monthly allowance', () => {
    expect(widgetLimit(newUser())).toBe(0);
    expect(widgetLimit(newUser({ plan: 'starter', plan_status: 'active' }))).toBe(0);
    expect(widgetLimit(newUser({ plan: 'pro', plan_status: 'active' }))).toBe(0);
    expect(widgetLimit(agency())).toBe(WIDGET_AUDITS);
    expect(widgetLimit(agency({ plan_status: 'canceled' }))).toBe(0);
    expect(widgetLimit(newUser(), { admin: true })).toBe(WIDGET_AUDITS);
  });

  it('is public only while switched on and while the owner is entitled to it', () => {
    const owner = agency();
    const widget = ensureWidget(owner.id);
    expect(publicWidget(widget.id)?.owner.id).toBe(owner.id);
    updateWidget(owner.id, { active: false });
    expect(publicWidget(widget.id)).toBeNull();
    updateWidget(owner.id, { active: true });
    updateUser(owner.id, { plan_status: 'canceled' });
    expect(publicWidget(widget.id)).toBeNull();
    expect(publicWidget('w_does-not-exist')).toBeNull();
    expect(publicWidget('../../etc')).toBeNull();
  });

  it('works for admins on any plan (the founder demoing it)', () => {
    const admin = createUser({ email: 'admin@example.com', name: 'Admin', passwordHash: 'x' });
    const widget = ensureWidget(admin.id);
    expect(publicWidget(widget.id)).toMatchObject({ admin: true });
  });
});

describe('lead widget: settings', () => {
  it('creates one widget per account, with a public id', () => {
    const owner = agency();
    const a = ensureWidget(owner.id);
    expect(a.id).toMatch(/^w_[A-Za-z0-9_-]{12}$/);
    expect(ensureWidget(owner.id).id).toBe(a.id);
    expect(a).toMatchObject({ active: true, notify: true, allowedHosts: [], ctaUrl: '' });
  });

  it('keeps text on one line and within limits', () => {
    const owner = agency();
    expect(updateWidget(owner.id, { headline: '  Free\nwebsite   check  ', buttonLabel: 'Go' })).toMatchObject({ headline: 'Free website check', buttonLabel: 'Go' });
    expect(() => updateWidget(owner.id, { buttonLabel: 'x'.repeat(33) })).toThrow(expect.objectContaining({ status: 400, extra: { field: 'buttonLabel' } }));
  });

  it('accepts web links and mailto: for the call to action, and nothing else', () => {
    expect(cleanLink('agency.co.uk/contact', 'ctaUrl', { mailto: true })).toBe('https://agency.co.uk/contact');
    expect(cleanLink('mailto:hello@agency.co.uk', 'ctaUrl', { mailto: true })).toBe('mailto:hello@agency.co.uk');
    expect(cleanLink('', 'ctaUrl')).toBe('');
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'mailto:nobody', 'localhost/x', 'https://user:pw@agency.co.uk']) {
      expect(() => cleanLink(bad, 'ctaUrl', { mailto: true }), bad).toThrow();
    }
    expect(() => cleanLink('mailto:hello@agency.co.uk', 'privacyUrl')).toThrow();
  });

  it('reads the allowed websites from addresses or hostnames', () => {
    expect(parseAllowedHosts('https://www.Agency.co.uk/audit, agency.co.uk\n*.agency.co.uk  agency.co.uk')).toEqual(['www.agency.co.uk', 'agency.co.uk', '*.agency.co.uk']);
    expect(parseAllowedHosts('  ')).toEqual([]);
    for (const bad of ['localhost', '127.0.0.1', 'ftp://agency.co.uk', 'agency.co.uk:8080', 'not a site', '*.']) {
      expect(() => parseAllowedHosts(bad), bad).toThrow(expect.objectContaining({ extra: { field: 'allowedHosts' } }));
    }
    expect(() => parseAllowedHosts(Array.from({ length: MAX_ALLOWED_HOSTS + 1 }, (_, i) => `site${i}.co.uk`).join(' '))).toThrow();
    expect(updateWidget(agency().id, { allowedHosts: 'agency.co.uk' }).allowedHosts).toEqual(['agency.co.uk']);
  });
});

describe('lead widget: audits', () => {
  it('queues a review owned by the agency and records the lead', () => {
    const owner = agency();
    const { widget, leadId, reviewId, key } = start(owner, { name: 'Ana\nRivera', email: 'ana@example.org' });
    const review = db().prepare('SELECT user_id, origin, status, page_type, goal FROM reviews WHERE id = ?').get(reviewId);
    expect(review).toEqual({ user_id: owner.id, origin: 'widget', status: 'queued', page_type: 'other', goal: 'lead' });
    const lead = db().prepare('SELECT widget_id, name, email, key_hash FROM widget_leads WHERE id = ?').get(leadId) as Record<string, string>;
    expect(lead).toMatchObject({ widget_id: widget.id, name: 'Ana Rivera', email: 'ana@example.org' });
    expect(lead.key_hash).not.toBe(key);
  });

  it("shows the visitor progress, then the score and problems but never the fixes, and only to the visitor's browser", () => {
    const owner = agency();
    const { widget, leadId, reviewId, key } = start(owner);
    expect(widgetAuditView(widget.id, leadId, 'x'.repeat(32))).toBeNull();
    expect(widgetAuditView(ensureWidget(agency().id).id, leadId, key)).toBeNull();
    expect(widgetAuditView(widget.id, leadId, null)).toBeNull();
    expect(widgetAuditView(widget.id, leadId, key)).toMatchObject({ status: 'queued', result: null, errorMessage: null });
    expect(widgetAuditView(widget.id, leadId, key)!.queuePosition).toBeGreaterThanOrEqual(1);

    expect(finish(reviewId)).toBe(true);
    const view = widgetAuditView(widget.id, leadId, key)!;
    expect(view.status).toBe('complete');
    expect(view.result).toMatchObject({ score: REPORT.score, grade: REPORT.grade, issueCount: REPORT.issues.length });
    expect(view.result!.topIssues.length).toBeLessThanOrEqual(3);
    const body = JSON.stringify(view);
    expect(body).not.toContain(REPORT.issues[0].recommendation);
    expect(body).not.toContain('"example"');
  });

  it('tells the visitor why a check failed, in words meant for them', () => {
    const owner = agency();
    const { widget, leadId, reviewId, key } = start(owner);
    failReview(reviewId, run(reviewId), 'analysis-failed', 'Our analysis service is temporarily unavailable, so this review could not be completed. You have not been charged.');
    expect(widgetAuditView(widget.id, leadId, key)).toMatchObject({ status: 'failed', errorMessage: 'Our analysis service is temporarily unavailable, so this check could not be completed.', result: null });
    expect(visitorMessage('The page did not load.')).toBe('The page did not load.');
    expect(visitorMessage('You have not been charged.')).toBe('The page could not be checked.');
    expect(visitorMessage(null)).toBe('The page could not be checked.');
  });

  it('never uses the review allowance and stays out of the account history', () => {
    const owner = agency();
    const { reviewId } = start(owner);
    finish(reviewId);
    expect(usageFor(findUserById(owner.id)!).used).toBe(0);
    expect(listReviews(owner.id).map((r) => r.id)).not.toContain(reviewId);
    expect(listScoreHistory(owner.id).map((r) => r.id)).not.toContain(reviewId);
  });

  it('caps audits running at once, so a burst cannot fill the queue', () => {
    const owner = agency();
    for (let i = 0; i < WIDGET_INFLIGHT_MAX; i++) start(owner);
    expect(() => start(owner)).toThrow(expect.objectContaining({ status: 503, code: 'widget_busy' }));
  });

  it('pauses at the monthly allowance, not counting failed checks', () => {
    const owner = agency({ period_start: now() - 24 * 3600_000, period_end: now() + 29 * 24 * 3600_000 });
    const insert = db().prepare("INSERT INTO reviews (id, user_id, url, page_type, goal, audience, status, origin, created_at) VALUES (?, ?, 'https://x.example.com/', 'other', 'lead', 'a', ?, 'widget', ?)");
    for (let i = 0; i < WIDGET_AUDITS - 1; i++) insert.run(`quota-${owner.id}-${i}`, owner.id, 'complete', now());
    insert.run(`quota-${owner.id}-failed`, owner.id, 'failed', now());
    expect(widgetUsage(owner)).toMatchObject({ used: WIDGET_AUDITS - 1, remaining: 1 });
    start(owner);
    expect(() => start(owner)).toThrow(expect.objectContaining({ status: 429, code: 'widget_quota' }));
  });

  it("puts a paying agency's visitor first in the queue, because they are waiting on the agency's website", () => {
    clearQueue();
    const owner = agency();
    const other = newUser({ plan: 'pro', plan_status: 'active' });
    const intake = (n: number) => ({ url: `https://client.example.com/${n}`, pageType: 'service' as const, goal: 'lead' as const, audience: 'Local firms', context: '' });
    const { ids } = createReviews(owner, [1, 2, 3].map(intake), { origin: 'bulk' });
    // Another paying customer's review, queued after the batch (explicitly, so the order never depends on the clock).
    const later = createReviews(other, [intake(4)]).ids[0];
    db().prepare('UPDATE reviews SET created_at = ? WHERE id = ?').run(now() + 60_000, later);
    const { reviewId } = start(owner);
    expect(claimNextReview('w1', 60_000).claimed?.id).toBe(reviewId);
    expect(claimNextReview('w1', 60_000).claimed?.id).toBe(ids[0]);
    clearQueue();
  });

  it("does not let a lapsed agency's widget audits jump the queue", () => {
    clearQueue();
    const lapsed = agency();
    const { reviewId } = start(lapsed);
    updateUser(lapsed.id, { plan_status: 'canceled' });
    const paying = createReviews(newUser({ plan: 'pro', plan_status: 'active' }), [{ url: 'https://client.example.com/', pageType: 'service', goal: 'lead', audience: 'Local firms', context: '' }]).ids[0];
    expect(claimNextReview('w1', 60_000).claimed?.id).toBe(paying);
    expect(claimNextReview('w1', 60_000).claimed?.id).toBe(reviewId);
    clearQueue();
  });
});

describe('lead widget: leads', () => {
  it('lists only the account’s own leads, newest first, with their scores', () => {
    const owner = agency();
    const first = start(owner, { email: 'first@example.org' });
    finish(first.reviewId);
    start(owner, { email: 'second@example.org' });
    start(agency(), { email: 'someone-else@example.org' });
    const leads = listWidgetLeads(owner.id);
    expect(leads.map((l) => l.email)).toEqual(['second@example.org', 'first@example.org']);
    expect(leads[1]).toMatchObject({ score: REPORT.score, reportAvailable: true, status: 'new' });
    expect(leads[0]).toMatchObject({ reviewStatus: 'queued', reportAvailable: false });
    expect(widgetLeadCounts(owner.id)).toMatchObject({ total: 2, week: 2, fresh: 2 });
  });

  it('updates a status only on the owner’s leads', () => {
    const owner = agency();
    const { leadId } = start(owner);
    setWidgetLeadStatus(owner.id, leadId, 'contacted');
    expect(listWidgetLeads(owner.id)[0].status).toBe('contacted');
    expect(() => setWidgetLeadStatus(agency().id, leadId, 'won')).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => setWidgetLeadStatus(owner.id, leadId, 'maybe' as never)).toThrow(expect.objectContaining({ status: 400 }));
  });

  it('deletes the lead with its report, but not while the audit is running', async () => {
    const owner = agency();
    const { leadId, reviewId } = start(owner);
    run(reviewId);
    await expect(deleteWidgetLead(owner.id, leadId)).rejects.toMatchObject({ status: 409 });
    completeReview(reviewId, 'test-worker', REPORT, 1000);
    await expect(deleteWidgetLead(agency().id, leadId)).rejects.toMatchObject({ status: 404 });
    await deleteWidgetLead(owner.id, leadId);
    expect(listWidgetLeads(owner.id)).toEqual([]);
    expect(db().prepare('SELECT deleted_at IS NOT NULL AS gone, report_json FROM reviews WHERE id = ?').get(reviewId)).toEqual({ gone: 1, report_json: null });
  });

  it('exports leads as a CSV that spreadsheets will not run as formulas', () => {
    const owner = agency();
    const { reviewId } = start(owner, { name: '=HYPERLINK("https://evil.example")', email: 'csv@example.org' });
    finish(reviewId);
    const csv = widgetLeadsCsv(owner.id);
    expect(csv.split('\r\n')[0]).toContain('Date (UTC),Name,Email,Website,Score');
    expect(csv).toContain(`csv@example.org`);
    expect(csv).toContain(`"'=HYPERLINK(""https://evil.example"")"`);
    expect(csv).toContain(`/app/reviews/${reviewId}`);
  });

  it('emails the agency once per lead, when the audit finishes', async () => {
    const owner = agency();
    const { reviewId, leadId } = start(owner);
    expect(await notifyWidgetLead(reviewId)).toBe(false);
    finish(reviewId);
    expect(await notifyWidgetLead(reviewId)).toBe(true);
    expect(await notifyWidgetLead(reviewId)).toBe(false);
    expect(db().prepare('SELECT notified_at IS NOT NULL AS done FROM widget_leads WHERE id = ?').get(leadId)).toEqual({ done: 1 });
  });

  it('respects the email setting, and still emails about failed checks', async () => {
    const owner = agency();
    updateWidget(owner.id, { notify: false });
    const quiet = start(owner);
    finish(quiet.reviewId);
    expect(await notifyWidgetLead(quiet.reviewId)).toBe(false);

    updateWidget(owner.id, { notify: true });
    const failed = start(owner);
    failReview(failed.reviewId, run(failed.reviewId), 'load_failed', 'The page did not load.');
    expect(await notifyWidgetLead(failed.reviewId)).toBe(true);
    expect(await notifyWidgetLead('not-a-widget-review')).toBe(false);
  });
});

describe('lead widget: the embedded page', () => {
  const owner = agency();
  const base = ensureWidget(owner.id);
  const page = (widget = base, brand: Parameters<typeof embedHtml>[0]['brand'] = null) => embedHtml({ widget, brand, nonce: 'abc123', appUrl: 'https://pagegrade.test' });

  it('escapes everything the agency typed', () => {
    const evil = '<img src=x onerror=alert(1)>"\'';
    const widget = { ...base, headline: evil, intro: evil, buttonLabel: evil, ctaLabel: evil, ctaUrl: 'https://agency.co.uk/?a="><script>', privacyUrl: '' };
    const html = page(widget, { name: evil, color: 'red;}</style><script>alert(1)</script>', logoUrl: null, whiteLabel: false });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;');
    expect(html).not.toContain('"><script>');
    expect(html).not.toContain('red;}');
    expect(html).toContain('--accent:#15803d');
  });

  it('keeps inline styles and scripts behind the nonce', () => {
    const html = page();
    expect(html).not.toMatch(/\sstyle="/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html.match(/<script(?![^>]*application\/json)[^>]*>/g)).toEqual(['<script nonce="abc123">']);
    expect(html.match(/<style[^>]*>/g)).toEqual(['<style nonce="abc123">']);
    expect(html).toContain('"api":"/api/embed/' + base.id + '"');
    // A parent that starts listening late (the in-app preview) can ask for the height again.
    expect(html).toContain("e.data.type === 'pagegrade:measure'");
  });

  it("uses the agency's colour, call to action and white label", () => {
    const branded = page({ ...base, ctaUrl: 'https://agency.co.uk/book', ctaLabel: 'Book a call' }, { name: 'Northside', color: '#1F6FEB', logoUrl: '/api/brand/logo/abc-123456.png', whiteLabel: true });
    expect(branded).toContain('--accent:#1f6feb');
    expect(branded).toContain('href="https://agency.co.uk/book"');
    expect(branded).toContain('Book a call');
    expect(branded).toContain('src="/api/brand/logo/abc-123456.png"');
    expect(branded).toContain('Northside will get your name, email and page address');
    expect(branded).not.toContain('PageGrade');
    const plain = page();
    expect(plain).toContain('Website check by <a href="https://pagegrade.test/"');
    expect(plain).toContain('The owner of this website will get');
    expect(plain).not.toContain('class="btn" href=');
  });

  it('may be framed by the listed sites (and their www twin) or, unconfigured, anywhere', () => {
    expect(frameAncestors([])).toBe("'self' *");
    expect(frameAncestors(['agency.co.uk', 'www.shop.co.uk', '*.agency.dev']).split(' ')).toEqual([
      "'self'", 'https://agency.co.uk', 'https://www.agency.co.uk', 'https://www.shop.co.uk', 'https://shop.co.uk', 'https://*.agency.dev',
    ]);
    const csp = embedCsp('n0nce', frameAncestors(['agency.co.uk']), true);
    expect(csp).toContain("script-src 'nonce-n0nce'");
    expect(csp).toContain("frame-ancestors 'self' https://agency.co.uk https://www.agency.co.uk");
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('tints backgrounds without color-mix', () => {
    expect(softOf('#000000')).toBe('#e0e0e0');
    expect(softOf('#ffffff')).toBe('#ffffff');
  });

  it('loads from the agency site and only trusts resize messages from PageGrade', () => {
    const js = loaderScript('https://pagegrade.test');
    expect(js).toContain('"https://pagegrade.test"');
    expect(js).toContain("e.origin !== base");
    expect(js).toContain('/^w_[A-Za-z0-9_-]{10,30}$/');
  });
});

describe('lead widget: public routes', () => {
  const APP = 'http://localhost:3000';
  let ip = 0;
  const post = async (widgetId: string, body: unknown, opts: { origin?: string; ip?: string } = {}) => {
    const { POST } = await import('@/app/api/embed/[widgetId]/audits/route');
    const headers = { 'content-type': 'application/json', origin: opts.origin ?? APP, 'x-forwarded-for': opts.ip ?? `198.51.100.${++ip}` };
    const res = await POST(new NextRequest(`${APP}/api/embed/${widgetId}/audits`, { method: 'POST', headers, body: JSON.stringify(body) }), { params: Promise.resolve({ widgetId }) });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const status = async (widgetId: string, leadId: string, key?: string) => {
    const { GET } = await import('@/app/api/embed/[widgetId]/audits/[leadId]/route');
    const res = await GET(new NextRequest(`${APP}/api/embed/${widgetId}/audits/${leadId}`, { headers: key ? { 'x-widget-key': key } : {} }), { params: Promise.resolve({ widgetId, leadId }) });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const page = async (widgetId: string) => {
    const { GET } = await import('@/app/embed/[widgetId]/route');
    return GET(new Request(`${APP}/embed/${widgetId}`), { params: Promise.resolve({ widgetId }) });
  };
  const form = { url: 'brightdental.example.com', goal: 'lead', name: 'Ana', email: 'ana@brightdental.example.com', source: 'https://agency.example.com/free-audit?utm=x' };

  it('starts an audit for a visitor and shows them its progress with their key only', async () => {
    const owner = agency();
    const widget = ensureWidget(owner.id);
    const res = await post(widget.id, form);
    expect(res).toMatchObject({ status: 201, body: { id: expect.any(String), key: expect.any(String) } });
    const lead = listWidgetLeads(owner.id)[0];
    expect(lead).toMatchObject({ email: 'ana@brightdental.example.com', url: 'https://brightdental.example.com/', source: 'https://agency.example.com/free-audit' });
    expect(await status(widget.id, String(res.body.id), String(res.body.key))).toMatchObject({ status: 200, body: { status: 'queued' } });
    expect((await status(widget.id, String(res.body.id))).status).toBe(404);
  });

  it('refuses other sites, bots, bad input, private addresses and switched-off widgets', async () => {
    const owner = agency();
    const widget = ensureWidget(owner.id);
    expect(await post(widget.id, form, { origin: 'https://evil.example' })).toMatchObject({ status: 403, body: { code: 'bad_origin' } });
    expect(await post(widget.id, { ...form, hp: 'I am a bot' })).toMatchObject({ status: 400 });
    expect(await post(widget.id, { ...form, email: 'nope' })).toMatchObject({ status: 400, body: { field: 'email' } });
    expect(await post(widget.id, { ...form, url: 'http://127.0.0.1/admin' })).toMatchObject({ status: 400, body: { field: 'url' } });
    expect(await post('w_unknownwidget', form)).toMatchObject({ status: 404, body: { code: 'widget_unavailable' } });
    updateWidget(owner.id, { active: false });
    expect(await post(widget.id, form)).toMatchObject({ status: 404, body: { code: 'widget_unavailable' } });
    expect(listWidgetLeads(owner.id)).toEqual([]);
  });

  it('limits each visitor to a few checks a day per widget', async () => {
    const widget = ensureWidget(agency().id);
    for (let i = 0; i < 3; i++) expect((await post(widget.id, form, { ip: '192.0.2.77' })).status).toBe(201);
    expect(await post(widget.id, form, { ip: '192.0.2.77' })).toMatchObject({ status: 429, body: { code: 'widget_limit' } });
    expect((await post(widget.id, form, { ip: '192.0.2.78' })).status).toBe(201);
  });

  it('serves the widget page framable only where the agency allows, without the site-wide frame ban', async () => {
    const owner = agency();
    const widget = updateWidget(owner.id, { allowedHosts: 'agency.co.uk' });
    const res = await page(widget.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('x-frame-options')).toBeNull();
    const csp = res.headers.get('content-security-policy')!;
    expect(csp).toContain("frame-ancestors 'self' https://agency.co.uk https://www.agency.co.uk");
    const nonce = /'nonce-([^']+)'/.exec(csp)![1];
    expect(await res.text()).toContain(`<script nonce="${nonce}">`);

    updateWidget(owner.id, { active: false });
    const off = await page(widget.id);
    expect(off.status).toBe(404);
    expect(await off.text()).toContain('not available right now');
  });
});
