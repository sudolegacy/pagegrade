import { handler, assertSameOrigin, json } from '@/lib/server/http';
import { clearSessionCookie, currentToken, destroySession } from '@/lib/server/session';

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  destroySession(await currentToken());
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
});
