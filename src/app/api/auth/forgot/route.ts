import { z } from 'zod';
import { handler, assertSameOrigin, clientIp, readJson, json } from '@/lib/server/http';
import { emailSchema, limitOrThrow, sendReset } from '@/lib/server/auth-flows';
import { findUserByEmail } from '@/lib/server/users';

const body = z.object({ email: emailSchema });

/** Always answers the same way so it cannot be used to discover accounts. */
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const { email } = body.parse(await readJson(req));
  limitOrThrow(`forgot:ip:${clientIp(req)}`, 10, 3600_000);
  const user = findUserByEmail(email);
  if (user && rateOk(email)) await sendReset(user).catch((e) => console.error('[forgot] email failed', e));
  return json({ ok: true });
});

function rateOk(email: string) {
  try { limitOrThrow(`forgot:email:${email}`, 3, 3600_000); return true; } catch { return false; }
}
