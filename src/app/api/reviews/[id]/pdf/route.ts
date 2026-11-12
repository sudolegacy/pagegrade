import { handler, HttpError } from '@/lib/server/http';
import { isAdmin, requireApiUser } from '@/lib/server/session';
import { entitledPlan, getReview } from '@/lib/server/reviews';
import { limitOrThrow } from '@/lib/server/auth-flows';
import { reportBrand } from '@/lib/server/brand';
import { renderReviewPdf } from '@/lib/server/pdf';
import { hostPath } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 90;
type Ctx = { params: Promise<{ id: string }> };

/** Download a finished review as a PDF (Pro and Agency). Agency PDFs carry the agency's branding. */
export const GET = handler<Ctx>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  if (!isAdmin(user) && !entitledPlan(user).limits.pdf) throw new HttpError(402, 'PDF reports are part of the Pro and Agency plans.', 'pdf_unavailable');
  const review = getReview(id, user.id);
  if (!review) throw new HttpError(404, 'Review not found.', 'not_found');
  if (review.status !== 'complete' || !review.report) throw new HttpError(409, 'The PDF is ready once the review has finished.', 'not_complete');
  limitOrThrow(`pdf:user:${user.id}`, 20, 3600_000, 'You have downloaded a lot of PDFs in the last hour. Please try again shortly.');
  const host = hostPath(review.finalUrl ?? review.url);
  const brand = reportBrand(user, review.clientId);
  const footer = brand?.whiteLabel ? `${brand.name ? `${brand.name} · ` : ''}Review of ${host}` : `PageGrade review of ${host}`;
  const pdf = await renderReviewPdf(id, user.id, footer);
  const name = `${host.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page'}-review.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' },
  });
});
