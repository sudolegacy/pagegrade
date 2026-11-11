import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { env } from './env';

import { HttpError } from './errors';

export { HttpError };

export const json = (data: unknown, init?: number | ResponseInit) => NextResponse.json(data, typeof init === 'number' ? { status: init } : init);

/** Wraps a route handler with consistent error responses. Unexpected errors are logged, never leaked. */
export function handler<C>(fn: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      return await fn(req, ctx);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message, code: error.code, ...error.extra }, error.status);
      if (error instanceof ZodError) return json({ error: error.issues[0]?.message ?? 'Invalid input.', code: 'invalid', field: error.issues[0]?.path.join('.') }, 400);
      console.error('[api]', req.method, req.nextUrl.pathname, error);
      return json({ error: 'Something went wrong on our side. Please try again.', code: 'server_error' }, 500);
    }
  };
}

/**
 * CSRF defence for state-changing requests: browsers always send Origin on
 * cross-site POSTs, so requiring it to match our own origin blocks forged requests
 * (session cookies are also SameSite=Lax).
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowed = new Set([new URL(env.appUrl).origin, req.nextUrl.origin]);
  if (!origin || !allowed.has(origin)) throw new HttpError(403, 'This request was blocked for security reasons. Refresh the page and try again.', 'bad_origin');
}

/**
 * The visitor's IP for rate limiting. Each proxy appends the address it saw to
 * X-Forwarded-For, so only the rightmost TRUST_PROXY_HOPS entries come from our
 * own infrastructure; anything to their left is client-controlled and spoofable.
 * Railway (and Next.js locally) add one hop, which is the default.
 */
export function clientIp(req: NextRequest) {
  const hops = Math.max(0, Math.floor(Number(process.env.TRUST_PROXY_HOPS ?? 1)) || 0);
  const chain = (req.headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (hops > 0 && chain.length) return chain[Math.max(0, chain.length - hops)];
  return req.headers.get('x-real-ip')?.trim() || 'local';
}

export async function readJson<T = unknown>(req: NextRequest): Promise<T> {
  const text = await req.text();
  if (text.length > 64_000) throw new HttpError(413, 'Request too large.', 'too_large');
  try { return JSON.parse(text || '{}') as T; } catch { throw new HttpError(400, 'Invalid request body.', 'invalid_json'); }
}
