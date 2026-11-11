/**
 * Blog content model. Each article lives in ./posts/<slug>.ts and is registered in ALL_POSTS below.
 * To publish a new article: add a file, import it here, set status to 'published'. Drafts are only
 * visible in development (`npm run dev`) and never appear in the sitemap, feed or listings in production.
 * The shape is deliberately CMS-like (slug, status, dates, taxonomy, SEO fields) so it can later be
 * swapped for a headless CMS without touching the pages.
 */
import { post as aiSearchVisibility } from './posts/ai-search-visibility-uk';
import { post as localAiSearch } from './posts/local-seo-ai-search-uk';
import { post as aiVisibilityAudit } from './posts/ai-visibility-audit';

export type CategoryId = 'ai-search' | 'local-seo' | 'landing-pages';
export type AuthorId = 'pagegrade';

export type Category = { id: CategoryId; name: string; title: string; description: string; intro: string };
export type Author = { id: AuthorId; name: string; role: string; bio: string; url: string };
export type Faq = { q: string; a: string };

export type Post = {
  slug: string;
  status: 'published' | 'draft';
  /** <title>; keep under ~60 characters where possible. */
  seoTitle: string;
  /** On-page H1. */
  title: string;
  /** Short label for footers and breadcrumbs. */
  shortTitle: string;
  /** Meta description, ~140–160 characters. */
  description: string;
  /** One- or two-sentence summary used on cards. */
  excerpt: string;
  published: string; // ISO date
  updated?: string; // ISO date
  author: AuthorId;
  category: CategoryId;
  tags: string[];
  /** Industries the article genuinely covers (shown as context; future industry hubs). */
  industries?: string[];
  /** Places the article is written for, e.g. "United Kingdom". */
  locations?: string[];
  primaryKeyword: string;
  secondaryKeywords: string[];
  featured?: boolean;
  /** Optional hero image (put files in /public/blog). Social cards are generated automatically. */
  image?: { src: string; alt: string; width: number; height: number };
  faqs?: Faq[];
  /** Product call to action shown after the article. */
  cta?: { title: string; body: string; label: string; href?: string };
  /** Hand-picked related slugs; otherwise related posts are chosen by category and tags. */
  related?: string[];
  body: string; // Markdown (GFM)
};

export const CATEGORIES: Record<CategoryId, Category> = {
  'ai-search': {
    id: 'ai-search', name: 'AI search visibility', title: 'AI search visibility guides',
    description: 'Practical, evidence-based guides to getting your business found, cited and recommended by ChatGPT, Gemini, Copilot and Google’s AI Overviews and AI Mode.',
    intro: 'How AI assistants find and choose the businesses they mention, what actually moves the needle, and how to measure it. No hype, no guaranteed rankings.',
  },
  'local-seo': {
    id: 'local-seo', name: 'Local SEO', title: 'Local SEO guides for UK businesses',
    description: 'Local SEO for UK businesses in the age of AI search: Google Business Profile, Bing Places, reviews, location pages and industry-specific advice.',
    intro: 'Getting found by customers nearby, in Google Maps and in AI answers, with advice specific to trades, clinics, professional services and hospitality.',
  },
  'landing-pages': {
    id: 'landing-pages', name: 'Landing pages', title: 'Landing page guides',
    description: 'Guides to landing pages that convert: clear headlines, calls to action, trust and proof.',
    intro: 'Turning the visitors you earn into customers.',
  },
};

export const AUTHORS: Record<AuthorId, Author> = {
  pagegrade: {
    id: 'pagegrade', name: 'PageGrade editorial team', role: 'Landing page and search specialists', url: '/blog',
    bio: 'The PageGrade team builds and tests the review engine behind PageGrade, which checks landing pages against 36 conversion and clarity criteria. We write about what we see working on real pages, and link to the primary sources behind every claim.',
  },
};

const ALL_POSTS: Post[] = [aiSearchVisibility, localAiSearch, aiVisibilityAudit];

const showDrafts = process.env.NODE_ENV !== 'production';

/** Published posts (plus drafts in development), newest first. */
export const POSTS: Post[] = ALL_POSTS
  .filter((p) => p.status === 'published' || showDrafts)
  .sort((a, b) => (b.updated ?? b.published).localeCompare(a.updated ?? a.published) || b.published.localeCompare(a.published));

/** Only published posts: use for the sitemap, feed and anything search engines read. */
export const PUBLISHED_POSTS = POSTS.filter((p) => p.status === 'published');

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug) ?? null;
export const getCategory = (id: string): Category | null => (Object.hasOwn(CATEGORIES, id) ? CATEGORIES[id as CategoryId] : null);
export const postsInCategory = (id: CategoryId) => POSTS.filter((p) => p.category === id);
/** Categories that have at least one post (empty categories are not linked or indexed). */
export const activeCategories = () => Object.values(CATEGORIES).filter((c) => POSTS.some((p) => p.category === c.id));
export const featuredPosts = () => POSTS.filter((p) => p.featured);

export const readingMinutes = (md: string) => Math.max(1, Math.round(md.split(/\s+/).filter(Boolean).length / 220));

export function relatedPosts(post: Post, limit = 3): Post[] {
  const picked = (post.related ?? []).map(getPost).filter((p): p is Post => !!p && p.slug !== post.slug);
  const rest = POSTS.filter((p) => p.slug !== post.slug && !picked.includes(p))
    .map((p) => ({ p, s: (p.category === post.category ? 3 : 0) + p.tags.filter((t) => post.tags.includes(t)).length }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
  return [...picked, ...rest].slice(0, limit);
}
