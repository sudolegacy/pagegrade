import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json, HttpError } from '@/lib/server/http';
import { currentToken, destroyAllSessions, requireApiUser } from '@/lib/server/session';
import { passwordHashFor, updateUser } from '@/lib/server/users';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/server/password';
import { limitOrThrow } from '@/lib/server/auth-flows';

const body = z.object({ current: z.string().min(1, 'Enter your current password.').max(200), next: z.string().max(200) });

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  limitOrThrow(`password:user:${user.id}`, 10, 3600_000);
  const input = body.parse(await readJson(req));
  if (!(await verifyPassword(input.current, passwordHashFor(user.id) ?? ''))) throw new HttpError(401, 'Your current password is not right.', 'invalid_password', { field: 'current' });
  const problem = passwordProblem(input.next, user.email);
  if (problem) throw new HttpError(400, problem, 'weak_password', { field: 'next' });
  updateUser(user.id, { password_hash: await hashPassword(input.next) });
  destroyAllSessions(user.id, await currentToken());
  return json({ ok: true });
});
