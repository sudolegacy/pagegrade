import { z } from 'zod';
import { handler, assertSameOrigin, clientIp, readJson, json, HttpError } from '@/lib/server/http';
import { emailSchema, limitOrThrow } from '@/lib/server/auth-flows';
import { dummyHash, verifyPassword } from '@/lib/server/password';
import { findUserByEmail } from '@/lib/server/users';
import { createSession, setSessionCookie } from '@/lib/server/session';

const body = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password.').max(200) });

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const input = body.parse(await readJson(req));
  limitOrThrow(`login:ip:${clientIp(req)}`, 30, 15 * 60_000);
  limitOrThrow(`login:email:${input.email}`, 8, 15 * 60_000, 'Too many attempts for this account. Wait 15 minutes or reset your password.');
  const user = findUserByEmail(input.email);
  const ok = await verifyPassword(input.password, user?.passwordHash ?? await dummyHash());
  if (!user || !ok) throw new HttpError(401, 'That email and password combination is not right.', 'invalid_credentials');
  const res = json({ ok: true });
  setSessionCookie(res, createSession(user.id, req.headers.get('user-agent') ?? ''));
  return res;
});
