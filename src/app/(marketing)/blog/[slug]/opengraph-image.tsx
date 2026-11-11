import { socialCard, OG_SIZE } from '@/lib/og';
import { CATEGORIES, POSTS, getPost, readingMinutes } from '@/content/blog';

export const alt = 'PageGrade guide';
export const size = OG_SIZE;
export const contentType = 'image/png';

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  return socialCard({
    eyebrow: 'PageGrade guide',
    title: post?.title ?? 'PageGrade guides',
    footer: post ? [`${readingMinutes(post.body)} min read`, CATEGORIES[post.category].name, ...(post.locations ?? []).slice(0, 1)] : ['AI search', 'Local SEO'],
  });
}
