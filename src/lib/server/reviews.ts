import { rm } from 'node:fs/promises';
import path from 'node:path';
import { db, now } from './db';
import { env } from './env';
import { randomId } from './ids';
import { HttpError } from './errors';
import { PLANS, type Plan } from '../plans';
import type { User } from './users';
import type { Report } from '../engine/report';
import type { Intake } from '../engine/intake';

export type ReviewStatus = 'queued' | 'running' | 'complete' | 'failed';
/** app: started in the app; bulk: part of a bulk batch; guest: free grader; monitor: weekly check. */
export type ReviewOrigin = 'app' | 'bulk' | 'guest' | 'monitor';

const DAY = 24 * 3600 * 1000;

type Row = {
  id: string; user_id: string; url: string; final_url: string | null; page_type: string; goal: string; audience: string; context: string;
  status: ReviewStatus; stage: string | null; attempts: number; score: number | null; grade: string | null; verdict: string | null;
  error_code: string | null; error_message: string | null; report_json: string | null; share_id: string | null;
  charged: number; charged_at: number | null; cost_usd: number | null; duration_ms: number | null;
  locked_by: string | null; lease_until: number | null; created_at: number; started_at: number | null; finished_at: number | null; deleted_at: number | null;
  origin: ReviewOrigin; guest_key: string | null; client_id: string | null; monitor_id: string | null; batch_id: string | null;
};

export type ReviewSummary = {
  id: string; url: string; finalUrl: string | null; pageType: string; goal: string; audience: string;
  status: ReviewStatus; stage: string | null; score: number | null; grade: string | null; verdict: string | null;
  errorMessage: string | null; shareId: string | null; createdAt: number; finishedAt: number | null;
  origin: ReviewOrigin; clientId: string | null; monitorId: string | null; batchId: string | null;
};
export type ReviewDetail = ReviewSummary & { userId: string; context: string; errorCode: string | null; startedAt: number | null; queuePosition: number | null; report: Report | null };

const SUMMARY_COLS = 'id, user_id, url, final_url, page_type, goal, audience, status, stage, score, grade, verdict, error_message, share_id, created_at, finished_at, origin, client_id, monitor_id, batch_id';

type SummaryRow = Pick<Row, 'id' | 'url' | 'final_url' | 'page_type' | 'goal' | 'audience' | 'status' | 'stage' | 'score' | 'grade' | 'verdict' | 'error_message' | 'share_id' | 'created_at' | 'finished_at' | 'origin' | 'client_id' | 'monitor_id' | 'batch_id'>;
const toSummary = (r: SummaryRow): ReviewSummary => ({
  id: r.id, url: r.url, finalUrl: r.final_url, pageType: r.page_type, goal: r.goal, audience: r.audience, status: r.status, stage: r.stage,
  score: r.score, grade: r.grade, verdict: r.verdict, errorMessage: r.error_message, shareId: r.share_id, createdAt: r.created_at, finishedAt: r.finished_at,
  origin: r.origin ?? 'app', clientId: r.client_id ?? null, monitorId: r.monitor_id ?? null, batchId: r.batch_id ?? null,
});

export const reviewDir = (id: string) => {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) throw new Error('invalid review id');
  return path.join(env.reviewsDir, id);
};

// ---------------------------------------------------------------- allowance

export type Usage = { plan: Plan; used: number; limit: number; remaining: number; unlimited: boolean; period: Plan['period']; resetsAt: number | null };

/** Subscription states that keep a paid plan; the queue SQL uses the same list. */
const PAID_STATUSES = ['active', 'trialing', 'past_due'];
const PAID_STATUSES_SQL = `(${PAID_STATUSES.map((s) => `'${s}'`).join(', ')})`;

/** The plan a user is entitled to right now (a lapsed subscription falls back to Free). */
export function entitledPlan(user: User): Plan {
  const plan = PLANS[user.plan] ?? PLANS.free;
  if (plan.id === 'free') return plan;
  return PAID_STATUSES.includes(user.planStatus) ? plan : PLANS.free;
}

/** Adds calendar months in UTC, clamping to the end of shorter months (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(t: number, n: number): number {
  const d = new Date(t);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return target.getTime();
}

/**
 * The monthly allowance window that contains `t`. For monthly subscriptions it
 * is the billing period; for yearly ones it is month k of the paid year, so a
 * yearly plan gets the same allowance every month rather than once a year.
 */
export function allowanceWindow(periodStart: number | null, periodEnd: number | null, t = now()): { start: number; end: number | null } {
  if (!periodStart) return { start: t - 31 * DAY, end: periodEnd };
  let k = 0;
  while (k < 1200 && addMonths(periodStart, k + 1) <= t) k++;
  const start = addMonths(periodStart, k);
  const next = addMonths(periodStart, k + 1);
  return { start, end: periodEnd && periodEnd > start ? Math.min(next, periodEnd) : next };
}

/**
 * Reviews are only charged when they complete, so usage is the number of
 * charged reviews in the current allowance window (lifetime for Free, the
 * current month for paid plans). Deleting a review does not refund it. Weekly
 * monitor checks and free-grader results are never charged.
 */
export function usageFor(user: User, opts: { admin?: boolean } = {}): Usage {
  const plan = entitledPlan(user);
  const window = plan.period === 'lifetime' ? { start: 0, end: null } : allowanceWindow(user.periodStart, user.periodEnd);
  const used = (db().prepare('SELECT COUNT(*) AS n FROM reviews WHERE user_id = ? AND charged = 1 AND charged_at >= ?').get(user.id, window.start) as { n: number }).n;
  const unlimited = !!opts.admin;
  return {
    plan, used, limit: plan.reviews, unlimited,
    remaining: unlimited ? Number.MAX_SAFE_INTEGER : Math.max(0, plan.reviews - used),
    period: plan.period, resetsAt: plan.period === 'month' ? window.end : null,
  };
}

export const outOfReviewsMessage = (usage: Usage) => usage.plan.id === 'free'
  ? `You've used your ${usage.limit} free reviews. Choose a plan to keep reviewing pages.`
  : `You've used all ${usage.limit} reviews in this billing period. Upgrade your plan or wait until your allowance resets.`;

// ---------------------------------------------------------------- user-facing

export type NewReview = Intake & { url: string };
export type CreateOptions = { admin?: boolean; clientId?: string | null; origin?: 'app' | 'bulk' };

/**
 * Queues one or more reviews in one transaction. Plans allow a number of
 * reviews in progress at once (1 on Free and Starter), and the allowance must
 * cover the new reviews plus the ones already running.
 */
export function createReviews(user: User, inputs: NewReview[], opts: CreateOptions = {}): { ids: string[]; batchId: string | null } {
  if (!inputs.length) throw new HttpError(400, 'Add at least one page to review.', 'no_pages');
  const conn = db();
  return conn.transaction(() => {
    if (opts.clientId && !conn.prepare('SELECT 1 FROM clients WHERE id = ? AND user_id = ?').get(opts.clientId, user.id)) {
      throw new HttpError(404, 'Client folder not found.', 'client_not_found');
    }
    const plan = entitledPlan(user);
    const maxInflight = Math.max(1, plan.limits.inflight);
    const inflight = conn.prepare("SELECT id FROM reviews WHERE user_id = ? AND status IN ('queued', 'running') AND origin IN ('app', 'bulk') AND deleted_at IS NULL ORDER BY created_at").all(user.id) as { id: string }[];
    if (inflight.length + inputs.length > maxInflight) {
      if (inflight.length && (maxInflight === 1 || inflight.length >= maxInflight)) {
        throw new HttpError(409, maxInflight === 1
          ? 'You already have a review in progress. You can start another as soon as it finishes.'
          : `You already have ${inflight.length} reviews in progress, the most your plan runs at once. You can start more as soon as they finish.`, 'review_in_progress', { reviewId: inflight[0].id });
      }
      throw new HttpError(409, `Your plan runs up to ${maxInflight} reviews at once${inflight.length ? ` and ${inflight.length} ${inflight.length === 1 ? 'is' : 'are'} already in progress` : ''}. Review fewer pages, or wait for some to finish.`, 'too_many_in_progress');
    }
    const usage = usageFor(user, opts);
    if (!usage.unlimited && usage.remaining - inflight.length < inputs.length) {
      const left = Math.max(0, usage.remaining - inflight.length);
      throw new HttpError(402, left > 0 && inputs.length > 1
        ? `You have ${left} review${left === 1 ? '' : 's'} left, so you cannot start ${inputs.length}. Review fewer pages or upgrade your plan.`
        : outOfReviewsMessage(usage), 'out_of_reviews');
    }
    const t = now();
    const batchId = inputs.length > 1 ? randomId(9) : null;
    const origin = opts.origin ?? (batchId ? 'bulk' : 'app');
    const insert = conn.prepare(`INSERT INTO reviews (id, user_id, url, page_type, goal, audience, context, status, origin, client_id, batch_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)`);
    const ids = inputs.map((input, i) => {
      const id = randomId(12);
      insert.run(id, user.id, input.url, input.pageType, input.goal, input.audience, input.context ?? '', origin, opts.clientId ?? null, batchId, t + i);
      return id;
    });
    return { ids, batchId };
  }).immediate();
}

export function createReview(user: User, input: NewReview, opts: CreateOptions = {}): string {
  return createReviews(user, [input], opts).ids[0];
}

export function listReviews(userId: string, opts: { limit?: number; before?: number; q?: string; status?: ReviewStatus; clientId?: string; batchId?: string } = {}): ReviewSummary[] {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
  const where = ['user_id = ?', 'deleted_at IS NULL', 'created_at < ?'];
  const args: (string | number)[] = [userId, opts.before ?? Number.MAX_SAFE_INTEGER];
  const q = opts.q?.trim().slice(0, 200);
  if (q) { where.push("(url LIKE ? ESCAPE '\\' OR final_url LIKE ? ESCAPE '\\')"); const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`; args.push(like, like); }
  if (opts.status) { where.push('status = ?'); args.push(opts.status); }
  if (opts.clientId) { where.push('client_id = ?'); args.push(opts.clientId); }
  if (opts.batchId) { where.push('batch_id = ?'); args.push(opts.batchId); }
  const rows = db().prepare(`SELECT ${SUMMARY_COLS} FROM reviews WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`)
    .all(...args, limit) as Row[];
  return rows.map(toSummary);
}

/** Completed reviews (score history) for the Pages and Compare views, oldest first. No report bodies. */
export function listScoreHistory(userId: string, limit = 500): ReviewSummary[] {
  const rows = db().prepare(`SELECT ${SUMMARY_COLS} FROM reviews WHERE user_id = ? AND deleted_at IS NULL AND status = 'complete' AND score IS NOT NULL ORDER BY created_at DESC LIMIT ?`)
    .all(userId, Math.max(1, Math.min(1000, limit))) as Row[];
  return rows.map(toSummary).reverse();
}

export function countReviews(userId: string) {
  return (db().prepare('SELECT COUNT(*) AS n FROM reviews WHERE user_id = ? AND deleted_at IS NULL').get(userId) as { n: number }).n;
}

const queuePositionOf = (createdAt: number) =>
  1 + (db().prepare("SELECT COUNT(*) AS n FROM reviews WHERE status = 'queued' AND deleted_at IS NULL AND created_at < ?").get(createdAt) as { n: number }).n;

function detail(r: Row): ReviewDetail {
  return {
    ...toSummary(r), userId: r.user_id, context: r.context, errorCode: r.error_code, startedAt: r.started_at,
    queuePosition: r.status === 'queued' ? queuePositionOf(r.created_at) : null,
    report: r.report_json ? (JSON.parse(r.report_json) as Report) : null,
  };
}

export function getReview(id: string, userId: string): ReviewDetail | null {
  const r = db().prepare('SELECT * FROM reviews WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(id, userId) as Row | undefined;
  return r ? detail(r) : null;
}

/** Lightweight status for polling, without the report body. */
export function getReviewStatus(id: string, userId: string) {
  const r = db().prepare(`SELECT ${SUMMARY_COLS}, started_at FROM reviews WHERE id = ? AND user_id = ? AND deleted_at IS NULL`).get(id, userId) as (Row) | undefined;
  if (!r) return null;
  return { ...toSummary(r), startedAt: r.started_at, queuePosition: r.status === 'queued' ? queuePositionOf(r.created_at) : null };
}

export function getSharedReview(shareId: string): ReviewDetail | null {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(shareId)) return null;
  const r = db().prepare("SELECT * FROM reviews WHERE share_id = ? AND status = 'complete' AND deleted_at IS NULL").get(shareId) as Row | undefined;
  return r ? detail(r) : null;
}

/** Owner check for file access: returns the review id when the caller may read its files. */
export function canReadFiles(id: string, opts: { userId?: string | null; shareId?: string | null }): boolean {
  const r = db().prepare('SELECT user_id, share_id, deleted_at FROM reviews WHERE id = ?').get(id) as Pick<Row, 'user_id' | 'share_id' | 'deleted_at'> | undefined;
  if (!r || r.deleted_at) return false;
  if (opts.userId && r.user_id === opts.userId) return true;
  return !!(opts.shareId && r.share_id && opts.shareId === r.share_id);
}

export function setSharing(id: string, userId: string, enabled: boolean): string | null {
  const r = db().prepare("SELECT status, share_id FROM reviews WHERE id = ? AND user_id = ? AND deleted_at IS NULL").get(id, userId) as Pick<Row, 'status' | 'share_id'> | undefined;
  if (!r) throw new HttpError(404, 'Review not found.', 'not_found');
  if (r.status !== 'complete') throw new HttpError(409, 'Only finished reviews can be shared.', 'not_complete');
  const shareId = enabled ? r.share_id ?? randomId(15) : null;
  db().prepare('UPDATE reviews SET share_id = ? WHERE id = ?').run(shareId, id);
  return shareId;
}

/** Files a review in a client folder (or takes it out with null). */
export function setReviewClient(id: string, userId: string, clientId: string | null) {
  const conn = db();
  if (clientId && !conn.prepare('SELECT 1 FROM clients WHERE id = ? AND user_id = ?').get(clientId, userId)) throw new HttpError(404, 'Client folder not found.', 'client_not_found');
  const res = conn.prepare('UPDATE reviews SET client_id = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL').run(clientId, id, userId);
  if (!res.changes) throw new HttpError(404, 'Review not found.', 'not_found');
}

/** Soft delete: the row stays for usage accounting, the report and files are removed. */
export async function deleteReview(id: string, userId: string) {
  const conn = db();
  const r = conn.prepare('SELECT status FROM reviews WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(id, userId) as Pick<Row, 'status'> | undefined;
  if (!r) throw new HttpError(404, 'Review not found.', 'not_found');
  if (r.status === 'running') throw new HttpError(409, 'This review is being processed right now. You can delete it once it finishes.', 'review_running');
  // Keep only what usage limits need (address, date, outcome); drop the report and the visitor-provided text.
  conn.prepare(`UPDATE reviews SET deleted_at = ?, report_json = NULL, share_id = NULL, audience = '', context = '',
    status = CASE WHEN status = 'queued' THEN 'failed' ELSE status END,
    error_code = CASE WHEN status = 'queued' THEN 'cancelled' ELSE error_code END WHERE id = ?`).run(now(), id);
  await rm(reviewDir(id), { recursive: true, force: true });
}

export async function deleteAllReviewFiles(userId: string) {
  const ids = db().prepare('SELECT id FROM reviews WHERE user_id = ?').all(userId) as { id: string }[];
  await Promise.all(ids.map((r) => rm(reviewDir(r.id), { recursive: true, force: true })));
}

// ---------------------------------------------------------------- worker

export type ClaimedReview = Pick<Row, 'id' | 'user_id' | 'url' | 'page_type' | 'goal' | 'audience' | 'context' | 'attempts' | 'created_at' | 'origin' | 'monitor_id'>;
export const MAX_ATTEMPTS = 3;

/**
 * Atomically claims the next queued review. Paid Pro/Agency reviews go first,
 * weekly monitor checks last; within a tier, people take turns, so one bulk
 * batch of 25 pages does not hold up everyone else. With `paidOnly`, reviews
 * from free accounts and the free grader stay queued instead (the worker asks
 * for this once the daily budget is spent). Reviews whose worker stopped
 * heartbeating are requeued, or failed after MAX_ATTEMPTS so a poison page
 * cannot loop forever.
 */
export function claimNextReview(workerId: string, leaseMs: number, opts: { paidOnly?: boolean } = {}): { claimed: ClaimedReview | null; abandoned: string[] } {
  const conn = db();
  const t = now();
  // Filtering the candidates, not the winner, keeps a free job from holding up a paid one behind it.
  const candidates = opts.paidOnly
    ? `AND r.origin != 'guest' AND r.user_id IN (SELECT id FROM users WHERE plan != 'free' AND plan_status IN ${PAID_STATUSES_SQL})`
    : '';
  return conn.transaction(() => {
    const abandoned = (conn.prepare("SELECT id FROM reviews WHERE status = 'running' AND lease_until < ? AND attempts >= ?").all(t, MAX_ATTEMPTS) as { id: string }[]).map((r) => r.id);
    if (abandoned.length) {
      conn.prepare(`UPDATE reviews SET status = 'failed', stage = NULL, error_code = 'worker_lost', error_message = ?, finished_at = ?, locked_by = NULL, lease_until = NULL
        WHERE status = 'running' AND lease_until < ? AND attempts >= ?`).run('This review stopped unexpectedly several times, so we gave up. You have not been charged.', t, t, MAX_ATTEMPTS);
    }
    conn.prepare("UPDATE reviews SET status = 'queued', stage = NULL, locked_by = NULL, lease_until = NULL WHERE status = 'running' AND lease_until < ?").run(t);
    const row = conn.prepare(`SELECT q.id, q.user_id, q.url, q.page_type, q.goal, q.audience, q.context, q.attempts, q.created_at, q.origin, q.monitor_id
      FROM (
        SELECT r.*, ROW_NUMBER() OVER (
          PARTITION BY CASE WHEN r.origin = 'guest' THEN r.id WHEN r.origin = 'monitor' THEN r.user_id || ':monitor' ELSE r.user_id END
          ORDER BY r.created_at) AS turn
        FROM reviews r WHERE r.status = 'queued' AND r.deleted_at IS NULL ${candidates}
      ) q JOIN users u ON u.id = q.user_id
      ORDER BY CASE WHEN q.origin = 'monitor' THEN 2 WHEN u.plan IN ('pro', 'agency') AND u.plan_status IN ${PAID_STATUSES_SQL} THEN 0 ELSE 1 END, q.turn, q.created_at
      LIMIT 1`).get() as ClaimedReview | undefined;
    if (!row) return { claimed: null, abandoned };
    conn.prepare(`UPDATE reviews SET status = 'running', stage = 'starting', locked_by = ?, lease_until = ?, attempts = attempts + 1, started_at = COALESCE(started_at, ?) WHERE id = ?`)
      .run(workerId, t + leaseMs, t, row.id);
    return { claimed: { ...row, attempts: row.attempts + 1 }, abandoned };
  }).immediate();
}

/** Extends the lease; returns false if this worker no longer owns the review. */
export function heartbeat(id: string, workerId: string, leaseMs: number, stage?: string): boolean {
  const res = stage
    ? db().prepare("UPDATE reviews SET lease_until = ?, stage = ? WHERE id = ? AND locked_by = ? AND status = 'running'").run(now() + leaseMs, stage, id, workerId)
    : db().prepare("UPDATE reviews SET lease_until = ? WHERE id = ? AND locked_by = ? AND status = 'running'").run(now() + leaseMs, id, workerId);
  return res.changes > 0;
}

/** Stores the report and charges the review in one transaction (free grades and weekly checks are not charged). */
export function completeReview(id: string, workerId: string, report: Report, durationMs: number): boolean {
  const t = now();
  const res = db().prepare(`UPDATE reviews SET status = 'complete', stage = NULL, score = ?, grade = ?, verdict = ?, final_url = ?, report_json = ?,
      charged = CASE WHEN origin IN ('guest', 'monitor') THEN 0 ELSE 1 END, charged_at = CASE WHEN origin IN ('guest', 'monitor') THEN NULL ELSE ? END,
      cost_usd = ?, duration_ms = ?, finished_at = ?, locked_by = NULL, lease_until = NULL, error_code = NULL, error_message = NULL
    WHERE id = ? AND locked_by = ? AND status = 'running'`)
    .run(report.score, report.grade, report.verdict, report.finalUrl, JSON.stringify(report), t, report.meta.usage.costUsd, durationMs, t, id, workerId);
  return res.changes > 0;
}

export function failReview(id: string, workerId: string, code: string, message: string, costUsd = 0): boolean {
  const res = db().prepare(`UPDATE reviews SET status = 'failed', stage = NULL, error_code = ?, error_message = ?, cost_usd = ?, finished_at = ?, locked_by = NULL, lease_until = NULL
    WHERE id = ? AND locked_by = ? AND status = 'running'`).run(code, message.slice(0, 500), costUsd, now(), id, workerId);
  return res.changes > 0;
}

/** Puts a claimed review back on the queue (graceful shutdown, transient failure). */
export function releaseReview(id: string, workerId: string, opts: { countAttempt?: boolean } = {}) {
  db().prepare(`UPDATE reviews SET status = 'queued', stage = NULL, locked_by = NULL, lease_until = NULL${opts.countAttempt ? '' : ', attempts = MAX(0, attempts - 1)'}
    WHERE id = ? AND locked_by = ? AND status = 'running'`).run(id, workerId);
}

/** AI spend today (UTC), used for the daily budget guards. */
export function spendToday(): number {
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  return (db().prepare('SELECT COALESCE(SUM(cost_usd), 0) AS s FROM reviews WHERE finished_at >= ?').get(start.getTime()) as { s: number }).s;
}

// ---------------------------------------------------------------- capacity

/** open: everyone; paid_only: past the daily budget, so paying customers only; closed: past the hard cap, nobody. */
export type CapacityMode = 'open' | 'paid_only' | 'closed';
export type CapacityCheck = { ok: true } | { ok: false; reason: 'budget' | 'hard_cap' };

/**
 * What today's estimated AI spend allows. The budget stops free usage from
 * using up the day; only the hard cap stops paying customers. The worker and
 * the API routes both ask here, so they always agree.
 */
export function capacityMode(spend: number = spendToday()): CapacityMode {
  if (spend >= env.aiDailyHardCapUsd) return 'closed';
  return spend >= env.aiDailyBudgetUsd ? 'paid_only' : 'open';
}

/** Whether this person (null: a visitor without an account) may start a review right now. */
export function capacityCheck(user: User | null, spend: number = spendToday()): CapacityCheck {
  const mode = capacityMode(spend);
  if (mode === 'closed') return { ok: false, reason: 'hard_cap' };
  if (mode === 'paid_only' && !(user && entitledPlan(user).id !== 'free')) return { ok: false, reason: 'budget' };
  return { ok: true };
}

/** The 503 the review routes return when capacityCheck says no. */
export function assertCapacity(user: User | null) {
  const check = capacityCheck(user);
  if (check.ok) return;
  throw new HttpError(503, check.reason === 'budget'
    ? 'PageGrade is very busy today, so free grades and reviews are paused until tomorrow. Paid plans are still running.'
    : 'PageGrade is very busy right now. Please try again in a few hours.', 'capacity');
}

export function reviewOwner(id: string) {
  return db().prepare('SELECT u.id, u.email, u.name, u.notify_on_complete, u.notify_monitor FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?').get(id) as { id: string; email: string; name: string; notify_on_complete: number; notify_monitor: number } | undefined;
}
