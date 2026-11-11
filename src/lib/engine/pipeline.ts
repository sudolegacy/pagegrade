import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { capturePage } from './capture/capture';
import { bounds, factsForPrompt, measure, type Loc } from './checks';
import { GOALS, type Intake } from './intake';
import { auditPerformance, type LighthouseResult } from './lighthouse';
import { assessAiReadiness, type AiReadiness } from './ai-readiness';
import { AI_CRITERIA, CATEGORIES, CRITERIA, CRITERIA_BY_ID, ENGINE_VERSION } from './rubric';
import { confidenceFor, scoreReview, type RatedCriterion, type ScoredCriterion, type Severity } from './score';
import { applyBounds, locateQuote, type Adjustment } from './validate';
import { evaluate, type Evaluation } from './ai/evaluate';
import { recommend, type Recommendations } from './ai/recommend';
import { addUsage, emptyUsage } from './ai/client';
import { FALLBACK_FIX } from './fixes';
import { profileSummary, reportFacts, type Report, type ReportIssue } from './report';
import type { CaptureResult, ProfileCapture } from './types';

export type EngineConfig = {
  evalModel: string;
  evalRuns: number;
  evalReasoning: 'minimal' | 'low' | 'medium' | 'high';
  writeModel: string | null;
  performance: boolean;
  executablePath?: string;
};

export function engineConfigFromEnv(): EngineConfig {
  return {
    evalModel: process.env.AI_MODEL_EVAL || 'gpt-6-luna',
    evalRuns: Math.max(1, Math.min(5, Number(process.env.AI_EVAL_RUNS || 3))),
    evalReasoning: (process.env.AI_EVAL_REASONING as EngineConfig['evalReasoning']) || 'low',
    writeModel: process.env.AI_MODEL_WRITE === 'none' ? null : process.env.AI_MODEL_WRITE || 'gpt-6.1-terra',
    performance: process.env.PERFORMANCE_AUDIT !== 'off',
    executablePath: process.env.CHROMIUM_PATH || undefined,
  };
}

/** A failure with a message that is safe and useful to show the user. Failed reviews are never charged. */
export class ReviewError extends Error {
  constructor(public readonly code: string, message: string, public readonly detail?: string) { super(message); }
}

export type Stage = 'capture-desktop' | 'capture-desktop-retry' | 'capture-mobile' | 'analyse' | 'write' | 'finalise';
export type CachedAnalysis = { evaluation: Evaluation; recommendations: Recommendations | null };
export type AnalysisCache = { get(key: string): Promise<CachedAnalysis | null>; set(key: string, value: CachedAnalysis): Promise<void> };

async function checkpoint<T>(dir: string, name: string, fn: () => Promise<T>, keep: (v: T) => boolean = () => true): Promise<T> {
  const file = path.join(dir, `${name}.json`);
  try { return JSON.parse(await readFile(file, 'utf8')) as T; } catch { /* not yet computed */ }
  const value = await fn();
  if (keep(value)) await writeFile(file, JSON.stringify(value));
  return value;
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 3, major: 2, minor: 1 };
const round1 = (n: number) => Math.round(n * 10) / 10;

function defaultLocation(id: string, d: ProfileCapture): Loc | undefined {
  const f = d.facts;
  const box = (() => {
    if (id.startsWith('clarity.') && id !== 'clarity.support') return f.hero.headline?.b;
    if (id === 'clarity.support') return f.hero.subheadline?.b ?? f.hero.headline?.b;
    if (id === 'cta.friction') return f.forms.find((x) => !x.isSearch)?.b ?? f.primaryCta?.b;
    if (id.startsWith('cta.')) return f.primaryCta?.b;
    if (id.startsWith('trust.') && id !== 'trust.legitimacy') return f.trust.testimonials[0]?.b;
    return undefined;
  })();
  return box ? { profile: 'desktop', box } : undefined;
}

export function cacheKey(contentHash: string, intake: Intake, config: EngineConfig) {
  return createHash('sha256').update(JSON.stringify([ENGINE_VERSION, contentHash, intake.pageType, intake.goal, intake.audience.trim().toLowerCase(), (intake.context || '').trim().toLowerCase(), config.evalModel, config.evalRuns, config.evalReasoning, config.writeModel])).digest('hex');
}

export async function runPipeline(opts: { url: string; intake: Intake; dir: string; config: EngineConfig; allowPrivate?: boolean; onStage?: (stage: Stage) => void; cache?: AnalysisCache }): Promise<Report> {
  const started = Date.now();
  const { intake, dir, config } = opts;
  const goal = GOALS[intake.goal];

  // 1. Capture (desktop + mobile)
  const capture = await checkpoint<CaptureResult>(dir, 'capture', () => capturePage(opts.url, {
    dir, goalPattern: goal.pattern, allowPrivate: opts.allowPrivate, executablePath: config.executablePath, onStage: (s) => opts.onStage?.(s as Stage),
  }), (c) => c.status === 'complete' || c.status === 'partial');
  if (capture.status === 'blocked') throw new ReviewError('blocked', capture.issues[0]?.message ?? 'The site blocked our browser.');
  if (capture.status === 'failed' || !capture.desktop) throw new ReviewError('capture-failed', capture.issues[0]?.message ?? 'The page could not be loaded.');
  const desktop = capture.desktop;
  const mobile = capture.mobile;

  // 2. AI evaluation and performance audit in parallel
  opts.onStage?.('analyse');
  const facts = factsForPrompt(desktop, mobile);
  const key = cacheKey(capture.contentHash, intake, config);
  const cached = await opts.cache?.get(key).catch(() => null) ?? null;
  const read = (f: string) => readFile(path.join(dir, f));
  const performanceTask: Promise<LighthouseResult | null> = config.performance
    ? checkpoint<LighthouseResult | null>(dir, 'performance', () => auditPerformance(capture.finalUrl, { executablePath: config.executablePath, allowPrivate: opts.allowPrivate }).catch((e) => {
      console.warn(`[pipeline] performance audit failed: ${(e as Error).message}`);
      return null;
    }), (v) => v !== null)
    : Promise.resolve(null);
  // AI search readiness (robots.txt and raw HTML): best effort, it never fails the review.
  const aiReadinessTask: Promise<AiReadiness | null> = checkpoint<AiReadiness | null>(dir, 'ai-readiness', () => assessAiReadiness({ url: capture.finalUrl, facts: desktop.facts, allowPrivate: opts.allowPrivate }).catch((e) => {
    console.warn(`[pipeline] AI readiness check failed: ${(e as Error).message}`);
    return null;
  }), (v) => v !== null);
  const evaluationTask: Promise<Evaluation> = cached
    ? Promise.resolve(cached.evaluation)
    : checkpoint<Evaluation>(dir, 'evaluation', async () => evaluate(intake, facts, {
      desktopHero: await read(desktop.files.hero),
      desktopTiles: await Promise.all(desktop.files.tiles.map(async (t) => ({ buffer: await read(t.file), yCss: t.y, hCss: t.h }))),
      mobileHero: mobile ? await read(mobile.files.hero) : null,
      mobileTiles: mobile ? await Promise.all(mobile.files.tiles.slice(0, 1).map(async (t) => ({ buffer: await read(t.file), yCss: t.y, hCss: t.h }))) : [],
      desktopSize: { width: desktop.viewport.width, height: desktop.viewport.height },
      mobileSize: mobile ? { width: mobile.viewport.width, height: mobile.viewport.height } : null,
    }, { model: config.evalModel, runs: config.evalRuns, reasoning: config.evalReasoning }));
  const [performance, evaluation] = await Promise.all([performanceTask, evaluationTask.catch((e: Error) => {
    throw new ReviewError('analysis-failed', 'Our analysis service is temporarily unavailable, so this review could not be completed. You have not been charged.', e.message);
  })]);

  // 3. Measured ratings + bounded, evidence-checked AI ratings
  const measured = measure(desktop, mobile, {
    goalLabel: goal.label, goalPattern: goal.pattern,
    cls: performance?.metrics.cls ?? null,
    lighthouse: performance ? { performance: performance.scores.performance, accessibility: performance.scores.accessibility, lcpMs: performance.metrics.lcpMs } : null,
  });
  const limits = bounds(desktop, mobile);
  const searchable = [{ profile: 'desktop' as const, blocks: desktop.facts.blocks }, ...(mobile ? [{ profile: 'mobile' as const, blocks: mobile.facts.blocks }] : [])];
  const rated: Record<string, RatedCriterion> = {};
  const adjustments: Adjustment[] = [];
  let quotes = 0, unverified = 0;
  for (const c of CRITERIA) {
    if (c.source === 'dom' || c.source === 'lighthouse') {
      const m = measured[c.id];
      rated[c.id] = { id: c.id, rating: m?.rating ?? null, evidence: m?.evidence ?? '', location: m?.location };
      continue;
    }
    const j = evaluation.criteria[c.id];
    if (!j) { rated[c.id] = { id: c.id, rating: null, evidence: 'Not evaluated.' }; continue; }
    let quote = j.quote.trim();
    let location: Loc | undefined;
    if (quote) {
      quotes++;
      const order = j.where === 'mobile' ? [...searchable].reverse() : searchable;
      const found = locateQuote(quote, order);
      if (found.verified) location = found.location;
      else { unverified++; quote = ''; }
    }
    const bounded = applyBounds(c.id, j.rating, limits[c.id]);
    if (bounded.adjustment) adjustments.push(bounded.adjustment);
    rated[c.id] = {
      id: c.id, rating: bounded.rating, evidence: j.evidence, quote: quote || undefined,
      location: location ?? defaultLocation(c.id, desktop),
      adjusted: bounded.adjustment ? { from: bounded.adjustment.from, reason: bounded.adjustment.reason } : undefined,
    };
  }
  const scored = scoreReview(rated, intake.pageType);

  // 4. Action plan
  opts.onStage?.('write');
  const opportunities = (performance?.opportunities ?? []).slice(0, 4).map((o) => `${o.title}${o.savingsMs ? ` (about ${(o.savingsMs / 1000).toFixed(1)}s)` : ''}`);
  let recommendations: Recommendations | null = cached?.recommendations ?? null;
  let writeUsage = emptyUsage();
  if (!recommendations && config.writeModel) {
    recommendations = await checkpoint<Recommendations | null>(dir, 'recommendations', async () => {
      try {
        const r = await recommend({ intake, page: evaluation.page, facts, criteria: scored.criteria, opportunities, model: config.writeModel! });
        writeUsage = r.usage;
        return r.data;
      } catch (e) {
        console.warn(`[pipeline] recommendations failed, using rubric advice: ${(e as Error).message}`);
        return null;
      }
    }, (v) => v !== null);
  }
  if (!cached && opts.cache && recommendations) await opts.cache.set(key, { evaluation, recommendations }).catch(() => undefined);

  // 5. Assemble
  opts.onStage?.('finalise');
  const byId = new Map(scored.criteria.map((c) => [c.id, c]));
  const issueFrom = (ids: string[], base: Omit<ReportIssue, 'id' | 'severity' | 'impact' | 'potentialGain' | 'criteria' | 'location'>): ReportIssue | null => {
    const linked = ids.map((id) => byId.get(id)).filter((c): c is ScoredCriterion => !!c && c.severity != null);
    if (!linked.length) return null;
    const severity = linked.reduce<Severity>((s, c) => (SEVERITY_RANK[c.severity!] > SEVERITY_RANK[s] ? c.severity! : s), 'minor');
    const gain = round1(linked.reduce((s, c) => s + c.pointsLost, 0));
    return { ...base, id: '', criteria: linked.map((c) => c.id), severity, impact: gain >= 4 ? 'high' : gain >= 1.8 ? 'medium' : 'low', potentialGain: gain, location: linked.find((c) => c.location)?.location };
  };
  const issues: ReportIssue[] = [];
  for (const i of recommendations?.issues ?? []) {
    const issue = issueFrom(i.criteria, { title: i.title, problem: i.problem, recommendation: i.recommendation, example: i.example, effort: i.effort, source: 'ai' });
    if (issue) issues.push(issue);
  }
  const covered = new Set(issues.flatMap((i) => i.criteria));
  for (const c of [...scored.criteria].sort((a, b) => b.pointsLost - a.pointsLost)) {
    if (!c.severity || covered.has(c.id)) continue;
    if (recommendations && c.severity === 'minor') continue; // minor findings stay in the criteria breakdown
    if (!recommendations && issues.length >= 10) break;
    const fb = FALLBACK_FIX[c.id];
    const issue = issueFrom([c.id], { title: fb?.title ?? c.label, problem: c.evidence, recommendation: fb?.fix ?? '', example: '', effort: 'medium', source: 'rubric' });
    if (issue) { issues.push(issue); covered.add(c.id); }
  }
  issues.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.potentialGain - a.potentialGain);
  issues.forEach((i, n) => { i.id = `issue-${n + 1}`; });

  const strengths = recommendations?.strengths.length
    ? recommendations.strengths
    : scored.criteria.filter((c) => c.rating === 4).sort((a, b) => b.maxPoints - a.maxPoints).slice(0, 4).map((c) => ({ criterion: c.id, title: c.label, detail: c.evidence }));
  const top = issues[0];
  const verdict = recommendations?.verdict ?? (top ? `Scores ${scored.score}/100: the biggest opportunity is to ${top.title.charAt(0).toLowerCase()}${top.title.slice(1)}.` : `Scores ${scored.score}/100 with no significant issues found.`);
  const summary = recommendations?.summary ?? evaluation.page.fiveSecond;
  const confidence = confidenceFor({ completeness: capture.completeness, agreement: evaluation.agreement, runs: evaluation.runs, unverified, quotes, adjustments: adjustments.length, performanceMeasured: !!performance, mismatch: evaluation.page.mismatch });

  return {
    engineVersion: ENGINE_VERSION,
    createdAt: new Date().toISOString(),
    url: opts.url,
    finalUrl: capture.finalUrl,
    intake,
    score: scored.score,
    rawScore: scored.rawScore,
    grade: scored.grade,
    verdict,
    summary,
    page: evaluation.page,
    confidence,
    categories: scored.categories.map((c) => ({ ...c, blurb: CATEGORIES[c.id].blurb })),
    criteria: scored.criteria.map((c) => ({ ...c, question: CRITERIA_BY_ID[c.id].question, why: CRITERIA_BY_ID[c.id].why })),
    caps: scored.caps,
    issues,
    strengths,
    rewrites: recommendations?.rewrites ?? null,
    performance,
    aiReadiness: await aiReadinessTask,
    capture: { status: capture.status, completeness: capture.completeness, issues: capture.issues, durationMs: capture.durationMs, desktop: profileSummary(desktop), mobile: profileSummary(mobile) },
    facts: reportFacts(desktop, mobile),
    meta: {
      models: { evaluate: evaluation.model, write: recommendations ? config.writeModel : null },
      evaluationRuns: evaluation.runs,
      agreement: Math.round(evaluation.agreement * 100) / 100,
      adjustments,
      usage: cached ? emptyUsage() : addUsage(evaluation.usage, writeUsage),
      durationMs: Date.now() - started,
      cached: !!cached,
      recommendationsSource: recommendations ? 'ai' : 'rubric',
    },
  };
}

export { AI_CRITERIA };
