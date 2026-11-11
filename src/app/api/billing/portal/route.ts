import { handler, assertSameOrigin, json } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { createPortal } from '@/lib/server/billing';

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  return json({ url: await createPortal(await requireApiUser()) });
});
