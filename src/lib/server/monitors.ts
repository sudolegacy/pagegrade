import { db, now } from './db';
import { randomId } from './ids';
import { HttpError } from './errors';
import { findUserById, type User } from './users';
import { entitledPlan } from './reviews';
import { compareReports, hasAlert, type MonitorChange, type MonitorKind } from '../monitor-diff';
import type { Report } from '../engine/report';

/**
 * Weekly monitoring. A monitor is created from a finished review (its
 * baseline) and re-checks that page every week as a normal review with
 * origin 'monitor'. Checks are never charged against the review allowance;
 * the number of monitors is limited by plan instead.
 */
export const DAY_MS = 24 * 3600_000;
export const WEEK_MS = 7 * DAY_MS;

type Row = {
  id: string; user_id: string; client_id: string | null; url: string; kind: MonitorKind; label: string;
  page_type: string; goal: string; audience: string; context: string; active: number; baseline_review_id: string | null;
  last_score: number | null; last_checked_at: number | null; last_changes: string | null; last_alert_at: number | null;
  failures: number; next_run_at: number; created_at: number;
};

export type Monitor = {
  id: string; url: string; kind: MonitorKind; label: string; clientId: string | null; active: boolean;
  lastScore: number | null; lastCheckedAt: number | null; lastChanges: MonitorChange[]; lastAlertAt: number | null;
  failures: number; nextRunAt: number; createdAt: number; latestReviewId: string | null;
  /** A check is queued or running right now. */
  checking: boolean;
  /** Beyond the plan's monitor limit (for example after a downgrade): paused until there is room. */
  overLimit: boolean;
};

const parseChanges = (s: string | null): MonitorChange[] => { try { return s ? (JSON.parse(s) as MonitorChange[]) : []; } catch { return []; } };

export function monitorQuota(user: User) {
  const limit = entitledPlan(user).limits.monitors;
  const used = (db().prepare('SELECT COUNT(*) AS n FROM monitors WHERE user_id = ?').get(user.id) as { n: number }).n;
  return { limit, used };
}

export function listMonitors(user: User): Monitor[] {
  const conn = db();
  const rows = conn.prepare('SELECT * FROM monitors WHERE user_id = ? ORDER BY created_at').all(user.id) as Row[];
  if (!rows.length) return [];
  const limit = entitledPlan(user).limits.monitors;
  const busy = new Set((conn.prepare("SELECT monitor_id FROM reviews WHERE user_id = ? AND origin = 'monitor' AND status IN ('queued', 'running') AND deleted_at IS NULL").all(user.id) as { monitor_id: string }[]).map((r) => r.monitor_id));
  const latest = new Map((conn.prepare(`SELECT monitor_id, id FROM (
      SELECT monitor_id, id, ROW_NUMBER() OVER (PARTITION BY monitor_id ORDER BY finished_at DESC) AS n
      FROM reviews WHERE user_id = ? AND origin = 'monitor' AND status = 'complete' AND deleted_at IS NULL
    ) WHERE n = 1`).all(user.id) as { monitor_id: string; id: string }[]).map((r) => [r.monitor_id, r.id]));
  let activeRank = 0;
  return rows.map((r) => {
    const overLimit = !!r.active && activeRank++ >= limit;
    return {
      id: r.id, url: r.url, kind: r.kind, label: r.label, clientId: r.client_id, active: !!r.active,
      lastScore: r.last_score, lastCheckedAt: r.last_checked_at, lastChanges: parseChanges(r.last_changes), lastAlertAt: r.last_alert_at,
      failures: r.failures, nextRunAt: r.next_run_at, createdAt: r.created_at, latestReviewId: latest.get(r.id) ?? r.baseline_review_id,
      checking: busy.has(r.id), overLimit,
    };
  });
}

const getMonitor = (user: User, id: string) => listMonitors(user).find((m) => m.id === id) ?? null;

export function monitorForUrl(userId: string, url: string): string | null {
  return (db().prepare('SELECT id FROM monitors WHERE user_id = ? AND url = ?').get(userId, url) as { id: string } | undefined)?.id ?? null;
}

export function createMonitor(user: User, input: { reviewId: string; kind?: MonitorKind; label?: string; clientId?: string | null }): Monitor {
  const conn = db();
  const id = conn.transaction(() => {
    const { limit, used } = monitorQuota(user);
    if (used >= limit) {
      throw new HttpError(402, limit
        ? `Your plan monitors up to ${limit} page${limit === 1 ? '' : 's'}. Remove one, or upgrade to monitor more.`
        : 'Weekly monitoring is part of the paid plans. Choose a plan to monitor this page.', 'monitor_limit');
    }
    const review = conn.prepare("SELECT id, url, page_type, goal, audience, context, score FROM reviews WHERE id = ? AND user_id = ? AND status = 'complete' AND deleted_at IS NULL")
      .get(input.reviewId, user.id) as { id: string; url: string; page_type: string; goal: string; audience: string; context: string; score: number | null } | undefined;
    if (!review) throw new HttpError(404, 'Choose a finished review of the page you want to monitor.', 'review_not_found');
    if (monitorForUrl(user.id, review.url)) throw new HttpError(409, 'You already monitor this page.', 'monitor_exists');
    if (input.clientId && !conn.prepare('SELECT 1 FROM clients WHERE id = ? AND user_id = ?').get(input.clientId, user.id)) throw new HttpError(404, 'Client folder not found.', 'client_not_found');
    // The first check is a week after the page was last reviewed (deleted reviews included), so
    // adding and removing a monitor cannot be used to get extra reviews.
    const lastFinished = (conn.prepare("SELECT MAX(finished_at) AS t FROM reviews WHERE user_id = ? AND url = ? AND status = 'complete'").get(user.id, review.url) as { t: number | null }).t;
    const t = now();
    const monitorId = randomId(12);
    conn.prepare(`INSERT INTO monitors (id, user_id, client_id, url, kind, label, page_type, goal, audience, context, active, baseline_review_id, last_score, next_run_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`)
      .run(monitorId, user.id, input.clientId ?? null, review.url, input.kind === 'competitor' ? 'competitor' : 'own', (input.label ?? '').trim().slice(0, 80),
        review.page_type, review.goal, review.audience, review.context, review.id, review.score, Math.max(t, (lastFinished ?? t) + WEEK_MS), t);
    return monitorId;
  }).immediate();
  return getMonitor(user, id)!;
}

export function updateMonitor(user: User, id: string, patch: { active?: boolean; kind?: MonitorKind; label?: string; clientId?: string | null }): Monitor {
  const conn = db();
  const row = conn.prepare('SELECT * FROM monitors WHERE id = ? AND user_id = ?').get(id, user.id) as Row | undefined;
  if (!row) throw new HttpError(404, 'Monitor not found.', 'not_found');
  if (patch.clientId && !conn.prepare('SELECT 1 FROM clients WHERE id = ? AND user_id = ?').get(patch.clientId, user.id)) throw new HttpError(404, 'Client folder not found.', 'client_not_found');
  conn.prepare('UPDATE monitors SET active = ?, kind = ?, label = ?, client_id = ?, next_run_at = ? WHERE id = ?').run(
    patch.active === undefined ? row.active : patch.active ? 1 : 0,
    patch.kind === undefined ? row.kind : patch.kind === 'competitor' ? 'competitor' : 'own',
    patch.label === undefined ? row.label : patch.label.trim().slice(0, 80),
    patch.clientId === undefined ? row.client_id : patch.clientId,
    patch.active && !row.active ? Math.max(row.next_run_at, now()) : row.next_run_at,
    id,
  );
  return getMonitor(user, id)!;
}

export function deleteMonitor(userId: string, id: string) {
  const res = db().prepare('DELETE FROM monitors WHERE id = ? AND user_id = ?').run(id, userId);
  if (!res.changes) throw new HttpError(404, 'Monitor not found.', 'not_found');
}

/** Queues this week's checks for monitors that are due. Returns the new review ids. */
export function scheduleDueMonitors(t = now()): string[] {
  const conn = db();
  return conn.transaction(() => {
    const due = conn.prepare('SELECT * FROM monitors WHERE active = 1 AND next_run_at <= ? ORDER BY next_run_at LIMIT 200').all(t) as Row[];
    const users = new Map<string, User | null>();
    const ids: string[] = [];
    for (const m of due) {
      if (!users.has(m.user_id)) users.set(m.user_id, findUserById(m.user_id));
      const user = users.get(m.user_id);
      if (!user) continue;
      // Over the limit (after a downgrade, say): the oldest monitors keep running, the rest wait.
      const rank = (conn.prepare('SELECT COUNT(*) AS n FROM monitors WHERE user_id = ? AND active = 1 AND (created_at < ? OR (created_at = ? AND id < ?))').get(m.user_id, m.created_at, m.created_at, m.id) as { n: number }).n;
      if (rank >= entitledPlan(user).limits.monitors) { conn.prepare('UPDATE monitors SET next_run_at = ? WHERE id = ?').run(t + DAY_MS, m.id); continue; }
      if (conn.prepare("SELECT 1 FROM reviews WHERE monitor_id = ? AND status IN ('queued', 'running') AND deleted_at IS NULL").get(m.id)) continue;
      const id = randomId(12);
      conn.prepare(`INSERT INTO reviews (id, user_id, url, page_type, goal, audience, context, status, origin, client_id, monitor_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 'monitor', ?, ?, ?)`).run(id, m.user_id, m.url, m.page_type, m.goal, m.audience, m.context, m.client_id, m.id, t);
      conn.prepare('UPDATE monitors SET next_run_at = ? WHERE id = ?').run(t + WEEK_MS, m.id);
      ids.push(id);
    }
    return ids;
  }).immediate();
}

export type MonitorOutcome = { monitor: Monitor; user: User; changes: MonitorChange[]; alert: boolean };

function monitorOf(reviewId: string): { m: Row; user: User } | null {
  const conn = db();
  const link = conn.prepare("SELECT monitor_id FROM reviews WHERE id = ? AND origin = 'monitor'").get(reviewId) as { monitor_id: string | null } | undefined;
  if (!link?.monitor_id) return null;
  const m = conn.prepare('SELECT * FROM monitors WHERE id = ?').get(link.monitor_id) as Row | undefined;
  const user = m ? findUserById(m.user_id) : null;
  return m && user ? { m, user } : null;
}

/** After a weekly check completes: compare with the previous result for this page and record what changed. */
export function monitorCheckFinished(reviewId: string, report: Report): MonitorOutcome | null {
  const found = monitorOf(reviewId);
  if (!found) return null;
  const { m, user } = found;
  const conn = db();
  const prev = conn.prepare(`SELECT report_json FROM reviews WHERE user_id = ? AND (monitor_id = ? OR id = ?) AND id != ? AND status = 'complete' AND report_json IS NOT NULL
    ORDER BY finished_at DESC LIMIT 1`).get(m.user_id, m.id, m.baseline_review_id ?? '', reviewId) as { report_json: string } | undefined;
  const changes = prev ? compareReports(JSON.parse(prev.report_json) as Report, report, m.kind) : [];
  const alert = hasAlert(changes);
  const t = now();
  conn.prepare('UPDATE monitors SET last_score = ?, last_checked_at = ?, last_changes = ?, failures = 0, last_alert_at = CASE WHEN ? = 1 THEN ? ELSE last_alert_at END WHERE id = ?')
    .run(report.score, t, JSON.stringify(changes), alert ? 1 : 0, t, m.id);
  return { monitor: getMonitor(user, m.id)!, user, changes, alert };
}

/** After a weekly check fails: retry tomorrow (twice), and tell the owner when their own page fails twice in a row. */
export function monitorCheckFailed(reviewId: string, message: string): MonitorOutcome | null {
  const found = monitorOf(reviewId);
  if (!found) return null;
  const { m, user } = found;
  const failures = m.failures + 1;
  const own = m.kind === 'own';
  const changes: MonitorChange[] = failures >= 2
    ? [{ type: 'offline', severity: own ? 'alert' : 'info', title: own ? 'We could not load your page' : 'We could not load this page', detail: message }]
    : [];
  const alert = own && failures === 2;
  const t = now();
  db().prepare('UPDATE monitors SET failures = ?, last_checked_at = ?, last_changes = ?, next_run_at = ?, last_alert_at = CASE WHEN ? = 1 THEN ? ELSE last_alert_at END WHERE id = ?')
    .run(failures, t, changes.length ? JSON.stringify(changes) : m.last_changes, failures < 3 ? t + DAY_MS : t + WEEK_MS, alert ? 1 : 0, t, m.id);
  return { monitor: getMonitor(user, m.id)!, user, changes, alert };
}

export function activeMonitorCount(): number {
  return (db().prepare('SELECT COUNT(*) AS n FROM monitors WHERE active = 1').get() as { n: number }).n;
}
