import OpenAI from 'openai';
import type { z } from 'zod';

/** USD per 1M tokens (input, output). Used for cost tracking only. */
const PRICES: Record<string, [number, number]> = {
  'gpt-6-luna': [0.1, 0.5],
  'gpt-5.6-luna': [0.2, 1.2],
  'gpt-6.1-terra': [1, 5],
  'gpt-6.1-sol': [2, 10],
  'gpt-5.6-sol': [4, 20],
  'gpt-5.4-mini': [0.75, 4.5],
};

export type Usage = { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
export const emptyUsage = (): Usage => ({ calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
export function addUsage(a: Usage, b: Usage): Usage {
  return { calls: a.calls + b.calls, inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens, costUsd: Math.round((a.costUsd + b.costUsd) * 1e6) / 1e6 };
}

let client: OpenAI | null = null;
function getClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
  return client;
}

export type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'low' | 'high' | 'auto' } };
export const imagePart = (jpeg: Buffer, detail: 'low' | 'high' | 'auto' = 'high'): Part => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpeg.toString('base64')}`, detail } });

export class AiError extends Error {
  constructor(message: string, public readonly retryable: boolean) { super(message); }
}

/**
 * One structured-output call with timeout, bounded retries on transient errors
 * and schema validation. Reasoning models here only accept the default
 * temperature, so consistency comes from the rubric, anchors and multi-run
 * aggregation rather than sampling settings.
 */
export async function structuredCall<T>(opts: {
  model: string; system: string; user: Part[]; schemaName: string; jsonSchema: Record<string, unknown>; validator: z.ZodType<T>;
  reasoning?: 'minimal' | 'low' | 'medium' | 'high'; timeoutMs?: number; maxOutputTokens?: number; retries?: number;
}): Promise<{ data: T; usage: Usage }> {
  const retries = opts.retries ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model: opts.model,
        messages: [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }],
        response_format: { type: 'json_schema', json_schema: { name: opts.schemaName, strict: true, schema: opts.jsonSchema } },
        ...(opts.reasoning ? { reasoning_effort: opts.reasoning } : {}),
        ...(opts.maxOutputTokens ? { max_completion_tokens: opts.maxOutputTokens } : {}),
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, { timeout: opts.timeoutMs ?? 120_000 });
      const choice = response.choices[0];
      const [inP, outP] = PRICES[opts.model] ?? [0, 0];
      const usage: Usage = {
        calls: 1,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        costUsd: ((response.usage?.prompt_tokens ?? 0) * inP + (response.usage?.completion_tokens ?? 0) * outP) / 1e6,
      };
      if (choice?.message?.refusal) throw new AiError(`Model refused: ${choice.message.refusal.slice(0, 200)}`, false);
      if (choice?.finish_reason === 'length') throw new AiError('Model output was cut off', true);
      const text = choice?.message?.content ?? '';
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { throw new AiError('Model returned invalid JSON', true); }
      const result = opts.validator.safeParse(parsed);
      if (!result.success) throw new AiError(`Model output failed validation: ${result.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`, true);
      return { data: result.data, usage };
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number }).status;
      const retryable = error instanceof AiError ? error.retryable : status === undefined || status === 408 || status === 409 || status === 429 || status >= 500;
      if (!retryable || attempt === retries) break;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt + Math.random() * 500));
    }
  }
  if (lastError instanceof AiError) throw lastError;
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new AiError(message.slice(0, 300), false);
}
