import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { deleteMonitor, updateMonitor } from '@/lib/server/monitors';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

const patch = z.object({
  active: z.boolean().optional(),
  kind: z.enum(['own', 'competitor']).optional(),
  label: z.string().trim().max(80).optional(),
  clientId: z.string().trim().max(40).nullable().optional(),
});

export const PATCH = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  return json({ monitor: updateMonitor(user, (await params).id, patch.parse(await readJson(req))) });
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  deleteMonitor(user.id, (await params).id);
  return json({ ok: true });
});
