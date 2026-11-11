import { db, now } from './db';
import { randomId } from './ids';
import { HttpError } from './errors';
import type { User } from './users';
import { entitledPlan } from './reviews';

/** Client folders (Agency plan): group reviews and monitors by client. */
export const MAX_CLIENTS = 500;

export type Client = {
  id: string; name: string; website: string; createdAt: number;
  reviews: number; monitors: number; lastReviewAt: number | null; latestScore: number | null;
};

type Row = { id: string; name: string; website: string; created_at: number; reviews: number; monitors: number; last_review_at: number | null; latest_score: number | null };

const SELECT = `SELECT c.id, c.name, c.website, c.created_at,
    (SELECT COUNT(*) FROM reviews r WHERE r.client_id = c.id AND r.user_id = c.user_id AND r.deleted_at IS NULL) AS reviews,
    (SELECT COUNT(*) FROM monitors m WHERE m.client_id = c.id AND m.user_id = c.user_id) AS monitors,
    (SELECT MAX(r.created_at) FROM reviews r WHERE r.client_id = c.id AND r.user_id = c.user_id AND r.deleted_at IS NULL) AS last_review_at,
    (SELECT r.score FROM reviews r WHERE r.client_id = c.id AND r.user_id = c.user_id AND r.deleted_at IS NULL AND r.status = 'complete' ORDER BY r.finished_at DESC LIMIT 1) AS latest_score
  FROM clients c`;

const toClient = (r: Row): Client => ({
  id: r.id, name: r.name, website: r.website, createdAt: r.created_at,
  reviews: r.reviews, monitors: r.monitors, lastReviewAt: r.last_review_at, latestScore: r.latest_score,
});

export function listClients(userId: string): Client[] {
  return (db().prepare(`${SELECT} WHERE c.user_id = ? ORDER BY c.name COLLATE NOCASE`).all(userId) as Row[]).map(toClient);
}

export function getClient(userId: string, id: string): Client | null {
  const r = db().prepare(`${SELECT} WHERE c.user_id = ? AND c.id = ?`).get(userId, id) as Row | undefined;
  return r ? toClient(r) : null;
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

export function createClient(user: User, input: { name: string; website?: string }): Client {
  if (!entitledPlan(user).limits.clients) throw new HttpError(402, 'Client folders are part of the Agency plan.', 'clients_unavailable');
  const name = cleanName(input.name);
  const website = cleanWebsite(input.website);
  const conn = db();
  const count = (conn.prepare('SELECT COUNT(*) AS n FROM clients WHERE user_id = ?').get(user.id) as { n: number }).n;
  if (count >= MAX_CLIENTS) throw new HttpError(409, `You can have up to ${MAX_CLIENTS} client folders.`, 'too_many_clients');
  const id = randomId(10);
  conn.prepare('INSERT INTO clients (id, user_id, name, website, created_at) VALUES (?, ?, ?, ?, ?)').run(id, user.id, name, website, now());
  return getClient(user.id, id)!;
}

export function updateClient(userId: string, id: string, patch: { name?: string; website?: string }): Client {
  const current = getClient(userId, id);
  if (!current) throw new HttpError(404, 'Client folder not found.', 'not_found');
  db().prepare('UPDATE clients SET name = ?, website = ? WHERE id = ? AND user_id = ?').run(
    patch.name === undefined ? current.name : cleanName(patch.name),
    patch.website === undefined ? current.website : cleanWebsite(patch.website),
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
