import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { checkPrintToken } from '@/lib/server/pdf';
import { getReview } from '@/lib/server/reviews';
import { findUserById } from '@/lib/server/users';
import { reportBrand } from '@/lib/server/brand';
import { ReportView } from '@/components/report/report-view';
import { assetsFor } from '@/components/report/assets';
import { ReportHeader } from '@/components/report/report-header';
import { BrandBar } from '@/components/report/brand-bar';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Report', robots: { index: false, follow: false } };

const PRINT_CSS = `
  nav[aria-label="Report sections"], [data-print-hide] { display: none !important; }
  html, body { background: #fff !important; }
  li, figure, table { break-inside: avoid; }
`;

/** Print view for PDF reports. Only reachable with a short-lived print token. */
export default async function PrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string | string[] }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  const token = typeof t === 'string' ? t : null;
  const userId = checkPrintToken(id, token);
  if (!userId || !token) notFound();
  const review = getReview(id, userId);
  if (!review?.report) notFound();
  const brand = reportBrand(findUserById(userId), review.clientId);
  const assets = assetsFor(review.report, (file) => `/api/reviews/${id}/files/${file}?pt=${encodeURIComponent(token)}`);
  const header = (
    <div className="space-y-6">
      {brand && <BrandBar brand={brand} note="Landing page review" />}
      <ReportHeader url={review.finalUrl ?? review.url} pageType={review.pageType} goal={review.goal} createdAt={review.createdAt} />
    </div>
  );
  return (
    <main className="mx-auto w-full max-w-[1040px] px-6 py-6">
      <style>{PRINT_CSS}</style>
      <ReportView report={review.report} assets={assets} header={header} nav="page" />
    </main>
  );
}
