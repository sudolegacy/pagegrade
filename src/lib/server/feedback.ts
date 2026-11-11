import { db, now } from './db';
import { randomId } from './ids';

/** "Talk to every user": why people sign up, and why they cancel (from the Stripe billing portal). */
export const SIGNUP_REASONS = [
  { id: 'own_site', label: 'Improve my own website' },
  { id: 'client_work', label: 'Review pages for clients' },
  { id: 'launch', label: 'Check a page before it launches' },
  { id: 'ads', label: 'Get more from paid ads' },
  { id: 'ai_search', label: 'Show up in AI answers' },
  { id: 'curious', label: 'Just curious' },
] as const;

export type FeedbackKind = 'signup' | 'cancel' | 'general';

/** Stores feedback once per `ref` (for example one cancellation reason per subscription). Returns false for a duplicate. */
export function addFeedback(input: { userId: string | null; kind: FeedbackKind; answer?: string; comment?: string; ref?: string | null }): boolean {
  const res = db().prepare('INSERT INTO feedback (id, user_id, kind, answer, comment, ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(ref) DO NOTHING')
    .run(randomId(12), input.userId, input.kind, (input.answer ?? '').trim().slice(0, 80), (input.comment ?? '').trim().slice(0, 2000), input.ref ?? null, now());
  return res.changes > 0;
}

export function hasSignupFeedback(userId: string): boolean {
  return !!db().prepare("SELECT 1 FROM feedback WHERE user_id = ? AND kind = 'signup'").get(userId);
}

export type FeedbackEntry = { id: string; kind: FeedbackKind; answer: string; comment: string; email: string | null; plan: string | null; createdAt: number };

/** Newest first, without dismissed prompts that carry no comment. */
export function recentFeedback(limit = 25): FeedbackEntry[] {
  const rows = db().prepare(`SELECT f.id, f.kind, f.answer, f.comment, f.created_at, u.email, u.plan FROM feedback f LEFT JOIN users u ON u.id = f.user_id
    WHERE NOT (f.answer = 'dismissed' AND f.comment = '') ORDER BY f.created_at DESC LIMIT ?`).all(Math.max(1, Math.min(200, limit))) as
    { id: string; kind: FeedbackKind; answer: string; comment: string; created_at: number; email: string | null; plan: string | null }[];
  return rows.map((r) => ({ id: r.id, kind: r.kind, answer: r.answer, comment: r.comment, email: r.email, plan: r.plan, createdAt: r.created_at }));
}

export function feedbackCounts(kind: FeedbackKind): { answer: string; n: number }[] {
  return db().prepare("SELECT answer, COUNT(*) AS n FROM feedback WHERE kind = ? AND answer != '' AND answer != 'dismissed' GROUP BY answer ORDER BY n DESC").all(kind) as { answer: string; n: number }[];
}
