import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Rss } from 'lucide-react';
import { CATEGORIES, POSTS, activeCategories, featuredPosts } from '@/content/blog';
import { PostCard } from '@/components/blog/post-card';
import { BlogSearch, type SearchItem } from '@/components/blog/blog-search';
import { StartForm } from '@/components/app/start-form';
import { SITE } from '@/lib/site';
import { CHECK_COUNT } from '@/lib/engine/catalog';

const TITLE = 'AI search visibility and SEO guides for UK businesses';
const DESCRIPTION = 'Practical guides to getting found in ChatGPT, Gemini, Copilot and Google’s AI Overviews, local SEO for UK businesses, and landing pages that turn visitors into customers.';

export const metadata: Metadata = {
  title: { absolute: `Guides: AI search visibility & SEO for UK businesses · ${SITE.name}` },
  description: DESCRIPTION,
  alternates: { canonical: '/blog', types: { 'application/rss+xml': `${SITE.url}/blog/rss.xml` } },
  openGraph: { type: 'website', title: TITLE, description: DESCRIPTION, url: '/blog' },
};

export default function BlogIndex() {
  const featured = featuredPosts()[0] ?? POSTS[0];
  const rest = POSTS.filter((p) => p.slug !== featured?.slug);
  const categories = activeCategories();
  const index: SearchItem[] = POSTS.map((p) => ({ slug: p.slug, title: p.title, excerpt: p.excerpt, category: CATEGORIES[p.category].name, keywords: [p.primaryKeyword, ...p.secondaryKeywords, ...p.tags, ...(p.industries ?? [])].join(' ') }));
  const ld = {
    '@context': 'https://schema.org', '@type': 'Blog', name: `${SITE.name} guides`, url: `${SITE.url}/blog`, description: DESCRIPTION, inLanguage: 'en-GB',
    publisher: { '@type': 'Organization', name: SITE.company, url: SITE.url, logo: { '@type': 'ImageObject', url: `${SITE.url}/apple-icon.png` } },
    blogPost: POSTS.filter((p) => p.status === 'published').map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE.url}/blog/${p.slug}`, datePublished: p.published, dateModified: p.updated ?? p.published })),
  };

  return (
    <section className="py-14 sm:py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div className="container-page">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Guides</p>
            <h1 className="mt-2 text-[36px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[46px]">{TITLE}</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-zinc-600">How to get found, cited and recommended by AI assistants and Google, and what to fix on your page so visitors become customers. Written for UK businesses, with sources for every claim.</p>
          </div>
          <BlogSearch items={index} />
        </div>

        {categories.length > 1 && (
          <nav aria-label="Topics" className="mt-10 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link key={c.id} href={`/blog/category/${c.id}`} className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-[13.5px] font-medium text-zinc-700 shadow-card hover:border-zinc-300 hover:text-ink">{c.name}</Link>
            ))}
          </nav>
        )}

        {featured && (
          <div className="mt-10">
            <h2 className="sr-only">Featured guide</h2>
            <PostCard post={featured} large headingLevel="h3" />
          </div>
        )}

        {rest.length > 0 && (
          <div className="mt-12">
            <h2 className="text-[15px] font-semibold text-ink">Latest guides</h2>
            <ul className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => <li key={p.slug}><PostCard post={p} headingLevel="h3" /></li>)}
            </ul>
          </div>
        )}

        {categories.map((c) => (
          <div key={c.id} className="mt-14 border-t border-zinc-200/80 pt-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="max-w-2xl">
                <h2 className="text-[22px] font-semibold text-ink">{c.name}</h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-600">{c.intro}</p>
              </div>
              <Link href={`/blog/category/${c.id}`} className="inline-flex items-center gap-1 text-[14px] font-medium text-brand-700 hover:text-brand-800">All {c.name.toLowerCase()} guides<ArrowRight className="size-4" aria-hidden /></Link>
            </div>
            <ul className="mt-5 grid gap-x-8 gap-y-3 md:grid-cols-2">
              {POSTS.filter((p) => p.category === c.id).slice(0, 6).map((p) => (
                <li key={p.slug}><Link href={`/blog/${p.slug}`} className="text-[15px] font-medium text-ink underline-offset-4 hover:underline">{p.title}</Link></li>
              ))}
            </ul>
          </div>
        ))}

        <aside className="mt-16 grid gap-6 rounded-2xl bg-ink p-7 text-white sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <h2 className="text-[24px] font-semibold leading-tight">Is your page clear enough for people and AI to recommend?</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-300">PageGrade reviews your landing page against {CHECK_COUNT} checks, including whether it says plainly what you do, who it is for and why to trust you. Your first 3 reviews are free.</p>
          </div>
          <StartForm target="/signup" cta="Review my page" size="md" dark />
        </aside>

        <p className="mt-8 text-center text-[13px] text-zinc-500"><a href="/blog/rss.xml" className="inline-flex items-center gap-1.5 hover:text-ink"><Rss className="size-3.5" aria-hidden />RSS feed</a></p>
      </div>
    </section>
  );
}
