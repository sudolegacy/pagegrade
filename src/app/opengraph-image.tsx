import { socialCard, OG_SIZE } from '@/lib/og';
import { CHECK_COUNT } from '@/lib/engine/catalog';

export const alt = 'PageGrade: landing page reviews backed by evidence';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return socialCard({
    eyebrow: `Landing page reviews · ${CHECK_COUNT} conversion checks`,
    title: 'Find out what is stopping your landing page converting',
    footer: ['Clarity', 'Calls to action', 'Trust', 'Design', 'Persuasion', 'Mobile', 'Speed'],
  });
}
