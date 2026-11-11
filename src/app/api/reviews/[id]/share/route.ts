import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { setSharing } from '@/lib/server/reviews';
import { env } from '@/lib/server/env';

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ enabled: z.boolean() });

export const POST = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const { enabled } = body.parse(await readJson(req));
  const shareId = setSharing((await params).id, user.id, enabled);
  return json({ shareId, url: shareId ? `${env.appUrl}/r/${shareId}` : null });
});
