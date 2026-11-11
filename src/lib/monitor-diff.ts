import type { Report } from './engine/report';

/**
 * Compares two reviews of the same page (last week's and this week's) and
 * lists what changed. "own" pages alert on drops and slowdowns; "competitor"
 * pages alert when they change their offer or improve.
 */
export type MonitorKind = 'own' | 'competitor';
export type MonitorChangeType = 'score_drop' | 'score_rise' | 'slower' | 'faster' | 'headline' | 'subheadline' | 'cta' | 'pricing' | 'proof' | 'new_cap' | 'offline';
export type MonitorChange = { type: MonitorChangeType; severity: 'alert' | 'info'; title: string; detail: string };

export const SCORE_ALERT_POINTS = 5;

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const clip = (s: string | null | undefined, n = 90) => { const v = (s ?? '').replace(/\s+/g, ' ').trim(); return v ? (v.length > n ? `${v.slice(0, n - 1)}…` : v) : '(none)'; };
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const perfScore = (r: Report) => { const s = r.performance?.scores.performance; return typeof s === 'number' ? (s <= 1 ? Math.round(s * 100) : s) : null; };

export function compareReports(prev: Report, next: Report, kind: MonitorKind = 'own'): MonitorChange[] {
  const own = kind === 'own';
  const out: MonitorChange[] = [];

  const delta = next.score - prev.score;
  if (delta <= -SCORE_ALERT_POINTS) {
    const top = next.issues[0]?.title;
    out.push({ type: 'score_drop', severity: own ? 'alert' : 'info', title: `Score dropped ${-delta} points`, detail: `${prev.score} → ${next.score}.${top ? ` Biggest issue now: ${top}.` : ''}` });
  } else if (delta >= SCORE_ALERT_POINTS) {
    out.push({ type: 'score_rise', severity: own ? 'info' : 'alert', title: `Score rose ${delta} points`, detail: `${prev.score} → ${next.score}.${own ? '' : ' They have improved their page.'}` });
  }

  const lcpA = prev.performance?.metrics.lcpMs ?? null;
  const lcpB = next.performance?.metrics.lcpMs ?? null;
  if (typeof lcpA === 'number' && typeof lcpB === 'number') {
    if (lcpB - lcpA >= 1000 && lcpB > 2500) out.push({ type: 'slower', severity: own ? 'alert' : 'info', title: 'The page got slower', detail: `The main content now takes ${secs(lcpB)} to appear (it was ${secs(lcpA)}).` });
    else if (lcpA - lcpB >= 1000) out.push({ type: 'faster', severity: 'info', title: 'The page got faster', detail: `The main content now takes ${secs(lcpB)} to appear (it was ${secs(lcpA)}).` });
  } else {
    const pa = perfScore(prev), pb = perfScore(next);
    if (pa !== null && pb !== null && pa - pb >= 15) out.push({ type: 'slower', severity: own ? 'alert' : 'info', title: 'The page got slower', detail: `Speed score ${pa} → ${pb}.` });
  }

  const a = prev.facts, b = next.facts;
  const changed = (x: string | null, y: string | null) => norm(x) !== norm(y) && !!(norm(x) || norm(y));
  if (changed(a.headline, b.headline)) out.push({ type: 'headline', severity: own ? 'info' : 'alert', title: 'Headline changed', detail: `"${clip(a.headline)}" → "${clip(b.headline)}"` });
  if (changed(a.subheadline, b.subheadline)) out.push({ type: 'subheadline', severity: 'info', title: 'Subheadline changed', detail: `"${clip(a.subheadline)}" → "${clip(b.subheadline)}"` });
  if (changed(a.primaryCta, b.primaryCta)) out.push({ type: 'cta', severity: own ? 'info' : 'alert', title: 'Main button changed', detail: `"${clip(a.primaryCta, 40)}" → "${clip(b.primaryCta, 40)}"` });
  if (!!a.pricing !== !!b.pricing) out.push({ type: 'pricing', severity: own ? 'info' : 'alert', title: b.pricing ? 'Prices now shown' : 'Prices removed', detail: b.pricing ? 'The page now shows prices.' : 'The page no longer shows prices.' });
  const proofA = a.testimonials + a.logos, proofB = b.testimonials + b.logos;
  if (Math.abs(proofB - proofA) >= 2) out.push({ type: 'proof', severity: 'info', title: proofB > proofA ? 'More social proof' : 'Less social proof', detail: `Testimonials and logos: ${proofA} → ${proofB}.` });

  const before = new Set(prev.caps.filter((c) => c.applied).map((c) => c.id));
  for (const cap of next.caps.filter((c) => c.applied && !before.has(c.id))) {
    out.push({ type: 'new_cap', severity: own ? 'alert' : 'info', title: 'New problem limiting the score', detail: `${cap.label} (the score is capped at ${cap.max}).` });
  }

  return out.sort((x, y) => (x.severity === y.severity ? 0 : x.severity === 'alert' ? -1 : 1));
}

export const hasAlert = (changes: MonitorChange[]) => changes.some((c) => c.severity === 'alert');
