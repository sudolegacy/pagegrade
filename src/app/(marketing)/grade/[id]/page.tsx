import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/session';
import { getReview } from '@/lib/server/reviews';
import { GUEST_COOKIE, getGradeTeaser } from '@/lib/server/grader';
import { GradeResult } from '@/components/grade/grade-result';
import { hostPath } from '@/lib/format';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getGradeTeaser((await params).id);
  const title = t?.result ? `${hostPath(t.finalUrl ?? t.url)} scored ${t.result.score}/100` : 'Free page grade';
  return { title, description: 'A free PageGrade score for this landing page. Grade yours in about a minute, no signup needed.', robots: { index: false, follow: true } };
}

export default async function GradeResultPage({ params }: Props) {
  const { id } = await params;
  const teaser = getGradeTeaser(id, (await cookies()).get(GUEST_COOKIE)?.value);
  if (!teaser) notFound();
  const user = await currentUser();
  // Already saved to this account: show the full report instead.
  if (user && teaser.claimed && getReview(id, user.id)) redirect(`/app/reviews/${id}`);
  return (
    <div className="px-5 py-12 sm:py-16">
      <GradeResult initial={teaser} signedIn={!!user} />
    </div>
  );
}
