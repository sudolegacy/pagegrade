import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { db, kv, now } from './db';
import { env } from './env';
import type { AnalysisCache, CachedAnalysis } from '../engine/pipeline';

const DAY = 24 * 3600 * 1000;

/** Analysis results keyed by page content + intake + engine config, so unchanged pages re-review for free. */
export const analysisCache: AnalysisCache = {
  async get(key) {
    const row = db().prepare('SELECT value, created_at FROM analysis_cache WHERE key = ?').get(key) as { value: string; created_at: number } | undefined;
    if (!row || row.created_at < now() - 7 * DAY) return null;
    return JSON.parse(row.value) as CachedAnalysis;
  },
  async set(key, value) {
    db().prepare('INSERT INTO analysis_cache (key, value, created_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, created_at = excluded.created_at')
      .run(key, JSON.stringify(value), now());
  },
};

/** Online SQLite backup (safe while the app is running), keeping the newest `keep` files. */
export async function backupDatabase(keep = 7): Promise<string> {
  await mkdir(env.backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(env.backupsDir, `pagegrade-${stamp}.db`);
  await db().backup(file);
  const files = (await readdir(env.backupsDir)).filter((f) => /^pagegrade-.*\.db$/.test(f)).sort();
  for (const old of files.slice(0, Math.max(0, files.length - keep))) await rm(path.join(env.backupsDir, old), { force: true });
  kv.set('backup:last', JSON.stringify({ at: now(), file: path.basename(file), bytes: (await stat(file)).size }));
  return file;
}

/** Removes expired rows that are no longer needed. */
export function pruneExpired() {
  const t = now();
  const conn = db();
  conn.prepare('DELETE FROM sessions WHERE expires_at < ?').run(t);
  conn.prepare('DELETE FROM tokens WHERE expires_at < ?').run(t - DAY);
  conn.prepare('DELETE FROM rate_limits WHERE reset_at < ?').run(t);
  conn.prepare('DELETE FROM analysis_cache WHERE created_at < ?').run(t - 14 * DAY);
  conn.prepare('DELETE FROM stripe_events WHERE received_at < ? AND processed_at IS NOT NULL').run(t - 90 * DAY);
  conn.prepare('DELETE FROM print_tokens WHERE expires_at < ?').run(t);
}

/** Intermediate files that are only needed while a review runs. */
export async function cleanReviewWorkFiles(dir: string) {
  const files = await readdir(dir).catch(() => [] as string[]);
  await Promise.all(files.filter((f) => /-tile-\d+\.jpg$/.test(f) || /^(evaluation|recommendations|performance)\.json$/.test(f)).map((f) => rm(path.join(dir, f), { force: true })));
}
