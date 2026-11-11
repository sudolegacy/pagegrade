import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/server/db';
import { env } from '@/lib/server/env';
import { createUser, findUserById, updateUser, type User } from '@/lib/server/users';
import { claimNextReview, completeReview, createReview, deleteReview, failReview, setSharing } from '@/lib/server/reviews';
import { createLead } from '@/lib/server/leads';
import { addFeedback } from '@/lib/server/feedback';
import { mailer } from '@/lib/server/mail';
import { MAX_SENDS_PER_RUN, runLifecycle } from '@/lib/server/lifecycle';
import { buildDigest, sendFounderDigest } from '@/lib/server/digest';
import { REVIEW_CSV_HEADERS, csvCell, reviewsCsv, toCsv } from '@/lib/server/csv';
import type { Report } from '@/lib/engine/report';

const DAY = 86_400_000;
const intake = { url: 'https://example.com/', pageType: 'saas' as const, goal: 'trial' as const, audience: 'Founders', context: '' };
const report = (issues: string[] = [], costUsd = 0.02) =>
  ({ score: 70, grade: 'B', verdict: 'Decent page', finalUrl: 'https://example.com/', issues: issues.map((title) => ({ title })), meta: { usage: { costUsd } } }) as unknown as Report;

let seq = 0;
function user(opts: { ageDays?: number; name?: string; email?: string; plan?: string; status?: string; optOut?: boolean } = {}): User {
  const u = createUser({ email: opts.email ?? `user${++seq}@example.com`, name: opts.name ?? 'Sam Smith', passwordHash: 'x' });
  db().prepare('UPDATE users SET created_at = ? WHERE id = ?').run(Date.now() - (opts.ageDays ?? 0) * DAY, u.id);
  if (opts.plan) updateUser(u.id, { plan: opts.plan, plan_status: opts.status ?? 'active' });
  if (opts.optOut) updateUser(u.id, { notify_on_complete: 0 });
  return findUserById(u.id)!;
}

/** Runs a review through the real queue so it is charged exactly as in production. */
function review(u: User, opts: { url?: string; issues?: string[]; fail?: boolean; finishedDaysAgo?: number } = {}): string {
  const id = createReview(findUserById(u.id)!, { ...intake, url: opts.url ?? intake.url });
  expect(claimNextReview('test-worker', 60_000).claimed?.id).toBe(id);
  if (opts.fail) failReview(id, 'test-worker', 'blocked', 'Blocked');
  else completeReview(id, 'test-worker', report(opts.issues), 1500);
  if (opts.finishedDaysAgo != null) {
    const t = Date.now() - opts.finishedDaysAgo * DAY;
    db().prepare('UPDATE reviews SET finished_at = ?, charged_at = CASE WHEN charged = 1 THEN ? END WHERE id = ?').run(t, t, id);
  }
  return id;
}

const lifecycleRows = () => db().prepare('SELECT user_id, kind FROM lifecycle_emails ORDER BY kind, user_id').all() as { user_id: string; kind: string }[];
const quietMail = () => ({
  first: vi.spyOn(mailer, 'lifecycleFirstReview').mockResolvedValue({ sent: true }),
  free: vi.spyOn(mailer, 'lifecycleFreeUsed').mockResolvedValue({ sent: true }),
  agency: vi.spyOn(mailer, 'lifecycleAgencyOnboarding').mockResolvedValue({ sent: true }),
  checkIn: vi.spyOn(mailer, 'lifecycleCheckIn').mockResolvedValue({ sent: true }),
});

beforeEach(() => {
  db().exec("DELETE FROM lifecycle_emails; DELETE FROM leads; DELETE FROM feedback; DELETE FROM users WHERE id != 'guest'");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('lifecycle emails', () => {
  it('nudges people who signed up a few days ago and have not run a full review, once', async () => {
    const at = Date.now();
    const due = user({ ageDays: 3, name: 'Sam Smith' });
    user({ ageDays: 1 });
    user({ ageDays: 9 });
    user({ ageDays: 3, optOut: true });
    user({ ageDays: 3, email: 'admin@example.com' });
    review(user({ ageDays: 3 }));
    createReview(user({ ageDays: 3 }), intake); // still queued, so they are already trying it
    const mail = quietMail();

    expect(await runLifecycle(at)).toEqual({ sent: 1, failed: 0, byKind: { first_review: 1 } });
    expect(mail.first).toHaveBeenCalledTimes(1);
    expect(mail.first).toHaveBeenCalledWith(due.email, { name: 'Sam Smith', url: `${env.appUrl}/app/new` });
    expect(lifecycleRows()).toEqual([{ user_id: due.id, kind: 'first_review' }]);

    expect(await runLifecycle(at)).toEqual({ sent: 0, failed: 0, byKind: {} });
    expect(mail.first).toHaveBeenCalledTimes(1);
  });

  it('tells people who used all their free reviews about the paid plans', async () => {
    const at = Date.now();
    const spent = user({ ageDays: 20 });
    for (let i = 0; i < 3; i++) review(spent, { finishedDaysAgo: 2 });
    const justNow = user({ ageDays: 20 });
    for (let i = 0; i < 3; i++) review(justNow);
    const twoOfThree = user({ ageDays: 20 });
    for (let i = 0; i < 2; i++) review(twoOfThree, { finishedDaysAgo: 2 });
    const longAgo = user({ ageDays: 90 });
    for (let i = 0; i < 3; i++) review(longAgo, { finishedDaysAgo: 40 });
    const lapsed = user({ ageDays: 60 });
    for (let i = 0; i < 3; i++) review(lapsed, { finishedDaysAgo: 2 });
    updateUser(lapsed.id, { stripe_customer_id: 'cus_lapsed' });
    const mail = quietMail();

    expect(await runLifecycle(at)).toEqual({ sent: 1, failed: 0, byKind: { free_used: 1 } });
    expect(mail.free).toHaveBeenCalledWith(spent.email, { name: 'Sam Smith', url: `${env.appUrl}/app/billing` });
    expect(lifecycleRows()).toEqual([{ user_id: spent.id, kind: 'free_used' }]);
  });

  it('welcomes new Agency customers the day after they upgrade, with the booking link', async () => {
    vi.stubEnv('NEXT_PUBLIC_BOOKING_URL', 'https://cal.example/agency');
    const at = Date.now();
    const upgrade = (opts: { ageDays: number; periodStartDaysAgo: number; updatedDaysAgo: number }) => {
      const u = user({ ageDays: opts.ageDays, name: 'Alex Agency' });
      updateUser(u.id, { plan: 'agency', plan_status: 'active', period_start: at - opts.periodStartDaysAgo * DAY, period_end: at + 29 * DAY });
      db().prepare('UPDATE users SET updated_at = ? WHERE id = ?').run(at - opts.updatedDaysAgo * DAY, u.id);
      return u;
    };
    const fresh = upgrade({ ageDays: 40, periodStartDaysAgo: 1, updatedDaysAgo: 1 });
    upgrade({ ageDays: 90, periodStartDaysAgo: 20, updatedDaysAgo: 1 }); // edited their branding, billing period is old
    upgrade({ ageDays: 40, periodStartDaysAgo: 5, updatedDaysAgo: 5 });
    user({ ageDays: 40, plan: 'pro' });
    const mail = quietMail();

    expect(await runLifecycle(at)).toEqual({ sent: 1, failed: 0, byKind: { agency_onboarding: 1 } });
    expect(mail.agency).toHaveBeenCalledWith(fresh.email, { name: 'Alex Agency', url: `${env.appUrl}/app/settings`, bookingUrl: 'https://cal.example/agency' });

    // Someone who upgraded a few minutes ago waits for tomorrow's run.
    const justUpgraded = user({ ageDays: 40 });
    updateUser(justUpgraded.id, { plan: 'agency', plan_status: 'active', period_start: Date.now(), period_end: Date.now() + 30 * DAY });
    expect(await runLifecycle(at)).toMatchObject({ sent: 0 });
    expect(await runLifecycle(at + DAY)).toEqual({ sent: 1, failed: 0, byKind: { agency_onboarding: 1 } });
    expect(mail.agency).toHaveBeenLastCalledWith(justUpgraded.email, expect.objectContaining({ bookingUrl: 'https://cal.example/agency' }));
  });

  it('checks in with paying customers after about a week and about a month', async () => {
    const week = user({ ageDays: 8, plan: 'pro' });
    const month = user({ ageDays: 26, plan: 'starter' });
    user({ ageDays: 15, plan: 'pro' });
    user({ ageDays: 8, plan: 'pro', status: 'past_due' });
    user({ ageDays: 8 });
    const mail = quietMail();

    expect(await runLifecycle()).toEqual({ sent: 2, failed: 0, byKind: { checkin_7: 1, checkin_25: 1 } });
    expect(mail.checkIn).toHaveBeenCalledWith(week.email, { name: 'Sam Smith', url: `${env.appUrl}/app`, day: 7 });
    expect(mail.checkIn).toHaveBeenCalledWith(month.email, { name: 'Sam Smith', url: `${env.appUrl}/app`, day: 25 });
    expect(lifecycleRows()).toEqual([{ user_id: month.id, kind: 'checkin_25' }, { user_id: week.id, kind: 'checkin_7' }]);
  });

  it('sends one email per person at a time, most useful first', async () => {
    const at = Date.now();
    const u = user({ ageDays: 8, name: 'Alex Agency' });
    updateUser(u.id, { plan: 'agency', plan_status: 'active', period_start: at - DAY, period_end: at + 29 * DAY });
    db().prepare('UPDATE users SET updated_at = ? WHERE id = ?').run(at - DAY, u.id);
    const mail = quietMail();

    expect(await runLifecycle(at)).toEqual({ sent: 1, failed: 0, byKind: { agency_onboarding: 1 } });
    expect(await runLifecycle(at)).toMatchObject({ sent: 0 });
    expect(mail.checkIn).not.toHaveBeenCalled();
    expect(lifecycleRows()).toEqual([{ user_id: u.id, kind: 'agency_onboarding' }]);
  });

  it('only emails confirmed addresses when confirmation is required', async () => {
    vi.stubEnv('REQUIRE_EMAIL_VERIFICATION', 'true');
    user({ ageDays: 3 });
    const confirmed = user({ ageDays: 3 });
    updateUser(confirmed.id, { email_verified_at: Date.now() });
    const mail = quietMail();

    expect(await runLifecycle()).toMatchObject({ sent: 1 });
    expect(mail.first).toHaveBeenCalledWith(confirmed.email, expect.anything());
  });

  it('releases the claim when a send fails, so the next run tries again', async () => {
    const u = user({ ageDays: 3 });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const first = vi.spyOn(mailer, 'lifecycleFirstReview').mockRejectedValueOnce(new Error('smtp down')).mockResolvedValue({ sent: true });

    expect(await runLifecycle()).toEqual({ sent: 0, failed: 1, byKind: {} });
    expect(lifecycleRows()).toEqual([]);
    expect(await runLifecycle()).toEqual({ sent: 1, failed: 0, byKind: { first_review: 1 } });
    expect(first).toHaveBeenCalledTimes(2);
    expect(lifecycleRows()).toEqual([{ user_id: u.id, kind: 'first_review' }]);
  });

  it('gives up after three failures in a row instead of waiting on a dead mail server', async () => {
    for (let i = 0; i < 5; i++) user({ ageDays: 3 });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const first = vi.spyOn(mailer, 'lifecycleFirstReview').mockRejectedValue(new Error('smtp down'));

    expect(await runLifecycle()).toEqual({ sent: 0, failed: 3, byKind: {} });
    expect(first).toHaveBeenCalledTimes(3);
    expect(lifecycleRows()).toEqual([]);
  });

  it('caps how many emails one run sends, and carries the rest to the next run', async () => {
    for (let i = 0; i < MAX_SENDS_PER_RUN + 5; i++) user({ ageDays: 3 });
    quietMail();

    expect((await runLifecycle()).sent).toBe(MAX_SENDS_PER_RUN);
    expect((await runLifecycle()).sent).toBe(5);
    expect((await runLifecycle()).sent).toBe(0);
    expect(lifecycleRows()).toHaveLength(MAX_SENDS_PER_RUN + 5);
  });

  it('does nothing in production until a mail server is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    user({ ageDays: 3 });
    const mail = quietMail();

    expect(await runLifecycle()).toEqual({ sent: 0, failed: 0, byKind: {} });
    expect(mail.first).not.toHaveBeenCalled();
    expect(lifecycleRows()).toEqual([]);
  });
});

describe('founder digest', () => {
  it('adds up the week from the same numbers as the admin page', () => {
    const pro = user({ plan: 'pro' });
    updateUser(pro.id, { cancel_at_period_end: 1 });
    const agency = user({ plan: 'agency' });
    updateUser(agency.id, { billing_interval: 'year' });
    const churned = user({});
    const veteran = user({ ageDays: 30 });
    addFeedback({ userId: churned.id, kind: 'cancel', answer: 'too_expensive', ref: 'cancel:sub_1' });
    addFeedback({ userId: pro.id, kind: 'cancel', answer: 'unused', ref: 'cancel:sub_2' });
    createLead({ kind: 'pack', email: 'a@agency.example' });
    createLead({ kind: 'pack', email: 'b@agency.example' });
    createLead({ kind: 'call', email: 'c@agency.example' });
    review(veteran);
    review(veteran, { fail: true });

    const digest = buildDigest();
    expect(digest).toMatchObject({ mrrGbp: 111.5, paying: 2, newUsers: 3, grades: 0, claimed: 0, packRequests: 2, openLeads: 3, cancellations: 2, failRate: 0.5, adminUrl: `${env.appUrl}/admin` });
    expect(digest.spendUsd).toBeCloseTo(0.02);
    expect(digest.peakDayUsd).toBeCloseTo(0.02);
    expect(digest.budgetUsd).toBe(Number(process.env.AI_DAILY_BUDGET_USD || 25));
    expect(digest.weekLabel).toMatch(/^week to [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/);
  });

  it('reports a quiet week as zeros, not NaN', () => {
    expect(buildDigest()).toMatchObject({ mrrGbp: 0, paying: 0, newUsers: 0, cancellations: 0, spendUsd: 0, failRate: 0 });
  });

  it('goes to the founder address, falls back to the first admin, and does nothing without either', async () => {
    const send = vi.spyOn(mailer, 'founderDigest').mockResolvedValue({ sent: true });

    expect(await sendFounderDigest()).toEqual({ sent: true });
    expect(send).toHaveBeenLastCalledWith('admin@example.com', expect.objectContaining({ paying: 0 }));

    vi.stubEnv('FOUNDER_ALERT_EMAIL', 'Founder@Example.com');
    await sendFounderDigest();
    expect(send).toHaveBeenLastCalledWith('founder@example.com', expect.anything());

    send.mockClear();
    vi.stubEnv('FOUNDER_ALERT_EMAIL', '');
    vi.stubEnv('ADMIN_EMAILS', '');
    expect(await sendFounderDigest()).toEqual({ sent: false });
    expect(send).not.toHaveBeenCalled();
  });

  it('puts the money, paying customers and sign-ups in the subject', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await mailer.founderDigest('me@example.com', {
      weekLabel: 'week to Mon 16 Nov', mrrGbp: 94, paying: 3, newUsers: 1, grades: 10, claimed: 2, packRequests: 1, openLeads: 4, cancellations: 0, spendUsd: 1.5, budgetUsd: 25, failRate: 0.02, adminUrl: 'https://example.com/admin',
    });
    expect(info.mock.calls.flat().join(' ')).toContain('subject="PageGrade week: £94 MRR · 3 paying · 1 sign-up"');
  });
});

describe('CSV', () => {
  it('quotes cells that need it and doubles embedded quotes', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(72)).toBe('72');
    expect(csvCell(Number.NaN)).toBe('');
  });

  it('stops spreadsheets from running cells as formulas', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+44 20 7946 0000')).toBe("'+44 20 7946 0000");
    expect(csvCell('-2 points')).toBe("'-2 points");
    expect(csvCell('@mention')).toBe("'@mention");
    expect(csvCell('\t=1+1')).toBe("'\t=1+1");
    expect(csvCell('  =1+1')).toBe("'  =1+1");
    expect(csvCell('=HYPERLINK("http://x.example","y")')).toBe(`"'=HYPERLINK(""http://x.example"",""y"")"`);
    expect(csvCell('a=b')).toBe('a=b');
    expect(csvCell(-5)).toBe('-5');
  });

  it('writes a byte order mark, CRLF line ends and a final newline', () => {
    expect(toCsv([['a', 'b'], ['1', 'x,y']])).toBe('\uFEFFa,b\r\n1,"x,y"\r\n');
  });
});

describe('review export', () => {
  function parse(csv: string) {
    const rows: string[][] = [[]];
    let cell = '';
    let quoted = false;
    const text = csv.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { rows.at(-1)!.push(cell); cell = ''; }
      else if (ch === '\r' && text[i + 1] === '\n') { rows.at(-1)!.push(cell); cell = ''; rows.push([]); i++; }
      else cell += ch;
    }
    const [head, ...body] = rows.filter((r) => r.length);
    return { head, table: body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]]))) };
  }

  it('lists only the caller\'s own reviews, with the top three fixes and working links', async () => {
    const me = user({ plan: 'pro' });
    const other = user({ plan: 'pro' });
    db().prepare("INSERT INTO clients (id, user_id, name, website, created_at) VALUES ('client1', ?, 'Harbour Dental', '', ?)").run(me.id, Date.now());
    const a = review(me, { url: 'https://a.example/', issues: ['Name the product in the headline', 'Add proof above the fold', 'Shorten the form', 'A fourth fix is left out'] });
    const shareId = setSharing(a, me.id, true);
    const b = review(me, { url: 'https://b.example/', issues: ['=HYPERLINK("http://evil.example","x")'] });
    const failed = review(me, { url: 'https://c.example/', fail: true });
    const deleted = review(me, { url: 'https://deleted.example/' });
    await deleteReview(deleted, me.id);
    review(other, { url: 'https://other.example/' });
    db().prepare("UPDATE reviews SET client_id = 'client1', batch_id = 'batch1' WHERE id = ?").run(b);
    const t = Date.now();
    db().prepare('UPDATE reviews SET created_at = ? WHERE id = ?').run(t - 30_000, a);
    db().prepare('UPDATE reviews SET created_at = ? WHERE id = ?').run(t - 20_000, b);
    db().prepare('UPDATE reviews SET created_at = ? WHERE id = ?').run(t - 10_000, failed);

    const { csv, count } = reviewsCsv(me.id);
    const { head, table } = parse(csv);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(head).toEqual([...REVIEW_CSV_HEADERS]);
    expect(count).toBe(3);
    expect(table.map((r) => r.Page)).toEqual(['https://c.example/', 'https://b.example/', 'https://a.example/']);

    const rowA = table.find((r) => r.Page === 'https://a.example/')!;
    expect(rowA).toMatchObject({
      'Final URL': 'https://example.com/', Status: 'complete', Score: '70', Grade: 'B', Verdict: 'Decent page', 'Page type': 'SaaS or software product', Goal: 'Start a free trial', Client: '',
      'Top fix 1': 'Name the product in the headline', 'Top fix 2': 'Add proof above the fold', 'Top fix 3': 'Shorten the form', 'Duration (s)': '2',
      'Share link': `${env.appUrl}/r/${shareId}`, 'Report link': `${env.appUrl}/app/reviews/${a}`,
    });
    expect(new Date(rowA['Reviewed at']).toISOString()).toBe(rowA['Reviewed at']);

    const rowB = table.find((r) => r.Page === 'https://b.example/')!;
    expect(rowB).toMatchObject({ Client: 'Harbour Dental', 'Top fix 1': `'=HYPERLINK("http://evil.example","x")`, 'Top fix 2': '', 'Share link': '' });

    const rowFailed = table.find((r) => r.Page === 'https://c.example/')!;
    expect(rowFailed).toMatchObject({ Status: 'failed', Score: '', Grade: '', 'Top fix 1': '', 'Duration (s)': '', 'Report link': `${env.appUrl}/app/reviews/${failed}` });

    expect(parse(reviewsCsv(me.id, { clientId: 'client1' }).csv).table.map((r) => r.Page)).toEqual(['https://b.example/']);
    expect(parse(reviewsCsv(me.id, { batchId: 'batch1' }).csv).table.map((r) => r.Page)).toEqual(['https://b.example/']);
    expect(parse(reviewsCsv(me.id, { status: 'failed' }).csv).table.map((r) => r.Page)).toEqual(['https://c.example/']);
    expect(parse(reviewsCsv(me.id, { q: 'a.example' }).csv).table.map((r) => r.Page)).toEqual(['https://a.example/']);
    expect(reviewsCsv(me.id, { clientId: 'someone-elses-client' }).count).toBe(0);
    expect(parse(reviewsCsv(other.id).csv).table.map((r) => r.Page)).toEqual(['https://other.example/']);
  });

  it('copes with reports that are damaged or missing the issue list', () => {
    const me = user({ plan: 'pro' });
    const damaged = review(me, { url: 'https://damaged.example/' });
    const noIssues = review(me, { url: 'https://noissues.example/' });
    review(me, { url: 'https://odd.example/', issues: ['  Spread   over\nlines  '] });
    db().prepare("UPDATE reviews SET report_json = '{not json' WHERE id = ?").run(damaged);
    db().prepare("UPDATE reviews SET report_json = '{\"score\":1}' WHERE id = ?").run(noIssues);

    const { table } = parse(reviewsCsv(me.id).csv);
    expect(table.find((r) => r.Page === 'https://damaged.example/')).toMatchObject({ Status: 'complete', 'Top fix 1': '' });
    expect(table.find((r) => r.Page === 'https://noissues.example/')).toMatchObject({ 'Top fix 1': '' });
    expect(table.find((r) => r.Page === 'https://odd.example/')).toMatchObject({ 'Top fix 1': 'Spread over lines' });
  });
});
