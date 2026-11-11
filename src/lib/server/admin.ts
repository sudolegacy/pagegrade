import { db, kv, now } from './db';
import { spendToday } from './reviews';
import { monthlyValue, planById, type BillingInterval } from '../plans';
import { feedbackCounts, recentFeedback } from './feedback';
import { referralBalances } from './referrals';

const DAY = 24 * 3600 * 1000;

type Heartbeat = { at: number; id: string; active: number };
type Backup = { at: number; file: string; bytes: number };

const parse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
};

/** Everything the operator dashboard shows, in one read-only pass. */
export function adminOverview() {
  const conn = db();
  const t = now();
  const users = conn.prepare(`SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN email_verified_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS verified,
      COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS lastWeek
    FROM users WHERE id != 'guest'`).get(t - 7 * DAY) as { total: number; verified: number; lastWeek: number };
  const paid = conn.prepare(`SELECT plan, COUNT(*) AS n FROM users
    WHERE plan != 'free' AND plan_status IN ('active', 'trialing', 'past_due') GROUP BY plan`).all() as { plan: string; n: number }[];
  const pastDue = (conn.prepare("SELECT COUNT(*) AS n FROM users WHERE plan_status = 'past_due'").get() as { n: number }).n;
  const byInterval = conn.prepare(`SELECT plan, billing_interval AS interval, COUNT(*) AS n FROM users
    WHERE plan != 'free' AND plan_status IN ('active', 'trialing', 'past_due') AND id != 'guest' GROUP BY plan, billing_interval`).all() as { plan: string; interval: BillingInterval; n: number }[];
  const mrrGbp = Math.round(byInterval.reduce((sum, p) => {
    const plan = planById(p.plan);
    return sum + (plan ? monthlyValue(plan, p.interval === 'year' ? 'year' : 'month') * p.n : 0);
  }, 0) * 100) / 100;
  const yearlyCustomers = byInterval.filter((p) => p.interval === 'year').reduce((s, p) => s + p.n, 0);
  const growth = conn.prepare(`SELECT
      COALESCE(SUM(CASE WHEN origin = 'guest' THEN 1 ELSE 0 END), 0) AS grades,
      COALESCE(SUM(CASE WHEN origin = 'guest' AND user_id != 'guest' THEN 1 ELSE 0 END), 0) AS claimed,
      COALESCE(SUM(CASE WHEN origin = 'monitor' THEN 1 ELSE 0 END), 0) AS checks,
      COALESCE(SUM(CASE WHEN origin = 'bulk' THEN 1 ELSE 0 END), 0) AS bulk
    FROM reviews WHERE created_at >= ?`).get(t - 7 * DAY) as { grades: number; claimed: number; checks: number; bulk: number };
  const monitors = (conn.prepare('SELECT COUNT(*) AS n FROM monitors WHERE active = 1').get() as { n: number }).n;
  const referred = (conn.prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by IS NOT NULL').get() as { n: number }).n;
  const byStatus = Object.fromEntries((conn.prepare('SELECT status, COUNT(*) AS n FROM reviews GROUP BY status').all() as { status: string; n: number }[]).map((r) => [r.status, r.n]));
  const day = conn.prepare(`SELECT COUNT(*) AS finished,
      COALESCE(SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END), 0) AS complete,
      COALESCE(SUM(CASE WHEN status = 'failed' AND COALESCE(error_code, '') != 'cancelled' THEN 1 ELSE 0 END), 0) AS failed,
      AVG(CASE WHEN status = 'complete' THEN duration_ms END) AS avgMs
    FROM reviews WHERE finished_at >= ?`).get(t - DAY) as { finished: number; complete: number; failed: number; avgMs: number | null };
  const month = conn.prepare(`SELECT COALESCE(SUM(cost_usd), 0) AS spend, COALESCE(SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END), 0) AS complete
    FROM reviews WHERE finished_at >= ?`).get(t - 30 * DAY) as { spend: number; complete: number };
  const queue = conn.prepare(`SELECT r.id, r.url, r.status, r.stage, r.attempts, r.created_at AS createdAt, r.started_at AS startedAt, u.email, u.plan
    FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.status IN ('queued', 'running') AND r.deleted_at IS NULL ORDER BY r.created_at LIMIT 50`).all() as {
      id: string; url: string; status: 'queued' | 'running'; stage: string | null; attempts: number; createdAt: number; startedAt: number | null; email: string; plan: string;
    }[];
  const failures = conn.prepare(`SELECT r.id, r.url, r.error_code AS code, r.error_message AS message, r.finished_at AS at, r.attempts, u.email
    FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.status = 'failed' AND COALESCE(r.error_code, '') != 'cancelled' ORDER BY r.finished_at DESC LIMIT 15`).all() as {
      id: string; url: string; code: string | null; message: string | null; at: number | null; attempts: number; email: string;
    }[];
  const recentUsers = conn.prepare(`SELECT u.id, u.email, u.name, u.plan, u.plan_status AS planStatus, u.email_verified_at AS verifiedAt, u.created_at AS createdAt,
      (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id AND r.charged = 1) AS reviews
    FROM users u WHERE u.id != 'guest' ORDER BY u.created_at DESC LIMIT 20`).all() as {
      id: string; email: string; name: string; plan: string; planStatus: string; verifiedAt: number | null; createdAt: number; reviews: number;
    }[];
  const stripeErrors = conn.prepare('SELECT id, type, received_at AS at, error FROM stripe_events WHERE error IS NOT NULL ORDER BY received_at DESC LIMIT 10').all() as {
    id: string; type: string; at: number; error: string;
  }[];
  return {
    generatedAt: t,
    users, paid, pastDue, byStatus, day, month, queue, failures, recentUsers, stripeErrors,
    mrrGbp, yearlyCustomers, growth, monitors, referred,
    partners: referralBalances(),
    feedback: recentFeedback(25),
    signupReasons: feedbackCounts('signup'),
    cancelReasons: feedbackCounts('cancel'),
    spendToday: spendToday(),
    budgetUsd: Number(process.env.AI_DAILY_BUDGET_USD || 25),
    worker: parse<Heartbeat>(kv.get('worker:heartbeat')),
    backup: parse<Backup>(kv.get('backup:last')),
  };
}
export type AdminOverview = ReturnType<typeof adminOverview>;
