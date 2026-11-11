import type { Intake } from './intake';
import type { CaptureIssue, CaptureResult, ProfileCapture } from './types';
import type { CategoryScore, Confidence, ScoredCriterion, Severity } from './score';
import type { LighthouseResult } from './lighthouse';
import type { AiReadiness } from './ai-readiness';
import type { PageRead } from './ai/evaluate';
import type { Usage } from './ai/client';
import type { Adjustment } from './validate';
import type { Loc } from './checks';
import { proofSignals } from './checks';
import type { gradeFor } from './rubric';

export type ReportIssue = {
  id: string;
  title: string;
  problem: string;
  recommendation: string;
  example: string;
  criteria: string[];
  severity: Severity;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  /** Upper bound on points recovered if every linked criterion reached 4/4. */
  potentialGain: number;
  location?: Loc;
  source: 'ai' | 'rubric';
};

export type ProfileSummary = {
  viewport: { width: number; height: number; dpr: number };
  docHeight: number;
  capturedHeight: number;
  files: { hero: string; full: string; first: string };
};

export type ReportFacts = {
  title: string;
  headline: string | null;
  subheadline: string | null;
  primaryCta: string | null;
  ctaCount: number;
  words: number;
  readingEase: number | null;
  testimonials: number;
  logos: number;
  proofTypes: number;
  forms: { fields: number; required: number }[];
  pricing: boolean;
  faq: boolean;
  mobileHeadline: string | null;
  mobileCta: string | null;
};

export type Report = {
  engineVersion: string;
  createdAt: string;
  url: string;
  finalUrl: string;
  intake: Intake;
  score: number;
  rawScore: number;
  grade: ReturnType<typeof gradeFor>;
  verdict: string;
  summary: string;
  page: PageRead;
  confidence: Confidence;
  categories: (CategoryScore & { blurb: string })[];
  criteria: (ScoredCriterion & { question: string; why: string })[];
  caps: { id: string; label: string; max: number; applied: boolean }[];
  issues: ReportIssue[];
  strengths: { criterion: string; title: string; detail: string }[];
  rewrites: { headlines: string[]; subheadline: string; ctas: string[] } | null;
  performance: LighthouseResult | null;
  /** Added in 2.1; older reports do not have it. */
  aiReadiness?: AiReadiness | null;
  capture: {
    status: CaptureResult['status'];
    completeness: number;
    issues: CaptureIssue[];
    durationMs: number;
    desktop: ProfileSummary | null;
    mobile: ProfileSummary | null;
  };
  facts: ReportFacts;
  meta: {
    models: { evaluate: string; write: string | null };
    evaluationRuns: number;
    agreement: number;
    adjustments: Adjustment[];
    usage: Usage;
    durationMs: number;
    cached: boolean;
    recommendationsSource: 'ai' | 'rubric';
  };
};

export function profileSummary(p: ProfileCapture | null): ProfileSummary | null {
  if (!p) return null;
  return { viewport: p.viewport, docHeight: p.facts.doc.height, capturedHeight: p.capturedHeight, files: { hero: p.files.hero, full: p.files.full, first: p.files.firstImpression } };
}

export function reportFacts(desktop: ProfileCapture, mobile: ProfileCapture | null): ReportFacts {
  const f = desktop.facts;
  return {
    title: f.title,
    headline: f.hero.headline?.text ?? null,
    subheadline: f.hero.subheadline?.text ?? null,
    primaryCta: f.primaryCta?.text ?? null,
    ctaCount: f.buttonCtaCount,
    words: f.content.words,
    readingEase: f.content.flesch,
    testimonials: f.trust.testimonials.length,
    logos: f.trust.logos.count,
    proofTypes: proofSignals(f).types,
    forms: f.forms.filter((x) => !x.isSearch).map((x) => ({ fields: x.fields, required: x.required })),
    pricing: f.pricing.present,
    faq: f.faq.present,
    mobileHeadline: mobile?.facts.hero.headline?.text ?? null,
    mobileCta: mobile?.facts.primaryCta?.text ?? null,
  };
}
