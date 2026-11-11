import { marked } from 'marked';
import { SITE } from '@/lib/site';

export type Heading = { id: string; text: string; level: 2 | 3 };

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const slugify = (s: string) => decode(s).toLowerCase().replace(/[’'"]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'section';

/**
 * Renders article Markdown to HTML with stable heading ids (for the table of contents and deep links),
 * safe external links and lazy-loaded images. Article content is first-party, so raw HTML is trusted.
 */
export async function renderArticle(md: string): Promise<{ html: string; headings: Heading[] }> {
  let html = await marked.parse(md, { gfm: true });
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  html = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, lvl: string, inner: string) => {
    const text = decode(inner.replace(/<[^>]+>/g, '')).trim();
    let id = slugify(text);
    const n = used.get(id) ?? 0;
    used.set(id, n + 1);
    if (n) id = `${id}-${n + 1}`;
    headings.push({ id, text, level: Number(lvl) as 2 | 3 });
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });
  const own = new URL(SITE.url).host;
  html = html.replace(/<a href="(https?:\/\/[^"]+)"/g, (m, href: string) => {
    try { if (new URL(href).host === own) return m; } catch { return m; }
    return `<a href="${href}" rel="noopener noreferrer" target="_blank"`;
  });
  html = html.replace(/<img /g, '<img loading="lazy" decoding="async" ');
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
  return { html, headings };
}
