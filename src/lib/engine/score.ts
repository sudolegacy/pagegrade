import { CAPS, CATEGORIES, CRITERIA, categoryWeights, criterionWeight, gradeFor, type CategoryId, type CriterionSource } from './rubric';
import type { Loc } from './checks';
import type { PageType } from './intake';

export type Severity = 'critical' | 'major' | 'minor';
export type RatedCriterion = { id: string; rating: number | null; evidence: string; quote?: string; location?: Loc; adjusted?: { from: number; reason: string } };

export type ScoredCriterion = RatedCriterion & {
  category: CategoryId; label: string; source: CriterionSource;
  score: number | null; // 0-100
  maxPoints: number; // share of the overall score this criterion controls
  pointsLost: number;
  severity: Severity | null;
  status: 'pass' | 'warn' | 'fail' | 'na';
};

export type CategoryScore = { id: CategoryId; label: string; score: number | null; weight: number; pointsLost: number };
export type Scored = {
  score: number; rawScore: number; grade: ReturnType<typeof gradeFor>;
  categories: CategoryScore[]; criteria: ScoredCriterion[];
  caps: { id: string; label: string; max: number; applied: boolean }[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Deterministic scoring: weighted criterion ratings → category scores →
 * weighted overall score, then hard caps for fundamental failures. Categories
 * with no measurable criteria are dropped and the remaining weights renormalised.
 */
export function scoreReview(rated: Record<string, RatedCriterion>, pageType: PageType): Scored {
  const catW = categoryWeights(pageType);
  const byCat = new Map<CategoryId, { id: string; w: number; r: number | null }[]>();
  for (const c of CRITERIA) {
    const r = rated[c.id]?.rating ?? null;
    const list = byCat.get(c.category) ?? [];
    list.push({ id: c.id, w: criterionWeight(c.id, pageType), r });
    byCat.set(c.category, list);
  }
  const activeCats = (Object.keys(CATEGORIES) as CategoryId[]).filter((id) => (byCat.get(id) ?? []).some((x) => x.r != null));
  const totalCatW = activeCats.reduce((s, id) => s + catW[id], 0) || 1;

  const criteria: ScoredCriterion[] = [];
  const categories: CategoryScore[] = [];
  let raw = 0;
  for (const catId of Object.keys(CATEGORIES) as CategoryId[]) {
    const list = byCat.get(catId) ?? [];
    const applicable = list.filter((x) => x.r != null);
    const wSum = applicable.reduce((s, x) => s + x.w, 0);
    const share = activeCats.includes(catId) ? catW[catId] / totalCatW : 0;
    let catScore: number | null = null;
    if (applicable.length && wSum > 0) {
      catScore = (applicable.reduce((s, x) => s + x.w * ((x.r as number) / 4), 0) / wSum) * 100;
      raw += share * catScore;
    }
    let catLost = 0;
    for (const x of list) {
      const def = CRITERIA.find((c) => c.id === x.id)!;
      const base = rated[x.id] ?? { id: x.id, rating: null, evidence: '' };
      const maxPoints = x.r != null && wSum > 0 ? share * (x.w / wSum) * 100 : 0;
      const pointsLost = x.r != null ? maxPoints * (1 - x.r / 4) : 0;
      catLost += pointsLost;
      criteria.push({
        ...base, category: catId, label: def.label, source: def.source,
        score: x.r != null ? Math.round((x.r / 4) * 100) : null,
        maxPoints: round1(maxPoints), pointsLost: round1(pointsLost),
        severity: null, status: x.r == null ? 'na' : x.r >= 3 ? 'pass' : x.r === 2 ? 'warn' : 'fail',
      });
    }
    categories.push({ id: catId, label: CATEGORIES[catId].label, score: catScore == null ? null : Math.round(catScore), weight: round1(share * 100), pointsLost: round1(catLost) });
  }

  const ratingOf = (id: string) => rated[id]?.rating ?? null;
  const triggered = (id: string) => {
    const r = (() => {
      switch (id) {
        case 'unclear-offer': return ratingOf('clarity.offer');
        case 'no-cta': return ratingOf('cta.primary_above_fold');
        case 'no-proof': return ratingOf('trust.social_proof');
        case 'broken-mobile': return ratingOf('mobile.viewport');
        default: return null;
      }
    })();
    if (r == null) return false;
    return id === 'unclear-offer' || id === 'broken-mobile' ? r <= 1 : r === 0;
  };
  const caps = CAPS.map((c) => ({ id: c.id, label: c.label, max: c.max, applied: triggered(c.id) && raw > c.max }));
  const capValue = Math.min(100, ...CAPS.filter((c) => triggered(c.id)).map((c) => c.max));
  const score = Math.round(Math.min(raw, capValue));

  const capCriteria = new Set<string>(CAPS.filter((c) => triggered(c.id)).map((c) => c.criterion));
  for (const c of criteria) {
    if (c.rating == null || c.rating === 4) continue;
    if (capCriteria.has(c.id) || c.pointsLost >= 4) c.severity = 'critical';
    else if (c.pointsLost >= 1.8) c.severity = 'major';
    else c.severity = 'minor';
  }
  return { score, rawScore: round1(raw), grade: gradeFor(score), categories, criteria, caps };
}

export type Confidence = { level: 'high' | 'medium' | 'low'; reasons: string[] };

export function confidenceFor(input: { completeness: number; agreement: number; runs: number; unverified: number; quotes: number; adjustments: number; performanceMeasured: boolean; mismatch: string }): Confidence {
  const reasons: string[] = [];
  let points = 0;
  if (input.completeness < 70) { points += 2; reasons.push('Parts of the page could not be captured reliably.'); }
  else if (input.completeness < 90) { points += 1; reasons.push('The capture had minor gaps (see capture notes).'); }
  if (input.runs > 1 && input.agreement < 0.7) { points += 2; reasons.push('Independent evaluation passes disagreed on several criteria.'); }
  else if (input.runs > 1 && input.agreement < 0.85) { points += 1; reasons.push('Independent evaluation passes disagreed on a few criteria.'); }
  if (input.quotes >= 4 && input.unverified / input.quotes > 0.3) { points += 1; reasons.push('Some quoted evidence could not be matched to the page text.'); }
  if (input.adjustments >= 4) { points += 1; reasons.push('Several AI judgements had to be corrected against measured page facts.'); }
  if (!input.performanceMeasured) reasons.push('Speed could not be measured, so the technical score uses fewer checks.');
  if (input.mismatch) reasons.push('The page does not appear to match the goal or audience you described.');
  const level = points >= 3 ? 'low' : points >= 1 ? 'medium' : 'high';
  if (level === 'high') reasons.unshift('Full capture on desktop and mobile, with consistent evaluation passes.');
  return { level, reasons };
}
