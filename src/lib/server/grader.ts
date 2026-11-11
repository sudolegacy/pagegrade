import { rm } from 'node:fs/promises';
import { db, now } from './db';
import { randomId } from './ids';
import { HttpError } from './errors';
import { GUEST_USER_ID, type User } from './users';
import { outOfReviewsMessage, reviewDir, usageFor, type ReviewStatus } from './reviews';
import type { Intake } from '../engine/intake';
import type { Report } from '../engine/report';

/**
 * Free grader: anyone can grade a page without an account. The grade belongs
 * to the guest user and is tied to the visitor's browser by a random key in an
 * httpOnly cookie. Anyone with the link sees the score and the top problems;
 * the fixes need an account. Signing up moves the browser's grades into the
 * new account for free; an existing account unlocks one for 1 review.
 */
export const GUEST_COOKIE = 'pg_guest';
export const GUEST_COOKIE_MAX_AGE = 30 * 24 * 3600;
export const GUEST_AUDIENCE = 'People visiting this page for the first time';
const GUEST_KEEP_MS = 30 * 24 * 3600_000;

export const newGuestKey = () => randomId(24);
export const isGuestKey = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(v);

export function createGuestReview(input: { url: string; pageType: Intake['pageType']; goal: Intake['goal'] }, key: string): string {
  const id = randomId(12);
  db().prepare(`INSERT INTO reviews (id, user_id, url, page_type, goal, audience, context, status, origin, guest_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, '', 'queued', 'guest', ?, ?)`).run(id, GUEST_USER_ID, input.url, input.pageType, input.goal, GUEST_AUDIENCE, key, now());
  return id;
}

export const guestGradesSince = (t: number) => (db().prepare("SELECT COUNT(*) AS n FROM reviews WHERE origin = 'guest' AND created_at >= ?").get(t) as { n: number }).n;

/** One free grade at a time per browser. */
export function inflightGuestGrade(key: string): string | null {
  return (db().prepare("SELECT id FROM reviews WHERE guest_key = ? AND origin = 'guest' AND status IN ('queued', 'running') AND deleted_at IS NULL LIMIT 1").get(key) as { id: string } | undefined)?.id ?? null;
}

export type GradeResult = {
  score: number; grade: string; verdict: string; summary: string;
  categories: { id: string; label: string; score: number | null }[];
  topIssues: { title: string; severity: string }[];
  issueCount: number; strengthCount: number; rewriteCount: number;
  performance: number | null; lcpMs: number | null;
  ai: { passed: number; total: number; blocked: string[] } | null;
};

export type GradeTeaser = {
  id: string; url: string; finalUrl: string | null; status: ReviewStatus; stage: string | null; queuePosition: number | null;
  createdAt: number; startedAt: number | null; errorMessage: string | null;
  /** Saved to an account. */
  claimed: boolean;
  /** Ran in this browser. */
  mine: boolean;
  result: GradeResult | null;
};

/** What the free grader shows: the score and the problems, never the fixes or rewrites. */
export function teaserResult(report: Report): GradeResult {
  const rw = report.rewrites;
  return {
    score: report.score, grade: String(report.grade), verdict: report.verdict, summary: report.summary,
    categories: report.categories.map((c) => ({ id: c.id, label: c.label, score: c.score })),
    topIssues: report.issues.slice(0, 3).map((i) => ({ title: i.title, severity: i.severity })),
    issueCount: report.issues.length, strengthCount: report.strengths.length,
    rewriteCount: rw ? rw.headlines.length + rw.ctas.length + (rw.subheadline ? 1 : 0) : 0,
    performance: report.performance?.scores.performance ?? null, lcpMs: report.performance?.metrics.lcpMs ?? null,
    ai: report.aiReadiness
      ? { passed: report.aiReadiness.passed, total: report.aiReadiness.total, blocked: report.aiReadiness.crawlers.filter((c) => c.status === 'blocked' && c.role !== 'training').map((c) => c.product) }
      : null,
  };
}

export function getGradeTeaser(id: string, key?: string | null): GradeTeaser | null {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) return null;
  const conn = db();
  const r = conn.prepare("SELECT id, user_id, url, final_url, status, stage, created_at, started_at, error_message, report_json, guest_key FROM reviews WHERE id = ? AND origin = 'guest' AND deleted_at IS NULL").get(id) as
    { id: string; user_id: string; url: string; final_url: string | null; status: ReviewStatus; stage: string | null; created_at: number; started_at: number | null; error_message: string | null; report_json: string | null; guest_key: string | null } | undefined;
  if (!r) return null;
  const claimed = r.user_id !== GUEST_USER_ID;
  const mine = isGuestKey(key) && r.guest_key === key;
  const queuePosition = r.status === 'queued'
    ? 1 + (conn.prepare("SELECT COUNT(*) AS n FROM reviews WHERE status = 'queued' AND deleted_at IS NULL AND created_at < ?").get(r.created_at) as { n: number }).n
    : null;
  // Once a grade is saved to an account it is private: other visitors only see that it exists.
  const show = r.status === 'complete' && !!r.report_json && (!claimed || mine);
  return {
    id: r.id, url: r.url, finalUrl: r.final_url, status: r.status, stage: r.stage, queuePosition, createdAt: r.created_at, startedAt: r.started_at,
    errorMessage: r.status === 'failed' ? r.error_message : null, claimed, mine,
    result: show ? teaserResult(JSON.parse(r.report_json!) as Report) : null,
  };
}

/** On signup: every grade this browser ran moves into the new account, free of charge. */
export function claimGuestGrades(userId: string, key: string | null | undefined): number {
  if (!isGuestKey(key)) return 0;
  return db().prepare("UPDATE reviews SET user_id = ? WHERE guest_key = ? AND user_id = ? AND origin = 'guest' AND deleted_at IS NULL").run(userId, key, GUEST_USER_ID).changes;
}

/** An existing account unlocks a grade it ran while signed out. This uses 1 review. */
export function unlockGuestGrade(user: User, id: string, key: string | null | undefined, opts: { admin?: boolean } = {}): string {
  const conn = db();
  return conn.transaction(() => {
    const r = conn.prepare("SELECT id, user_id, guest_key, status FROM reviews WHERE id = ? AND origin = 'guest' AND deleted_at IS NULL").get(id) as
      { id: string; user_id: string; guest_key: string | null; status: ReviewStatus } | undefined;
    if (!r) throw new HttpError(404, 'This grade was not found.', 'not_found');
    if (r.user_id === user.id) return r.id;
    if (r.user_id !== GUEST_USER_ID || !isGuestKey(key) || r.guest_key !== key) {
      throw new HttpError(403, 'Only the browser that ran this grade can unlock it. Run your own free grade, or review the page from your account.', 'not_yours');
    }
    if (r.status === 'failed') throw new HttpError(409, 'This grade did not finish, so there is nothing to unlock. Review the page from your account instead.', 'not_complete');
    if (r.status !== 'complete') throw new HttpError(409, 'This grade is still running. You can unlock it as soon as it finishes.', 'not_complete');
    const usage = usageFor(user, opts);
    if (!usage.unlimited && usage.remaining <= 0) throw new HttpError(402, outOfReviewsMessage(usage), 'out_of_reviews');
    conn.prepare('UPDATE reviews SET user_id = ?, charged = ?, charged_at = ? WHERE id = ?').run(user.id, usage.unlimited ? 0 : 1, usage.unlimited ? null : now(), r.id);
    return r.id;
  }).immediate();
}

/** Unclaimed free grades are kept for 30 days, then deleted with their screenshots. */
export async function pruneGuestGrades(t = now()): Promise<number> {
  const conn = db();
  const rows = conn.prepare("SELECT id FROM reviews WHERE user_id = ? AND origin = 'guest' AND deleted_at IS NULL AND status IN ('complete', 'failed') AND created_at < ? LIMIT 500")
    .all(GUEST_USER_ID, t - GUEST_KEEP_MS) as { id: string }[];
  for (const { id } of rows) {
    conn.prepare('UPDATE reviews SET deleted_at = ?, report_json = NULL WHERE id = ?').run(t, id);
    await rm(reviewDir(id), { recursive: true, force: true }).catch(() => undefined);
  }
  return rows.length;
}
