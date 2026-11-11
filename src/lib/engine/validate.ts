import type { TextBlock } from './types';
import type { Loc, Bound } from './checks';

const norm = (s: string) => s.toLowerCase()
  .replace(/[‘’‚‛′`´]/g, "'").replace(/[“”„‟″]/g, '"').replace(/[‐-―−]/g, '-')
  .replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s: string) => norm(s).split(' ').filter((t) => t.length > 1);

/**
 * Finds where a quoted phrase appears in the captured page text. Returns the
 * tightest matching block so the report can highlight the element. Quotes that
 * cannot be found are treated as unverified and are not shown to users.
 */
export function locateQuote(quote: string, profiles: { profile: 'desktop' | 'mobile'; blocks: TextBlock[] }[]): { verified: boolean; location?: Loc } {
  const nq = norm(quote);
  if (nq.length < 4) return { verified: false };
  const qTokens = tokens(quote);
  for (const { profile, blocks } of profiles) {
    const normed = blocks.map((b) => ({ b, n: norm(b.t) }));
    // 1. Exact containment in a single block (prefer the smallest block).
    const containing = normed.filter((x) => x.n.includes(nq)).sort((a, b) => a.n.length - b.n.length);
    if (containing[0]) return { verified: true, location: { profile, box: containing[0].b.b } };
    // 2. Quote spanning a few consecutive blocks (e.g. a headline split across spans).
    //    Shortest windows first, so the highlight covers only the blocks the quote is in.
    for (let size = 2; size <= 4; size++) {
      for (let i = 0; i + size <= normed.length; i++) {
        const window = normed.slice(i, i + size);
        if (!window.map((x) => x.n).join(' ').includes(nq)) continue;
        const parts = window.map((x) => x.b.b);
        const x0 = Math.min(...parts.map((p) => p.x)), y0 = Math.min(...parts.map((p) => p.y));
        const x1 = Math.max(...parts.map((p) => p.x + p.w)), y1 = Math.max(...parts.map((p) => p.y + p.h));
        return { verified: true, location: { profile, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } } };
      }
    }
    // 3. Near-verbatim (minor punctuation/ellipsis differences): >= 85% token overlap with one block.
    if (qTokens.length >= 4) {
      let best: { score: number; b: TextBlock } | null = null;
      for (const x of normed) {
        const bt = new Set(x.n.split(' '));
        const hit = qTokens.filter((t) => bt.has(t)).length / qTokens.length;
        if (hit >= 0.85 && (!best || hit > best.score)) best = { score: hit, b: x.b };
      }
      if (best) return { verified: true, location: { profile, box: best.b.b } };
    }
  }
  return { verified: false };
}

export type Adjustment = { id: string; from: number; to: number; reason: string };

/** Applies measured bounds to AI ratings. Returns the bounded rating and any adjustment made. */
export function applyBounds(id: string, rating: number, bounds: Bound[] | undefined): { rating: number; adjustment?: Adjustment } {
  if (!bounds?.length) return { rating };
  let r = rating;
  const reasons: string[] = [];
  for (const b of bounds) {
    if (b.max != null && r > b.max) { r = b.max; reasons.push(b.reason); }
  }
  for (const b of bounds) {
    // A floor never overrides a ceiling that was just applied.
    const ceiling = Math.min(...bounds.map((x) => x.max ?? 4));
    if (b.min != null && r < b.min && b.min <= ceiling) { r = b.min; reasons.push(b.reason); }
  }
  return r === rating ? { rating } : { rating: r, adjustment: { id, from: rating, to: r, reason: reasons.join('; ') } };
}
