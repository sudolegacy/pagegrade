import { db, now } from './db';
import { randomId } from './ids';
import { HttpError } from './errors';
import { isAdmin } from './session';
import type { User } from './users';
import { entitledPlan } from './reviews';

/** Client folders (Agency plan): group reviews and monitors by client. */
export const MAX_CLIENTS = 500;
export const MAX_BRAND_NAME = 60;

/** A folder's own branding for its reports and PDFs. Empty name and no logo means the account's branding is used. */
export type ClientBrand = { name: string; color: string; logo: string | null; logoUrl: string | null };

export type Client = {
  id: string; name: string; website: string; createdAt: number;
  reviews: number; monitors: number; lastReviewAt: number | null; latestScore: number | null;
  brand: ClientBrand;
};

/** The part of a folder that decides how its reports look (see brandForReview in brand.ts). */
export type ClientLook = Pick<Client, 'id' | 'name' | 'website' | 'brand'>;

type BrandCols = { brand_name: string; brand_color: string; brand_logo: string | null };
type Row = BrandCols & { id: string; name: string; website: string; created_at: number; reviews: number; monitors: number; last_review_at: number | null; latest_score: number | null };

const toBrand = (r: BrandCols): ClientBrand => ({
  name: r.brand_name, color: r.brand_color, logo: r.brand_logo, logoUrl: r.brand_logo ? `/api/brand/logo/${r.brand_logo}` : null,
});

const SELECT = `SELECT c.id, c.name, c.website, c.created_at, c.brand_name, c.brand_color, c.brand_logo,
    (SELECT COUNT(*) FROM reviews r WHERE r.client_id = c.id AND r.user_id = c.user_id AND r.deleted_at IS NULL) AS reviews,
    (SELECT COUNT(*) FROM monitors m WHERE m.client_id = c.id AND m.user_id = c.user_id) AS monitors,
    (SELECT MAX(r.created_at) FROM reviews r WHERE r.client_id = c.id AND r.user_id = c.user_id AND r.deleted_at IS NULL) AS last_review_at,
    (SELECT r.score FROM reviews r WHERE r.client_id = c.id AND r.user_id = c.user_id AND r.deleted_at IS NULL AND r.status = 'complete' ORDER BY r.finished_at DESC LIMIT 1) AS latest_score
  FROM clients c`;

const toClient = (r: Row): Client => ({
  id: r.id, name: r.name, website: r.website, createdAt: r.created_at,
  reviews: r.reviews, monitors: r.monitors, lastReviewAt: r.last_review_at, latestScore: r.latest_score,
  brand: toBrand(r),
});

export function listClients(userId: string): Client[] {
  return (db().prepare(`${SELECT} WHERE c.user_id = ? ORDER BY c.name COLLATE NOCASE`).all(userId) as Row[]).map(toClient);
}

export function getClient(userId: string, id: string): Client | null {
  const r = db().prepare(`${SELECT} WHERE c.user_id = ? AND c.id = ?`).get(userId, id) as Row | undefined;
  return r ? toClient(r) : null;
}

/** Just what a report needs from the folder, without the review counts: cheap enough for every report view. */
export function clientLook(userId: string, id: string): ClientLook | null {
  const r = db().prepare('SELECT id, name, website, brand_name, brand_color, brand_logo FROM clients WHERE user_id = ? AND id = ?')
    .get(userId, id) as (BrandCols & { id: string; name: string; website: string }) | undefined;
  return r ? { id: r.id, name: r.name, website: r.website, brand: toBrand(r) } : null;
}

function cleanName(name: unknown): string {
  const v = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  if (!v) throw new HttpError(400, 'Give the client a name.', 'invalid_input', { field: 'name' });
  return v;
}

function cleanWebsite(website: unknown): string {
  const v = typeof website === 'string' ? website.trim() : '';
  if (!v) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.') || u.toString().length > 200) throw new Error('bad');
    return u.toString().replace(/\/$/, '');
  } catch {
    throw new HttpError(400, 'Enter the client website as an address like example.com.', 'invalid_input', { field: 'website' });
  }
}

/** A website address tidied the way folders store it, or '' when it cannot be (for data we did not type ourselves). */
export function tidyWebsite(website: string): string {
  try { return cleanWebsite(website); } catch { return ''; }
}

function cleanBrandName(name: unknown): string {
  const v = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : '';
  if (v.length > MAX_BRAND_NAME) throw new HttpError(400, `Keep the name on reports under ${MAX_BRAND_NAME} characters.`, 'invalid_input', { field: 'brandName' });
  return v;
}

function cleanBrandColor(color: unknown): string {
  const v = typeof color === 'string' ? color.trim() : '';
  if (v && !/^#[0-9a-fA-F]{6}$/.test(v)) throw new HttpError(400, 'Use a colour code like #1F6FEB.', 'invalid_input', { field: 'brandColor' });
  return v;
}

export type ClientInput = { name: string; website?: string; brandName?: string; brandColor?: string };

/** Admins can use every feature without a plan, so they can keep folders too. */
export function createClient(user: User, input: ClientInput): Client {
  if (!isAdmin(user) && !entitledPlan(user).limits.clients) throw new HttpError(402, 'Client folders are part of the Agency plan.', 'clients_unavailable');
  const name = cleanName(input.name);
  const website = cleanWebsite(input.website);
  const brandName = cleanBrandName(input.brandName);
  const brandColor = cleanBrandColor(input.brandColor);
  const conn = db();
  const count = (conn.prepare('SELECT COUNT(*) AS n FROM clients WHERE user_id = ?').get(user.id) as { n: number }).n;
  if (count >= MAX_CLIENTS) throw new HttpError(409, `You can have up to ${MAX_CLIENTS} client folders.`, 'too_many_clients');
  const id = randomId(10);
  conn.prepare('INSERT INTO clients (id, user_id, name, website, brand_name, brand_color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, user.id, name, website, brandName, brandColor, now());
  return getClient(user.id, id)!;
}

/** `brandLogo` is only ever set by the logo upload in brand.ts, never from a request body. */
export function updateClient(userId: string, id: string, patch: { name?: string; website?: string; brandName?: string; brandColor?: string; brandLogo?: string | null }): Client {
  const current = getClient(userId, id);
  if (!current) throw new HttpError(404, 'Client folder not found.', 'not_found');
  db().prepare('UPDATE clients SET name = ?, website = ?, brand_name = ?, brand_color = ?, brand_logo = ? WHERE id = ? AND user_id = ?').run(
    patch.name === undefined ? current.name : cleanName(patch.name),
    patch.website === undefined ? current.website : cleanWebsite(patch.website),
    patch.brandName === undefined ? current.brand.name : cleanBrandName(patch.brandName),
    patch.brandColor === undefined ? current.brand.color : cleanBrandColor(patch.brandColor),
    patch.brandLogo === undefined ? current.brand.logo : patch.brandLogo,
    id, userId,
  );
  return getClient(userId, id)!;
}

/** Deletes the folder only: its reviews and monitors stay, unfiled. */
export function deleteClient(userId: string, id: string) {
  const conn = db();
  conn.transaction(() => {
    const res = conn.prepare('DELETE FROM clients WHERE id = ? AND user_id = ?').run(id, userId);
    if (!res.changes) throw new HttpError(404, 'Client folder not found.', 'not_found');
    conn.prepare('UPDATE reviews SET client_id = NULL WHERE client_id = ? AND user_id = ?').run(id, userId);
    conn.prepare('UPDATE monitors SET client_id = NULL WHERE client_id = ? AND user_id = ?').run(id, userId);
  }).immediate();
}
