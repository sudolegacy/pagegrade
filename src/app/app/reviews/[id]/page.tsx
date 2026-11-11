import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AlertOctagon, ArrowLeft } from 'lucide-react';
import { currentUser } from '@/lib/server/session';
import { getReview } from '@/lib/server/reviews';
import { env } from '@/lib/server/env';
import { ReviewProgress } from '@/components/app/review-progress';
import { ReviewActions } from '@/components/app/review-actions';
import { ReviewExtras } from '@/components/app/review-extras';
import { accountView } from '@/lib/server/account';
import { monitorForUrl } from '@/lib/server/monitors';
import { listClients } from '@/lib/server/clients';
import { ReportView } from '@/components/report/report-view';
import { assetsFor } from '@/components/report/assets';
import { ReportHeader } from '@/components/report/report-header';
import { ButtonLink } from '@/components/ui/button';
import { hostPath } from '@/lib/format';

export const dynamic = 'force-dynamic';

// generateMetadata and the page share one database read and JSON parse per request.
const loadReview = cache((id: string, userId: string) => getReview(id, userId));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await currentUser();
  const review = user ? loadReview((await params).id, user.id) : null;
  return { title: review ? `${review.score != null ? `${review.score} · ` : ''}${hostPath(review.finalUrl ?? review.url)}` : 'Review' };
}


export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const review = loadReview(id, user.id);
  if (!review) notFound();
  const features = accountView(user).features;
  const extras = review.status === 'complete' && review.report ? (
    <ReviewExtras id={review.id} host={hostPath(review.finalUrl ?? review.url)} score={review.report.score}
      issues={review.report.issues.slice(0, 3).map((i) => ({ title: i.title, recommendation: i.recommendation }))}
      shareId={review.shareId} appUrl={env.appUrl} signature={user.brand.name || user.name}
      pdf={!!features.pdf} monitored={!!monitorForUrl(user.id, review.url)} canMonitor={features.monitors > 0}
      clients={features.clients ? listClients(user.id).map((c) => ({ id: c.id, name: c.name })) : []} clientId={review.clientId} />
  ) : null;

  const header = (
    <div>
      <Link href="/app/reviews" className="inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-ink"><ArrowLeft className="size-3.5" aria-hidden />History</Link>
      <div className="mt-3">
        <ReportHeader url={review.finalUrl ?? review.url} pageType={review.pageType} goal={review.goal} createdAt={review.createdAt}
          actions={<div className="flex flex-wrap items-center gap-2">{extras}<ReviewActions id={review.id} status={review.status} shareId={review.shareId} appUrl={env.appUrl} /></div>} />
      </div>
    </div>
  );

  if (review.status === 'queued' || review.status === 'running') {
    return (
      <div className="space-y-8">
        {header}
        <ReviewProgress id={review.id} notify={user.notifyOnComplete && !!env.smtp} initial={{ status: review.status, stage: review.stage, queuePosition: review.queuePosition, startedAt: review.startedAt, createdAt: review.createdAt }} />
      </div>
    );
  }

  if (review.status === 'failed' || !review.report) {
    return (
      <div className="space-y-8">
        {header}
        <div className="card mx-auto max-w-xl p-7 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-red-50 text-red-600"><AlertOctagon className="size-5" aria-hidden /></div>
          <h2 className="mt-4 text-[18px] font-semibold text-ink">{review.errorCode === 'cancelled' ? 'This review was cancelled' : 'We could not finish this review'}</h2>
          <p className="mx-auto mt-2 max-w-md text-[14.5px] leading-relaxed text-zinc-600">{review.errorMessage ?? 'Something went wrong.'}</p>
          <p className="mt-2 text-[13.5px] text-zinc-500">You have not been charged for this review.</p>
          <div className="mt-6 flex justify-center gap-2">
            <ButtonLink href={`/app/new?from=${review.id}`}>Try again</ButtonLink>
            <ButtonLink href="/app/new" variant="secondary">Review another page</ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  const assets = assetsFor(review.report, (file) => `/api/reviews/${review.id}/files/${file}`);
  return <ReportView report={review.report} assets={assets} header={header} />;
}
