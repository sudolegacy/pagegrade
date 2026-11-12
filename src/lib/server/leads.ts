import { db, now } from './db';
import { randomId } from './ids';

/**
 * Leads are agencies (and others) who asked for something before paying: a
 * free prospect pack, a call, or a partner invite. The business plan's first
 * weekly metric is "agencies asking for a pack", so every request is recorded here.
 */
export type LeadKind = 'pack' | 'call' | 'partner' | 'other';
export type LeadStatus = 'new' | 'contacted' | 'pack_sent' | 'won' | 'lost';
export const LEAD_STATUSES: { id: LeadStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Replied' },
  { id: 'pack_sent', label: 'Pack sent' },
  { id: 'won', label: 'Customer' },
  { id: 'lost', label: 'Not now' },
];

/** `clientId` and `batchId` point at the client folder and review batch built for a pack request (see packs.ts). */
export type Lead = {
  id: string; kind: LeadKind; name: string; email: string; company: string; website: string; message: string;
  prospects: string[]; source: string; status: LeadStatus; note: string; userId: string | null;
  clientId: string | null; batchId: string | null; createdAt: number; updatedAt: number;
};

type Row = {
  id: string; kind: LeadKind; name: string; email: string; company: string; website: string; message: string; prospects: string;
  source: string; status: LeadStatus; note: string; user_id: string | null; client_id: string | null; batch_id: string | null; created_at: number; updated_at: number;
};

const toLead = (r: Row): Lead => {
  let prospects: string[] = [];
  try { const v = JSON.parse(r.prospects); if (Array.isArray(v)) prospects = v.filter((x): x is string => typeof x === 'string'); } catch { /* stored by us; ignore corruption */ }
  return {
    id: r.id, kind: r.kind, name: r.name, email: r.email, company: r.company, website: r.website, message: r.message, prospects,
    source: r.source, status: r.status, note: r.note, userId: r.user_id, clientId: r.client_id ?? null, batchId: r.batch_id ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
};

export function createLead(input: { kind: LeadKind; name?: string; email: string; company?: string; website?: string; message?: string; prospects?: string[]; source?: string; userId?: string | null }): Lead {
  const id = randomId(12);
  const t = now();
  db().prepare(`INSERT INTO leads (id, kind, name, email, company, website, message, prospects, source, status, note, user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', '', ?, ?, ?)`)
    .run(id, input.kind, (input.name ?? '').trim().slice(0, 80), input.email.trim().toLowerCase().slice(0, 254), (input.company ?? '').trim().slice(0, 120),
      (input.website ?? '').trim().slice(0, 300), (input.message ?? '').trim().slice(0, 2000), JSON.stringify((input.prospects ?? []).slice(0, 10)),
      (input.source ?? '').trim().slice(0, 60), input.userId ?? null, t, t);
  return findLead(id)!;
}

export function findLead(id: string): Lead | null {
  const r = db().prepare('SELECT * FROM leads WHERE id = ?').get(id) as Row | undefined;
  return r ? toLead(r) : null;
}

/** Newest first. `open` keeps only leads that still need an action from you. */
export function listLeads(opts: { open?: boolean; limit?: number } = {}): Lead[] {
  const where = opts.open ? "WHERE status IN ('new', 'contacted', 'pack_sent')" : '';
  const rows = db().prepare(`SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT ?`).all(Math.max(1, Math.min(500, opts.limit ?? 100))) as Row[];
  return rows.map(toLead);
}

export function updateLead(id: string, fields: Partial<{ status: LeadStatus; note: string; userId: string | null; clientId: string | null; batchId: string | null }>): boolean {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id, updated_at: now() };
  if (fields.status) { sets.push('status = @status'); params.status = fields.status; }
  if (fields.note != null) { sets.push('note = @note'); params.note = fields.note.trim().slice(0, 2000); }
  if (fields.userId !== undefined) { sets.push('user_id = @user_id'); params.user_id = fields.userId; }
  if (fields.clientId !== undefined) { sets.push('client_id = @client_id'); params.client_id = fields.clientId; }
  if (fields.batchId !== undefined) { sets.push('batch_id = @batch_id'); params.batch_id = fields.batchId; }
  if (!sets.length) return false;
  return db().prepare(`UPDATE leads SET ${sets.join(', ')}, updated_at = @updated_at WHERE id = @id`).run(params).changes > 0;
}

/** Counts for the plan scoreboard: requests in a window, and how many of them became customers. */
export function leadStats(sinceMs: number): { total: number; packs: number; won: number; open: number; packsSince: number; wonSince: number } {
  const r = db().prepare(`SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN kind = 'pack' THEN 1 ELSE 0 END), 0) AS packs,
      COALESCE(SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END), 0) AS won,
      COALESCE(SUM(CASE WHEN status IN ('new', 'contacted', 'pack_sent') THEN 1 ELSE 0 END), 0) AS open,
      COALESCE(SUM(CASE WHEN kind = 'pack' AND created_at >= ? THEN 1 ELSE 0 END), 0) AS packsSince,
      COALESCE(SUM(CASE WHEN status = 'won' AND updated_at >= ? THEN 1 ELSE 0 END), 0) AS wonSince
    FROM leads`).get(sinceMs, sinceMs) as { total: number; packs: number; won: number; open: number; packsSince: number; wonSince: number };
  return r;
}

/** The same address asking again within a day is a double submit, not a second lead. */
export function recentLeadFrom(email: string, kind: LeadKind, withinMs = 24 * 3600 * 1000): Lead | null {
  const r = db().prepare('SELECT * FROM leads WHERE email = ? AND kind = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 1')
    .get(email.trim().toLowerCase(), kind, now() - withinMs) as Row | undefined;
  return r ? toLead(r) : null;
}
