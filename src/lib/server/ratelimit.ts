import { db, now } from './db';

/** Fixed-window rate limit stored in SQLite (shared by all processes). */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const t = now();
  const conn = db();
  const result = conn.transaction(() => {
    const row = conn.prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?').get(key) as { count: number; reset_at: number } | undefined;
    if (!row || row.reset_at <= t) {
      conn.prepare('INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at').run(key, t + windowMs);
      return { ok: true, retryAfterSec: 0 };
    }
    if (row.count >= limit) return { ok: false, retryAfterSec: Math.ceil((row.reset_at - t) / 1000) };
    conn.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').run(key);
    return { ok: true, retryAfterSec: 0 };
  }).immediate();
  if (Math.random() < 0.01) conn.prepare('DELETE FROM rate_limits WHERE reset_at < ?').run(t);
  return result;
}
