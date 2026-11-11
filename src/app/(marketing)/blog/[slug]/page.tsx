import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AUTHORS, CATEGORIES, POSTS, getPost, readingMinutes, relatedPosts } from '@/content/blog';
import { renderArticle } from '@/lib/blog-render';
import { Breadcrumbs } from '@/components/blog/breadcrumbs';
import { PostCard, PostMeta } from '@/components/blog/post-card';
import { ShareLinks } from '@/components/blog/share-links';
import { StartForm } from '@/components/app/start-form';
import { ButtonLink } from '@/components/ui/button';
import { faqJsonLd } from '@/components/site/faq';
import { SITE } from '@/lib/site';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  const url = `/blog/${post.slug}`;
  return {
    title: { absolute: post.seoTitle },
    description: post.description,
    keywords: [post.primaryKeyword, ...post.secondaryKeywords],
    authors: [{ name: AUTHORS[post.author].name, url: `${SITE.url}${AUTHORS[post.author].url}` }],
    alternates: { canonical: url },
    robots: post.status === 'draft' ? { index: false, follow: false } : undefined,
    openGraph: {
      type: 'article', url, title: post.title, description: post.description, siteName: SITE.name, locale: 'en_GB',
      publishedTime: post.published, modifiedTime: post.updated ?? post.published, section: CATEGORIES[post.category].name, tags: post.tags,
      ...(post.image ? { images: [{ url: post.image.src, width: post.image.width, height: post.image.height, alt: post.image.alt }] } : {}),
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description },
  };
}

export default async function PostPage({ params }: Props) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const { html, headings } = await renderArticle(post.body);
  const category = CATEGORIES[post.category];
  const author = AUTHORS[post.author];
  const url = `${SITE.url}/blog/${post.slug}`;
  const related = relatedPosts(post);
  const toc = headings.filter((h) => h.level === 2);
  const words = post.body.split(/\s+/).filter(Boolean).length;

  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    '@id': `${url}#article`, url, mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: post.title, description: post.description, inLanguage: 'en-GB',
    image: post.image ? `${SITE.url}${post.image.src}` : `${url}/opengraph-image`,
    datePublished: post.published, dateModified: post.updated ?? post.published,
    articleSection: category.name, keywords: [post.primaryKeyword, ...post.secondaryKeywords].join(', '), wordCount: words,
    ...(post.locations?.length ? { spatialCoverage: post.locations.map((name) => ({ '@type': 'Place', name })) } : {}),
    about: post.primaryKeyword,
    author: { '@type': 'Organization', name: author.name, url: `${SITE.url}${author.url}` },
    publisher: { '@type': 'Organization', name: SITE.company, url: SITE.url, logo: { '@type': 'ImageObject', url: `${SITE.url}/apple-icon.png` } },
  };

  return (
    <article className="py-10 sm:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      {post.faqs?.length ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(post.faqs)) }} /> : null}

      <div className="container-page">
        <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Guides', href: '/blog' }, { name: category.name, href: `/blog/category/${category.id}` }, { name: post.shortTitle, href: `/blog/${post.slug}` }]} />

        <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,720px)_1fr] lg:gap-16">
          <div className="min-w-0">
            <header>
              <Link href={`/blog/category/${category.id}`} className="text-[13.5px] font-medium text-brand-700 hover:text-brand-800">{category.name}</Link>
              <h1 className="mt-3 text-balance text-[32px] font-semibold leading-[1.12] tracking-[-0.03em] text-ink sm:text-[42px]">{post.title}</h1>
              <p className="mt-4 text-[18px] leading-relaxed text-zinc-600">{post.excerpt}</p>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6">
                <div className="text-[13.5px] text-zinc-500">
                  <p>By <Link href={author.url} className="font-medium text-zinc-700 hover:text-ink">{author.name}</Link></p>
                  <PostMeta post={post} className="mt-0.5 text-[13.5px]" />
                </div>
                <ShareLinks url={url} title={post.title} />
              </div>
              {post.updated && <p className="mt-3 text-[12.5px] text-zinc-500">First published <time dateTime={post.published}>{new Date(post.published).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })}</time>.</p>}
            </header>

            {post.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.image.src} alt={post.image.alt} width={post.image.width} height={post.image.height} className="mt-8 w-full rounded-xl border border-zinc-200" fetchPriority="high" />
            )}

            {toc.length > 2 && (
              <nav aria-label="On this page" className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 lg:hidden">
                <p className="text-[13px] font-semibold text-ink">On this page</p>
                <ol className="mt-2.5 space-y-1.5 text-[14px]">{toc.map((h) => <li key={h.id}><a href={`#${h.id}`} className="text-zinc-600 hover:text-ink">{h.text}</a></li>)}</ol>
              </nav>
            )}

            <div className="prose-pg mt-10" dangerouslySetInnerHTML={{ __html: html }} />

            {post.faqs?.length ? (
              <section aria-labelledby="faq" className="mt-14">
                <h2 id="faq" className="text-[26px] font-semibold leading-tight text-ink">Frequently asked questions</h2>
                <div className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
                  {post.faqs.map((f) => (
                    <details key={f.q} className="group py-4">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[16.5px] font-medium text-ink">
                        <h3 className="font-medium">{f.q}</h3>
                        <span className="mt-0.5 text-zinc-400 transition group-open:rotate-45" aria-hidden>+</span>
                      </summary>
                      <p className="mt-3 text-[15.5px] leading-relaxed text-zinc-700">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}

            <aside className="mt-14 rounded-2xl border border-brand-200/70 bg-brand-50/60 p-6 sm:p-8">
              <h2 className="text-[21px] font-semibold text-ink">{post.cta?.title ?? 'Check your own page in a couple of minutes'}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-700">{post.cta?.body ?? 'PageGrade reviews your live page and shows the evidence on your screenshots. Your first 3 reviews are free.'}</p>
              {post.cta?.href
                ? <ButtonLink href={post.cta.href} className="mt-5">{post.cta.label}</ButtonLink>
                : <StartForm target="/signup" cta={post.cta?.label ?? 'Review my page'} size="md" className="mt-5" />}
              <p className="mt-3 text-[13px] text-zinc-500">Not sure yet? <Link href="/sample" className="font-medium text-brand-700 hover:text-brand-800">See a full sample report</Link> or <Link href="/pricing" className="font-medium text-brand-700 hover:text-brand-800">compare plans</Link>.</p>
            </aside>

            <section aria-label="About the author" className="mt-12 flex gap-4 rounded-xl border border-zinc-200 bg-white p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[15px] font-semibold text-white" aria-hidden>PG</span>
              <div>
                <p className="text-[14.5px] font-semibold text-ink">{author.name}</p>
                <p className="text-[13px] text-zinc-500">{author.role}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">{author.bio}</p>
              </div>
            </section>

            {post.tags.length > 0 && (
              <p className="mt-8 flex flex-wrap gap-2" aria-label="Topics">
                {post.tags.map((t) => <span key={t} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[12.5px] text-zinc-600">{t}</span>)}
              </p>
            )}
          </div>

          {toc.length > 2 && (
            <aside className="hidden lg:block">
              <nav aria-label="On this page" className="sticky top-24">
                <p className="text-[13px] font-semibold text-ink">On this page</p>
                <ol className="mt-3 space-y-2 border-l border-zinc-200 text-[13.5px]">
                  {toc.map((h) => <li key={h.id}><a href={`#${h.id}`} className="-ml-px block border-l border-transparent pl-4 leading-snug text-zinc-600 hover:border-zinc-400 hover:text-ink">{h.text}</a></li>)}
                </ol>
                <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-4">
                  <p className="text-[13.5px] font-semibold text-ink">Review your page free</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{readingMinutes(post.body) > 5 ? 'Short on time? ' : ''}See what is unclear or missing, with fixes.</p>
                  <ButtonLink href="/signup" size="sm" className="mt-3 w-full">Start free</ButtonLink>
                </div>
              </nav>
            </aside>
          )}
        </div>

        {related.length > 0 && (
          <nav aria-label="Related guides" className="mt-16 border-t border-zinc-200/80 pt-10">
            <h2 className="text-[19px] font-semibold text-ink">Related guides</h2>
            <ul className="mt-5 grid gap-5 md:grid-cols-3">{related.map((p) => <li key={p.slug}><PostCard post={p} headingLevel="h3" /></li>)}</ul>
          </nav>
        )}
      </div>
    </article>
  );
}
