import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json, HttpError } from '@/lib/server/http';
import { isAdmin, requireApiUser } from '@/lib/server/session';
import { LEAD_STATUSES, updateLead } from '@/lib/server/leads';

export const dynamic = 'force-dynamic';

const body = z.object({
  id: z.string().trim().min(1).max(40),
  status: z.enum(LEAD_STATUSES.map((s) => s.id)).optional(),
  note: z.string().max(2000).optional(),
}).refine((v) => v.status !== undefined || v.note !== undefined, { message: 'Nothing to update.' });

/** Admin: move a lead through the pipeline or edit its note. */
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  if (!isAdmin(user)) throw new HttpError(403, 'Admins only.', 'forbidden');
  const { id, status, note } = body.parse(await readJson(req));
  if (!updateLead(id, { status, note })) throw new HttpError(404, 'Lead not found.', 'not_found');
  return json({ ok: true });
});
