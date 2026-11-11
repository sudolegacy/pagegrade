import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { createClient, listClients } from '@/lib/server/clients';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json({ clients: listClients(user.id) }, { headers: { 'Cache-Control': 'no-store' } });
});

const body = z.object({ name: z.string().max(200), website: z.string().max(300).optional() });

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  return json({ client: createClient(user, body.parse(await readJson(req))) }, 201);
});
