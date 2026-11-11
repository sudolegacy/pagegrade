import { describe, expect, it } from 'vitest';
import { CAPS, CATEGORIES, CRITERIA, gradeFor } from '@/lib/engine/rubric';
import { scoreReview, type RatedCriterion } from '@/lib/engine/score';
import { applyBounds, locateQuote } from '@/lib/engine/validate';
import { CATEGORY_COUNT, CHECK_COUNT } from '@/lib/engine/catalog';

const allRated = (rating: number, overrides: Record<string, number | null> = {}) =>
  Object.fromEntries(CRITERIA.map((c) => [c.id, { id: c.id, rating: c.id in overrides ? overrides[c.id] : rating, evidence: '' } satisfies RatedCriterion]));

describe('rubric', () => {
  it('matches the counts used in public copy', () => {
    expect(CRITERIA.length).toBe(CHECK_COUNT);
    expect(Object.keys(CATEGORIES).length).toBe(CATEGORY_COUNT);
    expect(new Set(CRITERIA.map((c) => c.id)).size).toBe(CRITERIA.length);
  });
  it('has category weights that add up to 100%', () => {
    expect(Object.values(CATEGORIES).reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1, 5);
  });
  it('grades at the documented boundaries', () => {
    expect([100, 90, 89, 80, 79, 70, 69, 55, 54, 40, 39, 0].map(gradeFor)).toEqual(['A+', 'A+', 'A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'F', 'F']);
  });
});

describe('scoreReview', () => {
  it('scores a perfect page 100 and an empty one 0', () => {
    for (const type of ['saas', 'service', 'ecommerce', 'leadgen', 'event', 'other'] as const) {
      expect(scoreReview(allRated(4), type).score).toBe(100);
      expect(scoreReview(allRated(0), type).score).toBe(0);
    }
  });
  it('is monotonic: improving one check never lowers the score', () => {
    let previous = scoreReview(allRated(2), 'saas').score;
    for (const c of CRITERIA) {
      const next = scoreReview(allRated(2, { [c.id]: 4 }), 'saas').score;
      expect(next).toBeGreaterThanOrEqual(previous - 0);
      previous = scoreReview(allRated(2), 'saas').score;
    }
  });
  it('applies hard caps for fundamental failures', () => {
    for (const cap of CAPS) {
      const rating = cap.id === 'unclear-offer' || cap.id === 'broken-mobile' ? 1 : 0;
      const result = scoreReview(allRated(4, { [cap.criterion]: rating }), 'saas');
      expect(result.score).toBeLessThanOrEqual(cap.max);
      expect(result.caps.find((c) => c.id === cap.id)?.applied).toBe(true);
      expect(result.criteria.find((c) => c.id === cap.criterion)?.severity).toBe('critical');
    }
  });
  it('ignores checks that do not apply and renormalises the rest', () => {
    const lighthouse = CRITERIA.filter((c) => c.source === 'lighthouse').map((c) => c.id);
    const result = scoreReview(allRated(4, Object.fromEntries(lighthouse.map((id) => [id, null]))), 'saas');
    expect(result.score).toBe(100);
    expect(result.criteria.filter((c) => c.status === 'na').map((c) => c.id).sort()).toEqual([...lighthouse].sort());
  });
  it('reports points lost that add up to the gap from 100 (before caps)', () => {
    const result = scoreReview(allRated(3), 'service');
    const lost = result.categories.reduce((s, c) => s + c.pointsLost, 0);
    expect(100 - result.rawScore).toBeCloseTo(lost, 0);
  });
});

describe('locateQuote', () => {
  const block = (t: string, y: number) => ({ t, b: { x: 10, y, w: 300, h: 20 } }) as never;
  const profiles = [{ profile: 'desktop' as const, blocks: [block('Payroll software for small UK businesses', 100), block('Run payroll in minutes,', 140), block('not hours.', 160), block('Start your free trial', 200)] }];
  it('finds exact quotes, ignoring case and curly punctuation', () => {
    expect(locateQuote('payroll software for small UK businesses', profiles)).toMatchObject({ verified: true, location: { profile: 'desktop', box: { y: 100 } } });
    expect(locateQuote('“Start your free trial”', profiles).verified).toBe(true);
  });
  it('finds quotes that span neighbouring blocks and returns their combined box', () => {
    const hit = locateQuote('Run payroll in minutes, not hours.', profiles);
    expect(hit.verified).toBe(true);
    expect(hit.location?.box).toEqual({ x: 10, y: 140, w: 300, h: 40 });
  });
  it('refuses quotes that are not on the page', () => {
    expect(locateQuote('The number one payroll platform in Europe', profiles).verified).toBe(false);
    expect(locateQuote('ok', profiles).verified).toBe(false);
  });
});

describe('applyBounds', () => {
  it('caps AI ratings that contradict measurements and explains why', () => {
    expect(applyBounds('cta.visual_prominence', 4, [{ max: 2, reason: 'The button has low contrast' } as never])).toMatchObject({ rating: 2, adjustment: { from: 4, to: 2 } });
    expect(applyBounds('cta.visual_prominence', 1, [{ max: 2, reason: 'x' } as never])).toEqual({ rating: 1 });
    expect(applyBounds('x', 3, undefined)).toEqual({ rating: 3 });
  });
});
