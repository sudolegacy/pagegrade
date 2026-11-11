/**
 * Writes src/content/benchmark.ts from a benchmark results file so published
 * figures always come from a real run.
 *
 *   npx tsx scripts/benchmark-summary.ts [bench/results/<file>.json]
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Row = { id: string; run: number; score?: number; s?: number; error?: string };
const dir = 'bench/results';
const file = process.argv[2] || path.join(dir, (await readdir(dir)).filter((f) => f.endsWith('.json')).sort().pop()!);
const { rows } = JSON.parse(await readFile(file, 'utf8')) as { rows: Row[] };
const ok = rows.filter((r) => typeof r.score === 'number');
const ids = [...new Set(ok.map((r) => r.id))];
const scores = (id: string) => ok.filter((r) => r.id === id).map((r) => r.score!);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const spreads = ids.map((id) => Math.max(...scores(id)) - Math.min(...scores(id)));
const weak = ['fx-bad-shop', 'fx-bad-leadgen'].filter((id) => ids.includes(id)).map((id) => Math.round(mean(scores(id))));
const full = ok.filter((r) => r.run === 1 && typeof r.s === 'number').map((r) => r.s!).sort((a, b) => a - b);
const repeats = Math.max(...ids.map((id) => scores(id).length));
const out = {
  date: path.basename(file).slice(0, 10),
  pages: ids.length,
  testPages: ids.filter((i) => i.startsWith('fx-')).length,
  publicSites: ids.filter((i) => !i.startsWith('fx-')).length,
  repeats,
  maxSpread: Math.max(...spreads),
  meanSpread: Math.round(mean(spreads) * 10) / 10,
  testPageScores: { strong: Math.round(mean(scores('fx-good-saas'))), mixed: Math.round(mean(scores('fx-mixed-service'))), weak: [Math.min(...weak), Math.max(...weak)] },
  medianSeconds: full[Math.floor((full.length - 1) / 2)],
  maxSeconds: full[full.length - 1],
  errors: rows.filter((r) => r.error).length,
};
const ts = `/**
 * Published benchmark figures. Generated from ${file} by
 * \`npx tsx scripts/benchmark-summary.ts\`; do not edit by hand.
 */
export const BENCHMARK = {
  date: '${out.date}',
  pages: ${out.pages},
  testPages: ${out.testPages},
  publicSites: ${out.publicSites},
  repeats: ${out.repeats},
  maxSpread: ${out.maxSpread},
  meanSpread: ${out.meanSpread},
  testPageScores: { strong: ${out.testPageScores.strong}, mixed: ${out.testPageScores.mixed}, weak: [${out.testPageScores.weak.join(', ')}] as [number, number] },
  medianSeconds: ${out.medianSeconds},
  maxSeconds: ${out.maxSeconds},
} as const;
`;
await writeFile('src/content/benchmark.ts', ts);
console.log(JSON.stringify(out));
