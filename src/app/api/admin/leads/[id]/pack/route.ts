import { z } from 'zod';
import { handler, assertSameOrigin, json, HttpError } from '@/lib/server/http';
import { isAdmin, requireApiUser } from '@/lib/server/session';
import { findLead } from '@/lib/server/leads';
import { buildPack, packFor } from '@/lib/server/packs';
import { assertCapacity } from '@/lib/server/reviews';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

const leadId = z.string().trim().min(1).max(40);

async function adminLead(params: Ctx['params']) {
  const user = await requireApiUser();
  if (!isAdmin(user)) throw new HttpError(403, 'Admins only.', 'forbidden');
  return { user, id: leadId.parse((await params).id) };
}

/** Admin: where the lead's pack stands, and the reply to send once its reviews have finished. */
export const GET = handler<Ctx>(async (_req, { params }) => {
  const { id } = await adminLead(params);
  const lead = findLead(id);
  if (!lead) throw new HttpError(404, 'Lead not found.', 'not_found');
  const pack = packFor(lead);
  return json({ built: !!pack, clientId: lead.clientId, batchId: lead.batchId, status: pack?.status ?? null, reply: pack?.reply ?? '' }, { headers: { 'Cache-Control': 'no-store' } });
});

/** Admin: build the pack for a pack request. Asking again while it is running or finished queues nothing. */
export const POST = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { user, id } = await adminLead(params);
  const build = buildPack(user, id, { beforeQueue: () => assertCapacity(user) });
  const pack = packFor(findLead(id)!);
  return json({ ...build, status: pack?.status ?? null, reply: pack?.reply ?? '' }, build.queued ? 201 : 200);
});
