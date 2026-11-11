import { socialCard, OG_SIZE } from '@/lib/og';
import { getGradeTeaser } from '@/lib/server/grader';
import { hostPath } from '@/lib/format';

export const alt = 'PageGrade free page grade';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const t = getGradeTeaser((await params).id);
  const r = t?.result;
  return socialCard({
    eyebrow: 'Free page grade',
    title: t && r ? `${hostPath(t.finalUrl ?? t.url)} scored ${r.score}/100` : 'How good is your landing page?',
    footer: r ? [`Grade ${r.grade}`, `${r.issueCount} issue${r.issueCount === 1 ? '' : 's'} found`, 'Grade yours free'] : ['Free', 'No signup', 'About a minute'],
  });
}
