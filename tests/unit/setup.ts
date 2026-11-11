import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

// Point the app at a fresh data directory before any module opens the database.
const dir = mkdtempSync(path.join(tmpdir(), 'pagegrade-test-'));
process.env.DATA_DIR = dir;
process.env.ADMIN_EMAILS = 'admin@example.com';
delete process.env.SMTP_HOST;

afterAll(async () => {
  const { closeDb } = await import('@/lib/server/db');
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});
