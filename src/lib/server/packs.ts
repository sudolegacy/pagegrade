import { db } from './db';
import { env } from './env';
import { HttpError } from './errors';
import { randomId } from './ids';
import { MAX_BRAND_NAME, clientLook, createClient, getClient, tidyWebsite } from './clients';
import { findLead, updateLead, type Lead } from './leads';
import { createReviews, type NewReview, type ReviewStatus } from './reviews';
import { isAdmin } from './session';
import type { User } from './users';
import { normalizeUrl } from '../engine/net/url-guard';
import { hostPath } from '../format';

/**
 * Prospect packs: an agency asks for audits of businesses it wants to win. Building a pack files the
 * prospects' pages in a client folder named after the agency (carrying the agency's name on its reports),
 * queues the reviews as one batch and links both to the lead, so the founder only has to download the PDFs
 * and send the reply.
 */
const AUDIENCE = 'Potential customers of this business';
const MAX_CONTEXT = 1000;

export type PackReview = {
  id: string; url: string; status: ReviewStatus; score: number | null; grade: string | null;
  pdfUrl: string; shareUrl?: string; error?: string;
};

export type PackStatus = {
  total: number; complete: number; failed: number;
  /** Queued or running. */
  running: number;
  reviews: PackReview[];
  /** The client folder the reviews are filed in, while it still exists. */
  folder: { id: string; brandName: string; hasLogo: boolean } | null;
};

export type PackView = { clientId: string | null; batchId: string; status: PackStatus; reply: string };
export type PackBuild = { clientId: string; batchId: string; queued: number };

/** The lead's prospect pages as canonical addresses, without repeats and without anything that is not a web page. */
export function prospectUrls(lead: Lead): string[] {
  const urls = new Set<string>();
  for (const prospect of lead.prospects) {
    try { urls.add(normalizeUrl(prospect).toString()); } catch { /* the lead form checked these, so this is only data from elsewhere */ }
  }
  return [...urls];
}

/** The agency's company name, else the domain it wrote from. */
export function packFolderName(lead: Lead): string {
  const domain = lead.email.split('@')[1] ?? '';
  return (lead.company || domain || lead.name || 'Prospect pack').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function packContext(lead: Lead, folderName: string): string {
  const note = lead.message.trim();
  return (note ? `Prospect pack for ${folderName}. Note from the agency: ${note}` : `Prospect pack for ${folderName}.`).slice(0, MAX_CONTEXT);
}

/** createReviews only groups two or more pages, but a pack needs a batch to find its reviews by. */
function tagAsBatch(reviewId: string): string {
  const batchId = randomId(9);
  db().prepare('UPDATE reviews SET batch_id = ? WHERE id = ?').run(batchId, reviewId);
  return batchId;
}

/**
 * Builds the pack for a pack request: a client folder named after the agency (reused when the lead already
 * has one), a batch of reviews for its prospects, and the lead linked to both and marked as replied to.
 * Asking again while any review of the batch is running or finished changes nothing; when none is (all failed,
 * or deleted) the prospects are queued again, in the same folder. `beforeQueue` runs once reviews are certain
 * to be queued, and anything it throws leaves nothing behind (the route uses it for the AI budget check).
 */
export function buildPack(user: User, leadId: string, opts: { beforeQueue?: () => void } = {}): PackBuild {
  if (!isAdmin(user)) throw new HttpError(403, 'Admins only.', 'forbidden');
  return db().transaction((): PackBuild => {
    const lead = findLead(leadId);
    if (!lead) throw new HttpError(404, 'Lead not found.', 'not_found');
    if (lead.kind !== 'pack') throw new HttpError(400, 'Only pack requests can become a prospect pack.', 'not_a_pack');
    const urls = prospectUrls(lead);
    if (!urls.length) throw new HttpError(400, 'This request has no prospect pages to review.', 'no_prospects');
    if (lead.batchId && lead.clientId) {
      const current = packStatus(lead);
      if (current.running + current.complete > 0) return { clientId: lead.clientId, batchId: lead.batchId, queued: 0 };
    }

    opts.beforeQueue?.();
    const name = packFolderName(lead);
    const clientId = (lead.clientId && getClient(user.id, lead.clientId)?.id)
      || createClient(user, { name, website: tidyWebsite(lead.website), brandName: name.slice(0, MAX_BRAND_NAME) }).id;
    const context = packContext(lead, name);
    const inputs: NewReview[] = urls.map((url) => ({ url, pageType: 'service', goal: 'contact', audience: AUDIENCE, context }));
    // createReviews takes the in-flight cap from the plan, and admins are not held to theirs.
    const { ids, batchId } = createReviews({ ...user, plan: 'agency', planStatus: 'active' }, inputs, { admin: true, clientId, origin: 'bulk' });
    const batch = batchId ?? tagAsBatch(ids[0]);
    updateLead(lead.id, { clientId, batchId: batch, ...(lead.status === 'new' ? { status: 'contacted' as const } : {}) });
    return { clientId, batchId: batch, queued: ids.length };
  }).immediate();
}

type StatusRow = { id: string; user_id: string; url: string; status: ReviewStatus; score: number | null; grade: string | null; share_id: string | null; error_message: string | null };

/** Where the lead's pack stands, from the reviews of its batch. Reviews that were deleted do not count. */
export function packStatus(lead: Lead): PackStatus {
  const rows = lead.batchId
    ? db().prepare(`SELECT id, user_id, url, status, score, grade, share_id, error_message FROM reviews WHERE batch_id = ? AND deleted_at IS NULL ORDER BY created_at, id`).all(lead.batchId) as StatusRow[]
    : [];
  const reviews = rows.map((r): PackReview => ({
    id: r.id, url: r.url, status: r.status, score: r.score, grade: r.grade, pdfUrl: `/api/reviews/${r.id}/pdf`,
    ...(r.share_id ? { shareUrl: `${env.appUrl}/r/${r.share_id}` } : {}),
    ...(r.status === 'failed' && r.error_message ? { error: r.error_message } : {}),
  }));
  const folder = rows.length && lead.clientId ? clientLook(rows[0].user_id, lead.clientId) : null;
  return {
    total: reviews.length,
    complete: reviews.filter((r) => r.status === 'complete').length,
    failed: reviews.filter((r) => r.status === 'failed').length,
    running: reviews.filter((r) => r.status === 'queued' || r.status === 'running').length,
    reviews,
    folder: folder ? { id: folder.id, brandName: folder.brand.name, hasLogo: !!folder.brand.logo } : null,
  };
}

/**
 * The reply to paste into the agency's email thread, built from the reviews that finished. Empty until one has.
 * The call is offered with the booking link when there is one.
 */
export function packReplyText(lead: Lead, status: PackStatus, founderName: string, bookingUrl: string = env.bookingUrl): string {
  const done = status.reviews.filter((r) => r.status === 'complete' && r.score != null);
  if (!done.length) return '';
  const many = done.length > 1;
  const brandName = status.folder?.brandName ?? '';
  const branded = brandName ? `, branded with ${brandName}'s name${status.folder?.hasLogo ? ' and logo' : ''}` : '';
  const first = lead.name.trim().split(/\s+/)[0];
  const scores = done.map((r) => `- ${hostPath(r.url)}: ${r.score}/100${r.grade ? ` (${r.grade})` : ''}`);
  const call = /^https?:\/\//i.test(bookingUrl)
    ? `I can show you how it works in 15 minutes: ${bookingUrl}`
    : "reply and I'll show you how it works in 15 minutes.";
  return [
    `Hi ${first || 'there'},`,
    many ? `Thanks for sending these over. The audits are attached as PDFs${branded}:` : `Thanks for sending this over. The audit is attached as a PDF${branded}:`,
    scores.join('\n'),
    `${many ? 'Each one has' : 'It has'} the score, the fixes that matter most and suggested rewrites for the headline and main button, so ${many ? 'they are' : 'it is'} ready to send on.`,
    `If you'd like to send audits like these regularly, ${call}`,
    founderName ? `Best wishes,\n${founderName}` : 'Best wishes',
  ].join('\n\n');
}

/** Everything a pipeline row needs about a lead's pack, or null before one has been built. */
export function packFor(lead: Lead): PackView | null {
  if (!lead.batchId) return null;
  const status = packStatus(lead);
  return { clientId: lead.clientId, batchId: lead.batchId, status, reply: packReplyText(lead, status, env.founderName) };
}
