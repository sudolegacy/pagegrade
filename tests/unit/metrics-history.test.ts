import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/server/db';
import { HttpError } from '@/lib/server/errors';
import { createUser, updateUser, type UserFields } from '@/lib/server/users';
import { createLead, updateLead } from '@/lib/server/leads';
import { addFeedback } from '@/lib/server/feedback';
import { mailer } from '@/lib/server/mail';
import { buildDigest, sendFounderDigest } from '@/lib/server/digest';
import { planMetrics } from '@/lib/server/plan-metrics';
import {
  WEEK, listOutreachWeeks, listSnapshots, outreachRates, outreachTotals, rateStatus, recordSnapshot, upsertOutreachWeek, weekStart,
  type OutreachInput,
} from '@/lib/server/metrics-history';
import { MRR_CHECKPOINTS, PLAN_SECTIONS, TARGETS } from '@/content/business-plan';

const session = vi.hoisted(() => ({ user: null as { id: string; email: string } | null }));
vi.mock('@/lib/server/session', async () => {
  const { HttpError } = await import('@/lib/server/errors');
  const { env } = await import('@/lib/server/env');
  return {
    requireApiUser: async () => {
      if (!session.user) throw new HttpError(401, 'Please sign in to continue.', 'unauthenticated');
      return session.user;
    },
    isAdmin: (user: { email: string } | null) => !!user && env.adminEmails.includes(user.email.toLowerCase()),
  };
});

const DAY = 24 * 3600 * 1000;
const utc = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0) => Date.UTC(year, month - 1, day, hour, minute, second, ms);

let seq = 0;
function newUser(fields: UserFields = {}) {
  const user = createUser({ email: `person${++seq}@example.com`, name: 'Test', passwordHash: 'x' });
  if (Object.keys(fields).length) updateUser(user.id, fields);
  return user;
}

function addReview(userId: string, origin: 'guest' | 'app', createdAt: number, extra: { costUsd?: number; finishedAt?: number } = {}) {
  db().prepare(`INSERT INTO reviews (id, user_id, url, page_type, goal, audience, status, origin, created_at, cost_usd, finished_at)
    VALUES (?, ?, 'https://example.com/', 'saas', 'trial', 'Founders', 'complete', ?, ?, ?, ?)`).run(randomUUID(), userId, origin, createdAt, extra.costUsd ?? null, extra.finishedAt ?? null);
}

const numbers: OutreachInput = { prospectsEmailed: 120, replies: 14, packRequests: 7, optOuts: 2, bounces: 3, calls: 1, note: 'New subject line' };

/** The error an action throws, so a test can check its status, code and field. */
function rejection(run: () => unknown): HttpError {
  try { run(); } catch (error) { return error as HttpError; }
  throw new Error('Expected the call to be rejected.');
}

beforeEach(() => {
  db().exec("DELETE FROM metric_snapshots; DELETE FROM outreach_weeks; DELETE FROM leads; DELETE FROM feedback; DELETE FROM reviews; DELETE FROM users WHERE id != 'guest';");
  session.user = null;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('weekStart', () => {
  const iso = (t: number) => new Date(weekStart(t)).toISOString();

  it('is the Monday at 00:00 UTC of the week containing the time', () => {
    expect(iso(utc(2026, 11, 11, 12))).toBe('2026-11-09T00:00:00.000Z'); // Wednesday
    expect(iso(utc(2026, 11, 15))).toBe('2026-11-09T00:00:00.000Z'); // Sunday, start of the day
    expect(iso(utc(2026, 11, 15, 23, 59, 59, 999))).toBe('2026-11-09T00:00:00.000Z'); // Sunday, last millisecond
    expect(iso(utc(2026, 11, 16))).toBe('2026-11-16T00:00:00.000Z'); // Monday at 00:00 exactly
    expect(iso(utc(2026, 11, 16, 0, 0, 0, 1))).toBe('2026-11-16T00:00:00.000Z');
    expect(iso(utc(2026, 11, 16, 7))).toBe('2026-11-16T00:00:00.000Z'); // when the weekly digest goes out
  });

  it('crosses month, year and leap-day boundaries', () => {
    expect(iso(utc(2027, 1, 1, 10))).toBe('2026-12-28T00:00:00.000Z');
    expect(iso(utc(2026, 1, 1, 10))).toBe('2025-12-29T00:00:00.000Z');
    expect(iso(utc(2028, 3, 1, 9))).toBe('2028-02-28T00:00:00.000Z');
  });

  it('always lands on a Monday no later than the time, less than a week before it', () => {
    for (let hours = 0; hours < 24 * 14; hours += 5) {
      const t = utc(2026, 11, 9) + hours * 3600 * 1000;
      const monday = weekStart(t);
      expect(new Date(monday).getUTCDay()).toBe(1);
      expect(monday).toBeLessThanOrEqual(t);
      expect(t - monday).toBeLessThan(WEEK);
      expect(weekStart(monday)).toBe(monday);
    }
  });
});

describe('weekly snapshots', () => {
  it('records the week from the same numbers as the digest and the admin overview', () => {
    const t = Date.now();
    const pro = newUser({ plan: 'pro', plan_status: 'active', cancel_at_period_end: 1 });
    newUser({ plan: 'agency', plan_status: 'active' });
    newUser({ plan: 'agency', plan_status: 'active', billing_interval: 'year' });
    const churned = newUser();
    addFeedback({ userId: churned.id, kind: 'cancel', answer: 'too_expensive', ref: 'cancel:sub_1' });
    createLead({ kind: 'pack', email: 'a@agency.example' });
    updateLead(createLead({ kind: 'pack', email: 'b@agency.example' }).id, { status: 'won' });
    createLead({ kind: 'call', email: 'c@agency.example' });
    for (let i = 0; i < 3; i++) addReview('guest', 'guest', t - DAY);
    addReview(pro.id, 'app', t - 2 * DAY, { costUsd: 0.25, finishedAt: t - 2 * DAY });
    addReview(pro.id, 'app', t - DAY, { costUsd: 0.25, finishedAt: t - DAY });

    const snapshot = recordSnapshot(t);
    expect(snapshot).toMatchObject({
      weekStart: weekStart(t), mrrGbp: 210.5, paying: 3, agencies: 2, users: 4, newUsers: 4, grades: 3, packRequests: 2, openLeads: 2, cancellations: 2, createdAt: t,
    });
    expect(snapshot.spendUsd).toBeCloseTo(0.5);

    const digest = buildDigest(t);
    expect(snapshot).toMatchObject({
      mrrGbp: digest.mrrGbp, paying: digest.paying, newUsers: digest.newUsers, grades: digest.grades, packRequests: digest.packRequests,
      openLeads: digest.openLeads, cancellations: digest.cancellations, spendUsd: digest.spendUsd,
    });
    expect(listSnapshots()).toEqual([snapshot]);
  });

  it('keeps one row for a week and updates it when recorded again', () => {
    const monday = utc(2026, 11, 16, 7);
    const first = recordSnapshot(monday);
    expect(first).toMatchObject({ weekStart: utc(2026, 11, 16), paying: 0, mrrGbp: 0 });

    newUser({ plan: 'starter', plan_status: 'active' });
    const second = recordSnapshot(monday + 30 * 60_000);
    expect(second).toMatchObject({ weekStart: first.weekStart, paying: 1, mrrGbp: 9, createdAt: monday + 30 * 60_000 });
    recordSnapshot(monday + 3 * DAY);
    expect(db().prepare('SELECT COUNT(*) AS n FROM metric_snapshots').get()).toEqual({ n: 1 });

    recordSnapshot(monday + WEEK);
    expect(listSnapshots().map((s) => s.weekStart)).toEqual([utc(2026, 11, 23), utc(2026, 11, 16)]);
    expect(listSnapshots(1).map((s) => s.weekStart)).toEqual([utc(2026, 11, 23)]);
  });

  it('is recorded by the weekly digest even when there is no founder address to email', async () => {
    const send = vi.spyOn(mailer, 'founderDigest').mockResolvedValue({ sent: true });
    vi.stubEnv('FOUNDER_ALERT_EMAIL', '');
    vi.stubEnv('ADMIN_EMAILS', '');
    newUser({ plan: 'pro', plan_status: 'active' });
    const t = Date.now();

    expect(await sendFounderDigest(t)).toEqual({ sent: false });
    expect(send).not.toHaveBeenCalled();
    expect(listSnapshots()).toMatchObject([{ weekStart: weekStart(t), paying: 1, mrrGbp: 29 }]);
  });

  it('is recorded before the digest email goes out', async () => {
    const send = vi.spyOn(mailer, 'founderDigest').mockImplementation(async () => {
      expect(listSnapshots()).toHaveLength(1);
      return { sent: true };
    });
    expect(await sendFounderDigest()).toEqual({ sent: true });
    expect(send).toHaveBeenCalledOnce();
  });

  it('does not stop the digest email when the snapshot cannot be saved', async () => {
    const send = vi.spyOn(mailer, 'founderDigest').mockResolvedValue({ sent: true });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    db().exec('ALTER TABLE metric_snapshots RENAME TO metric_snapshots_away');
    try {
      expect(await sendFounderDigest()).toEqual({ sent: true });
    } finally {
      db().exec('ALTER TABLE metric_snapshots_away RENAME TO metric_snapshots');
    }
    expect(send).toHaveBeenCalledOnce();
    expect(logged).toHaveBeenCalledWith('[digest] could not record the weekly snapshot', expect.any(Error));
  });
});

describe('outreach numbers', () => {
  const thisMonday = weekStart(Date.now());

  it('saves a week and replaces it when saved again', () => {
    const saved = upsertOutreachWeek(thisMonday, numbers);
    expect(saved).toMatchObject({ weekStart: thisMonday, ...numbers });
    expect(saved.updatedAt).toBeGreaterThan(0);

    upsertOutreachWeek(thisMonday, { ...numbers, replies: 20, note: '  Sharper opening  ' });
    expect(db().prepare('SELECT COUNT(*) AS n FROM outreach_weeks').get()).toEqual({ n: 1 });
    expect(listOutreachWeeks()).toMatchObject([{ weekStart: thisMonday, prospectsEmailed: 120, replies: 20, note: 'Sharper opening' }]);
  });

  it('treats calls and the note as optional', () => {
    const { calls, note, ...required } = numbers;
    expect(calls).toBe(1);
    expect(note).toBe('New subject line');
    expect(upsertOutreachWeek(thisMonday, required)).toMatchObject({ calls: 0, note: '' });
  });

  it('lists the newest week first and honours the limit', () => {
    for (let i = 0; i < 4; i++) upsertOutreachWeek(thisMonday - i * WEEK, { ...numbers, replies: i });
    expect(listOutreachWeeks().map((w) => w.replies)).toEqual([0, 1, 2, 3]);
    expect(listOutreachWeeks(2).map((w) => w.replies)).toEqual([0, 1]);
  });

  it('rejects counts that are negative, fractional, missing or too big, and names the field', () => {
    const bad = (field: keyof OutreachInput, value: unknown) =>
      rejection(() => upsertOutreachWeek(thisMonday, { ...numbers, [field]: value as number }));
    for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '5', null, undefined, 100_001]) {
      expect(bad('replies', value), String(value)).toMatchObject({ status: 400, code: 'invalid_input', extra: { field: 'replies' } });
    }
    for (const field of ['prospectsEmailed', 'packRequests', 'optOuts', 'bounces', 'calls'] as const) {
      expect(bad(field, -1)).toMatchObject({ status: 400, extra: { field } });
    }
    expect(upsertOutreachWeek(thisMonday, { ...numbers, replies: 0, calls: 100_000 })).toMatchObject({ replies: 0, calls: 100_000 });
    expect(bad('note', 'x'.repeat(501))).toMatchObject({ status: 400, extra: { field: 'note' } });
    expect(upsertOutreachWeek(thisMonday, { ...numbers, note: ` ${'x'.repeat(500)} ` }).note).toHaveLength(500);
  });

  it('rejects a week that does not start on a Monday at 00:00 UTC, saving nothing', () => {
    db().exec('DELETE FROM outreach_weeks');
    for (const week of [thisMonday + DAY, thisMonday - 1, thisMonday + 1, thisMonday - DAY, thisMonday + 3600_000, Number.NaN, thisMonday + 0.5]) {
      expect(rejection(() => upsertOutreachWeek(week, numbers)), String(week)).toMatchObject({ status: 400, code: 'invalid_input', extra: { field: 'weekStart' } });
    }
    expect(listOutreachWeeks()).toEqual([]);
  });

  it('adds up the weeks from a date and works out the rates, with none until a prospect is emailed', () => {
    expect(outreachTotals(0)).toEqual({ weeks: 0, prospectsEmailed: 0, replies: 0, packRequests: 0, optOuts: 0, bounces: 0, calls: 0 });
    expect(outreachRates(0)).toEqual({ emailed: 0, packRate: null, replyRate: null, optOutRate: null, bounceRate: null });

    upsertOutreachWeek(thisMonday - 4 * WEEK, { prospectsEmailed: 1000, replies: 100, packRequests: 100, optOuts: 100, bounces: 100 });
    upsertOutreachWeek(thisMonday - 2 * WEEK, { prospectsEmailed: 50, replies: 5, packRequests: 3, optOuts: 1, bounces: 1, calls: 1 });
    upsertOutreachWeek(thisMonday - WEEK, { prospectsEmailed: 70, replies: 7, packRequests: 4, optOuts: 1, bounces: 2, calls: 2 });
    upsertOutreachWeek(thisMonday, { prospectsEmailed: 80, replies: 8, packRequests: 3, optOuts: 0, bounces: 1 });

    const since = thisMonday - 3 * WEEK;
    expect(outreachTotals(since)).toEqual({ weeks: 3, prospectsEmailed: 200, replies: 20, packRequests: 10, optOuts: 2, bounces: 4, calls: 3 });
    expect(outreachRates(since)).toEqual({ emailed: 200, packRate: 5, replyRate: 10, optOutRate: 1, bounceRate: 2 });
    expect(outreachRates(thisMonday - 4 * WEEK)).toEqual({ emailed: 1200, packRate: 9.2, replyRate: 10, optOutRate: 8.5, bounceRate: 8.7 });
    expect(outreachRates(thisMonday + WEEK)).toMatchObject({ emailed: 0, packRate: null });
  });

  it('gives no rates for weeks where nobody was emailed, though the counts are kept', () => {
    upsertOutreachWeek(thisMonday, { prospectsEmailed: 0, replies: 1, packRequests: 0, optOuts: 1, bounces: 0 });
    expect(outreachRates(thisMonday)).toEqual({ emailed: 0, packRate: null, replyRate: null, optOutRate: null, bounceRate: null });
    expect(outreachTotals(thisMonday)).toMatchObject({ weeks: 1, replies: 1, optOuts: 1 });
  });
});

describe('rateStatus', () => {
  it('meets a "5% or more" target at the target and misses it below', () => {
    expect(rateStatus(5, 5, 'min')).toBe('good');
    expect(rateStatus(7.5, 5, 'min')).toBe('good');
    expect(rateStatus(4.9, 5, 'min')).toBe('bad');
    expect(rateStatus(0, 5, 'min')).toBe('bad');
  });

  it('has to beat an "under 2%" target, so equal to it is a miss', () => {
    expect(rateStatus(1.9, 2, 'max')).toBe('good');
    expect(rateStatus(0, 2, 'max')).toBe('good');
    expect(rateStatus(2, 2, 'max')).toBe('bad');
    expect(rateStatus(8, 2, 'max')).toBe('bad');
  });

  it('is unknown when there is no rate yet', () => {
    expect(rateStatus(null, 5, 'min')).toBe('unknown');
    expect(rateStatus(null, 2, 'max')).toBe('unknown');
    expect(rateStatus(Number.NaN, 5, 'min')).toBe('unknown');
  });
});

describe('planMetrics: weekly check-in', () => {
  it('has no outreach rates, verdicts or history until something is logged', () => {
    const m = planMetrics();
    expect(m.outreach.last4Weeks.totals).toMatchObject({ weeks: 0, prospectsEmailed: 0 });
    expect(m.outreach.last4Weeks.rates).toEqual({ emailed: 0, packRate: null, replyRate: null, optOutRate: null, bounceRate: null });
    expect(m.outreach.packToCustomer).toEqual({ sent: 0, won: 0, pct: null });
    expect(m.outreach.statuses).toEqual({ packRate: 'unknown', optOutRate: 'unknown', bounceRate: 'unknown', packToCustomer: 'unknown' });
    expect(m.history).toMatchObject({ snapshots: [], outreachWeeks: [], weeks: [] });
    expect(m.history.recentMondays).toHaveLength(9);
    expect(m.history.recentMondays[0]).toBe(weekStart(m.at));
    expect(m.history.recentMondays.map((t, i, all) => (i ? all[i - 1] - t : WEEK))).toEqual(Array(9).fill(WEEK));
  });

  it('judges the last four Mondays against the plan targets, and packs asked for in four weeks against the 20% target', () => {
    const at = utc(2026, 12, 16, 10); // the Wednesday after the first checkpoint
    const monday = weekStart(at);
    upsertOutreachWeek(monday, { prospectsEmailed: 100, replies: 10, packRequests: 6, optOuts: 1, bounces: 3 });
    upsertOutreachWeek(monday - 3 * WEEK, { prospectsEmailed: 100, replies: 6, packRequests: 4, optOuts: 5, bounces: 1 });
    upsertOutreachWeek(monday - 4 * WEEK, { prospectsEmailed: 900, replies: 90, packRequests: 90, optOuts: 90, bounces: 90 });

    const pack = (status: 'won' | 'pack_sent' | 'new', daysAgo: number, kind: 'pack' | 'call' = 'pack') => {
      const lead = createLead({ kind, email: `lead${++seq}@agency.example` });
      updateLead(lead.id, { status });
      db().prepare('UPDATE leads SET created_at = ? WHERE id = ?').run(at - daysAgo * DAY, lead.id);
    };
    pack('won', 3);
    for (let i = 0; i < 4; i++) pack('pack_sent', 10 + i);
    pack('new', 2);
    pack('won', 40);
    pack('won', 2, 'call');

    const m = planMetrics(at);
    expect(m.outreach.last4Weeks.totals).toMatchObject({ weeks: 2, prospectsEmailed: 200, packRequests: 10, optOuts: 6, bounces: 4 });
    expect(m.outreach.last4Weeks.rates).toMatchObject({ emailed: 200, packRate: 5, optOutRate: 3, bounceRate: 2 });
    expect(m.outreach.packToCustomer).toEqual({ sent: 5, won: 1, pct: 20 });
    expect(m.outreach.statuses).toEqual({ packRate: 'good', optOutRate: 'bad', bounceRate: 'good', packToCustomer: 'good' });
    expect([TARGETS.packRequestPct, TARGETS.optOutPct, TARGETS.bouncePct, TARGETS.packToCustomerPct]).toEqual([5, 2, 3, 20]);

    const week = utc(2026, 12, 14);
    expect(planMetrics(week + 5 * WEEK).outreach.last4Weeks.totals.weeks).toBe(0);
    expect(planMetrics(monday - WEEK).outreach.last4Weeks.rates.emailed).toBe(100);
  });

  it('joins each week\'s snapshot to its outreach numbers, newest first, with the checkpoint target on the checkpoint week', () => {
    const [month1, month2] = MRR_CHECKPOINTS;
    const insertSnapshot = (week: number, mrr: number) => db().prepare(
      'INSERT INTO metric_snapshots (week_start, mrr_gbp, paying, created_at) VALUES (?, ?, 1, ?)').run(week, mrr, week + 7 * 3600_000);
    const oneWeekBefore = month1.at - WEEK;
    insertSnapshot(oneWeekBefore, 40);
    insertSnapshot(month1.at, month1.fastMrr);
    upsertOutreachWeek(month1.at, { prospectsEmailed: 200, replies: 20, packRequests: 8, optOuts: 4, bounces: 2, note: 'Sharper subject' });
    upsertOutreachWeek(month1.at + WEEK, { prospectsEmailed: 100, replies: 5, packRequests: 1, optOuts: 0, bounces: 0 });
    upsertOutreachWeek(month2.at, { prospectsEmailed: 50, replies: 2, packRequests: 0, optOuts: 0, bounces: 0 });

    const { weeks } = planMetrics(month2.at + DAY).history;
    expect(weeks.map((w) => w.weekStart)).toEqual([month2.at, month1.at + WEEK, month1.at, oneWeekBefore]);

    const [checkpointWithoutSnapshot, outreachOnly, both, snapshotOnly] = weeks;
    expect(checkpointWithoutSnapshot).toMatchObject({ snapshot: null, checkpoint: { label: 'Month 2', baseMrr: month2.baseMrr, fastMrr: month2.fastMrr, status: null } });
    expect(outreachOnly).toMatchObject({ snapshot: null, checkpoint: null, packRate: 1, optOutRate: 0, bounceRate: 0 });
    expect(both).toMatchObject({
      snapshot: { mrrGbp: month1.fastMrr }, outreach: { note: 'Sharper subject' }, packRate: 4, optOutRate: 2, bounceRate: 1,
      checkpoint: { id: month1.id, label: 'Month 1', baseMrr: month1.baseMrr, fastMrr: month1.fastMrr, status: 'ahead' },
    });
    expect(snapshotOnly).toMatchObject({ snapshot: { mrrGbp: 40 }, outreach: null, packRate: null, checkpoint: null });
  });

  it('compares the checkpoint week\'s MRR with the base and fast cases', () => {
    const [month1] = MRR_CHECKPOINTS;
    const status = (mrr: number) => {
      db().prepare('INSERT OR REPLACE INTO metric_snapshots (week_start, mrr_gbp, created_at) VALUES (?, ?, ?)').run(month1.at, mrr, month1.at);
      return planMetrics(month1.at).history.weeks[0].checkpoint?.status;
    };
    expect(status(month1.fastMrr)).toBe('ahead');
    expect(status(month1.baseMrr)).toBe('on_track');
    expect(status(month1.baseMrr - 0.01)).toBe('behind');
  });
});

describe('POST /api/admin/outreach', () => {
  const post = async (body: unknown, opts: { origin?: string | null } = {}) => {
    const { POST } = await import('@/app/api/admin/outreach/route');
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (opts.origin !== null) headers.origin = opts.origin ?? 'http://localhost:3000';
    const res = await POST(new NextRequest('http://localhost:3000/api/admin/outreach', { method: 'POST', headers, body: JSON.stringify(body) }), undefined);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const admin = () => { session.user = { id: 'a', email: 'admin@example.com' }; };
  const monday = weekStart(Date.now());
  const payload = { weekStart: monday, prospectsEmailed: 120, replies: 14, packRequests: 7, optOuts: 2, bounces: 3 };

  it('blocks anyone who is not a signed-in admin, or whose request comes from another site', async () => {
    expect(await post(payload)).toMatchObject({ status: 401, body: { code: 'unauthenticated' } });
    session.user = { id: 'u', email: 'someone@example.com' };
    expect(await post(payload)).toMatchObject({ status: 403, body: { code: 'forbidden' } });
    admin();
    expect(await post(payload, { origin: 'https://evil.example' })).toMatchObject({ status: 403, body: { code: 'bad_origin' } });
    expect(await post(payload, { origin: null })).toMatchObject({ status: 403, body: { code: 'bad_origin' } });
    expect(listOutreachWeeks()).toEqual([]);
  });

  it('saves the week, then replaces it, and answers ok', async () => {
    admin();
    expect(await post(payload)).toEqual({ status: 200, body: { ok: true } });
    expect(listOutreachWeeks()).toMatchObject([{ weekStart: monday, prospectsEmailed: 120, replies: 14, packRequests: 7, optOuts: 2, bounces: 3, calls: 0, note: '' }]);

    expect(await post({ ...payload, replies: 20, calls: 2, note: '  Sharper opening  ' })).toEqual({ status: 200, body: { ok: true } });
    expect(listOutreachWeeks()).toMatchObject([{ weekStart: monday, replies: 20, calls: 2, note: 'Sharper opening' }]);
    expect(await post({ ...payload, weekStart: monday - 100 * WEEK })).toMatchObject({ status: 200 });
    expect(listOutreachWeeks()).toHaveLength(2);
  });

  it('only takes a Monday that has started and is under two years old', async () => {
    admin();
    const field = { code: 'invalid_input', field: 'weekStart' };
    expect(await post({ ...payload, weekStart: monday - WEEK + DAY })).toMatchObject({ status: 400, body: { ...field, error: 'Choose a Monday.' } });
    expect(await post({ ...payload, weekStart: monday + WEEK })).toMatchObject({ status: 400, body: { ...field, error: 'That week has not started yet.' } });
    expect(await post({ ...payload, weekStart: monday - 110 * WEEK })).toMatchObject({ status: 400, body: { ...field, error: 'That week is more than two years ago.' } });
    expect(await post({ ...payload, weekStart: 'monday' })).toMatchObject({ status: 400, body: { code: 'invalid', field: 'weekStart' } });
    expect(await post({ ...payload, weekStart: undefined })).toMatchObject({ status: 400, body: { code: 'invalid', field: 'weekStart' } });
    expect(listOutreachWeeks()).toEqual([]);
  });

  it('rejects bad numbers and a long note, naming the field', async () => {
    admin();
    const invalid = { code: 'invalid' };
    expect(await post({ ...payload, replies: -1 })).toMatchObject({ status: 400, body: { ...invalid, field: 'replies', error: 'Use zero or more.' } });
    expect(await post({ ...payload, optOuts: 1.5 })).toMatchObject({ status: 400, body: { ...invalid, field: 'optOuts', error: 'Use a whole number.' } });
    expect(await post({ ...payload, bounces: '3' })).toMatchObject({ status: 400, body: { ...invalid, field: 'bounces' } });
    expect(await post({ ...payload, prospectsEmailed: 100_001 })).toMatchObject({ status: 400, body: { ...invalid, field: 'prospectsEmailed', error: 'Use 100,000 or fewer.' } });
    expect(await post({ ...payload, packRequests: undefined })).toMatchObject({ status: 400, body: { ...invalid, field: 'packRequests', error: 'Enter a number.' } });
    expect(await post({ ...payload, calls: -2 })).toMatchObject({ status: 400, body: { ...invalid, field: 'calls' } });
    expect(await post({ ...payload, note: 'x'.repeat(501) })).toMatchObject({ status: 400, body: { ...invalid, field: 'note' } });
    expect(listOutreachWeeks()).toEqual([]);
  });
});

describe('business plan page wiring', () => {
  const source = readFileSync(new URL('../../src/app/admin/plan/page.tsx', import.meta.url), 'utf8');

  it('puts the weekly check-in between the launch checklist and the pipeline, in the page and its table of contents', () => {
    const at = (id: string) => source.indexOf(`<Section id="${id}"`);
    expect(at('launch')).toBeGreaterThan(-1);
    expect(at('weekly')).toBeGreaterThan(at('launch'));
    expect(at('pipeline')).toBeGreaterThan(at('weekly'));
    expect(PLAN_SECTIONS.map((s) => s.id).slice(0, 4)).toEqual(['scoreboard', 'launch', 'weekly', 'pipeline']);
  });
});
