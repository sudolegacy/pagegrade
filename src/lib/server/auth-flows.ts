import { z } from 'zod';
import { env } from './env';
import { HttpError } from './errors';
import { mailer } from './mail';
import { createToken } from './users';
import { rateLimit } from './ratelimit';
import type { User } from './users';

export const emailSchema = z.string().trim().toLowerCase().max(254).email('Enter a valid email address.');

export function limitOrThrow(key: string, limit: number, windowMs: number, message = 'Too many attempts. Please wait a few minutes and try again.') {
  const r = rateLimit(key, limit, windowMs);
  if (!r.ok) throw new HttpError(429, message, 'rate_limited', { retryAfter: r.retryAfterSec });
}

export async function sendVerification(user: Pick<User, 'id' | 'email'>) {
  const token = createToken(user.id, 'verify', 24 * 3600 * 1000);
  await mailer.verify(user.email, `${env.appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`);
}

export async function sendReset(user: Pick<User, 'id' | 'email'>) {
  const token = createToken(user.id, 'reset', 3600 * 1000);
  await mailer.reset(user.email, `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`);
}

/** Only same-site relative paths are accepted as post-login destinations. */
export function safeNext(next: string | null | undefined, fallback = '/app'): string {
  if (!next || typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\r\n]/.test(next)) return fallback;
  return next.slice(0, 300);
}
