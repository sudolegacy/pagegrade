import { describe, expect, it } from 'vitest';
import { CATEGORIES, POSTS, getPost } from '@/content/blog';
import { PLANS, PAID_PLANS, planById, planByLookupKey } from '@/lib/plans';

describe('blog', () => {
  it('every post has unique slugs, a description of sensible length and real content', () => {
    expect(new Set(POSTS.map((p) => p.slug)).size).toBe(POSTS.length);
    for (const p of POSTS) {
      expect(p.description.length).toBeGreaterThan(70);
      expect(p.description.length).toBeLessThanOrEqual(165);
      expect(p.body.split(/\s+/).length).toBeGreaterThan(1000);
      expect(p.body).not.toMatch(/lorem ipsum|TODO|\bTBD\b/i);
    }
  });
  it('every post has unique SEO titles that contain its primary keyword', () => {
    expect(new Set(POSTS.map((p) => p.seoTitle)).size).toBe(POSTS.length);
    for (const p of POSTS) {
      expect(p.seoTitle.length).toBeLessThanOrEqual(65);
      expect(p.seoTitle.toLowerCase()).toContain(p.primaryKeyword.toLowerCase());
      expect(CATEGORIES[p.category]).toBeDefined();
    }
  });
  it('internal blog links point at real posts', () => {
    const slugs = new Set(POSTS.map((p) => p.slug));
    for (const p of POSTS) {
      for (const [, slug] of p.body.matchAll(/\]\(\/blog\/([a-z0-9-]+)\)/g)) expect(slugs, `${p.slug} links to /blog/${slug}`).toContain(slug);
      for (const r of p.related ?? []) expect(slugs).toContain(r);
    }
  });
  it('the AI visibility audit has 30 checklist items', () => {
    expect(getPost('ai-visibility-audit')!.body.match(/^- \[ \]/gm)?.length).toBe(30);
  });
});

describe('plans', () => {
  it('free is lifetime, paid plans are monthly with Stripe lookup keys', () => {
    expect(PLANS.free).toMatchObject({ priceGbp: 0, reviews: 3, period: 'lifetime', lookupKey: null });
    for (const p of PAID_PLANS) {
      expect(p.period).toBe('month');
      expect(planByLookupKey(p.lookupKey)).toBe(p);
    }
    expect(PAID_PLANS.map((p) => [p.id, p.priceGbp, p.reviews])).toEqual([['starter', 9, 10], ['pro', 29, 40], ['agency', 99, 200]]);
  });
  it('looks up untyped plan ids safely', () => {
    expect(planById('pro')?.name).toBe('Pro');
    expect(planById('enterprise')).toBeNull();
    expect(planById('__proto__')).toBeNull();
    expect(planByLookupKey(null)).toBeNull();
  });
});
