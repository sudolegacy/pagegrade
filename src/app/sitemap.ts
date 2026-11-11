import type { MetadataRoute } from 'next';
import { PUBLISHED_POSTS, activeCategories } from '@/content/blog';
import { LEGAL_UPDATED_ISO } from '@/lib/legal';
import { SITE } from '@/lib/site';

const iso = (d: string) => new Date(d).toISOString();

export default function sitemap(): MetadataRoute.Sitemap {
  const latestPost = PUBLISHED_POSTS.map((p) => p.updated ?? p.published).sort().at(-1) ?? '2026-11-06';
  const legal = iso(LEGAL_UPDATED_ISO);
  const page = (path: string, lastModified: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] = 'monthly') =>
    ({ url: `${SITE.url}${path}`, lastModified, priority, changeFrequency });
  const categoryUpdated = (id: string) => PUBLISHED_POSTS.filter((p) => p.category === id).map((p) => p.updated ?? p.published).sort().at(-1) ?? latestPost;
  return [
    page('', iso(latestPost), 1, 'weekly'),
    page('/pricing', iso(latestPost), 0.8),
    page('/sample', iso(latestPost), 0.7),
    page('/grade', iso(latestPost), 0.9),
    page('/partners', iso(latestPost), 0.5),
    page('/blog', iso(latestPost), 0.8, 'weekly'),
    ...activeCategories().filter((c) => PUBLISHED_POSTS.some((p) => p.category === c.id)).map((c) => page(`/blog/category/${c.id}`, iso(categoryUpdated(c.id)), 0.6, 'weekly')),
    ...PUBLISHED_POSTS.map((p) => page(`/blog/${p.slug}`, iso(p.updated ?? p.published), 0.7)),
    page('/privacy', legal, 0.2, 'yearly'),
    page('/terms', legal, 0.2, 'yearly'),
    page('/cookies', legal, 0.2, 'yearly'),
  ];
}
