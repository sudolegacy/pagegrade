import { handler, assertSameOrigin, readJson, json, HttpError } from '@/lib/server/http';
import { isAdmin, requireApiUser } from '@/lib/server/session';
import { assertCapacity, createReview, listReviews } from '@/lib/server/reviews';
import { limitOrThrow } from '@/lib/server/auth-flows';
import { env } from '@/lib/server/env';
import { intakeSchema } from '@/lib/engine/intake';
import { UrlRejectedError, validatePublicUrl } from '@/lib/engine/net/url-guard';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  const user = await requireApiUser();
  const before = Number(req.nextUrl.searchParams.get('before')) || undefined;
  return json({ reviews: listReviews(user.id, { before, limit: 50 }) });
});

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  if (env.requireVerification && !user.emailVerifiedAt) throw new HttpError(403, 'Confirm your email address to start reviewing. We sent you a link when you signed up.', 'unverified');
  limitOrThrow(`review:user:${user.id}`, 30, 3600_000, 'You have started a lot of reviews in the last hour. Please wait a little before starting another.');
  const intake = intakeSchema.parse(await readJson(req));
  assertCapacity(user);
  let url: string;
  try {
    url = await validatePublicUrl(intake.url);
  } catch (error) {
    if (error instanceof UrlRejectedError) throw new HttpError(400, error.message, `url_${error.code}`, { field: 'url' });
    throw error;
  }
  const id = createReview(user, { ...intake, url }, { admin: isAdmin(user) });
  return json({ id }, 201);
});
