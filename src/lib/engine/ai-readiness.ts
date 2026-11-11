import type { PageFacts } from './types';
import { guardedGet } from './net/fetch';

/**
 * AI search readiness: can AI search tools reach, read and understand this
 * page? It checks what the business controls (robots.txt, indexing, text that
 * does not need JavaScript, structured data, a clear identity). It does NOT
 * measure whether ChatGPT, Gemini or Google's AI actually mention the business;
 * the report says so plainly.
 */
export type AiCheckId = 'crawlers' | 'indexable' | 'no_js' | 'depth' | 'structured_data' | 'title_description' | 'identity' | 'faq';
export type AiCheckStatus = 'pass' | 'warn' | 'fail';
export type AiCheck = { id: AiCheckId; label: string; status: AiCheckStatus; detail: string; fix?: string };
export type AiCrawlerRole = 'search' | 'assistant' | 'training';
export type AiCrawler = { agent: string; owner: string; product: string; role: AiCrawlerRole; status: 'allowed' | 'blocked' | 'unknown' };
export type AiReadiness = { checks: AiCheck[]; crawlers: AiCrawler[]; robots: 'found' | 'missing' | 'error'; passed: number; total: number };

export const AI_CRAWLERS: Omit<AiCrawler, 'status'>[] = [
  { agent: 'Googlebot', owner: 'Google', product: 'Google Search and AI Overviews', role: 'search' },
  { agent: 'Bingbot', owner: 'Microsoft', product: 'Bing and Copilot', role: 'search' },
  { agent: 'OAI-SearchBot', owner: 'OpenAI', product: 'ChatGPT search', role: 'search' },
  { agent: 'PerplexityBot', owner: 'Perplexity', product: 'Perplexity', role: 'search' },
  { agent: 'Claude-SearchBot', owner: 'Anthropic', product: 'Claude search', role: 'search' },
  { agent: 'ChatGPT-User', owner: 'OpenAI', product: 'ChatGPT reading a page on request', role: 'assistant' },
  { agent: 'GPTBot', owner: 'OpenAI', product: 'OpenAI model training', role: 'training' },
  { agent: 'ClaudeBot', owner: 'Anthropic', product: 'Anthropic model training', role: 'training' },
  { agent: 'Google-Extended', owner: 'Google', product: 'Gemini training and grounding', role: 'training' },
];

export const AI_CHECK_LABELS: Record<AiCheckId, string> = {
  crawlers: 'AI search crawlers can reach the page',
  indexable: 'The page can be indexed',
  no_js: 'The text is readable without JavaScript',
  depth: 'Enough text to quote',
  structured_data: 'Structured data describes the business',
  title_description: 'A clear title and description',
  identity: 'It is clear who is behind the page',
  faq: 'Answers to common questions',
};

// ---------------------------------------------------------------- robots.txt

export type RobotsGroup = { agents: string[]; rules: { allow: boolean; path: string }[] };

/** Parses robots.txt into groups (RFC 9309): consecutive user-agent lines share the rules that follow them. */
export function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === 'allow' || key === 'disallow')) current.rules.push({ allow: key === 'allow', path: value });
    }
  }
  return groups;
}

const ruleMatches = (pattern: string, path: string) =>
  new RegExp('^' + pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/\\\$$/, '$')).test(path);

/** Whether `agent` may fetch `path`: its own group wins over `*`, the longest matching rule wins, and Allow wins a tie. */
export function robotsVerdict(groups: RobotsGroup[], agent: string, path = '/'): 'allowed' | 'blocked' {
  const token = agent.toLowerCase();
  let matched = groups.filter((g) => g.agents.includes(token));
  if (!matched.length) matched = groups.filter((g) => g.agents.includes('*'));
  let best: { allow: boolean; len: number } | null = null;
  for (const rule of matched.flatMap((g) => g.rules)) {
    if (!rule.path || !ruleMatches(rule.path, path)) continue;
    const len = rule.path.length;
    if (!best || len > best.len || (len === best.len && rule.allow && !best.allow)) best = { allow: rule.allow, len };
  }
  return !best || best.allow ? 'allowed' : 'blocked';
}

/** Visible text of raw HTML (no scripts, styles or tags). */
export function htmlText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}
const countWords = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'\u2019-]*/gu) ?? []).length;
const list = (items: string[]) => items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

// ---------------------------------------------------------------- assessment

export type AiFetch = (url: string, opts: { accept?: string; maxBytes?: number }) => Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }>;

export async function assessAiReadiness(input: { url: string; facts: PageFacts; allowPrivate?: boolean; fetch?: AiFetch }): Promise<AiReadiness> {
  const get: AiFetch = input.fetch ?? ((u, o) => guardedGet(u, { allowPrivate: input.allowPrivate, timeoutMs: 6000, maxBytes: o.maxBytes ?? 512 * 1024, accept: o.accept }));
  const page = new URL(input.url);
  const [robotsRes, rawRes] = await Promise.all([
    get(new URL('/robots.txt', page).toString(), { accept: 'text/plain,*/*;q=0.5', maxBytes: 256 * 1024 }).catch(() => null),
    get(page.toString(), { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' }).catch(() => null),
  ]);

  // A missing robots.txt (4xx) means "allowed"; a server error makes crawlers hold back, so we report it as unknown.
  let robots: AiReadiness['robots'] = 'error';
  let groups: RobotsGroup[] = [];
  if (robotsRes && robotsRes.status >= 200 && robotsRes.status < 300) { robots = 'found'; groups = parseRobots(robotsRes.body); }
  else if (robotsRes && robotsRes.status >= 400 && robotsRes.status < 500) robots = 'missing';
  const path = page.pathname + page.search;
  const crawlers: AiCrawler[] = AI_CRAWLERS.map((c) => ({ ...c, status: robots === 'error' ? 'unknown' : robots === 'missing' ? 'allowed' : robotsVerdict(groups, c.agent, path) }));

  const f = input.facts;
  const checks: AiCheck[] = [];
  const add = (id: AiCheckId, status: AiCheckStatus, detail: string, fix?: string) => checks.push({ id, label: AI_CHECK_LABELS[id], status, detail, ...(fix && status !== 'pass' ? { fix } : {}) });

  // 1. Crawlers
  const blocked = (role: AiCrawlerRole) => crawlers.filter((c) => c.role === role && c.status === 'blocked').map((c) => c.product);
  if (robots === 'error') {
    add('crawlers', 'warn', 'We could not read your robots.txt because the server returned an error. Search crawlers usually hold back when that happens.', 'Make sure /robots.txt loads (or returns a plain 404) so crawlers know they are welcome.');
  } else if (blocked('search').length) {
    add('crawlers', 'fail', `Your robots.txt blocks ${list(blocked('search'))} from this page, so those tools cannot find it or cite it.`, 'Remove the Disallow rules for these crawlers in robots.txt, unless you block them on purpose.');
  } else if (blocked('assistant').length) {
    add('crawlers', 'warn', `Search crawlers are allowed, but ${list(blocked('assistant'))} is blocked, so ChatGPT cannot open the page when someone asks about it.`, 'Allow ChatGPT-User in robots.txt if you want ChatGPT to read the page on request.');
  } else {
    const training = blocked('training');
    add('crawlers', 'pass', training.length
      ? `AI search crawlers can reach the page. You block ${list(training)}, which only affects model training, not AI search results.`
      : 'Google, Bing, ChatGPT search, Perplexity and Claude can all reach the page.');
  }

  // 2. Indexing
  const xRobots = rawRes ? [rawRes.headers['x-robots-tag']].flat().filter(Boolean).join(', ') : '';
  if (/noindex/i.test(f.meta.robots) || /noindex/i.test(xRobots)) {
    add('indexable', 'fail', 'The page tells search engines not to index it (noindex), so it will not appear in search or AI answers built on search.', 'Remove noindex from the robots meta tag or the X-Robots-Tag header.');
  } else add('indexable', 'pass', 'Nothing stops search engines from indexing the page.');

  // 3. Text without JavaScript
  const rendered = f.content.words;
  if (!rawRes || rawRes.status >= 400) {
    add('no_js', 'warn', 'We could not load the page without a browser, so we could not check what crawlers that skip JavaScript see.', 'Check the page loads for simple HTTP clients, not only browsers.');
  } else {
    const raw = countWords(htmlText(rawRes.body));
    const share = rendered > 0 ? raw / rendered : 1;
    if (rendered >= 80 && share < 0.3) add('no_js', 'fail', `Only about ${Math.round(share * 100)}% of the text is in the HTML; the rest appears after JavaScript runs. Many AI crawlers do not run JavaScript, so they see an almost empty page.`, 'Render the main content on the server (server-side rendering or static generation).');
    else if (rendered >= 80 && share < 0.6) add('no_js', 'warn', `About ${Math.round(share * 100)}% of the text is in the HTML; the rest needs JavaScript. Crawlers that skip JavaScript miss part of the page.`, 'Make sure the headline, the offer and key details are in the HTML the server sends.');
    else add('no_js', 'pass', 'The main text is in the HTML, so crawlers that skip JavaScript can read it.');
  }

  // 4. Depth
  if (rendered < 150) add('depth', 'fail', `The page has about ${rendered} words. AI answers quote pages that explain what you do, for whom, where and at what price.`, 'Add a short, specific section: what you offer, who it is for, where you work and what it costs.');
  else if (rendered < 300) add('depth', 'warn', `The page has about ${rendered} words, which gives AI tools little to quote.`, 'Add concrete details people ask about: prices, areas served, timescales and proof.');
  else add('depth', 'pass', `About ${rendered} words, enough for AI tools to understand and quote the page.`);

  // 5. Structured data
  const types = [...new Set(f.meta.jsonLdTypes)];
  const useful = types.filter((t) => /organization|localbusiness|product|service|offer|faqpage|person|softwareapplication|store|restaurant|professionalservice|course|event|review/i.test(t));
  if (useful.length) add('structured_data', 'pass', `Structured data found: ${list(useful.slice(0, 5))}.`);
  else if (types.length) add('structured_data', 'warn', `Structured data found (${list(types.slice(0, 4))}), but nothing that describes the business or the offer.`, 'Add Organization or LocalBusiness markup, plus Product, Service or FAQPage where it fits.');
  else add('structured_data', 'fail', 'No structured data. It is the most direct way to tell search and AI tools what the business is and what it sells.', 'Add Organization or LocalBusiness JSON-LD with your name, address, phone and website.');

  // 6. Title and description
  const title = f.title.trim();
  const description = f.meta.description.trim();
  if (!title) add('title_description', 'fail', 'The page has no title.', 'Write a title of 30 to 60 characters that says what you offer and where.');
  else if (!description) add('title_description', 'warn', 'The page has a title but no meta description, so tools have to guess the summary.', 'Write a description of 70 to 160 characters that sums up the offer.');
  else if (title.length > 70 || description.length > 200 || title.length < 10 || description.length < 50) add('title_description', 'warn', 'The title or description is very short or very long, so it is likely to be cut or rewritten.', 'Aim for a 30 to 60 character title and a 70 to 160 character description.');
  else add('title_description', 'pass', 'The page has a clear title and description.');

  // 7. Identity
  const c = f.trust.contact;
  const signals = [c.email && 'an email address', c.phone && 'a phone number', c.contactLink && 'a contact page', c.about && 'an about page'].filter(Boolean) as string[];
  if (signals.length >= 2) add('identity', 'pass', `The page shows ${list(signals)}.`);
  else if (signals.length === 1) add('identity', 'warn', `The page only shows ${signals[0]}. AI tools prefer to name businesses whose identity is easy to confirm.`, 'Show who you are: the business name, location, contact details and a link to an about page.');
  else add('identity', 'fail', 'There is no contact detail or about link on the page, so it is hard to tell who is behind it.', 'Add the business name, location and contact details, and link to an about page.');

  // 8. FAQ
  if (f.faq.present && f.faq.items >= 3) add('faq', 'pass', `The page answers ${f.faq.items} common questions, which matches how people ask AI tools.`);
  else if (f.faq.present) add('faq', 'warn', 'The page has a short FAQ.', 'Answer the five to eight questions customers ask most, in plain sentences.');
  else add('faq', 'warn', 'The page does not answer common questions directly. People ask AI tools questions, and pages with clear answers are easier to quote.', 'Add a short FAQ with the questions customers ask most, and mark it up as FAQPage.');

  const passed = checks.filter((x) => x.status === 'pass').length;
  return { checks, crawlers, robots, passed, total: checks.length };
}
