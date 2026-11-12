import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, Plus } from 'lucide-react';
import { currentUser, isAdmin } from '@/lib/server/session';
import { listReviews, getReview } from '@/lib/server/reviews';
import { accountView } from '@/lib/server/account';
import { hasSignupFeedback, SIGNUP_REASONS } from '@/lib/server/feedback';
import { agencyOnboarding } from '@/lib/server/onboarding';
import { FeedbackCard } from '@/components/app/feedback-card';
import { OnboardingCard } from '@/components/app/onboarding-card';
import { ReviewRows, hostPath, shortDate } from '@/components/app/review-list';
import { StartForm } from '@/components/app/start-form';
import { Alert } from '@/components/ui/field';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScoreRing, scoreTone, toneText } from '@/components/ui/score';
import { cn } from '@/lib/cn';
import { CHECK_COUNT } from '@/lib/engine/catalog';
import { ONBOARDING_COOKIE } from '@/lib/onboarding';

export const metadata: Metadata = { title: 'Overview' };

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;
  const account = accountView(user);
  const askFeedback = !hasSignupFeedback(user.id);
  const onboarding = (await cookies()).get(ONBOARDING_COOKIE)?.value === '1' ? null : agencyOnboarding(user, { admin: isAdmin(user) });
  const onboardingCard = onboarding && !onboarding.complete ? <OnboardingCard steps={onboarding.steps} /> : null;
  const reviews = listReviews(user.id, { limit: 100 });
  const notices = (
    <>
      {sp.verified && <Alert tone="success" className="mb-6" title="Email confirmed">You are all set to review pages.</Alert>}
      {sp.reset && <Alert tone="success" className="mb-6" title="Password updated">You have been signed out on your other devices.</Alert>}
    </>
  );
  const firstName = (user.name || '').split(' ')[0];

  if (reviews.length === 0) {
    return (
      <div>
        {notices}
        <div className="card overflow-hidden">
          <div className="px-6 py-10 sm:px-10 sm:py-14">
            <p className="eyebrow">Welcome{firstName ? `, ${firstName}` : ''}</p>
            <h1 className="mt-2 max-w-xl text-[30px] font-semibold leading-tight text-ink">Review your first landing page</h1>
            <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-zinc-600">Paste the page people land on from your ads, emails or search. In a couple of minutes you will know what is costing you conversions, with the evidence and the fixes to make first.</p>
            <StartForm className="mt-7 max-w-xl" cta="Continue" />
            <p className="mt-3 text-[13px] text-zinc-500">{account.usage.unlimited ? 'Admin account: unlimited reviews.' : `You have ${account.usage.remaining} review${account.usage.remaining === 1 ? '' : 's'} available.`}</p>
          </div>
          <ol className="grid border-t border-zinc-100 bg-zinc-50/60 sm:grid-cols-3">
            {[
              ['Capture', 'We load your page on desktop and mobile like a real visitor, dismissing cookie banners and loading lazy content.'],
              ['Check', `${CHECK_COUNT} checks across clarity, calls to action, trust, design, persuasion, mobile and speed.`],
              ['Fix', 'Prioritised fixes that show exactly where the problem is, plus rewrites you can test.'],
            ].map(([t, d], i) => (
              <li key={t} className="border-zinc-100 px-6 py-5 sm:border-l sm:first:border-l-0 sm:px-8">
                <p className="text-[13px] font-semibold text-ink"><span className="mr-2 text-zinc-400">{i + 1}</span>{t}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
        {onboardingCard && <div className="mt-6">{onboardingCard}</div>}
      </div>
    );
  }

  const latestDone = reviews.find((r) => r.status === 'complete');
  const latest = latestDone ? getReview(latestDone.id, user.id) : null;
  const inflight = reviews.find((r) => r.status === 'queued' || r.status === 'running');

  // One row per page: latest score and change since the previous completed review of the same URL.
  const pages = new Map<string, { url: string; id: string; score: number; prev: number | null; at: number; count: number }>();
  for (const r of reviews.filter((x) => x.status === 'complete' && x.score != null).reverse()) {
    const key = hostPath(r.finalUrl ?? r.url);
    const p = pages.get(key);
    pages.set(key, { url: r.finalUrl ?? r.url, id: r.id, score: r.score!, prev: p ? p.score : null, at: r.createdAt, count: (p?.count ?? 0) + 1 });
  }
  const tracked = [...pages.values()].sort((a, b) => b.at - a.at).slice(0, 6);

  return (
    <div className="space-y-8">
      {askFeedback && <FeedbackCard reasons={SIGNUP_REASONS} />}
      {notices}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-ink">{firstName ? `Hi ${firstName}` : 'Overview'}</h1>
          <p className="mt-1 text-[14.5px] text-zinc-600">{reviews.length} review{reviews.length === 1 ? '' : 's'} · {pages.size} page{pages.size === 1 ? '' : 's'}</p>
        </div>
        <ButtonLink href="/app/new" className="hidden sm:inline-flex"><Plus className="size-4" aria-hidden />New review</ButtonLink>
      </div>

      {inflight && (
        <Link href={`/app/reviews/${inflight.id}`} className="card flex items-center gap-4 px-5 py-4 transition hover:border-brand-200">
          <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-brand-600" /></span>
          <div className="min-w-0 flex-1"><p className="truncate text-[14.5px] font-medium text-ink">Reviewing {hostPath(inflight.url)}</p><p className="text-[13px] text-zinc-500">{inflight.status === 'queued' ? 'Waiting to start' : 'In progress'} · usually 1–3 minutes</p></div>
          <ArrowRight className="size-4 text-zinc-400" aria-hidden />
        </Link>
      )}

      {onboardingCard}

      {latest?.report && (
        <section className="card overflow-hidden">
          <div className="grid lg:grid-cols-[1fr_1.1fr]">
            <div className="flex gap-5 p-6">
              <ScoreRing score={latest.report.score} size={96} stroke={8} className="shrink-0" />
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-zinc-500">Latest review · {shortDate(latest.createdAt)}</p>
                <p className="mt-1 truncate text-[16px] font-semibold text-ink">{hostPath(latest.report.finalUrl)}</p>
                <p className="mt-1.5 line-clamp-3 text-[14px] leading-relaxed text-zinc-600">{latest.report.verdict}</p>
                <Link href={`/app/reviews/${latest.id}`} className="mt-3 inline-flex items-center gap-1 text-[13.5px] font-medium text-brand-700 hover:text-brand-800">Open report<ArrowRight className="size-3.5" aria-hidden /></Link>
              </div>
            </div>
            <div className="border-t border-zinc-100 bg-zinc-50/60 p-6 lg:border-l lg:border-t-0">
              <p className="text-[12.5px] font-medium text-zinc-500">Fix these first</p>
              <ol className="mt-3 space-y-2.5">
                {latest.report.issues.slice(0, 3).map((i, n) => (
                  <li key={i.id}>
                    <Link href={`/app/reviews/${latest.id}#fix-${n + 1}`} className="group flex items-start gap-3">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-ink text-[11px] font-semibold text-white">{n + 1}</span>
                      <span className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-ink group-hover:underline">{i.title}</span>
                      <Badge tone={i.severity === 'critical' ? 'red' : i.severity === 'major' ? 'amber' : 'neutral'} className="shrink-0">{i.severity === 'critical' ? 'Critical' : i.severity === 'major' ? 'Major' : 'Minor'}</Badge>
                    </Link>
                  </li>
                ))}
                {latest.report.issues.length === 0 && <li className="text-[14px] text-zinc-600">No significant problems found.</li>}
              </ol>
            </div>
          </div>
        </section>
      )}

      {tracked.length > 0 && (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Your pages</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tracked.map((p) => {
              const delta = p.prev == null ? null : p.score - p.prev;
              return (
                <Link key={p.id} href={`/app/reviews/${p.id}`} className="card group p-4 transition hover:border-zinc-300">
                  <p className="truncate text-[14px] font-medium text-ink">{hostPath(p.url)}</p>
                  <div className="mt-3 flex items-end justify-between">
                    <span className={cn('text-[28px] font-semibold leading-none tabular-nums tracking-tight', toneText[scoreTone(p.score)])}>{p.score}</span>
                    {delta == null ? <span className="text-[12.5px] text-zinc-400">{p.count} review</span> : (
                      <span className={cn('inline-flex items-center gap-0.5 text-[13px] font-medium tabular-nums', delta > 0 ? 'text-brand-700' : delta < 0 ? 'text-red-600' : 'text-zinc-500')}>
                        {delta > 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : delta < 0 ? <ArrowDownRight className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
                        {delta > 0 ? `+${delta}` : delta} since last review
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[12.5px] text-zinc-500">Last reviewed {shortDate(p.at)}</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink">Recent reviews</h2>
          <Link href="/app/reviews" className="text-[13px] font-medium text-zinc-500 hover:text-ink">View all</Link>
        </div>
        <ReviewRows reviews={reviews.slice(0, 5)} />
      </section>
    </div>
  );
}
