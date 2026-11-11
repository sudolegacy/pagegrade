import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { deleteClient, updateClient } from '@/lib/server/clients';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

const patch = z.object({ name: z.string().max(200).optional(), website: z.string().max(300).optional() });

export const PATCH = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  return json({ client: updateClient(user.id, (await params).id, patch.parse(await readJson(req))) });
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  deleteClient(user.id, (await params).id);
  return json({ ok: true });
});
