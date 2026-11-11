import { db } from './db';
import { env } from './env';
import { adminOverview } from './admin';
import { leadStats } from './leads';
import { mailer } from './mail';

const DAY = 24 * 3600 * 1000;

export type FounderDigest = Parameters<typeof mailer.founderDigest>[1];

const weekEnding = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });

/**
 * The weekly numbers from the business plan. Money, sign-ups and the free grader come from the admin overview so the email
 * and the admin page always agree; the seven-day review and cancellation figures are measured back from `at`.
 */
export function buildDigest(at = Date.now()): FounderDigest {
  const since = at - 7 * DAY;
  const overview = adminOverview();
  const leads = leadStats(since);
  const conn = db();
  const reviews = conn.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END), 0) AS complete,
      COALESCE(SUM(CASE WHEN status = 'failed' AND COALESCE(error_code, '') != 'cancelled' THEN 1 ELSE 0 END), 0) AS failed,
      COALESCE(SUM(cost_usd), 0) AS spend
    FROM reviews WHERE finished_at >= ?`).get(since) as { complete: number; failed: number; spend: number };
  const peak = conn.prepare(`SELECT COALESCE(MAX(day_spend), 0) AS peak FROM
    (SELECT SUM(cost_usd) AS day_spend FROM reviews WHERE finished_at >= ? GROUP BY date(finished_at / 1000, 'unixepoch'))`).get(since) as { peak: number };
  // Stripe's portal feedback is the only cancellation record, so customers already set to cancel are counted too.
  const cancellations = (conn.prepare(`SELECT COUNT(*) AS n FROM (
      SELECT user_id AS id FROM feedback WHERE kind = 'cancel' AND user_id IS NOT NULL AND created_at >= ?
      UNION
      SELECT id FROM users WHERE id != 'guest' AND cancel_at_period_end = 1 AND plan != 'free' AND plan_status IN ('active', 'trialing', 'past_due'))`).get(since) as { n: number }).n;
  const finished = reviews.complete + reviews.failed;

  return {
    weekLabel: `week to ${weekEnding.format(at)}`,
    mrrGbp: overview.mrrGbp,
    paying: overview.paid.reduce((sum, p) => sum + p.n, 0),
    newUsers: overview.users.lastWeek,
    grades: overview.growth.grades,
    claimed: overview.growth.claimed,
    packRequests: leads.packsSince,
    openLeads: leads.open,
    cancellations,
    spendUsd: reviews.spend,
    peakDayUsd: peak.peak,
    budgetUsd: overview.budgetUsd,
    failRate: finished ? reviews.failed / finished : 0,
    adminUrl: `${env.appUrl}/admin`,
  };
}

/** The next Monday at 07:00 UTC (08:00 in British summer): when the plan says to check the numbers. */
export function nextDigestAt(from = Date.now()): number {
  const d = new Date(from);
  d.setUTCHours(7, 0, 0, 0);
  while (d.getUTCDay() !== 1 || d.getTime() <= from) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}

/** Emails the numbers to the founder. Does nothing when no founder or admin address is configured. */
export async function sendFounderDigest(at = Date.now()): Promise<{ sent: boolean }> {
  const to = env.founderAlertEmail;
  if (!to) return { sent: false };
  return mailer.founderDigest(to, buildDigest(at));
}
