import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { getSharedReview } from '@/lib/server/reviews';
import { findUserById } from '@/lib/server/users';
import { brandFor } from '@/lib/server/brand';

/** Shared reports: PageGrade's header and footer, unless the owner uses white-label branding. */
export default async function SharedReportLayout({ children, params }: { children: React.ReactNode; params: Promise<{ shareId: string }> }) {
  const review = getSharedReview((await params).shareId);
  const brand = review ? brandFor(findUserById(review.userId)) : null;
  const main = <main className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-8 sm:py-10">{children}</main>;
  if (brand?.whiteLabel) return main;
  return (
    <>
      <SiteHeader sticky={false} />
      {main}
      <SiteFooter />
    </>
  );
}
