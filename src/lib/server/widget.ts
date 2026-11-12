import { db, now } from './db';
import { env } from './env';
import { randomId, sha256 } from './ids';
import { HttpError } from './errors';
import { findUserById, type User } from './users';
import { GUEST_AUDIENCE, teaserResult, type GradeResult } from './grader';
import { allowanceWindow, deleteReview, entitledPlan, type ReviewStatus } from './reviews';
import { mailer } from './mail';
import { toCsv } from './csv';
import { PLANS } from '../plans';
import type { Goal } from '../engine/intake';
import type { Report } from '../engine/report';

/**
 * Lead widget (Agency plan): an audit form an agency embeds on its own website.
 * A visitor enters their page and email, sees a score and the biggest problems
 * in the agency's colours, and the agency gets the lead with the full report.
 * Each audit is a review with origin 'widget', owned by the agency. Audits are
 * not charged to the review allowance; they have a monthly allowance of their own.
 * This module is shared with the worker, so it must not import next/headers.
 */

export const WIDGET_ID_RE = /^w_[A-Za-z0-9_-]{10,30}$/;
export const LEAD_ID_RE = /^[A-Za-z0-9_-]{12,40}$/;
/** Audits waiting or running at once per account, so a burst of visitors (or a bot) cannot fill the queue. */
export const WIDGET_INFLIGHT_MAX = 5;
/** Audits per visitor (IP address) per widget per day. */
export const WIDGET_PER_IP = 3;
export const MAX_ALLOWED_HOSTS = 10;
export const LEAD_STATUSES = ['new', 'contacted', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Copy used while a field is left blank, so better defaults reach every widget without a migration. */
export const WIDGET_DEFAULTS = {
  headline: 'How well does your website turn visitors into customers?',
  intro: 'Get a free score out of 100 for any page in about a minute, with the biggest problems holding it back.',
  buttonLabel: 'Check my website',
  ctaLabel: 'Talk to us about the fixes',
};
export const WIDGET_TEXT_MAX = { headline: 90, intro: 240, buttonLabel: 32, ctaLabel: 40 } as const;

export type WidgetSettings = {
  active: boolean; headline: string; intro: string; buttonLabel: string; ctaLabel: string; ctaUrl: string;
  privacyUrl: string; allowedHosts: string[]; notify: boolean;
};
export type Widget = WidgetSettings & { id: string; userId: string; createdAt: number; updatedAt: number };

type Row = {
  id: string; user_id: string; active: number; headline: string; intro: string; button_label: string; cta_label: string; cta_url: string;
  privacy_url: string; allowed_hosts: string; notify: number; created_at: number; updated_at: number;
};

const toWidget = (r: Row): Widget => ({
  id: r.id, userId: r.user_id, active: !!r.active, headline: r.headline, intro: r.intro, buttonLabel: r.button_label, ctaLabel: r.cta_label,
  ctaUrl: r.cta_url, privacyUrl: r.privacy_url, allowedHosts: r.allowed_hosts ? r.allowed_hosts.split(' ') : [], notify: !!r.notify,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

/** The copy a visitor sees, with defaults for blank fields. */
export const widgetCopy = (w: Pick<Widget, 'headline' | 'intro' | 'buttonLabel' | 'ctaLabel'>) => ({
  headline: w.headline || WIDGET_DEFAULTS.headline, intro: w.intro || WIDGET_DEFAULTS.intro,
  buttonLabel: w.buttonLabel || WIDGET_DEFAULTS.buttonLabel, ctaLabel: w.ctaLabel || WIDGET_DEFAULTS.ctaLabel,
});

// ---------------------------------------------------------------- allowance

/** Same rule as session.isAdmin, which this module cannot import (the worker uses it). */
const isAdminAccount = (user: User) => env.adminEmails.includes(user.email.toLowerCase());

/** Widget audits a month this account may run: the plan's allowance (0 means no widget). Admins get the Agency allowance. */
export function widgetLimit(user: User, opts: { admin?: boolean } = {}): number {
  const own = entitledPlan(user).limits.widget;
  return opts.admin ? Math.max(own, PLANS.agency.limits.widget) : own;
}

export type WidgetUsage = { used: number; limit: number; remaining: number; resetsAt: number | null };

/** Widget audits started in the current allowance month. Failed audits do not count, like failed reviews. */
export function widgetUsage(user: User, opts: { admin?: boolean } = {}): WidgetUsage {
  const limit = widgetLimit(user, opts);
  const window = allowanceWindow(user.periodStart, user.periodEnd);
  const used = (db().prepare("SELECT COUNT(*) AS n FROM reviews WHERE user_id = ? AND origin = 'widget' AND status != 'failed' AND created_at >= ?")
    .get(user.id, window.start) as { n: number }).n;
  return { used, limit, remaining: Math.max(0, limit - used), resetsAt: window.end };
}

// ---------------------------------------------------------------- settings

export function widgetFor(userId: string): Widget | null {
  const r = db().prepare('SELECT * FROM widgets WHERE user_id = ?').get(userId) as Row | undefined;
  return r ? toWidget(r) : null;
}

/** The account's widget, created on first use. */
export function ensureWidget(userId: string): Widget {
  const t = now();
  db().prepare('INSERT OR IGNORE INTO widgets (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)').run(`w_${randomId(9)}`, userId, t, t);
  return widgetFor(userId)!;
}

const invalid = (field: string, message: string) => new HttpError(400, message, 'invalid', { field });
/** Text that ends up in HTML and email subjects: one line, no control characters. */
const oneLine = (s: string) => s.replace(/[\p{Cc}\s]+/gu, ' ').trim();

const HOST_RE = /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/**
 * The websites a widget may be embedded on, from what the agency typed: addresses or bare
 * hostnames, separated by spaces, commas or new lines. "*.agency.co.uk" allows every subdomain.
 */
export function parseAllowedHosts(input: string): string[] {
  const hosts: string[] = [];
  for (const raw of input.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    const scheme = /^([a-z][a-z0-9+.-]*):\/\//.exec(raw)?.[1];
    let rest = scheme ? raw.slice(scheme.length + 3) : raw;
    const wildcard = rest.startsWith('*.');
    if (wildcard) rest = rest.slice(2);
    let host = '';
    try {
      const u = new URL(`https://${rest}`);
      if ((!scheme || scheme === 'http' || scheme === 'https') && !u.port && !u.username && !u.password) host = u.hostname;
    } catch { /* reported below */ }
    if (host && wildcard) host = `*.${host}`;
    if (!host || !HOST_RE.test(host)) throw invalid('allowedHosts', `“${raw.slice(0, 60)}” is not a website address. Use addresses like youragency.co.uk.`);
    if (!hosts.includes(host)) hosts.push(host);
  }
  if (hosts.length > MAX_ALLOWED_HOSTS) throw invalid('allowedHosts', `Add up to ${MAX_ALLOWED_HOSTS} websites.`);
  return hosts;
}

/** A link the widget shows: http(s), or mailto: for the call to action. Blank stays blank. */
export function cleanLink(input: string, field: string, opts: { mailto?: boolean } = {}): string {
  const raw = input.trim();
  if (!raw) return '';
  try {
    const candidate = /^mailto:/i.test(raw) || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(candidate);
    const ok = /^https?:$/.test(u.protocol) ? u.hostname.includes('.') && !u.username && !u.password : opts.mailto && u.protocol === 'mailto:' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(decodeURIComponent(u.pathname));
    if (!ok || u.toString().length > 500) throw new Error('bad');
    return u.toString();
  } catch {
    throw invalid(field, opts.mailto ? 'Enter a web address like youragency.co.uk/contact, or mailto: and an email address.' : 'Enter a web address like youragency.co.uk/privacy.');
  }
}

export type WidgetPatch = Partial<Omit<WidgetSettings, 'allowedHosts'> & { allowedHosts: string }>;

/** Validates and saves widget settings; the widget is created if needed. */
export function updateWidget(userId: string, input: WidgetPatch): Widget {
  const current = ensureWidget(userId);
  const fields: Record<string, string | number> = {};
  for (const key of ['headline', 'intro', 'buttonLabel', 'ctaLabel'] as const) {
    const value = input[key];
    if (value === undefined) continue;
    const text = oneLine(value);
    if (text.length > WIDGET_TEXT_MAX[key]) throw invalid(key, `Keep this under ${WIDGET_TEXT_MAX[key]} characters.`);
    fields[{ headline: 'headline', intro: 'intro', buttonLabel: 'button_label', ctaLabel: 'cta_label' }[key]] = text;
  }
  if (input.ctaUrl !== undefined) fields.cta_url = cleanLink(input.ctaUrl, 'ctaUrl', { mailto: true });
  if (input.privacyUrl !== undefined) fields.privacy_url = cleanLink(input.privacyUrl, 'privacyUrl');
  if (input.allowedHosts !== undefined) fields.allowed_hosts = parseAllowedHosts(input.allowedHosts).join(' ');
  if (input.active !== undefined) fields.active = input.active ? 1 : 0;
  if (input.notify !== undefined) fields.notify = input.notify ? 1 : 0;
  const keys = Object.keys(fields);
  if (keys.length) {
    db().prepare(`UPDATE widgets SET ${keys.map((k) => `${k} = @${k}`).join(', ')}, updated_at = @updated_at WHERE id = @id`).run({ ...fields, updated_at: now(), id: current.id });
  }
  return widgetFor(userId)!;
}

/** A widget visitors can use right now: it exists, is switched on, and its owner's plan still includes it. */
export function publicWidget(id: string): { widget: Widget; owner: User; admin: boolean } | null {
  if (!WIDGET_ID_RE.test(id)) return null;
  const r = db().prepare('SELECT * FROM widgets WHERE id = ?').get(id) as Row | undefined;
  if (!r || !r.active) return null;
  const owner = findUserById(r.user_id);
  if (!owner) return null;
  const admin = isAdminAccount(owner);
  return widgetLimit(owner, { admin }) > 0 ? { widget: toWidget(r), owner, admin } : null;
}

// ---------------------------------------------------------------- audits

export type NewWidgetAudit = { url: string; goal: Goal; name: string; email: string; source: string };

/**
 * Queues a visitor's audit and records the lead in one transaction. Returns a
 * random key that only this visitor's browser holds; it is needed to see the result.
 */
export function startWidgetAudit(widget: Widget, owner: User, input: NewWidgetAudit, opts: { admin?: boolean } = {}): { leadId: string; reviewId: string; key: string } {
  const conn = db();
  return conn.transaction(() => {
    if (widgetUsage(owner, opts).remaining <= 0) {
      throw new HttpError(429, 'This free audit has been so popular this month that it is paused for now. Please get in touch directly instead.', 'widget_quota');
    }
    const inflight = (conn.prepare("SELECT COUNT(*) AS n FROM reviews WHERE user_id = ? AND origin = 'widget' AND status IN ('queued', 'running') AND deleted_at IS NULL")
      .get(owner.id) as { n: number }).n;
    if (inflight >= WIDGET_INFLIGHT_MAX) throw new HttpError(503, 'Several audits are running right now. Please try again in a minute.', 'widget_busy');
    const t = now();
    const reviewId = randomId(12);
    conn.prepare(`INSERT INTO reviews (id, user_id, url, page_type, goal, audience, context, status, origin, created_at)
      VALUES (?, ?, ?, 'other', ?, ?, '', 'queued', 'widget', ?)`).run(reviewId, owner.id, input.url, input.goal, GUEST_AUDIENCE, t);
    const leadId = randomId(12);
    const key = randomId(24);
    conn.prepare(`INSERT INTO widget_leads (id, widget_id, user_id, review_id, name, email, url, source, key_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(leadId, widget.id, owner.id, reviewId, oneLine(input.name).slice(0, 80), input.email, input.url, input.source.slice(0, 300), sha256(key), t);
    return { leadId, reviewId, key };
  }).immediate();
}

export type WidgetAuditView = {
  id: string; url: string; finalUrl: string | null; status: ReviewStatus; stage: string | null; queuePosition: number | null;
  createdAt: number; startedAt: number | null; errorMessage: string | null; result: GradeResult | null;
};

/** Failure messages are written for PageGrade customers; a widget visitor never pays and runs a "check", not a review. */
export const visitorMessage = (message: string | null) =>
  (message ?? '').replace(/\s*You have not been charged[^.]*\.?/gi, '').replace(/\breview\b/g, 'check').trim() || 'The page could not be checked.';

/** What the visitor sees: progress, then the score and the biggest problems. Never the fixes; those go to the agency. */
export function widgetAuditView(widgetId: string, leadId: string, key: string | null | undefined): WidgetAuditView | null {
  if (!WIDGET_ID_RE.test(widgetId) || !LEAD_ID_RE.test(leadId) || typeof key !== 'string' || key.length < 16 || key.length > 100) return null;
  const conn = db();
  const r = conn.prepare(`SELECT l.id, r.url, r.final_url, r.status, r.stage, r.created_at, r.started_at, r.error_message, r.report_json, r.deleted_at
    FROM widget_leads l JOIN reviews r ON r.id = l.review_id WHERE l.id = ? AND l.widget_id = ? AND l.key_hash = ?`).get(leadId, widgetId, sha256(key)) as
    { id: string; url: string; final_url: string | null; status: ReviewStatus; stage: string | null; created_at: number; started_at: number | null; error_message: string | null; report_json: string | null; deleted_at: number | null } | undefined;
  if (!r || r.deleted_at) return null;
  const queuePosition = r.status === 'queued'
    ? 1 + (conn.prepare("SELECT COUNT(*) AS n FROM reviews WHERE status = 'queued' AND deleted_at IS NULL AND created_at < ?").get(r.created_at) as { n: number }).n
    : null;
  return {
    id: r.id, url: r.url, finalUrl: r.final_url, status: r.status, stage: r.stage, queuePosition, createdAt: r.created_at, startedAt: r.started_at,
    errorMessage: r.status === 'failed' ? visitorMessage(r.error_message) : null,
    result: r.status === 'complete' && r.report_json ? teaserResult(JSON.parse(r.report_json) as Report) : null,
  };
}

// ---------------------------------------------------------------- leads

export type WidgetLead = {
  id: string; name: string; email: string; url: string; source: string; status: LeadStatus; createdAt: number;
  reviewId: string; reviewStatus: ReviewStatus | null; score: number | null; grade: string | null; reportAvailable: boolean;
};

export function listWidgetLeads(userId: string, limit = 200): WidgetLead[] {
  const rows = db().prepare(`SELECT l.id, l.name, l.email, l.url, l.source, l.status, l.created_at, l.review_id, r.status AS review_status, r.score, r.grade, r.deleted_at
    FROM widget_leads l LEFT JOIN reviews r ON r.id = l.review_id AND r.user_id = l.user_id WHERE l.user_id = ? ORDER BY l.created_at DESC, l.rowid DESC LIMIT ?`)
    .all(userId, Math.max(1, Math.min(1000, limit))) as {
      id: string; name: string; email: string; url: string; source: string; status: LeadStatus; created_at: number; review_id: string;
      review_status: ReviewStatus | null; score: number | null; grade: string | null; deleted_at: number | null;
    }[];
  return rows.map((r) => ({
    id: r.id, name: r.name, email: r.email, url: r.url, source: r.source, status: r.status, createdAt: r.created_at, reviewId: r.review_id,
    reviewStatus: r.deleted_at ? null : r.review_status, score: r.deleted_at ? null : r.score, grade: r.deleted_at ? null : r.grade,
    reportAvailable: !r.deleted_at && r.review_status === 'complete',
  }));
}

export function setWidgetLeadStatus(userId: string, id: string, status: LeadStatus) {
  if (!LEAD_STATUSES.includes(status)) throw invalid('status', 'Choose a status from the list.');
  const res = db().prepare('UPDATE widget_leads SET status = ? WHERE id = ? AND user_id = ?').run(status, id, userId);
  if (!res.changes) throw new HttpError(404, 'Lead not found.', 'not_found');
}

/** Deletes a lead's details and its audit report (for example when someone asks to be forgotten). */
export async function deleteWidgetLead(userId: string, id: string) {
  const conn = db();
  const lead = conn.prepare('SELECT review_id FROM widget_leads WHERE id = ? AND user_id = ?').get(id, userId) as { review_id: string } | undefined;
  if (!lead) throw new HttpError(404, 'Lead not found.', 'not_found');
  const review = conn.prepare('SELECT status FROM reviews WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(lead.review_id, userId) as { status: ReviewStatus } | undefined;
  if (review?.status === 'running') throw new HttpError(409, 'This audit is running right now. You can delete the lead as soon as it finishes.', 'review_running');
  if (review) await deleteReview(lead.review_id, userId);
  conn.prepare('DELETE FROM widget_leads WHERE id = ? AND user_id = ?').run(id, userId);
}

/** Leads in total and in the last seven days, for the page header. */
export function widgetLeadCounts(userId: string, t = now()) {
  return db().prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS week,
    COALESCE(SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END), 0) AS fresh FROM widget_leads WHERE user_id = ?`).get(t - 7 * 24 * 3600_000, userId) as { total: number; week: number; fresh: number };
}

/** The account's leads as a CSV, newest first (cells are protected against spreadsheet formulas by toCsv). */
export function widgetLeadsCsv(userId: string): string {
  return toCsv([
    ['Date (UTC)', 'Name', 'Email', 'Website', 'Score', 'Grade', 'Status', 'Widget page', 'Full report'],
    ...listWidgetLeads(userId, 1000).map((l) => [
      new Date(l.createdAt).toISOString().slice(0, 16).replace('T', ' '), l.name, l.email, l.url, l.score, l.grade, l.status, l.source,
      l.reportAvailable ? `${env.appUrl}/app/reviews/${l.reviewId}` : '',
    ]),
  ]);
}

/**
 * Emails the agency about a lead once its audit has finished or failed (a failed audit is still a lead).
 * Claimed before sending, so it goes out at most once even if the review is processed again.
 */
export async function notifyWidgetLead(reviewId: string): Promise<boolean> {
  const conn = db();
  const lead = conn.prepare(`SELECT l.id, l.name, l.email, l.url, l.source, w.notify, u.email AS owner_email, r.status, r.score, r.grade, r.final_url, r.error_message
    FROM widget_leads l JOIN widgets w ON w.id = l.widget_id JOIN users u ON u.id = l.user_id JOIN reviews r ON r.id = l.review_id
    WHERE l.review_id = ? AND l.notified_at IS NULL`).get(reviewId) as
    { id: string; name: string; email: string; url: string; source: string; notify: number; owner_email: string; status: ReviewStatus; score: number | null; grade: string | null; final_url: string | null; error_message: string | null } | undefined;
  if (!lead || (lead.status !== 'complete' && lead.status !== 'failed')) return false;
  if (!conn.prepare('UPDATE widget_leads SET notified_at = ? WHERE id = ? AND notified_at IS NULL').run(now(), lead.id).changes) return false;
  if (!lead.notify) return false;
  const complete = lead.status === 'complete' && lead.score != null;
  await mailer.widgetLead(lead.owner_email, {
    name: lead.name, email: lead.email, pageUrl: lead.final_url ?? lead.url, source: lead.source,
    score: complete ? lead.score : null, grade: complete ? lead.grade : null, failedReason: complete ? null : lead.error_message,
    reportUrl: `${env.appUrl}/app/reviews/${reviewId}`, leadsUrl: `${env.appUrl}/app/widget#leads`,
  });
  return true;
}
