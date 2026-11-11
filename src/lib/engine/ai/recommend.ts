import { z } from 'zod';
import { CRITERIA_BY_ID } from '../rubric';
import { GOALS, PAGE_TYPES, type Intake } from '../intake';
import type { ScoredCriterion } from '../score';
import type { PageRead } from './evaluate';
import { structuredCall, type Usage } from './client';

export type RecIssue = { criteria: string[]; title: string; problem: string; recommendation: string; example: string; effort: 'low' | 'medium' | 'high' };
export type Recommendations = {
  verdict: string;
  summary: string;
  issues: RecIssue[];
  strengths: { criterion: string; title: string; detail: string }[];
  rewrites: { headlines: string[]; subheadline: string; ctas: string[] };
};

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['verdict', 'summary', 'issues', 'strengths', 'rewrites'],
  properties: {
    verdict: { type: 'string', description: 'One plain-English sentence (max 22 words) summing up the page.' },
    summary: { type: 'string', description: '2-3 sentences: what works, the biggest problem and the single most valuable change.' },
    issues: {
      type: 'array', description: 'Prioritised fixes, most valuable first. Group findings that share one fix.',
      items: {
        type: 'object', additionalProperties: false, required: ['criteria', 'title', 'problem', 'recommendation', 'example', 'effort'],
        properties: {
          criteria: { type: 'array', items: { type: 'string' }, description: 'IDs of the findings this fix addresses (from the list provided).' },
          title: { type: 'string', description: 'Imperative, max 10 words, e.g. "Name the product in the headline".' },
          problem: { type: 'string', description: 'What is wrong on this page and why it costs conversions, citing the evidence (max 45 words).' },
          recommendation: { type: 'string', description: 'Exactly what to change, specific to this page (max 70 words).' },
          example: { type: 'string', description: 'A concrete example such as rewritten copy, or empty string.' },
          effort: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    strengths: {
      type: 'array', description: 'Up to 4 things the page does well (from the strengths provided).',
      items: { type: 'object', additionalProperties: false, required: ['criterion', 'title', 'detail'], properties: { criterion: { type: 'string' }, title: { type: 'string' }, detail: { type: 'string', description: 'max 30 words' } } },
    },
    rewrites: {
      type: 'object', additionalProperties: false, required: ['headlines', 'subheadline', 'ctas'],
      properties: {
        headlines: { type: 'array', items: { type: 'string' }, description: 'Exactly 3 alternative headlines.' },
        subheadline: { type: 'string', description: 'One improved subheadline.' },
        ctas: { type: 'array', items: { type: 'string' }, description: 'Exactly 3 alternative primary button labels.' },
      },
    },
  },
};

const validator = z.object({
  verdict: z.string().min(1),
  summary: z.string().min(1),
  issues: z.array(z.object({ criteria: z.array(z.string()), title: z.string(), problem: z.string(), recommendation: z.string(), example: z.string(), effort: z.enum(['low', 'medium', 'high']) })),
  strengths: z.array(z.object({ criterion: z.string(), title: z.string(), detail: z.string() })),
  rewrites: z.object({ headlines: z.array(z.string()), subheadline: z.string(), ctas: z.array(z.string()) }),
});

const SYSTEM = `You are a senior conversion rate optimisation consultant writing the action plan of a landing page audit. You receive the audit's verified findings. Turn them into specific, prioritised fixes a founder or marketer could implement this week.

Rules:
- Base every point on the findings and facts provided. Refer to this page's actual words and elements; never give generic advice that could apply to any page.
- Never invent facts about the business (customer numbers, results, awards, prices, features). When suggested copy needs a fact you do not have, use a short bracketed placeholder such as [number of customers] or [main result].
- Order issues by expected conversion impact: critical findings first, then major, then minor. Group findings that share one fix into a single issue; do not repeat the same advice twice. Include every critical and major finding in some issue.
- Recommendations must be concrete (what to change, where, and to what), not "consider improving".
- Rewrites must fit the stated audience and goal, stay truthful to the page's offer, and be written in the same language as the page. Headlines under 12 words; button labels under 6 words.
- Plain British English for everything except the rewrites. No hype, no emojis, no markdown.`;

export async function recommend(input: {
  intake: Intake; page: PageRead; facts: string; criteria: ScoredCriterion[]; opportunities: string[]; model: string;
}): Promise<{ data: Recommendations; usage: Usage }> {
  const findings = input.criteria
    .filter((c) => c.severity && c.rating != null)
    .sort((a, b) => b.pointsLost - a.pointsLost)
    .map((c) => `- [${c.severity}] ${c.id} — ${c.label} (rated ${c.rating}/4, costs ${c.pointsLost} points): ${c.evidence}${c.quote ? ` Quote: “${c.quote}”` : ''}${c.adjusted ? ` (Measured: ${c.adjusted.reason}.)` : ''}`);
  const strengths = input.criteria
    .filter((c) => c.rating === 4 || (c.rating === 3 && c.maxPoints >= 3))
    .sort((a, b) => b.maxPoints - a.maxPoints)
    .slice(0, 8)
    .map((c) => `- ${c.id} — ${c.label} (rated ${c.rating}/4): ${c.evidence}`);
  const text = [
    '## Intake',
    `Page type: ${PAGE_TYPES[input.intake.pageType]}`,
    `Primary goal: ${GOALS[input.intake.goal].label}`,
    `Target audience: ${input.intake.audience}`,
    `Extra context: ${input.intake.context?.trim() || 'none'}`,
    '',
    '## How the page reads to a first-time visitor',
    `Offer: ${input.page.offer}`,
    `Apparent audience: ${input.page.audience}`,
    `Main action: ${input.page.primaryAction}`,
    `Five-second takeaway: ${input.page.fiveSecond}`,
    input.page.mismatch ? `Mismatch with intake: ${input.page.mismatch}` : 'Mismatch with intake: none',
    '',
    '## Measured page facts',
    input.facts,
    '',
    '## Findings to fix (most costly first)',
    findings.join('\n') || '- none',
    '',
    '## Strengths',
    strengths.join('\n') || '- none',
    input.opportunities.length ? `\n## Speed opportunities (Lighthouse)\n${input.opportunities.map((o) => `- ${o}`).join('\n')}` : '',
    '',
    'Return at most 8 issues, at most 4 strengths, exactly 3 headlines and exactly 3 button labels.',
  ].join('\n');
  const result = await structuredCall<Recommendations>({
    model: input.model, system: SYSTEM, user: [{ type: 'text', text }], schemaName: 'audit_action_plan', jsonSchema: SCHEMA,
    validator: validator as unknown as z.ZodType<Recommendations>, reasoning: 'medium', timeoutMs: 150_000, maxOutputTokens: 16_000,
  });
  const known = new Set(input.criteria.map((c) => c.id));
  const data = result.data;
  data.issues = data.issues
    .map((i) => ({ ...i, criteria: Array.from(new Set(i.criteria.filter((id) => known.has(id)))) }))
    .filter((i) => i.criteria.length && i.title.trim())
    .slice(0, 8);
  data.strengths = data.strengths.filter((s) => CRITERIA_BY_ID[s.criterion]).slice(0, 4);
  data.rewrites.headlines = data.rewrites.headlines.filter(Boolean).slice(0, 3);
  data.rewrites.ctas = data.rewrites.ctas.filter(Boolean).slice(0, 3);
  return { data, usage: result.usage };
}
