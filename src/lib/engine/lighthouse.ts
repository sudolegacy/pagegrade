import { proxyChromeArgs, startGuardedProxy } from './net/proxy';

export type FieldData = { lcpMs: number | null; cls: number | null; inpMs: number | null; category: string | null };
export type LighthouseResult = {
  source: 'pagespeed' | 'local';
  /** Real-user (Chrome UX Report) data when Google has enough traffic for this URL or origin. */
  field: FieldData | null;
  scores: { performance: number | null; accessibility: number | null; seo: number | null; bestPractices: number | null };
  metrics: { fcpMs: number | null; lcpMs: number | null; tbtMs: number | null; cls: number | null; siMs: number | null };
  opportunities: { id: string; title: string; savingsMs: number; savingsBytes: number }[];
  accessibilityFailures: { id: string; title: string; count: number }[];
  pageWeightBytes: number | null;
  warnings: string[];
  durationMs: number;
};

type Audit = { id: string; title: string; score: number | null; scoreDisplayMode: string; numericValue?: number; details?: { type?: string; items?: unknown[]; overallSavingsMs?: number; overallSavingsBytes?: number }; metricSavings?: { LCP?: number; FCP?: number } };


type Lhr = { categories: Record<string, { score: number | null; auditRefs?: { id: string; weight: number }[] }>; audits: Record<string, Audit>; runWarnings?: string[] };

function summarise(lhr: Lhr, started: number): Omit<LighthouseResult, 'source' | 'field'> {
  const cat = (id: string) => { const s = lhr.categories[id]?.score; return typeof s === 'number' ? Math.round(s * 100) : null; };
  const audits = lhr.audits as Record<string, Audit>;
  const num = (id: string) => { const v = audits[id]?.numericValue; return typeof v === 'number' ? v : null; };
  const opportunities = Object.values(audits)
    .filter((a) => a.score !== null && a.score < 0.9 && ((a.metricSavings?.LCP ?? 0) > 100 || (a.details?.overallSavingsMs ?? 0) > 100 || (a.details?.overallSavingsBytes ?? 0) > 50_000))
    .map((a) => ({ id: a.id, title: a.title, savingsMs: Math.round(Math.max(a.metricSavings?.LCP ?? 0, a.metricSavings?.FCP ?? 0, a.details?.overallSavingsMs ?? 0)), savingsBytes: Math.round(a.details?.overallSavingsBytes ?? 0) }))
    .sort((a, b) => b.savingsMs - a.savingsMs || b.savingsBytes - a.savingsBytes)
    .slice(0, 6);
  const a11yRefs = (lhr.categories.accessibility?.auditRefs ?? []) as { id: string; weight: number }[];
  const accessibilityFailures = a11yRefs
    .map((r) => audits[r.id])
    .filter((a): a is Audit => !!a && a.score === 0 && a.scoreDisplayMode === 'binary')
    .map((a) => ({ id: a.id, title: a.title, count: Array.isArray(a.details?.items) ? a.details!.items!.length : 0 }))
    .slice(0, 8);
  return {
    scores: { performance: cat('performance'), accessibility: cat('accessibility'), seo: cat('seo'), bestPractices: cat('best-practices') },
    metrics: { fcpMs: num('first-contentful-paint'), lcpMs: num('largest-contentful-paint'), tbtMs: num('total-blocking-time'), cls: num('cumulative-layout-shift'), siMs: num('speed-index') },
    opportunities, accessibilityFailures,
    pageWeightBytes: num('total-byte-weight'),
    warnings: (lhr.runWarnings ?? []).slice(0, 3).map((w: string) => w.slice(0, 200)),
    durationMs: Date.now() - started,
  };
}

const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) => new Promise<T>((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
  p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

/**
 * Lighthouse mobile audit (simulated throttling: a mid-range phone on a slow
 * 4G connection). Runs in its own Chrome, forced through the guarded proxy.
 */
export async function runLighthouse(url: string, opts: { executablePath?: string; allowPrivate?: boolean; timeoutMs?: number } = {}): Promise<LighthouseResult> {
  const started = Date.now();
  const [{ default: lighthouse }, chromeLauncher] = await Promise.all([import('lighthouse'), import('chrome-launcher')]);
  const proxy = await startGuardedProxy({ allowPrivate: opts.allowPrivate, maxBytes: 60 * 1024 * 1024 });
  const chrome = await chromeLauncher.launch({
    chromePath: opts.executablePath || process.env.CHROMIUM_PATH || undefined,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--mute-audio', '--disable-gpu', ...proxyChromeArgs(proxy.url)],
    logLevel: 'silent',
  });
  try {
    const run = lighthouse(url, {
      port: chrome.port, output: 'json', logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices'],
      formFactor: 'mobile', throttlingMethod: 'simulate', maxWaitForLoad: 35_000, disableFullPageScreenshot: true,
      screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
    });
    const result = await withTimeout(run, opts.timeoutMs ?? 90_000, 'Lighthouse');
    const lhr = result?.lhr;
    if (!lhr) throw new Error('Lighthouse returned no result');
    if (lhr.runtimeError) throw new Error(`Lighthouse: ${lhr.runtimeError.message}`);
    return { ...summarise(lhr as unknown as Lhr, started), source: 'local', field: null };
  } finally {
    await Promise.resolve(chrome.kill()).catch(() => undefined);
    await proxy.close().catch(() => undefined);
  }
}

/**
 * Google PageSpeed Insights (the same Lighthouse audit on Google's servers, plus
 * real-user field data). Preferred when PAGESPEED_API_KEY is set because results
 * match what site owners see in PageSpeed Insights and no local CPU is used.
 */
export async function runPageSpeed(url: string, apiKey: string, timeoutMs = 90_000): Promise<LighthouseResult> {
  const started = Date.now();
  const qs = new URLSearchParams({ url, strategy: 'mobile', key: apiKey });
  for (const c of ['performance', 'accessibility', 'seo', 'best-practices']) qs.append('category', c);
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`, { signal: AbortSignal.timeout(timeoutMs) });
  const body = await res.json().catch(() => null) as { lighthouseResult?: Lhr & { runtimeError?: { message: string } }; loadingExperience?: { overall_category?: string; metrics?: Record<string, { percentile: number; category: string }> }; error?: { message: string } } | null;
  if (!res.ok || !body?.lighthouseResult) throw new Error(`PageSpeed Insights: ${body?.error?.message?.slice(0, 160) ?? `HTTP ${res.status}`}`);
  if (body.lighthouseResult.runtimeError?.message) throw new Error(`PageSpeed Insights: ${body.lighthouseResult.runtimeError.message}`);
  const m = body.loadingExperience?.metrics;
  const field: FieldData | null = m && Object.keys(m).length ? {
    lcpMs: m.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    cls: m.CUMULATIVE_LAYOUT_SHIFT_SCORE ? m.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
    inpMs: m.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    category: body.loadingExperience?.overall_category ?? null,
  } : null;
  return { ...summarise(body.lighthouseResult, started), source: 'pagespeed', field };
}

/** PageSpeed Insights when configured, falling back to a local Lighthouse run. */
export async function auditPerformance(url: string, opts: { executablePath?: string; allowPrivate?: boolean } = {}): Promise<LighthouseResult> {
  const key = process.env.PAGESPEED_API_KEY;
  if (key && !opts.allowPrivate) {
    try { return await runPageSpeed(url, key); } catch (error) {
      console.warn(`[lighthouse] PageSpeed Insights failed, running locally: ${(error as Error).message}`);
    }
  }
  return runLighthouse(url, opts);
}
