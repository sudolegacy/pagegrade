import { createHash, randomBytes } from 'node:crypto';
import { db, now } from './db';
import { env } from './env';

/**
 * PDF reports: a headless browser opens /print/[id] with a short-lived print
 * token (it has no session cookie), and prints the same report the user sees.
 */
const PRINT_TTL_MS = 3 * 60_000;
const MAX_PARALLEL = 2;
const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');

export function createPrintToken(reviewId: string, userId: string): string {
  const raw = randomBytes(24).toString('base64url');
  db().prepare('INSERT INTO print_tokens (id, review_id, user_id, expires_at) VALUES (?, ?, ?, ?)').run(hash(raw), reviewId, userId, now() + PRINT_TTL_MS);
  return raw;
}

/** The user a print token was issued to, if it is still valid for this review. */
export function checkPrintToken(reviewId: string, raw: string | null | undefined): string | null {
  if (!raw || raw.length > 64) return null;
  const row = db().prepare('SELECT user_id, expires_at FROM print_tokens WHERE id = ? AND review_id = ?').get(hash(raw), reviewId) as { user_id: string; expires_at: number } | undefined;
  return row && row.expires_at > now() ? row.user_id : null;
}

let active = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  while (active >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try { return await fn(); } finally { active--; waiting.shift()?.(); }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function renderReviewPdf(reviewId: string, userId: string, footer: string): Promise<Buffer> {
  return slot(async () => {
    const { chromium } = await import('playwright-core');
    const token = createPrintToken(reviewId, userId);
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--disable-dev-shm-usage', '--no-first-run'] });
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
      const res = await page.goto(`${env.internalUrl}/print/${reviewId}?t=${encodeURIComponent(token)}`, { waitUntil: 'networkidle', timeout: 45_000 });
      if (!res || !res.ok()) throw new Error(`print page returned ${res?.status() ?? 'no response'}`);
      await page.emulateMedia({ media: 'print' });
      const pdf = await page.pdf({
        format: 'A4', printBackground: true, displayHeaderFooter: true,
        margin: { top: '12mm', bottom: '16mm', left: '10mm', right: '10mm' },
        headerTemplate: '<span></span>',
        footerTemplate: `<div style="width:100%;padding:0 10mm;font-family:Arial,sans-serif;font-size:8px;color:#71717a;display:flex;justify-content:space-between"><span>${esc(footer)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => undefined);
    }
  });
}
