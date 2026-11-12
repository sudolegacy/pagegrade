import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Link2 } from 'lucide-react';
import { getSharedReview } from '@/lib/server/reviews';
import { ReportView } from '@/components/report/report-view';
import { assetsFor } from '@/components/report/assets';
import { ReportHeader } from '@/components/report/report-header';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { hostPath } from '@/lib/format';
import { findUserById } from '@/lib/server/users';
import { reportBrand } from '@/lib/server/brand';
import { BrandBar } from '@/components/report/brand-bar';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ shareId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const review = getSharedReview((await params).shareId);
  return {
    title: review ? `Landing page review of ${hostPath(review.finalUrl ?? review.url)}` : 'Shared review',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function SharedReviewPage({ params }: Props) {
  const { shareId } = await params;
  const review = getSharedReview(shareId);
  if (!review?.report) notFound();
  const assets = assetsFor(review.report, (file) => `/api/reviews/${review.id}/files/${file}?s=${encodeURIComponent(shareId)}`);
  const brand = reportBrand(findUserById(review.userId), review.clientId);
  const header = (
    <div className="space-y-6">
      {brand && <BrandBar brand={brand} note="Landing page review" />}
      {!brand?.whiteLabel && <div className="flex flex-col gap-3 rounded-xl border border-brand-200/70 bg-brand-50/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2.5 text-[14px] leading-snug text-brand-900">
          <Link2 className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
          <span>Someone shared this PageGrade review with you. It shows the page as it was on the date of the review.</span>
        </p>
        <ButtonLink href="/grade" size="sm" className="shrink-0">Grade your own page free</ButtonLink>
      </div>}
      <ReportHeader url={review.finalUrl ?? review.url} pageType={review.pageType} goal={review.goal} createdAt={review.createdAt}
        eyebrow={<Badge tone="neutral" className="mb-2">Shared review</Badge>} />
    </div>
  );
  return <ReportView report={review.report} assets={assets} header={header} nav="page" />;
}
