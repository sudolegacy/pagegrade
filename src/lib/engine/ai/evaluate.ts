import { z } from 'zod';
import { AI_CRITERIA, CRITERIA_BY_ID } from '../rubric';
import { GOALS, PAGE_TYPES, type Intake } from '../intake';
import { addUsage, emptyUsage, imagePart, structuredCall, type Part, type Usage } from './client';

export const WHERE = ['first-screen', 'upper', 'middle', 'lower', 'whole-page', 'mobile', 'not-present'] as const;
export type Where = (typeof WHERE)[number];

export type CriterionJudgement = { evidence: string; quote: string; where: Where; rating: number };
export type PageRead = { offer: string; audience: string; primaryAction: string; fiveSecond: string; mismatch: string };
export type EvalRun = { page: PageRead; criteria: Record<string, CriterionJudgement> };
export type Evaluation = {
  page: PageRead;
  criteria: Record<string, CriterionJudgement & { runs: number[]; spread: number }>;
  runs: number;
  agreement: number; // share of criteria whose ratings differ by at most 1 across runs
  model: string;
  usage: Usage;
};

const judgementSchema = {
  type: 'object', additionalProperties: false, required: ['evidence', 'quote', 'where', 'rating'],
  properties: {
    evidence: { type: 'string', description: 'What you observed and where, 1-2 sentences, max 45 words. For absences, state what is missing.' },
    quote: { type: 'string', description: 'Exact text copied from the page supporting the rating (max 140 characters), or empty string.' },
    where: { type: 'string', enum: [...WHERE] },
    rating: { type: 'integer', enum: [0, 1, 2, 3, 4] },
  },
};

export const EVAL_JSON_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['page', 'criteria'],
  properties: {
    page: {
      type: 'object', additionalProperties: false, required: ['offer', 'audience', 'primaryAction', 'fiveSecond', 'mismatch'],
      properties: {
        offer: { type: 'string', description: 'What is offered, in plain words (max 25 words). Write "Unclear" if a first-time visitor could not tell.' },
        audience: { type: 'string', description: 'Who the page appears to target (max 15 words), or "Unclear".' },
        primaryAction: { type: 'string', description: 'The main action the page asks visitors to take (max 12 words), or "None".' },
        fiveSecond: { type: 'string', description: 'What a first-time visitor would take away from the first screen in five seconds (max 35 words).' },
        mismatch: { type: 'string', description: 'How the page conflicts with the stated goal or audience (max 30 words), or empty string if it matches.' },
      },
    },
    criteria: {
      type: 'object', additionalProperties: false, required: AI_CRITERIA.map((c) => c.id),
      properties: Object.fromEntries(AI_CRITERIA.map((c) => [c.id, { ...judgementSchema, description: c.label }])),
    },
  },
};

const judgementValidator = z.object({ evidence: z.string(), quote: z.string(), where: z.enum(WHERE), rating: z.number().int().min(0).max(4) });
const evalValidator = z.object({
  page: z.object({ offer: z.string(), audience: z.string(), primaryAction: z.string(), fiveSecond: z.string(), mismatch: z.string() }),
  criteria: z.object(Object.fromEntries(AI_CRITERIA.map((c) => [c.id, judgementValidator]))),
});

export const EVAL_SYSTEM = `You are PageGrade's landing page evaluator: a senior conversion rate optimisation (CRO) specialist who audits pages against a fixed rubric. Your ratings feed a deterministic score, so they must be calibrated, consistent and evidence-based: the same page must always receive the same ratings.

How to rate:
- Judge only what is visible in the screenshots and stated in the measured page facts. The measured facts come from the rendered page and are accurate; if a screenshot and a fact seem to disagree, trust the fact for presence/absence and the screenshot for visual quality.
- For each criterion, first write the evidence (what you saw and where), then choose the rating whose anchor best matches. When torn between two ratings, choose the lower one unless the evidence clearly satisfies the higher anchor.
- Use the whole scale. 4 is genuinely best-practice, 2 is typical/mediocre, 0 means absent or broken. Do not inflate ratings for famous brands, long pages or flashy visuals; judge clarity, specificity and evidence as a first-time visitor from the target audience would.
- Rate the page for the stated goal and audience. If the page targets something different, judge it as it is and explain the conflict in "mismatch".
- A headline and its supporting subheadline are sometimes styled inside one element (for example a dark first sentence followed by lighter text). Treat the visually distinct supporting sentence as the subheadline.
- "quote" must be copied exactly from text on the page (headline, button, testimonial, etc.) when it supports the rating; use an empty string for absences or purely visual judgements. Never paraphrase inside "quote".
- Be concise and concrete. Write in British English.`;

function rubricText() {
  return AI_CRITERIA.map((c) => [
    `### ${c.id} — ${c.label}`,
    c.question,
    ...(c.anchors ?? []).map((a, i) => `${i}: ${a}`),
  ].join('\n')).join('\n\n');
}

export type EvalImages = {
  desktopHero: Buffer;
  desktopTiles: { buffer: Buffer; yCss: number; hCss: number }[];
  mobileHero?: Buffer | null;
  mobileTiles?: { buffer: Buffer; yCss: number; hCss: number }[];
  desktopSize: { width: number; height: number };
  mobileSize?: { width: number; height: number } | null;
};

export function buildEvalMessage(intake: Intake, facts: string, images: EvalImages): Part[] {
  const parts: Part[] = [];
  const lines: string[] = [];
  let n = 1;
  lines.push(`Image ${n++}: desktop first screen (${images.desktopSize.width}×${images.desktopSize.height} CSS px) after pop-ups were dismissed.`);
  const firstTile = n;
  n += images.desktopTiles.length;
  if (images.desktopTiles.length) lines.push(`Images ${firstTile}–${n - 1}: the full desktop page, top to bottom (${images.desktopTiles.map((t, i) => `image ${firstTile + i} covers y=${t.yCss}–${t.yCss + t.hCss}px`).join('; ')}).`);
  if (images.mobileHero) lines.push(`Image ${n++}: mobile first screen (${images.mobileSize?.width ?? 390}×${images.mobileSize?.height ?? 844} CSS px).`);
  for (const t of images.mobileTiles ?? []) lines.push(`Image ${n++}: mobile page y=${t.yCss}–${t.yCss + t.hCss}px.`);

  parts.push({
    type: 'text',
    text: [
      '## Intake (provided by the page owner)',
      `Page type: ${PAGE_TYPES[intake.pageType]}`,
      `Primary conversion goal: ${GOALS[intake.goal].label}`,
      `Target audience: ${intake.audience}`,
      `Extra context: ${intake.context?.trim() || 'none'}`,
      '',
      '## Measured page facts',
      facts,
      '',
      '## Screenshots',
      ...lines,
      '',
      '## Rubric — rate every criterion 0–4',
      rubricText(),
    ].join('\n'),
  });
  parts.push(imagePart(images.desktopHero, 'high'));
  for (const t of images.desktopTiles) parts.push(imagePart(t.buffer, 'high'));
  if (images.mobileHero) parts.push(imagePart(images.mobileHero, 'high'));
  for (const t of images.mobileTiles ?? []) parts.push(imagePart(t.buffer, 'high'));
  return parts;
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]; };

/** Runs the evaluator several times in parallel and aggregates by per-criterion median (lower median for even counts). */
export async function evaluate(intake: Intake, facts: string, images: EvalImages, opts: { model: string; runs: number; reasoning?: 'minimal' | 'low' | 'medium' | 'high' }): Promise<Evaluation> {
  const message = buildEvalMessage(intake, facts, images);
  const settled = await Promise.allSettled(Array.from({ length: opts.runs }, () => structuredCall<EvalRun>({
    model: opts.model, system: EVAL_SYSTEM, user: message, schemaName: 'landing_page_evaluation', jsonSchema: EVAL_JSON_SCHEMA,
    validator: evalValidator as unknown as z.ZodType<EvalRun>, reasoning: opts.reasoning ?? 'low', timeoutMs: 150_000, maxOutputTokens: 16_000,
  })));
  const ok = settled.filter((s): s is PromiseFulfilledResult<{ data: EvalRun; usage: Usage }> => s.status === 'fulfilled').map((s) => s.value);
  if (!ok.length) {
    const reason = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected')?.reason;
    throw new Error(`AI evaluation failed: ${reason instanceof Error ? reason.message : String(reason)}`);
  }
  const usage = ok.reduce((u, r) => addUsage(u, r.usage), emptyUsage());
  const criteria: Evaluation['criteria'] = {};
  let agreeing = 0;
  for (const c of AI_CRITERIA) {
    const ratings = ok.map((r) => r.data.criteria[c.id].rating);
    const med = median(ratings);
    const pick = ok.find((r) => r.data.criteria[c.id].rating === med)!.data.criteria[c.id];
    const spread = Math.max(...ratings) - Math.min(...ratings);
    if (spread <= 1) agreeing++;
    criteria[c.id] = { ...pick, rating: med, runs: ratings, spread };
  }
  // Page read: take it from the run closest to the consensus.
  const distance = (r: EvalRun) => AI_CRITERIA.reduce((d, c) => d + Math.abs(r.criteria[c.id].rating - criteria[c.id].rating), 0);
  const central = [...ok].sort((a, b) => distance(a.data) - distance(b.data))[0].data;
  return { page: central.page, criteria, runs: ok.length, agreement: agreeing / AI_CRITERIA.length, model: opts.model, usage };
}

export { CRITERIA_BY_ID };
