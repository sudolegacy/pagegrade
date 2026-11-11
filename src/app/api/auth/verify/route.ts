import { NextResponse, type NextRequest } from 'next/server';
import { handler, assertSameOrigin, json } from '@/lib/server/http';
import { limitOrThrow, sendVerification } from '@/lib/server/auth-flows';
import { consumeToken, findUserById, updateUser } from '@/lib/server/users';
import { requireApiUser } from '@/lib/server/session';
import { env } from '@/lib/server/env';
import { mailer } from '@/lib/server/mail';

export const dynamic = 'force-dynamic';

/** Link from the verification email. */
export async function GET(req: NextRequest) {
  const userId = consumeToken(req.nextUrl.searchParams.get('token') ?? '', 'verify');
  const user = userId ? findUserById(userId) : null;
  if (!user) return NextResponse.redirect(`${env.appUrl}/verify-email?status=invalid`, 303);
  if (!user.emailVerifiedAt) {
    updateUser(user.id, { email_verified_at: Date.now() });
    // A short, personal welcome on the first verification only.
    await mailer.welcome(user.email, {
      name: user.name, url: `${env.appUrl}/app/new`,
      signature: env.founderName ? `${env.founderName}, founder of PageGrade` : 'The PageGrade team',
    }).catch((e) => console.error('[verify] welcome email failed', e));
  }
  return NextResponse.redirect(`${env.appUrl}/app?verified=1`, 303);
}

/** Resend the verification email. */
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  if (user.emailVerifiedAt) return json({ ok: true, alreadyVerified: true });
  limitOrThrow(`verify:user:${user.id}`, 4, 3600_000, 'We have sent several emails already. Check your spam folder, or try again in an hour.');
  await sendVerification(user);
  return json({ ok: true });
});
