/**
 * Engine benchmark: runs the real pipeline against local fixtures (known good /
 * mixed / bad pages) and real sites, then reports scores, ordering checks,
 * repeatability across repeated evaluations, timing and AI cost.
 *
 *   npx tsx --env-file=.env.local bench/run.ts [--only=a,b] [--model=gpt-6-luna] [--runs=3]
 *     [--reasoning=low] [--write=gpt-6.1-terra|none] [--perf=on|off] [--repeat=1] [--fresh]
 */
import http from 'node:http';
import { readFile, rm, mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { runPipeline, type EngineConfig } from '../src/lib/engine/pipeline';
import type { Intake } from '../src/lib/engine/intake';
import type { Report } from '../src/lib/engine/report';

type Target = { id: string; url: string; fixture?: boolean; intake: Omit<Intake, 'url'>; expect: 'good' | 'mixed' | 'bad' };

const TARGETS: Target[] = [
  { id: 'fx-good-saas', url: 'good-saas.html', fixture: true, expect: 'good', intake: { pageType: 'saas', goal: 'trial', audience: 'Finance leaders at growing companies', context: '' } },
  { id: 'fx-mixed-service', url: 'mixed-service.html', fixture: true, expect: 'mixed', intake: { pageType: 'service', goal: 'contact', audience: 'Small business owners who need a new website', context: '' } },
  { id: 'fx-bad-shop', url: 'bad-shop.html', fixture: true, expect: 'bad', intake: { pageType: 'ecommerce', goal: 'purchase', audience: 'Online shoppers looking for bargains', context: '' } },
  { id: 'fx-bad-leadgen', url: 'bad-leadgen.html', fixture: true, expect: 'bad', intake: { pageType: 'leadgen', goal: 'lead', audience: 'Operations directors at mid-size companies', context: '' } },
  { id: 'stripe', url: 'https://stripe.com', expect: 'good', intake: { pageType: 'saas', goal: 'signup', audience: 'Businesses that need to accept online payments', context: '' } },
  { id: 'linear', url: 'https://linear.app', expect: 'good', intake: { pageType: 'saas', goal: 'signup', audience: 'Software product teams', context: '' } },
  { id: 'basecamp', url: 'https://basecamp.com', expect: 'good', intake: { pageType: 'saas', goal: 'trial', audience: 'Small business teams managing projects', context: '' } },
  { id: 'gatesnfences', url: 'https://www.gatesnfences.com', expect: 'bad', intake: { pageType: 'ecommerce', goal: 'purchase', audience: 'Homeowners looking for driveway gates and openers', context: '' } },
  { id: 'arngren', url: 'http://arngren.net', expect: 'bad', intake: { pageType: 'ecommerce', goal: 'purchase', audience: 'Shoppers in Norway looking for gadgets and vehicles', context: '' } },
];

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true']; }));

async function serveFixtures() {
  const root = path.join(process.cwd(), 'bench/fixtures');
  const server = http.createServer(async (req, res) => {
    const name = path.basename(decodeURIComponent((req.url || '/').split('?')[0])) || 'index.html';
    try { const body = await readFile(path.join(root, name)); res.writeHead(200, { 'content-type': name.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }).end(body); }
    catch { res.writeHead(404).end('not found'); }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const { port } = server.address() as { port: number };
  return { base: `http://127.0.0.1:${port}/`, close: () => server.close() };
}

(async () => {
  const config: EngineConfig = {
    evalModel: args.model || 'gpt-6-luna',
    evalRuns: Number(args.runs || 3),
    evalReasoning: (args.reasoning || 'low') as EngineConfig['evalReasoning'],
    writeModel: args.write === 'none' ? null : args.write || 'gpt-6.1-terra',
    performance: args.perf !== 'off',
    executablePath: process.env.CHROMIUM_PATH,
  };
  const only = args.only ? new Set(String(args.only).split(',')) : null;
  const repeat = Number(args.repeat || 1);
  const fixtures = await serveFixtures();
  const rows: Record<string, unknown>[] = [];
  const summary: { id: string; expect: string; scores: number[]; categories: Record<string, (number | null)[]>; criteria: Record<string, (number | null)[]>; costs: number[]; ms: number[] }[] = [];
  for (const t of TARGETS) {
    if (only && !only.has(t.id)) continue;
    const dir = path.join(process.cwd(), '.data/bench', t.id);
    if (args.fresh) await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const url = t.fixture ? fixtures.base + t.url : t.url;
    const entry = { id: t.id, expect: t.expect, scores: [] as number[], categories: {} as Record<string, (number | null)[]>, criteria: {} as Record<string, (number | null)[]>, costs: [] as number[], ms: [] as number[] };
    for (let i = 0; i < repeat; i++) {
      // Keep capture + performance checkpoints; re-run the AI stages each repeat.
      for (const f of await readdir(dir)) if (f === 'evaluation.json' || f === 'recommendations.json') await rm(path.join(dir, f));
      const t0 = Date.now();
      try {
        const report: Report = await runPipeline({ url, intake: { ...t.intake, url }, dir, config, allowPrivate: !!t.fixture, onStage: (s) => process.stdout.write(`  [${t.id}#${i + 1}] ${s} +${Math.round((Date.now() - t0) / 1000)}s\n`) });
        await writeFile(path.join(dir, `report-${i + 1}.json`), JSON.stringify(report, null, 1));
        entry.scores.push(report.score);
        entry.costs.push(report.meta.usage.costUsd);
        entry.ms.push(Date.now() - t0);
        for (const c of report.categories) (entry.categories[c.id] ||= []).push(c.score);
        for (const c of report.criteria) (entry.criteria[c.id] ||= []).push(c.rating);
        rows.push({ id: t.id, run: i + 1, score: report.score, raw: report.rawScore, grade: report.grade, conf: report.confidence.level, agree: report.meta.agreement, adj: report.meta.adjustments.length, cats: report.categories.map((c) => `${c.id.slice(0, 4)}:${c.score ?? '-'}`).join(' '), caps: report.caps.filter((c) => c.applied).map((c) => c.id).join(','), issues: report.issues.length, cost: report.meta.usage.costUsd.toFixed(4), s: Math.round((Date.now() - t0) / 1000) });
        console.log(`${t.id} #${i + 1}: ${report.score} (${report.grade}) — ${report.verdict}`);
      } catch (e) {
        console.log(`${t.id} #${i + 1}: ERROR ${(e as Error).message} ${(e as { detail?: string }).detail ?? ''}`);
        rows.push({ id: t.id, run: i + 1, error: (e as Error).message });
      }
    }
    summary.push(entry);
  }
  fixtures.close();
  console.table(rows);
  // Discrimination + repeatability
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const byExpect = (e: string) => summary.filter((s) => s.expect === e && s.scores.length).map((s) => mean(s.scores));
  const good = byExpect('good'), bad = byExpect('bad'), mixed = byExpect('mixed');
  console.log('mean good', mean(good).toFixed(1), 'mixed', mean(mixed).toFixed(1), 'bad', mean(bad).toFixed(1));
  console.log('ordering ok (every good > every mixed > every bad):', Math.min(...good) > Math.max(...(mixed.length ? mixed : [-1])) && Math.min(...(mixed.length ? mixed : [101])) > Math.max(...bad));
  for (const s of summary) {
    if (s.scores.length < 2) continue;
    const range = Math.max(...s.scores) - Math.min(...s.scores);
    const unstable = Object.entries(s.criteria).filter(([, v]) => { const n = v.filter((x): x is number => x != null); return n.length && Math.max(...n) - Math.min(...n) >= 2; }).map(([k]) => k);
    console.log(`${s.id}: scores ${s.scores.join(', ')} (range ${range}), unstable criteria (±2+): ${unstable.join(', ') || 'none'}`);
  }
  const allCosts = summary.flatMap((s) => s.costs);
  console.log(`avg AI cost per review: $${mean(allCosts).toFixed(4)}; avg duration ${(mean(summary.flatMap((s) => s.ms)) / 1000).toFixed(0)}s`);
  const out = path.join(process.cwd(), 'bench/results', `${new Date().toISOString().replace(/[:.]/g, '-')}-${config.evalModel}-r${config.evalRuns}-${config.evalReasoning}.json`);
  await writeFile(out, JSON.stringify({ config, rows, summary }, null, 1));
  console.log('saved', out);
  process.exit(0);
})();
