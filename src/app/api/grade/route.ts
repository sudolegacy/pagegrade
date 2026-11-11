import { z } from 'zod';
import { handler, assertSameOrigin, clientIp, readJson, json, HttpError } from '@/lib/server/http';
import { limitOrThrow } from '@/lib/server/auth-flows';
import { rateLimit } from '@/lib/server/ratelimit';
import { env } from '@/lib/server/env';
import { spendToday } from '@/lib/server/reviews';
import { GUEST_COOKIE, GUEST_COOKIE_MAX_AGE, createGuestReview, guestGradesSince, inflightGuestGrade, isGuestKey, newGuestKey } from '@/lib/server/grader';
import { PAGE_TYPES, GOALS, type PageType, type Goal } from '@/lib/engine/intake';
import { UrlRejectedError, validatePublicUrl } from '@/lib/engine/net/url-guard';

export const dynamic = 'force-dynamic';

const body = z.object({
  url: z.string().trim().min(3, 'Enter the address of the page you want to grade.').max(2048),
  pageType: z.enum(Object.keys(PAGE_TYPES) as [PageType, ...PageType[]]),
  goal: z.enum(Object.keys(GOALS) as [Goal, ...Goal[]]),
  website: z.string().max(200).optional(), // honeypot: people never see this field
});

/** Free grader: no account needed. Limited per visitor and per day so it cannot run up the AI bill. */
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  limitOrThrow(`grade:try:${ip}`, 20, 3600_000, 'Too many attempts. Please wait a few minutes and try again.');
  const input = body.parse(await readJson(req));
  if (input.website) throw new HttpError(400, 'Something went wrong. Please refresh the page and try again.', 'invalid');

  let url: string;
  try {
    url = await validatePublicUrl(input.url);
  } catch (error) {
    if (error instanceof UrlRejectedError) throw new HttpError(400, error.message, `url_${error.code}`, { field: 'url' });
    throw error;
  }

  const existing = req.cookies.get(GUEST_COOKIE)?.value;
  const key = isGuestKey(existing) ? existing : newGuestKey();
  const running = inflightGuestGrade(key);
  if (running) throw new HttpError(409, 'Your last free grade is still running. It usually takes about a minute.', 'grade_in_progress', { id: running });

  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  if (guestGradesSince(midnight.getTime()) >= env.graderDailyLimit || spendToday() >= Number(process.env.AI_DAILY_BUDGET_USD || 25)) {
    throw new HttpError(503, 'The free grader is very busy today. Create a free account to review your page now, or try again tomorrow.', 'capacity');
  }
  if (!rateLimit(`grade:ip:${ip}`, env.graderPerIp, 24 * 3600_000).ok) {
    throw new HttpError(429, "You have used today's free grades. Create a free account for 3 full reviews, or come back tomorrow.", 'grade_limit');
  }

  const id = createGuestReview({ url, pageType: input.pageType, goal: input.goal }, key);
  const res = json({ id }, 201);
  res.cookies.set(GUEST_COOKIE, key, { httpOnly: true, sameSite: 'lax', secure: env.appUrl.startsWith('https://'), path: '/', maxAge: GUEST_COOKIE_MAX_AGE });
  return res;
});
