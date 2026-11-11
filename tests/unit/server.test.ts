import { describe, expect, it } from 'vitest';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/server/password';
import { safeNext } from '@/lib/server/auth-flows';
import { rateLimit } from '@/lib/server/ratelimit';
import { clientIp } from '@/lib/server/http';
import { createUser, updateUser, findUserById } from '@/lib/server/users';
import { completeReview, createReview, claimNextReview, deleteReview, failReview, usageFor } from '@/lib/server/reviews';
import { HttpError } from '@/lib/server/errors';
import type { Report } from '@/lib/engine/report';

describe('passwords', () => {
  it('hashes with a random salt and verifies only the right password', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword('correct horse battery', a)).toBe(true);
    expect(await verifyPassword('correct horse batterY', a)).toBe(false);
    expect(await verifyPassword('anything', 'md5$abc')).toBe(false);
  });
  it('rejects weak passwords', () => {
    expect(passwordProblem('short')).toMatch(/10 characters/);
    expect(passwordProblem('aaaaaaaaaaaa')).toBeTruthy();
    expect(passwordProblem('password1234')).toBeTruthy();
    expect(passwordProblem('cleopatra-rules-1', 'cleopatra@example.com')).toBeTruthy();
    expect(passwordProblem('a sensible passphrase')).toBeNull();
  });
});

describe('safeNext', () => {
  it.each([
    ['/app/billing?plan=pro', '/app/billing?plan=pro'], ['/app', '/app'],
    ['https://evil.example', '/app'], ['//evil.example', '/app'], ['/\\evil.example', '/app'], ['javascript:alert(1)', '/app'],
    ['/app\r\nSet-Cookie: x', '/app'], [null, '/app'], ['', '/app'],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input as string | null)).toBe(expected);
  });
});

describe('rateLimit', () => {
  it('allows up to the limit within the window, then blocks with a retry time', () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit(`${key}:other`, 3, 60_000).ok).toBe(true);
  });
  it('starts a new window once the old one has expired', async () => {
    const key = `test:${Math.random()}`;
    expect(rateLimit(key, 1, 30).ok).toBe(true);
    expect(rateLimit(key, 1, 30).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 40));
    expect(rateLimit(key, 1, 30).ok).toBe(true);
  });
});

describe('clientIp', () => {
  const req = (headers: Record<string, string>) => ({ headers: new Headers(headers) }) as never;
  it('uses the address added by our own proxy, not one the client sent', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(req({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientIp(req({}))).toBe('local');
  });
});

describe('review allowance', () => {
  const intake = { url: 'https://example.com/', pageType: 'saas' as const, goal: 'trial' as const, audience: 'Founders', context: '' };
  const report = { score: 70, grade: 'B', verdict: 'ok', finalUrl: 'https://example.com/', meta: { usage: { costUsd: 0.02 } } } as unknown as Report;
  const finish = (id: string, ok: boolean) => {
    const { claimed } = claimNextReview('test-worker', 60_000);
    expect(claimed?.id).toBe(id);
    return ok ? completeReview(id, 'test-worker', report, 1000) : failReview(id, 'test-worker', 'blocked', 'Blocked');
  };
  const newUser = () => createUser({ email: `u${Math.random().toString(36).slice(2)}@example.com`, name: 'T', passwordHash: 'x' });

  it('gives Free users 3 reviews for life, charging only completed reviews', () => {
    const user = newUser();
    expect(usageFor(user)).toMatchObject({ used: 0, limit: 3, remaining: 3 });
    const failed = createReview(user, intake);
    expect(() => createReview(user, intake)).toThrowError(expect.objectContaining({ code: 'review_in_progress' }));
    finish(failed, false);
    expect(usageFor(user).used).toBe(0);
    for (let i = 0; i < 3; i++) finish(createReview(user, intake), true);
    expect(usageFor(user)).toMatchObject({ used: 3, remaining: 0 });
    let error: unknown;
    try { createReview(user, intake); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(402);
  });

  it('does not refund deleted reviews', async () => {
    const user = newUser();
    const id = createReview(user, intake);
    finish(id, true);
    await deleteReview(id, user.id);
    expect(usageFor(user).used).toBe(1);
  });

  it('resets paid allowances each billing period and falls back to Free when a subscription lapses', () => {
    const user = newUser();
    finish(createReview(user, intake), true);
    const start = Date.now() + 5; // a new period that starts after the review above
    updateUser(user.id, { plan: 'pro', plan_status: 'active', period_start: start, period_end: start + 30 * 86400_000 });
    const pro = findUserById(user.id)!;
    expect(usageFor(pro)).toMatchObject({ limit: 40, used: 0, period: 'month' });
    updateUser(user.id, { plan_status: 'canceled' });
    expect(usageFor(findUserById(user.id)!)).toMatchObject({ limit: 3, used: 1, period: 'lifetime' });
  });

  it('gives admins unlimited reviews', () => {
    const user = newUser();
    expect(usageFor(user, { admin: true }).unlimited).toBe(true);
  });
});
