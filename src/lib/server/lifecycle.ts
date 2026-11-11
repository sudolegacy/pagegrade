import { db } from './db';
import { env } from './env';
import { mailer } from './mail';
import { PLANS } from '../plans';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** Protects the SMTP account, and the inbox of everyone eligible, if a backlog builds up. */
export const MAX_SENDS_PER_RUN = 50;
/** A user never gets two lifecycle emails within this long of each other. */
const MIN_GAP = 3 * DAY;
/** Stop a run after this many sends fail in a row (SMTP down) instead of waiting out a timeout for every user. */
const MAX_CONSECUTIVE_FAILURES = 3;

type Candidate = { id: string; email: string; name: string };

/**
 * Who gets what, in priority order. Each rule is an extra condition on `u` (users); everything shared
 * (verified, not opted out, not an admin, never sent this kind) is added in `candidates`.
 */
const RULES = {
  // Upgraded to Agency yesterday. updated_at alone also moves when someone edits their branding, so the billing period must be new too.
  agency_onboarding: `u.plan = 'agency' AND u.plan_status = 'active' AND u.updated_at BETWEEN @at - ${2 * DAY} AND @at - ${12 * HOUR}
    AND COALESCE(u.period_start, u.updated_at) >= @at - ${2 * DAY}`,
  // Used every free review and never became a customer (a Stripe customer means they reached checkout, or have since cancelled).
  free_used: `u.plan = 'free' AND u.plan_status = 'active' AND u.stripe_customer_id IS NULL
    AND (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id AND r.charged = 1) >= @freeLimit
    AND (SELECT MAX(r.finished_at) FROM reviews r WHERE r.user_id = u.id AND r.charged = 1) BETWEEN @at - ${30 * DAY} AND @at - ${DAY}`,
  first_review: `u.created_at BETWEEN @at - ${7 * DAY} AND @at - ${2 * DAY}
    AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.user_id = u.id AND (r.charged = 1 OR (r.status IN ('queued', 'running') AND r.deleted_at IS NULL)))`,
  checkin_7: `u.plan != 'free' AND u.plan_status = 'active' AND u.created_at BETWEEN @at - ${10 * DAY} AND @at - ${7 * DAY}`,
  checkin_25: `u.plan != 'free' AND u.plan_status = 'active' AND u.created_at BETWEEN @at - ${28 * DAY} AND @at - ${25 * DAY}`,
} as const;
export type LifecycleKind = keyof typeof RULES;

const SEND: Record<LifecycleKind, (u: Candidate) => Promise<unknown>> = {
  agency_onboarding: (u) => mailer.lifecycleAgencyOnboarding(u.email, { name: u.name, url: `${env.appUrl}/app/settings`, bookingUrl: env.bookingUrl }),
  free_used: (u) => mailer.lifecycleFreeUsed(u.email, { name: u.name, url: `${env.appUrl}/app/billing` }),
  first_review: (u) => mailer.lifecycleFirstReview(u.email, { name: u.name, url: `${env.appUrl}/app/new` }),
  checkin_7: (u) => mailer.lifecycleCheckIn(u.email, { name: u.name, url: `${env.appUrl}/app`, day: 7 }),
  checkin_25: (u) => mailer.lifecycleCheckIn(u.email, { name: u.name, url: `${env.appUrl}/app`, day: 25 }),
};

function candidates(kind: LifecycleKind, at: number, limit: number): Candidate[] {
  // notify_on_complete is the only email preference users have, so it doubles as the opt-out for these emails.
  return db().prepare(`SELECT u.id, u.email, u.name FROM users u
    WHERE u.id != 'guest' AND u.notify_on_complete = 1
      ${env.requireVerification ? 'AND u.email_verified_at IS NOT NULL' : ''}
      AND LOWER(u.email) NOT IN (SELECT value FROM json_each(@admins))
      AND NOT EXISTS (SELECT 1 FROM lifecycle_emails l WHERE l.user_id = u.id AND (l.kind = @kind OR l.sent_at > @at - ${MIN_GAP}))
      AND ${RULES[kind]}
    ORDER BY u.created_at LIMIT @limit`).all({ kind, at, limit, freeLimit: PLANS.free.reviews, admins: JSON.stringify(env.adminEmails) }) as Candidate[];
}

/** Records the send before making it, so two workers (or a crash mid-send) can never email a user twice. */
function claim(userId: string, kind: LifecycleKind, at: number): boolean {
  const conn = db();
  return conn.transaction(() => conn.prepare('INSERT OR IGNORE INTO lifecycle_emails (user_id, kind, sent_at) VALUES (?, ?, ?)').run(userId, kind, at).changes === 1).immediate();
}

/**
 * Sends the lifecycle emails that are due: at most one per user per kind, ever, and at most MAX_SENDS_PER_RUN in a run.
 * A failed send releases its claim, so the user is tried again on the next run. Without SMTP the mailer only logs, and
 * the send still counts, which keeps development behaviour the same as production.
 */
export async function runLifecycle(at = Date.now()): Promise<{ sent: number; failed: number; byKind: Record<string, number> }> {
  const result = { sent: 0, failed: 0, byKind: {} as Record<string, number> };
  if (!env.smtp && env.isProduction) return result;
  let streak = 0;
  for (const kind of Object.keys(RULES) as LifecycleKind[]) {
    for (const user of candidates(kind, at, MAX_SENDS_PER_RUN - result.sent)) {
      if (!claim(user.id, kind, at)) continue;
      try {
        await SEND[kind](user);
      } catch (error) {
        db().prepare('DELETE FROM lifecycle_emails WHERE user_id = ? AND kind = ?').run(user.id, kind);
        console.error(`[lifecycle] ${kind} email to ${user.id} failed`, error);
        result.failed++;
        if (++streak >= MAX_CONSECUTIVE_FAILURES) return result;
        continue;
      }
      streak = 0;
      result.sent++;
      result.byKind[kind] = (result.byKind[kind] ?? 0) + 1;
    }
    if (result.sent >= MAX_SENDS_PER_RUN) break;
  }
  return result;
}
