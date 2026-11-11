import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json, HttpError } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { setReviewClient } from '@/lib/server/reviews';
import { getClient } from '@/lib/server/clients';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

const body = z.object({ clientId: z.string().trim().max(40).nullable() });

/** File a review in a client folder (or take it out with clientId: null). */
export const PUT = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const { clientId } = body.parse(await readJson(req));
  if (clientId && !getClient(user.id, clientId)) throw new HttpError(404, 'Client folder not found.', 'client_not_found');
  setReviewClient((await params).id, user.id, clientId);
  return json({ ok: true });
});
