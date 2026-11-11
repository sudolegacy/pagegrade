import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { createCheckout } from '@/lib/server/billing';

const body = z.object({ plan: z.enum(['starter', 'pro', 'agency']), interval: z.enum(['month', 'year']).default('month') });

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const { plan, interval } = body.parse(await readJson(req));
  return json({ url: await createCheckout(user, plan, interval) });
});
