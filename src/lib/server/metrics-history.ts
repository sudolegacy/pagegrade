import { adminOverview } from './admin';
import { db, now } from './db';
import { buildDigest } from './digest';
import { HttpError } from './errors';

const DAY = 24 * 3600 * 1000;
export const WEEK = 7 * DAY;

/** Bounds for one week of outreach numbers. The admin route reads the same limits, so both reject the same input. */
export const OUTREACH_LIMITS = { count: 100_000, note: 500 } as const;

const clamp = (limit: number) => Math.max(1, Math.min(520, Math.floor(limit) || 1));

/** Monday 00:00 UTC of the week containing `at`: the key both weekly tables use. */
export function weekStart(at: number): number {
  const d = new Date(at);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
}

/** `part` as a percentage of `whole` to one decimal place, or null when there is nothing to divide by. */
export const percentOf = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

// ─── Weekly snapshots ───────────────────────────────────────────────────────

/**
 * One row for each Monday check. MRR, plan counts and the user total are as they stood when it was taken;
 * sign-ups, grades, pack requests, cancellations and AI spend cover the seven days before.
 */
export type MetricSnapshot = {
  weekStart: number; mrrGbp: number; paying: number; agencies: number; users: number; newUsers: number; grades: number;
  packRequests: number; openLeads: number; cancellations: number; spendUsd: number; createdAt: number;
};

const SNAPSHOT_SELECT = `SELECT week_start AS weekStart, mrr_gbp AS mrrGbp, paying, agencies, users, new_users AS newUsers, grades,
  pack_requests AS packRequests, open_leads AS openLeads, cancellations, spend_usd AS spendUsd, created_at AS createdAt FROM metric_snapshots`;

/** Stores the weekly numbers under the Monday of the week containing `at`, replacing any earlier snapshot for that week. */
export function recordSnapshot(at: number = Date.now()): MetricSnapshot {
  const digest = buildDigest(at);
  const overview = adminOverview();
  const week = weekStart(at);
  db().prepare(`INSERT INTO metric_snapshots (week_start, mrr_gbp, paying, agencies, users, new_users, grades, pack_requests, open_leads, cancellations, spend_usd, created_at)
    VALUES (@week, @mrr, @paying, @agencies, @users, @newUsers, @grades, @packRequests, @openLeads, @cancellations, @spend, @at)
    ON CONFLICT(week_start) DO UPDATE SET mrr_gbp = excluded.mrr_gbp, paying = excluded.paying, agencies = excluded.agencies, users = excluded.users,
      new_users = excluded.new_users, grades = excluded.grades, pack_requests = excluded.pack_requests, open_leads = excluded.open_leads,
      cancellations = excluded.cancellations, spend_usd = excluded.spend_usd, created_at = excluded.created_at`)
    .run({
      week, mrr: digest.mrrGbp, paying: digest.paying, agencies: overview.paid.find((p) => p.plan === 'agency')?.n ?? 0, users: overview.users.total,
      newUsers: digest.newUsers, grades: digest.grades, packRequests: digest.packRequests, openLeads: digest.openLeads,
      cancellations: digest.cancellations, spend: digest.spendUsd, at,
    });
  return db().prepare(`${SNAPSHOT_SELECT} WHERE week_start = ?`).get(week) as MetricSnapshot;
}

/** Newest week first. */
export function listSnapshots(limit = 26): MetricSnapshot[] {
  return db().prepare(`${SNAPSHOT_SELECT} ORDER BY week_start DESC LIMIT ?`).all(clamp(limit)) as MetricSnapshot[];
}

// ─── Outreach numbers typed in from the Autopilot sheet ─────────────────────

export type OutreachWeek = {
  weekStart: number; prospectsEmailed: number; replies: number; packRequests: number; optOuts: number; bounces: number; calls: number;
  note: string; updatedAt: number;
};
export type OutreachInput = { prospectsEmailed: number; replies: number; packRequests: number; optOuts: number; bounces: number; calls?: number; note?: string };
export type OutreachTotals = Omit<OutreachWeek, 'weekStart' | 'note' | 'updatedAt'> & { weeks: number };

const OUTREACH_SELECT = `SELECT week_start AS weekStart, prospects_emailed AS prospectsEmailed, replies, pack_requests AS packRequests, opt_outs AS optOuts,
  bounces, calls, note, updated_at AS updatedAt FROM outreach_weeks`;

const COUNT_FIELDS = [
  ['prospectsEmailed', 'Prospects emailed'], ['replies', 'Replies'], ['packRequests', 'Pack requests'], ['optOuts', 'Opt-outs'], ['bounces', 'Bounces'], ['calls', 'Calls'],
] as const;

const invalid = (message: string, field: string) => new HttpError(400, message, 'invalid_input', { field });

/** Saves one week's numbers, replacing what was there. `week` must be a Monday 00:00 UTC. */
export function upsertOutreachWeek(week: number, input: OutreachInput): OutreachWeek {
  if (weekStart(week) !== week) throw invalid('Choose the Monday that starts the week.', 'weekStart');
  const counts = { prospectsEmailed: input.prospectsEmailed, replies: input.replies, packRequests: input.packRequests, optOuts: input.optOuts, bounces: input.bounces, calls: input.calls ?? 0 };
  for (const [key, label] of COUNT_FIELDS) {
    const n = counts[key];
    if (!Number.isInteger(n) || n < 0 || n > OUTREACH_LIMITS.count) throw invalid(`${label}: use a whole number from 0 to ${OUTREACH_LIMITS.count.toLocaleString('en-GB')}.`, key);
  }
  const note = (input.note ?? '').trim();
  if (note.length > OUTREACH_LIMITS.note) throw invalid(`Keep the note to ${OUTREACH_LIMITS.note} characters or fewer.`, 'note');
  db().prepare(`INSERT INTO outreach_weeks (week_start, prospects_emailed, replies, pack_requests, opt_outs, bounces, calls, note, updated_at)
    VALUES (@week, @prospectsEmailed, @replies, @packRequests, @optOuts, @bounces, @calls, @note, @at)
    ON CONFLICT(week_start) DO UPDATE SET prospects_emailed = excluded.prospects_emailed, replies = excluded.replies, pack_requests = excluded.pack_requests,
      opt_outs = excluded.opt_outs, bounces = excluded.bounces, calls = excluded.calls, note = excluded.note, updated_at = excluded.updated_at`)
    .run({ week, ...counts, note, at: now() });
  return db().prepare(`${OUTREACH_SELECT} WHERE week_start = ?`).get(week) as OutreachWeek;
}

/** Newest week first. */
export function listOutreachWeeks(limit = 26): OutreachWeek[] {
  return db().prepare(`${OUTREACH_SELECT} ORDER BY week_start DESC LIMIT ?`).all(clamp(limit)) as OutreachWeek[];
}

/** Sums of every logged week starting on or after `sinceMs`, with how many weeks that was. */
export function outreachTotals(sinceMs: number): OutreachTotals {
  return db().prepare(`SELECT COUNT(*) AS weeks, COALESCE(SUM(prospects_emailed), 0) AS prospectsEmailed, COALESCE(SUM(replies), 0) AS replies,
      COALESCE(SUM(pack_requests), 0) AS packRequests, COALESCE(SUM(opt_outs), 0) AS optOuts, COALESCE(SUM(bounces), 0) AS bounces, COALESCE(SUM(calls), 0) AS calls
    FROM outreach_weeks WHERE week_start >= ?`).get(sinceMs) as OutreachTotals;
}

/** Percentages of the prospects emailed since `sinceMs`. Each is null until some outreach has been logged. */
export function outreachRates(sinceMs: number) {
  const t = outreachTotals(sinceMs);
  const of = (part: number) => percentOf(part, t.prospectsEmailed);
  return { emailed: t.prospectsEmailed, packRate: of(t.packRequests), replyRate: of(t.replies), optOutRate: of(t.optOuts), bounceRate: of(t.bounces) };
}

export type RateStatus = 'good' | 'bad' | 'unknown';

/** A `min` target is met at the target ("5% or more"); a `max` target has to be beaten ("under 2%"). */
export function rateStatus(value: number | null, target: number, direction: 'min' | 'max'): RateStatus {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  return (direction === 'min' ? value >= target : value < target) ? 'good' : 'bad';
}
