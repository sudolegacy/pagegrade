import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, kv, now } from '@/lib/server/db';
import { createUser, updateUser, type UserFields } from '@/lib/server/users';
import { createLead, findLead, updateLead } from '@/lib/server/leads';
import { addFeedback } from '@/lib/server/feedback';
import { adminOverview } from '@/lib/server/admin';
import { planMetrics } from '@/lib/server/plan-metrics';
import {
  MIXES, MRR_CHECKPOINTS, OUTREACH_FOOTER, OUTREACH_TEMPLATES, PLACEHOLDERS, PLAN_SECTIONS, PRICE_TABLE, PRICING_RULES, PROJECTIONS, REPLY_TEMPLATES,
  STRATEGY_LATER, TARGETS, WEEK_TWO_CHECK, gbp, mailboxCeiling, planDate, triggerStatus,
} from '@/content/business-plan';
import { PLANS } from '@/lib/plans';

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
const HOUR = 3600 * 1000;

let seq = 0;
function newUser(fields: UserFields = {}, createdAt?: number) {
  const user = createUser({ email: `person${++seq}@example.com`, name: 'Test', passwordHash: 'x' });
  if (Object.keys(fields).length) updateUser(user.id, fields);
  if (createdAt != null) db().prepare('UPDATE users SET created_at = ? WHERE id = ?').run(createdAt, user.id);
  return user;
}

function addReview(userId: string, origin: 'guest' | 'app', createdAt: number, extra: { costUsd?: number; finishedAt?: number } = {}) {
  db().prepare(`INSERT INTO reviews (id, user_id, url, page_type, goal, audience, status, origin, created_at, cost_usd, finished_at)
    VALUES (?, ?, 'https://example.com/', 'saas', 'trial', 'Founders', 'complete', ?, ?, ?, ?)`).run(randomUUID(), userId, origin, createdAt, extra.costUsd ?? null, extra.finishedAt ?? null);
}

const CONFIG_KEYS = [
  'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'FOUNDER_NAME', 'FOUNDER_ALERT_EMAIL', 'APP_URL',
  'COMPANY_NUMBER', 'COMPANY_ADDRESS', 'NEXT_PUBLIC_COMPANY_NUMBER', 'NEXT_PUBLIC_COMPANY_ADDRESS', 'NEXT_PUBLIC_BOOKING_URL', 'BOOKING_URL',
  'AI_DAILY_BUDGET_USD', 'FREE_GRADER_DAILY_LIMIT', 'REQUIRE_EMAIL_VERIFICATION', 'ADMIN_EMAILS',
];
const saved: Record<string, string | undefined> = {};
const setEnv = (vars: Record<string, string | undefined>) => {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
};
/** Every setting the checklist reads, cleared except the admin address the test setup provides. */
const blankConfig = () => setEnv(Object.fromEntries(CONFIG_KEYS.map((k) => [k, k === 'ADMIN_EMAILS' ? 'admin@example.com' : undefined])));
const FULL_CONFIG = {
  OPENAI_API_KEY: 'sk-test-abc', STRIPE_SECRET_KEY: 'sk_live_secret123', STRIPE_WEBHOOK_SECRET: 'whsec_abc', SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'mailer-user', SMTP_PASS: 'smtp-pass-xyz', ADMIN_EMAILS: 'admin@example.com,demo@example.com', FOUNDER_NAME: 'Sam',
  FOUNDER_ALERT_EMAIL: 'sam.alerts@example.com', APP_URL: 'https://pagegrade.example.org', COMPANY_NUMBER: 'OC987654', COMPANY_ADDRESS: '9 Quiet Lane, Leeds',
  NEXT_PUBLIC_BOOKING_URL: 'https://cal.example.org/sam/15min', AI_DAILY_BUDGET_USD: '1', FREE_GRADER_DAILY_LIMIT: '20',
  // Explicit, so a REQUIRE_EMAIL_VERIFICATION=false in the ambient environment (CI sets it for the build) cannot leak in.
  REQUIRE_EMAIL_VERIFICATION: 'true',
};
const itemsById = (m: ReturnType<typeof planMetrics>) => Object.fromEntries(m.launch.items.map((i) => [i.id, i]));

beforeEach(() => {
  for (const key of CONFIG_KEYS) saved[key] = process.env[key];
  db().exec("DELETE FROM leads; DELETE FROM feedback; DELETE FROM stripe_events; DELETE FROM kv; DELETE FROM reviews; DELETE FROM users WHERE id != 'guest';");
  session.user = null;
});
afterEach(() => setEnv(saved));

describe('planMetrics: revenue', () => {
  it('counts MRR, paying customers and agencies from live subscriptions', () => {
    newUser({ plan: 'agency', plan_status: 'active', billing_interval: 'month' });
    newUser({ plan: 'agency', plan_status: 'past_due', billing_interval: 'year' });
    newUser({ plan: 'pro', plan_status: 'active', billing_interval: 'year' });
    newUser({ plan: 'starter', plan_status: 'active' });
    newUser({ plan: 'pro', plan_status: 'canceled' });
    newUser();

    const m = planMetrics();
    expect(m.payingCustomers).toBe(4);
    expect(m.pastDue).toBe(1);
    expect(m.byPlan).toEqual([
      { plan: 'starter', name: 'Starter', count: 1 },
      { plan: 'pro', name: 'Pro', count: 1 },
      { plan: 'agency', name: 'Agency', count: 2 },
    ]);
    // £99 + £990/12 + £290/12 + £9
    expect(m.mrr).toBe(214.67);
    expect(m.mrr).toBe(adminOverview().mrrGbp);
    expect(m.agencies).toEqual({ count: 2, priceRiseAt: 15, untilPriceRise: 13 });
    expect(m.progress).toEqual({ targetMrr: 10_000, pct: 2.1, remaining: 9785.33 });
  });

  it('starts at zero with nothing paid', () => {
    const m = planMetrics();
    expect(m).toMatchObject({ mrr: 0, payingCustomers: 0, agencies: { count: 0, untilPriceRise: 15 }, progress: { pct: 0, remaining: 10_000 } });
    expect(m.churn.monthlyPct).toBeNull();
    expect(m.signupToPaid.pct).toBeNull();
    expect(m.leads.packToCustomerPct).toBeNull();
  });

  it('tells you when it is time to raise the Agency price', () => {
    for (let i = 0; i < 15; i++) newUser({ plan: 'agency', plan_status: 'active' });
    expect(planMetrics().agencies).toEqual({ count: 15, priceRiseAt: 15, untilPriceRise: 0 });
  });
});

describe('planMetrics: checkpoints', () => {
  it('uses the dated Monday checkpoints from the plan', () => {
    expect(MRR_CHECKPOINTS.map((c) => [planDate(c.at), c.baseMrr, c.fastMrr])).toEqual([
      ['14 Dec 2026', 94, 190], ['11 Jan 2027', 280, 570], ['15 Feb 2027', 550, 1470],
      ['10 May 2027', 2150, 6270], ['9 Aug 2027', 5040, 12180], ['15 Nov 2027', 8270, 18230],
    ]);
    for (const c of [...MRR_CHECKPOINTS, WEEK_TWO_CHECK]) expect(new Date(c.at).getUTCDay(), c.label).toBe(1);
    expect(MRR_CHECKPOINTS.filter((c) => c.decision).map((c) => c.label)).toEqual(['Month 3']);
  });

  it('picks the next and last checkpoint from the time it is given', () => {
    newUser({ plan: 'agency', plan_status: 'active' });

    const before = planMetrics(Date.UTC(2026, 10, 11, 9));
    expect(before.lastCheckpoint).toBeNull();
    expect(before.nextCheckpoint).toMatchObject({ id: 'month-1', passed: false, days: 33, status: 'on_track', aboveBase: true, aboveFast: false, gapToBase: 0 });

    const between = planMetrics(Date.UTC(2026, 11, 20, 9));
    expect(between.lastCheckpoint).toMatchObject({ id: 'month-1', passed: true, days: 6, status: 'on_track' });
    expect(between.nextCheckpoint).toMatchObject({ id: 'month-2', baseMrr: 280, fastMrr: 570, status: 'behind', aboveBase: false, gapToBase: 181 });
    expect(between.checkpoints.map((c) => c.passed)).toEqual([true, false, false, false, false, false]);

    const onTheDay = planMetrics(MRR_CHECKPOINTS[2].at);
    expect(onTheDay.lastCheckpoint).toMatchObject({ id: 'month-3', passed: true, days: 0, decision: true });

    const after = planMetrics(Date.UTC(2028, 0, 1));
    expect(after.nextCheckpoint).toBeNull();
    expect(after.lastCheckpoint?.id).toBe('month-12');
  });

  it('compares MRR with the base and fast cases', () => {
    const at = Date.UTC(2027, 0, 1);
    expect(planMetrics(at).lastCheckpoint?.status).toBe('behind');
    for (let i = 0; i < 2; i++) newUser({ plan: 'agency', plan_status: 'active' });
    expect(planMetrics(at).lastCheckpoint).toMatchObject({ status: 'ahead', aboveBase: true, aboveFast: true }); // £198 vs £94 / £190
  });
});

describe('planMetrics: churn and sign-ups', () => {
  it('counts 30-day cancellations and an approximate monthly churn', () => {
    const t = now();
    for (let i = 0; i < 3; i++) newUser({ plan: 'pro', plan_status: 'active' });
    const leaver = newUser({ plan_status: 'canceled' });
    const old = newUser({ plan_status: 'canceled' });
    db().prepare('UPDATE users SET updated_at = ? WHERE id = ?').run(t - 40 * DAY, old.id);
    addFeedback({ userId: leaver.id, kind: 'cancel', answer: 'too_expensive', ref: 'cancel:sub_1' });
    addFeedback({ userId: leaver.id, kind: 'general', answer: 'love it', ref: 'general:1' });

    let m = planMetrics(t);
    expect(m.churn).toMatchObject({ cancelled30: 1, reasons30: 1, scheduled: 0, monthlyPct: 25, targetPct: 4 });

    // Billing sync resets ended subscriptions to Free, so Stripe's "deleted" events are counted too.
    for (const id of ['evt_1', 'evt_2']) db().prepare("INSERT INTO stripe_events (id, type, received_at) VALUES (?, 'customer.subscription.deleted', ?)").run(id, t - DAY);
    db().prepare("INSERT INTO stripe_events (id, type, received_at) VALUES ('evt_3', 'invoice.paid', ?)").run(t);
    const [first] = db().prepare("SELECT id FROM users WHERE plan = 'pro' LIMIT 1").all() as { id: string }[];
    updateUser(first.id, { cancel_at_period_end: 1 });
    m = planMetrics(t);
    expect(m.churn).toMatchObject({ cancelled30: 2, scheduled: 1, monthlyPct: 40 });
  });

  it('measures sign-ups that now pay, only among sign-ups older than 60 days and not counting admins', () => {
    const t = now();
    newUser({ plan: 'pro', plan_status: 'active' }, t - 90 * DAY);
    newUser({}, t - 80 * DAY);
    newUser({}, t - 70 * DAY);
    newUser({}, t - 61 * DAY);
    const admin = createUser({ email: 'admin@example.com', name: 'Founder', passwordHash: 'x' });
    db().prepare('UPDATE users SET created_at = ? WHERE id = ?').run(t - 100 * DAY, admin.id);
    newUser({ plan: 'starter', plan_status: 'active' }, t - 10 * DAY);
    newUser({}, t - 5 * DAY);

    expect(planMetrics(t).signupToPaid).toEqual({ cohort: 4, paid: 1, pct: 25, maturing: 2, targetPct: 5 });
    // A month on, nobody new has reached 60 days; after 56 days both recent sign-ups have.
    expect(planMetrics(t + 30 * DAY).signupToPaid).toMatchObject({ cohort: 4, maturing: 2 });
    expect(planMetrics(t + 56 * DAY).signupToPaid).toMatchObject({ cohort: 6, paid: 2, pct: 33.3, maturing: 0 });
  });
});

describe('planMetrics: growth, spend and leads', () => {
  it('counts free grades and the ones signed-up users unlocked in the last 7 days', () => {
    const t = now();
    const user = newUser();
    for (let i = 0; i < 3; i++) addReview('guest', 'guest', t - DAY);
    for (let i = 0; i < 2; i++) addReview(user.id, 'guest', t - 2 * DAY);
    addReview('guest', 'guest', t - 9 * DAY);
    addReview(user.id, 'app', t - DAY);
    expect(planMetrics(t).grader).toEqual({ grades7: 5, claimed7: 2 });
  });

  it('adds up AI spend for the current UTC day and flags a cap above the plan while the business is tiny', () => {
    setEnv({ AI_DAILY_BUDGET_USD: '25' });
    const t = now();
    const dayStart = new Date(t);
    dayStart.setUTCHours(0, 0, 0, 0);
    const user = newUser();
    addReview(user.id, 'app', t, { costUsd: 0.019, finishedAt: dayStart.getTime() });
    addReview(user.id, 'app', t, { costUsd: 0.019, finishedAt: dayStart.getTime() + 1000 });
    addReview(user.id, 'app', t, { costUsd: 5, finishedAt: dayStart.getTime() - 1 });

    const m = planMetrics(t);
    expect(m.ai.spendTodayUsd).toBeCloseTo(0.038, 6);
    expect(m.ai).toMatchObject({ capUsd: 25, recommendedCapUsd: 1, capTooHigh: true, graderLimitTooHigh: true });
    setEnv({ AI_DAILY_BUDGET_USD: '1', FREE_GRADER_DAILY_LIMIT: '20' });
    expect(planMetrics(t).ai).toMatchObject({ capUsd: 1, capTooHigh: false, graderDailyLimit: 20, graderLimitTooHigh: false });
  });

  it('follows the plan when the cap should rise: $3 once people pay, plus $0.30 a day per Agency, then free of the rule at 5 customers', () => {
    setEnv({ AI_DAILY_BUDGET_USD: '3' });
    expect(planMetrics().ai).toMatchObject({ recommendedCapUsd: 1, capTooHigh: true });
    newUser({ plan: 'starter', plan_status: 'active' });
    expect(planMetrics().ai).toMatchObject({ recommendedCapUsd: 3, capTooHigh: false });
    setEnv({ AI_DAILY_BUDGET_USD: '5' });
    expect(planMetrics().ai.capTooHigh).toBe(true);
    newUser({ plan: 'agency', plan_status: 'active' });
    setEnv({ AI_DAILY_BUDGET_USD: '3.3' });
    expect(planMetrics().ai).toMatchObject({ recommendedCapUsd: 3.3, capTooHigh: false });
    for (let i = 0; i < 3; i++) newUser({ plan: 'starter', plan_status: 'active' });
    setEnv({ AI_DAILY_BUDGET_USD: '25', FREE_GRADER_DAILY_LIMIT: '150' });
    expect(planMetrics().ai).toMatchObject({ capTooHigh: false, graderLimitTooHigh: false });
  });

  it('summarises the pipeline: open, pack requests in 7 and 30 days, and wins', () => {
    const t = now();
    const won = createLead({ kind: 'pack', email: 'a@agency.example', company: 'A Studio', prospects: ['one.example'] });
    const sent = createLead({ kind: 'pack', email: 'b@agency.example' });
    const call = createLead({ kind: 'call', email: 'c@agency.example' });
    const lost = createLead({ kind: 'pack', email: 'd@agency.example' });
    updateLead(won.id, { status: 'won' });
    updateLead(sent.id, { status: 'pack_sent' });
    updateLead(lost.id, { status: 'lost' });
    db().prepare('UPDATE leads SET created_at = ? WHERE id = ?').run(t - 20 * DAY, sent.id);
    expect(call.status).toBe('new');

    expect(planMetrics(t).leads).toEqual({
      open: 2, total: 4, won: 1, packs7: 2, packs30: 3, wonLast30: 1, packsSent: 2, packsWon: 1, packToCustomerPct: 50,
    });
    expect(planMetrics(t + 25 * DAY).leads).toMatchObject({ packs7: 0, packs30: 2 });
  });
});

describe('planMetrics: launch checklist', () => {
  it('fails the required checks on an empty configuration', () => {
    blankConfig();
    const m = planMetrics();
    const by = itemsById(m);
    expect(m.launch.items.map((i) => i.id)).toEqual([
      'openai', 'stripe-keys', 'stripe-live', 'smtp', 'admin-emails', 'founder-name', 'founder-alerts', 'app-url', 'company', 'booking',
      'ai-cap', 'grader-cap', 'worker', 'backup', 'verification',
    ]);
    for (const id of ['openai', 'stripe-keys', 'stripe-live', 'smtp', 'founder-name', 'app-url', 'company', 'booking', 'ai-cap', 'grader-cap', 'worker', 'backup', 'verification']) {
      expect(by[id].ok, id).toBe(false);
    }
    expect(by['admin-emails'].ok).toBe(true);
    expect(by['admin-emails'].detail).toMatch(/demo account/);
    expect(by['founder-alerts']).toMatchObject({ ok: true, detail: expect.stringContaining('first ADMIN_EMAILS') });
    expect(by['stripe-keys'].detail).toContain('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET');
    expect(m.launch.blocking).toBe(10);
    expect(m.launch.ready).toBe(2);
  });

  it('passes every check on a launched server, without leaking a single value', () => {
    const t = now();
    setEnv(FULL_CONFIG);
    kv.set('worker:heartbeat', JSON.stringify({ at: t - 30_000, id: 'w1', active: 0 }));
    kv.set('backup:last', JSON.stringify({ at: t - 10 * HOUR, file: 'pagegrade.db', bytes: 1000 }));

    const m = planMetrics(t);
    expect(m.launch.items.filter((i) => !i.ok).map((i) => i.id)).toEqual([]);
    expect(m.launch).toMatchObject({ blocking: 0, ready: 15 });

    const serialised = JSON.stringify(m);
    for (const value of Object.values(FULL_CONFIG)) {
      for (const part of value.split(',')) if (part.length > 4) expect(serialised, `leaked ${part}`).not.toContain(part);
    }
  });

  it('tells a test Stripe key from a live one', () => {
    blankConfig();
    setEnv({ STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_WEBHOOK_SECRET: 'whsec_abc' });
    let by = itemsById(planMetrics());
    expect(by['stripe-keys'].ok).toBe(true);
    expect(by['stripe-live']).toMatchObject({ ok: false, detail: expect.stringContaining('test key') });
    setEnv({ STRIPE_SECRET_KEY: 'rk_live_abc' });
    by = itemsById(planMetrics());
    expect(by['stripe-live'].ok).toBe(true);
    setEnv({ STRIPE_WEBHOOK_SECRET: undefined });
    expect(itemsById(planMetrics())['stripe-keys']).toMatchObject({ ok: false, detail: expect.stringContaining('STRIPE_WEBHOOK_SECRET') });
  });

  it('wants a public https address and both company details', () => {
    blankConfig();
    const urlOk = (url: string) => { setEnv({ APP_URL: url }); return itemsById(planMetrics())['app-url'].ok; };
    expect(urlOk('http://localhost:3000')).toBe(false);
    expect(urlOk('https://localhost')).toBe(false);
    expect(urlOk('http://pagegrade.example.org')).toBe(false);
    expect(urlOk('https://pagegrade.example.org')).toBe(true);

    expect(itemsById(planMetrics()).company.ok).toBe(false);
    setEnv({ COMPANY_NUMBER: 'OC987654' });
    expect(itemsById(planMetrics()).company).toMatchObject({ ok: false, detail: expect.stringContaining('COMPANY_ADDRESS') });
    setEnv({ COMPANY_NUMBER: undefined, NEXT_PUBLIC_COMPANY_NUMBER: 'OC987654', NEXT_PUBLIC_COMPANY_ADDRESS: '9 Quiet Lane, Leeds' });
    expect(itemsById(planMetrics()).company.ok).toBe(true);
  });

  it('checks that the worker and backups are recent', () => {
    blankConfig();
    const t = now();
    expect(itemsById(planMetrics(t)).worker.detail).toMatch(/never reported/);
    expect(itemsById(planMetrics(t)).backup.detail).toMatch(/No backup yet/);

    kv.set('worker:heartbeat', JSON.stringify({ at: t - 110_000 }));
    kv.set('backup:last', JSON.stringify({ at: t - 29 * HOUR }));
    expect(itemsById(planMetrics(t))).toMatchObject({ worker: { ok: true }, backup: { ok: true } });

    kv.set('worker:heartbeat', JSON.stringify({ at: t - 180_000 }));
    kv.set('backup:last', JSON.stringify({ at: t - 31 * HOUR }));
    expect(itemsById(planMetrics(t))).toMatchObject({ worker: { ok: false }, backup: { ok: false } });
    kv.set('worker:heartbeat', 'not json');
    expect(itemsById(planMetrics(t)).worker.ok).toBe(false);
  });

  it('applies the cost safeguards only while the business is small', () => {
    blankConfig();
    expect(itemsById(planMetrics())).toMatchObject({ 'ai-cap': { ok: false }, 'grader-cap': { ok: false } });
    setEnv({ AI_DAILY_BUDGET_USD: '1', FREE_GRADER_DAILY_LIMIT: '20' });
    expect(itemsById(planMetrics())).toMatchObject({ 'ai-cap': { ok: true }, 'grader-cap': { ok: true } });
    setEnv({ AI_DAILY_BUDGET_USD: '25', FREE_GRADER_DAILY_LIMIT: '150' });
    for (let i = 0; i < TARGETS.smallBusinessCustomers; i++) newUser({ plan: 'starter', plan_status: 'active' });
    expect(itemsById(planMetrics())).toMatchObject({ 'ai-cap': { ok: true }, 'grader-cap': { ok: true } });
  });

  it('asks for email verification, which is on by default once SMTP is set', () => {
    blankConfig();
    expect(itemsById(planMetrics()).verification.ok).toBe(false);
    setEnv({ SMTP_HOST: 'smtp.example.com' });
    expect(itemsById(planMetrics()).verification.ok).toBe(true);
    setEnv({ REQUIRE_EMAIL_VERIFICATION: 'false' });
    expect(itemsById(planMetrics()).verification.ok).toBe(false);
  });
});

describe('plan content', () => {
  it('reads prices from the plan catalogue and adds up the £10k mixes', () => {
    expect(PRICE_TABLE.map((r) => [r.plan, r.monthly, r.yearly])).toEqual([['Free', '£0', '–'], ['Starter', '£9', '£90'], ['Pro', '£29', '£290'], ['Agency', '£99', '£990']]);
    expect(PRICE_TABLE[3].includes).toContain(`${PLANS.agency.reviews} reviews a month`);
    expect(MIXES.map((x) => [x.customers, x.mrr])).toEqual([[101, 9999], [67, 9983], [220, 10_080]]);
    expect(TARGETS.newAgencyPriceGbp).toBe(149);
    expect([gbp(0), gbp(1470), gbp(82.5), gbp(24.1666)]).toEqual(['£0', '£1,470', '£82.50', '£24.17']);
    expect(PRICING_RULES.find((r) => r.title === 'Yearly plans')?.text).toContain('£990 instead of £1,188');
    expect(PRICING_RULES.find((r) => r.title === 'Yearly plans')?.text).toContain('£82.50 a month of MRR');
  });

  it('keeps the projection table and the dated checkpoints in step', () => {
    expect(PROJECTIONS.filter((p) => [6, 9, 12, 18, 24].includes(p.month)).map((p) => [p.month, p.slow, p.base, p.fast])).toEqual([
      [6, 750, 2150, 6270], [9, 1390, 5040, 12_180], [12, 2150, 8270, 18_230], [18, 3970, 14_900, 30_700], [24, 6250, 21_720, 43_590],
    ]);
    for (const c of MRR_CHECKPOINTS) {
      const p = PROJECTIONS.find((x) => x.month === c.month);
      expect([c.slowMrr, c.baseMrr, c.fastMrr]).toEqual([p?.slow, p?.base, p?.fast]);
    }
    expect([mailboxCeiling('slow'), mailboxCeiling('base'), mailboxCeiling('fast')]).toEqual([1700, 4750, 12_667]);
  });

  it('defines every placeholder the templates use, and copies the footer and opt-out line', () => {
    const bodies = [...OUTREACH_TEMPLATES.flatMap((g) => [g.subject, ...g.emails.map((e) => e.body)]), OUTREACH_FOOTER.body];
    const used = new Set(bodies.flatMap((b) => [...b.matchAll(/\{(\w+)\}/g)].map((x) => x[1])));
    expect(used.size).toBeGreaterThan(8);
    for (const name of used) expect(PLACEHOLDERS, name).toContain(`{${name}}`);
    expect(OUTREACH_TEMPLATES.map((g) => g.emails.length)).toEqual([3, 3, 3]);
    expect(OUTREACH_TEMPLATES[0].subject).toBe('Free client audits for {company}');
    expect(OUTREACH_FOOTER.body).toContain('Reply "no" and I won\'t email you again.');
    expect(REPLY_TEMPLATES[0].body).toContain(`${PLANS.agency.priceGbp} a month or £${PLANS.agency.yearlyPriceGbp} a year`);
  });

  it('shows what is missing before a "do later" strategy can start', () => {
    const live = { mrr: 0, customers: 0, agencies: 0, at: Date.UTC(2026, 10, 11) };
    expect(triggerStatus([{ kind: 'customers', atLeast: 10 }], live)).toEqual({ ready: false, label: '0 of 10 customers' });
    expect(triggerStatus([], live)).toEqual({ ready: false, label: 'Your call' });
    expect(triggerStatus([{ kind: 'month', month: 2 }], live)).toEqual({ ready: false, label: 'From 14 Dec 2026' });
    expect(triggerStatus([{ kind: 'month', month: 2 }, { kind: 'customers', atLeast: 3 }], { ...live, customers: 3, at: Date.UTC(2026, 11, 15) }).ready).toBe(true);
    expect(triggerStatus([{ kind: 'mrr', atLeast: 1500 }], { ...live, mrr: 1500 }).ready).toBe(true);
    expect(triggerStatus([{ kind: 'agencies', atLeast: 15 }], { ...live, agencies: 14 }).label).toBe('14 of 15 agencies');
    expect(STRATEGY_LATER.find((s) => s.strategy.startsWith('Raise Agency'))?.triggers).toEqual([{ kind: 'agencies', atLeast: 15 }]);
  });
});

describe('POST /api/admin/leads', () => {
  const post = async (body: unknown, opts: { origin?: string | null } = {}) => {
    const { POST } = await import('@/app/api/admin/leads/route');
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (opts.origin !== null) headers.origin = opts.origin ?? 'http://localhost:3000';
    const res = await POST(new NextRequest('http://localhost:3000/api/admin/leads', { method: 'POST', headers, body: JSON.stringify(body) }), undefined);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const admin = () => { session.user = { id: 'a', email: 'admin@example.com' }; };

  it('blocks anyone who is not a signed-in admin, or whose request comes from another site', async () => {
    const lead = createLead({ kind: 'pack', email: 'x@agency.example' });
    expect(await post({ id: lead.id, status: 'won' })).toMatchObject({ status: 401, body: { code: 'unauthenticated' } });
    session.user = { id: 'u', email: 'someone@example.com' };
    expect(await post({ id: lead.id, status: 'won' })).toMatchObject({ status: 403, body: { code: 'forbidden' } });
    admin();
    expect(await post({ id: lead.id, status: 'won' }, { origin: 'https://evil.example' })).toMatchObject({ status: 403, body: { code: 'bad_origin' } });
    expect(await post({ id: lead.id, status: 'won' }, { origin: null })).toMatchObject({ status: 403, body: { code: 'bad_origin' } });
    expect(findLead(lead.id)?.status).toBe('new');
  });

  it('changes a lead status and note, and answers ok', async () => {
    admin();
    const lead = createLead({ kind: 'pack', email: 'x@agency.example' });
    expect(await post({ id: lead.id, status: 'pack_sent' })).toEqual({ status: 200, body: { ok: true } });
    expect(findLead(lead.id)).toMatchObject({ status: 'pack_sent', note: '' });
    expect(await post({ id: lead.id, note: '  Call booked for Friday  ' })).toEqual({ status: 200, body: { ok: true } });
    expect(findLead(lead.id)).toMatchObject({ status: 'pack_sent', note: 'Call booked for Friday' });
    expect(await post({ id: lead.id, status: 'won', note: '' })).toMatchObject({ status: 200 });
    expect(findLead(lead.id)).toMatchObject({ status: 'won', note: '' });
  });

  it('rejects unknown leads and bad input', async () => {
    admin();
    const lead = createLead({ kind: 'call', email: 'x@agency.example' });
    expect(await post({ id: 'missing', status: 'won' })).toMatchObject({ status: 404, body: { code: 'not_found' } });
    expect(await post({ id: lead.id, status: 'customer' })).toMatchObject({ status: 400, body: { code: 'invalid', field: 'status' } });
    expect(await post({ id: lead.id })).toMatchObject({ status: 400, body: { code: 'invalid' } });
    expect(await post({ status: 'won' })).toMatchObject({ status: 400, body: { code: 'invalid', field: 'id' } });
    expect(await post({ id: lead.id, note: 'x'.repeat(2001) })).toMatchObject({ status: 400, body: { code: 'invalid', field: 'note' } });
    expect(findLead(lead.id)).toMatchObject({ status: 'new', note: '' });
  });
});

describe('business plan page source', () => {
  // The page is JSX, which the unit-test transform does not handle, so its structure is checked from the source.
  const source = readFileSync(new URL('../../src/app/admin/plan/page.tsx', import.meta.url), 'utf8');

  it('has a section for every table-of-contents entry, once', () => {
    expect(new Set(PLAN_SECTIONS.map((s) => s.id)).size).toBe(PLAN_SECTIONS.length);
    for (const s of PLAN_SECTIONS) expect(source.match(new RegExp(`<[Ss]ection id="${s.id}"`, 'g')), s.id).toHaveLength(1);
  });

  it('checks for an admin itself rather than relying on the layout alone', () => {
    expect(source).toMatch(/if \(!isAdmin\(await currentUser\(\)\)\) notFound\(\);/);
  });
});
