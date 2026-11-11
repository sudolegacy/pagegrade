import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { activeCategories, getCategory, postsInCategory } from '@/content/blog';
import { Breadcrumbs } from '@/components/blog/breadcrumbs';
import { PostCard } from '@/components/blog/post-card';
import { SITE } from '@/lib/site';

type Props = { params: Promise<{ category: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return activeCategories().map((c) => ({ category: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = getCategory((await params).category);
  if (!c) return {};
  return {
    title: { absolute: `${c.title} · ${SITE.name}` },
    description: c.description,
    alternates: { canonical: `/blog/category/${c.id}` },
    openGraph: { type: 'website', title: c.title, description: c.description, url: `/blog/category/${c.id}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const c = getCategory((await params).category);
  if (!c) notFound();
  const posts = postsInCategory(c.id);
  if (!posts.length) notFound();
  const ld = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: c.title, description: c.description, url: `${SITE.url}/blog/category/${c.id}`, inLanguage: 'en-GB',
    mainEntity: { '@type': 'ItemList', itemListElement: posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE.url}/blog/${p.slug}`, name: p.title })) },
  };
  return (
    <section className="py-10 sm:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div className="container-page">
        <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Guides', href: '/blog' }, { name: c.name, href: `/blog/category/${c.id}` }]} />
        <div className="mt-8 max-w-2xl">
          <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[42px]">{c.title}</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-zinc-600">{c.description}</p>
        </div>
        <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => <li key={p.slug}><PostCard post={p} /></li>)}
        </ul>
      </div>
    </section>
  );
}
