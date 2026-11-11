import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ReviewForm, type ReviewDefaults } from '@/components/app/review-form';
import { currentUser } from '@/lib/server/session';
import { accountView } from '@/lib/server/account';
import { getReview } from '@/lib/server/reviews';
import { CHECK_COUNT } from '@/lib/engine/catalog';

export const metadata: Metadata = { title: 'New review' };

export default async function NewReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await currentUser();
  if (!user) redirect('/login?next=/app/new');
  const sp = await searchParams;
  const account = accountView(user);
  let defaults: ReviewDefaults = { url: sp.url?.slice(0, 2048) };
  if (sp.from) {
    const prev = getReview(sp.from, user.id);
    if (prev) defaults = { url: prev.url, pageType: prev.pageType, goal: prev.goal, audience: prev.audience, context: prev.context };
  }
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[26px] font-semibold text-ink">{sp.from ? 'Review this page again' : 'Review a page'}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">We load the page on desktop and mobile, measure it, and judge it against {CHECK_COUNT} conversion checks. Most reviews take one to three minutes.</p>
      <div className="mt-7">
        <ReviewForm defaults={defaults} remaining={account.usage.remaining} unlimited={account.usage.unlimited} blocked={account.verificationRequired ? 'unverified' : null} />
      </div>
    </div>
  );
}
