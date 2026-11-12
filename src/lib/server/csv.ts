import { db } from './db';
import { env } from './env';
import { GOALS, PAGE_TYPES } from '../engine/catalog';
import type { ReviewStatus } from './reviews';

export type CsvCell = string | number | null | undefined;

// Spreadsheets run cells that start with these (even after spaces) as formulas.
const FORMULA_START = /^\s*[=+\-@]|^[\t\r]/;

/** One RFC 4180 cell. Text that could be read as a formula gets a leading apostrophe; numbers are written as they are. */
export function csvCell(value: CsvCell): string {
  if (value == null) return '';
  const text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : value;
  const safe = typeof value === 'string' && FORMULA_START.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CRLF rows with a UTF-8 byte order mark, so Excel reads accents and £ correctly. */
export const toCsv = (rows: CsvCell[][]): string => `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;

export const REVIEW_CSV_HEADERS = [
  'Page', 'Final URL', 'Status', 'Score', 'Grade', 'Verdict', 'Page type', 'Goal', 'Client',
  'Top fix 1', 'Top fix 2', 'Top fix 3', 'Reviewed at', 'Duration (s)', 'Share link', 'Report link',
] as const;
export const REVIEW_EXPORT_MAX = 2000;

export type ReviewExportFilter = { batchId?: string; clientId?: string; status?: ReviewStatus; q?: string };

type ExportRow = {
  id: string; url: string; final_url: string | null; status: string; score: number | null; grade: string | null; verdict: string | null;
  page_type: string; goal: string; share_id: string | null; finished_at: number | null; duration_ms: number | null; client_name: string | null; fixes: string | null;
};

const label = (catalogue: Record<string, string>, id: string) => (Object.hasOwn(catalogue, id) ? catalogue[id] : id);
const goalLabels = Object.fromEntries(Object.entries(GOALS).map(([id, g]) => [id, g.label]));

/** The first three issue titles are the fixes, in priority order. Reports that lack them (or are damaged) just give fewer. */
function topFixes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const titles: unknown = JSON.parse(raw);
    return Array.isArray(titles) ? titles.filter((t): t is string => typeof t === 'string').map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean) : [];
  } catch { return []; }
}

/**
 * The caller's own non-deleted reviews, newest first, as a CSV for a spreadsheet or the outreach sheet.
 * Always scoped to `userId`; the filters mirror the History page.
 */
export function reviewsCsv(userId: string, filter: ReviewExportFilter = {}): { csv: string; count: number } {
  const where = ['r.user_id = ?', 'r.deleted_at IS NULL', "r.origin != 'widget'"];
  const args: (string | number)[] = [userId];
  if (filter.batchId) { where.push('r.batch_id = ?'); args.push(filter.batchId.slice(0, 40)); }
  if (filter.clientId) { where.push('r.client_id = ?'); args.push(filter.clientId.slice(0, 40)); }
  if (filter.status) { where.push('r.status = ?'); args.push(filter.status); }
  const q = filter.q?.trim().slice(0, 200);
  if (q) {
    where.push("(r.url LIKE ? ESCAPE '\\' OR r.final_url LIKE ? ESCAPE '\\')");
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    args.push(like, like);
  }
  // SQLite pulls the three titles out of each report, so a few thousand large reports never reach JavaScript.
  const rows = db().prepare(`SELECT r.id, r.url, r.final_url, r.status, r.score, r.grade, r.verdict, r.page_type, r.goal, r.share_id, r.finished_at, r.duration_ms, c.name AS client_name,
      CASE WHEN json_valid(r.report_json) THEN json_extract(r.report_json, '$.issues[0].title', '$.issues[1].title', '$.issues[2].title') END AS fixes
    FROM reviews r LEFT JOIN clients c ON c.id = r.client_id AND c.user_id = r.user_id
    WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT ${REVIEW_EXPORT_MAX}`).all(...args) as ExportRow[];

  const lines: CsvCell[][] = [[...REVIEW_CSV_HEADERS]];
  for (const r of rows) {
    const fixes = topFixes(r.fixes);
    lines.push([
      r.url, r.final_url, r.status, r.score, r.grade, r.verdict, label(PAGE_TYPES, r.page_type), label(goalLabels, r.goal), r.client_name,
      fixes[0], fixes[1], fixes[2],
      r.finished_at ? new Date(r.finished_at).toISOString() : '', r.duration_ms != null ? Math.round(r.duration_ms / 1000) : null,
      r.share_id ? `${env.appUrl}/r/${r.share_id}` : '', `${env.appUrl}/app/reviews/${r.id}`,
    ]);
  }
  return { csv: toCsv(lines), count: rows.length };
}
