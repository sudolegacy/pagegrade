import { z } from 'zod';
import { handler, assertSameOrigin, clientIp, readJson, json, HttpError } from '@/lib/server/http';
import { limitOrThrow } from '@/lib/server/auth-flows';
import { hashPassword, passwordProblem } from '@/lib/server/password';
import { consumeToken, findUserById, updateUser } from '@/lib/server/users';
import { createSession, destroyAllSessions, setSessionCookie } from '@/lib/server/session';
import { db } from '@/lib/server/db';
import { sha256 } from '@/lib/server/ids';

const body = z.object({ token: z.string().min(10).max(100), password: z.string().max(200) });

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  limitOrThrow(`reset:ip:${clientIp(req)}`, 10, 3600_000);
  const input = body.parse(await readJson(req));
  const pending = findUserFromTokenPeek(input.token);
  const problem = passwordProblem(input.password, pending?.email);
  if (problem) throw new HttpError(400, problem, 'weak_password', { field: 'password' });
  const userId = consumeToken(input.token, 'reset');
  const user = userId ? findUserById(userId) : null;
  if (!user) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.', 'invalid_token');
  updateUser(user.id, { password_hash: await hashPassword(input.password), ...(user.emailVerifiedAt ? {} : { email_verified_at: Date.now() }) });
  destroyAllSessions(user.id);
  const res = json({ ok: true });
  setSessionCookie(res, createSession(user.id, req.headers.get('user-agent') ?? ''));
  return res;
});

// Password rules mention the email name, so look it up without consuming the token.
function findUserFromTokenPeek(raw: string) {
  const row = db().prepare("SELECT u.email FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.id = ? AND t.kind = 'reset' AND t.used_at IS NULL AND t.expires_at > ?").get(sha256(raw), Date.now()) as { email: string } | undefined;
  return row ?? null;
}
