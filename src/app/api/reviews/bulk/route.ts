import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json, HttpError } from '@/lib/server/http';
import { isAdmin, requireApiUser } from '@/lib/server/session';
import { createReviews, entitledPlan, spendToday, type NewReview } from '@/lib/server/reviews';
import { limitOrThrow } from '@/lib/server/auth-flows';
import { env } from '@/lib/server/env';
import { BULK_MAX } from '@/lib/plans';
import { intakeSchema } from '@/lib/engine/intake';
import { UrlRejectedError, validatePublicUrl } from '@/lib/engine/net/url-guard';

export const dynamic = 'force-dynamic';

const body = intakeSchema.omit({ url: true }).extend({
  urls: z.array(z.string().trim().max(2048)).min(1, 'Add at least one page address.').max(BULK_MAX * 2),
  clientId: z.string().trim().max(40).nullish(),
});

/** Bulk reviews (Agency plan): up to BULK_MAX pages with the same goal and audience, queued as one batch. */
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const admin = isAdmin(user);
  if (!admin && !entitledPlan(user).limits.bulk) throw new HttpError(402, 'Bulk reviews are part of the Agency plan.', 'bulk_unavailable');
  if (env.requireVerification && !user.emailVerifiedAt) throw new HttpError(403, 'Confirm your email address to start reviewing. We sent you a link when you signed up.', 'unverified');
  limitOrThrow(`bulk:user:${user.id}`, 10, 3600_000, 'You have started several batches in the last hour. Please wait a little before starting another.');
  const { urls, clientId, ...intake } = body.parse(await readJson(req));
  if (spendToday() >= Number(process.env.AI_DAILY_BUDGET_USD || 25)) throw new HttpError(503, 'PageGrade is very busy right now. Please try again in a few hours.', 'capacity');

  const lines = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (!lines.length) throw new HttpError(400, 'Add at least one page address.', 'no_pages', { field: 'urls' });
  if (lines.length > BULK_MAX) throw new HttpError(400, `You can review up to ${BULK_MAX} pages at once.`, 'too_many_pages', { field: 'urls' });

  const errors: { line: number; url: string; error: string }[] = [];
  const inputs: NewReview[] = [];
  const seen = new Set<string>();
  for (const [i, line] of lines.entries()) {
    try {
      const url = await validatePublicUrl(line);
      if (seen.has(url)) continue;
      seen.add(url);
      inputs.push({ ...intake, url });
    } catch (error) {
      if (!(error instanceof UrlRejectedError)) throw error;
      errors.push({ line: i + 1, url: line, error: error.message });
    }
  }
  if (errors.length) throw new HttpError(400, `${errors.length} of the addresses ${errors.length === 1 ? 'needs' : 'need'} fixing before the batch can start.`, 'invalid_urls', { field: 'urls', errors });

  const { ids, batchId } = createReviews(user, inputs, { admin, clientId: clientId ?? null, origin: 'bulk' });
  return json({ ids, batchId }, 201);
});
