import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, now } from '@/lib/server/db';
import { adminOverview } from '@/lib/server/admin';
import { env } from '@/lib/server/env';
import { HttpError } from '@/lib/server/errors';
import { createUser, findUserById, updateUser, type User, type UserFields } from '@/lib/server/users';
import { assertCapacity, capacityCheck, capacityMode, claimNextReview, spendToday } from '@/lib/server/reviews';

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
vi.mock('node:dns/promises', () => ({ lookup: async () => [{ address: '93.184.216.34', family: 4 }] }));

// Budget $2, so the default hard cap is $6.
const BUDGET = 2;
const HARD_CAP = 6;
const KEYS = ['AI_DAILY_BUDGET_USD', 'AI_DAILY_HARD_CAP_USD'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) saved[key] = process.env[key];
  process.env.AI_DAILY_BUDGET_USD = String(BUDGET);
  delete process.env.AI_DAILY_HARD_CAP_USD;
  db().exec('DELETE FROM reviews; DELETE FROM monitors;');
  session.user = null;
});
afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
  }
});

let seq = 0;
function newUser(fields: UserFields = {}): User {
  const user = createUser({ email: `capacity${++seq}@example.com`, name: 'Test', passwordHash: 'x' });
  updateUser(user.id, { email_verified_at: Date.now(), ...fields });
  return findUserById(user.id)!;
}
const people = () => ({
  visitor: null,
  free: newUser(),
  lapsed: newUser({ plan: 'pro', plan_status: 'canceled' }), // a lapsed subscription is Free again
  starter: newUser({ plan: 'starter', plan_status: 'active' }),
  trialing: newUser({ plan: 'pro', plan_status: 'trialing' }),
  pastDue: newUser({ plan: 'agency', plan_status: 'past_due' }),
});
const PAYING = ['starter', 'trialing', 'pastDue'] as const;
const NOT_PAYING = ['visitor', 'free', 'lapsed'] as const;

/** Records one finished review that cost `usd`, which is all spendToday() looks at. */
function setSpend(usd: number) {
  db().prepare("DELETE FROM reviews WHERE id = 'spend-fixture'").run();
  db().prepare(`INSERT INTO reviews (id, user_id, url, page_type, goal, audience, status, origin, created_at, cost_usd, finished_at)
    VALUES ('spend-fixture', 'guest', 'https://example.com/', 'saas', 'trial', 'Founders', 'complete', 'app', ?, ?, ?)`).run(now(), usd, now());
}

let tick = 0;
function queue(userId: string, opts: { origin?: 'app' | 'bulk' | 'guest' | 'monitor'; at?: number } = {}) {
  const id = randomUUID();
  db().prepare(`INSERT INTO reviews (id, user_id, url, page_type, goal, audience, status, origin, created_at)
    VALUES (?, ?, 'https://example.com/', 'saas', 'trial', 'Founders', 'queued', ?, ?)`).run(id, userId, opts.origin ?? 'app', opts.at ?? now() + ++tick);
  return id;
}
const statusOf = (id: string) => (db().prepare('SELECT status FROM reviews WHERE id = ?').get(id) as { status: string }).status;
const claim = (paidOnly: boolean) => claimNextReview('test-worker', 60_000, { paidOnly }).claimed;
const thrown = (fn: () => void) => {
  try { fn(); } catch (error) { return error as HttpError; }
  return null;
};

describe('AI_DAILY_HARD_CAP_USD', () => {
  it('defaults to three times the budget and follows it', () => {
    expect(env.aiDailyHardCapUsd).toBe(HARD_CAP);
    process.env.AI_DAILY_BUDGET_USD = '25';
    expect(env.aiDailyHardCapUsd).toBe(75);
    delete process.env.AI_DAILY_BUDGET_USD;
    expect(env.aiDailyBudgetUsd).toBe(25);
    expect(env.aiDailyHardCapUsd).toBe(75);
  });

  it('can be set, but never sits below the budget', () => {
    process.env.AI_DAILY_HARD_CAP_USD = '10';
    expect(env.aiDailyHardCapUsd).toBe(10);
    process.env.AI_DAILY_HARD_CAP_USD = '1';
    expect(env.aiDailyHardCapUsd).toBe(BUDGET);
    for (const unusable of ['', 'lots']) {
      process.env.AI_DAILY_HARD_CAP_USD = unusable;
      expect(env.aiDailyHardCapUsd).toBe(HARD_CAP);
    }
  });

  it('is reported next to the budget on the admin overview', () => {
    expect(adminOverview()).toMatchObject({ budgetUsd: BUDGET, hardCapUsd: HARD_CAP });
    process.env.AI_DAILY_HARD_CAP_USD = '10';
    expect(adminOverview()).toMatchObject({ budgetUsd: BUDGET, hardCapUsd: 10 });
  });
});

describe('capacity', () => {
  it('lets everyone start reviews below the budget', () => {
    const who = people();
    expect(capacityMode(BUDGET - 0.01)).toBe('open');
    for (const person of Object.values(who)) expect(capacityCheck(person, BUDGET - 0.01)).toEqual({ ok: true });
  });

  it('pauses free accounts and visitors from the budget up, while paying customers carry on', () => {
    const who = people();
    for (const spend of [BUDGET, BUDGET + 0.01, HARD_CAP - 0.01]) {
      expect(capacityMode(spend)).toBe('paid_only');
      for (const name of NOT_PAYING) expect(capacityCheck(who[name], spend), `${name} at $${spend}`).toEqual({ ok: false, reason: 'budget' });
      for (const name of PAYING) expect(capacityCheck(who[name], spend), `${name} at $${spend}`).toEqual({ ok: true });
    }
  });

  it('pauses everyone, paying customers included, at the hard cap', () => {
    const who = people();
    for (const spend of [HARD_CAP, HARD_CAP + 10]) {
      expect(capacityMode(spend)).toBe('closed');
      for (const [name, person] of Object.entries(who)) expect(capacityCheck(person, spend), `${name} at $${spend}`).toEqual({ ok: false, reason: 'hard_cap' });
    }
  });

  it('has no paid-only band when the hard cap equals the budget', () => {
    process.env.AI_DAILY_HARD_CAP_USD = String(BUDGET);
    expect(capacityMode(BUDGET - 0.01)).toBe('open');
    expect(capacityMode(BUDGET)).toBe('closed');
    expect(capacityCheck(newUser({ plan: 'agency', plan_status: 'active' }), BUDGET)).toEqual({ ok: false, reason: 'hard_cap' });
  });

  it("reads today's recorded spend when none is given, and assertCapacity turns a no into a 503", () => {
    const who = people();
    setSpend(BUDGET - 0.5);
    expect(spendToday()).toBeCloseTo(BUDGET - 0.5, 6);
    expect(thrown(() => assertCapacity(who.free))).toBeNull();

    setSpend(BUDGET);
    const free = thrown(() => assertCapacity(who.free));
    expect(free).toBeInstanceOf(HttpError);
    expect(free).toMatchObject({ status: 503, code: 'capacity' });
    expect(free?.message).toMatch(/free grades and reviews are paused/);
    expect(thrown(() => assertCapacity(null))).toMatchObject({ status: 503, code: 'capacity' });
    expect(thrown(() => assertCapacity(who.starter))).toBeNull();

    setSpend(HARD_CAP);
    const paying = thrown(() => assertCapacity(who.starter));
    expect(paying).toMatchObject({ status: 503, code: 'capacity' });
    expect(paying?.message).not.toBe(free?.message);
  });
});

describe('claimNextReview with paidOnly', () => {
  it('leaves free users and visitors queued, and never lets them hold up a paying customer', () => {
    const { free, starter } = people();
    const freeReview = queue(free.id, { at: 1000 });
    const guestReview = queue('guest', { origin: 'guest', at: 1500 });
    const paidReview = queue(starter.id, { at: 2000 });

    expect(claim(true)?.id).toBe(paidReview);
    expect(claim(true)).toBeNull();
    expect(statusOf(freeReview)).toBe('queued');
    expect(statusOf(guestReview)).toBe('queued');
    // Once the budget allows it again, the oldest waiting job goes first.
    expect(claim(false)?.id).toBe(freeReview);
  });

  it('does not treat a free grade as a paying customer, whoever owns the row', () => {
    const { starter } = people();
    const grade = queue(starter.id, { origin: 'guest', at: 1000 });
    expect(claim(true)).toBeNull();
    expect(statusOf(grade)).toBe('queued');
  });

  it("keeps a paying customer's weekly checks going, and skips a lapsed subscriber's", () => {
    const { lapsed } = people();
    const pro = newUser({ plan: 'pro', plan_status: 'active' });
    const lapsedCheck = queue(lapsed.id, { origin: 'monitor', at: 1000 });
    const proCheck = queue(pro.id, { origin: 'monitor', at: 2000 });

    expect(claim(true)?.id).toBe(proCheck);
    expect(claim(true)).toBeNull();
    expect(statusOf(lapsedCheck)).toBe('queued');
  });

  it('keeps the queue order: Pro and Agency, then everyone else paying, then weekly checks', () => {
    const { starter } = people();
    const pro = newUser({ plan: 'pro', plan_status: 'active' });
    const check = queue(pro.id, { origin: 'monitor', at: 500 });
    const starterReview = queue(starter.id, { at: 1000 });
    const proReview = queue(pro.id, { at: 2000 });

    expect([claim(true)?.id, claim(true)?.id, claim(true)?.id]).toEqual([proReview, starterReview, check]);
    expect(claim(true)).toBeNull();
  });

  it('agrees with capacityCheck about who counts as paying, for every plan and subscription state', () => {
    const rows: { who: string; routes: boolean; worker: boolean }[] = [];
    for (const plan of ['free', 'starter', 'pro', 'agency']) {
      for (const status of ['active', 'trialing', 'past_due', 'canceled', 'incomplete']) {
        const user = newUser({ plan, plan_status: status });
        queue(user.id);
        rows.push({ who: `${plan}/${status}`, routes: capacityCheck(user, BUDGET).ok, worker: claim(true)?.user_id === user.id });
        db().exec('DELETE FROM reviews');
      }
    }
    expect(rows.filter((r) => r.routes !== r.worker)).toEqual([]);
    expect(rows.filter((r) => r.worker).map((r) => r.who)).toEqual([
      'starter/active', 'starter/trialing', 'starter/past_due', 'pro/active', 'pro/trialing', 'pro/past_due', 'agency/active', 'agency/trialing', 'agency/past_due',
    ]);
  });

  it('still requeues or fails jobs whose worker went quiet', () => {
    const { free } = people();
    const lost = (attempts: number) => {
      const id = randomUUID();
      db().prepare(`INSERT INTO reviews (id, user_id, url, page_type, goal, audience, status, origin, attempts, lease_until, created_at)
        VALUES (?, ?, 'https://example.com/', 'saas', 'trial', 'Founders', 'running', 'app', ?, ?, ?)`).run(id, free.id, attempts, now() - 1000, now() - 5000);
      return id;
    };
    const retry = lost(1);
    const hopeless = lost(3);

    const { claimed, abandoned } = claimNextReview('test-worker', 60_000, { paidOnly: true });
    expect(claimed).toBeNull();
    expect(abandoned).toEqual([hopeless]);
    expect(statusOf(hopeless)).toBe('failed');
    expect(statusOf(retry)).toBe('queued');
  });
});

describe('the review routes', () => {
  const routes = {
    reviews: () => import('@/app/api/reviews/route'),
    bulk: () => import('@/app/api/reviews/bulk/route'),
    grade: () => import('@/app/api/grade/route'),
  };
  let visitor = 0;
  const send = async (route: keyof typeof routes, path: string, body: unknown) => {
    const { POST } = await routes[route]();
    const headers = { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': `203.0.113.${++visitor}` };
    const res = await POST(new NextRequest(`http://localhost:3000${path}`, { method: 'POST', headers, body: JSON.stringify(body) }), undefined);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const review = { url: 'https://example.com/', pageType: 'saas', goal: 'trial', audience: 'Founders' };
  const asUser = (user: User) => { session.user = user; };
  const queuedFor = (userId: string) => (db().prepare("SELECT COUNT(*) AS n FROM reviews WHERE user_id = ? AND status = 'queued'").get(userId) as { n: number }).n;

  it('POST /api/reviews pauses free accounts at the budget and paying customers at the hard cap', async () => {
    const { free, starter } = people();

    setSpend(BUDGET);
    asUser(free);
    expect(await send('reviews', '/api/reviews', review)).toMatchObject({ status: 503, body: { code: 'capacity' } });
    expect(queuedFor(free.id)).toBe(0);
    asUser(starter);
    expect(await send('reviews', '/api/reviews', review)).toMatchObject({ status: 201 });
    expect(queuedFor(starter.id)).toBe(1);

    setSpend(HARD_CAP);
    db().exec("UPDATE reviews SET status = 'complete' WHERE status = 'queued'");
    expect(await send('reviews', '/api/reviews', review)).toMatchObject({ status: 503, body: { code: 'capacity' } });
    expect(queuedFor(starter.id)).toBe(0);
  });

  it('POST /api/reviews/bulk keeps Agency customers going at the budget and stops them at the hard cap', async () => {
    const agency = newUser({ plan: 'agency', plan_status: 'active' });
    const bulk = { urls: ['https://example.com/a', 'https://example.com/b'], pageType: 'service', goal: 'lead', audience: 'Local firms' };
    asUser(agency);

    setSpend(BUDGET);
    const ok = await send('bulk', '/api/reviews/bulk', bulk);
    expect(ok.status).toBe(201);
    expect(ok.body.ids).toHaveLength(2);

    setSpend(HARD_CAP);
    db().exec("UPDATE reviews SET status = 'complete' WHERE status = 'queued'");
    expect(await send('bulk', '/api/reviews/bulk', bulk)).toMatchObject({ status: 503, body: { code: 'capacity' } });
  });

  it('POST /api/grade stops visitors at the budget without sending them to a free account that would be paused too', async () => {
    const grade = { url: 'https://example.com/', pageType: 'saas', goal: 'trial' };

    setSpend(BUDGET - 0.5);
    expect((await send('grade', '/api/grade', grade)).status).toBe(201);

    setSpend(BUDGET);
    const paused = await send('grade', '/api/grade', grade);
    expect(paused).toMatchObject({ status: 503, body: { code: 'capacity' } });
    expect(String(paused.body.error)).not.toMatch(/account/i);

    setSpend(HARD_CAP);
    expect(await send('grade', '/api/grade', grade)).toMatchObject({ status: 503, body: { code: 'capacity' } });
  });
});
