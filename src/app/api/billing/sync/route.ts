import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { syncAfterCheckout } from '@/lib/server/billing';
import { accountView } from '@/lib/server/account';
import { limitOrThrow } from '@/lib/server/auth-flows';

const body = z.object({ sessionId: z.string().max(200).nullable().optional() });

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  limitOrThrow(`sync:user:${user.id}`, 20, 3600_000);
  const { sessionId } = body.parse(await readJson(req));
  return json(accountView(await syncAfterCheckout(user, sessionId ?? null)));
});
