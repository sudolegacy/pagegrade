/**
 * Published benchmark figures. Generated from bench/results/2026-11-06T00-18-08-350Z-gpt-6-luna-r3-low.json by
 * `npx tsx scripts/benchmark-summary.ts`; do not edit by hand.
 */
export const BENCHMARK = {
  date: '2026-11-06',
  pages: 9,
  testPages: 4,
  publicSites: 5,
  repeats: 2,
  maxSpread: 2,
  meanSpread: 1.3,
  testPageScores: { strong: 94, mixed: 52, weak: [16, 31] as [number, number] },
  medianSeconds: 46,
  maxSeconds: 114,
} as const;
