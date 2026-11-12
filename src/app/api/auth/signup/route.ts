import { z } from 'zod';
import { handler, assertSameOrigin, clientIp, readJson, json, HttpError } from '@/lib/server/http';
import { emailSchema, limitOrThrow, sendVerification } from '@/lib/server/auth-flows';
import { hashPassword, passwordProblem } from '@/lib/server/password';
import { createUser, findUserByEmail } from '@/lib/server/users';
import { createSession, setSessionCookie } from '@/lib/server/session';
import { env } from '@/lib/server/env';
import { mailer } from '@/lib/server/mail';
import { rateLimit } from '@/lib/server/ratelimit';
import { GUEST_COOKIE, claimGuestGrades } from '@/lib/server/grader';
import { REFERRAL_COOKIE, attachReferral } from '@/lib/server/referrals';

const body = z.object({ name: z.string().trim().max(80).default(''), email: emailSchema, password: z.string().max(200) });

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  limitOrThrow(`signup:ip:${clientIp(req)}`, 6, 3600_000, 'Too many sign-ups from this network. Please try again later.');
  const input = body.parse(await readJson(req));
  const problem = passwordProblem(input.password, input.email);
  if (problem) throw new HttpError(400, problem, 'weak_password', { field: 'password' });
  if (findUserByEmail(input.email)) throw new HttpError(409, 'An account with this email already exists. Log in instead, or reset your password.', 'email_taken', { field: 'email' });
  const user = createUser({ email: input.email, name: input.name, passwordHash: await hashPassword(input.password) });
  // Free grades run in this browser move into the new account, and a partner link gets the credit.
  const claimed = claimGuestGrades(user.id, req.cookies.get(GUEST_COOKIE)?.value);
  const referred = attachReferral(user.id, req.cookies.get(REFERRAL_COOKIE)?.value);
  if (env.smtp || !env.isProduction) await sendVerification(user).catch((e) => console.error('[signup] verification email failed', e));
  // Alert the founder so every sign-up gets a personal hello. Fire and forget: it must never slow down or fail the sign-up,
  // and the hourly cap stops a sign-up flood from using up the mailbox (the admin page still lists every account).
  const alertTo = env.founderAlertEmail;
  if (alertTo && alertTo !== user.email && rateLimit('founder-alert:signup', 60, 3600_000).ok) {
    void mailer.founderSignup(alertTo, { email: user.email, name: user.name, referred, claimedGrades: claimed, adminUrl: `${env.appUrl}/admin` })
      .catch((e) => console.error('[signup] founder alert failed', e));
  }
  const res = json({ ok: true, needsVerification: env.requireVerification, claimed }, 201);
  setSessionCookie(res, createSession(user.id, req.headers.get('user-agent') ?? ''));
  return res;
});
