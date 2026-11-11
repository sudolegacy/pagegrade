import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { proxyChromeArgs, startGuardedProxy } from '../net/proxy';
import type { CaptureIssue, CaptureResult, Layer, PageFacts, ProfileCapture } from '../types';
import { DETECT_LAYERS, DETECT_WALL, HIDE_LAYERS, MARK_CLOSE, MARK_CONSENT, PROGRESSIVE_SCROLL, REVEAL, SETTLE_DOM, STABILIZE, UNLOCK_SCROLL, WAIT_IMAGES } from './inpage';
import { EXTRACT } from './extract';
import { captureFullPage, encodeFull, findBlankBands, imageFingerprint, makeTiles, resizeJpeg } from './images';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function runInPage<T>(page: Page, script: string, arg: unknown = {}): Promise<T> {
  return page.evaluate(`(${script})(${JSON.stringify(arg)})`) as Promise<T>;
}

type ProfileSpec = { name: 'desktop' | 'mobile'; width: number; height: number; dpr: number; mobile: boolean; maxHeight: number; outScale: number; tileCss: number; tileWidth: number; maxTiles: number; cover: 'all' | 'top' };
// Desktop tiles cover the whole page for the AI; mobile tiles cover the first screens at a legible size
// (the rest of the mobile page is assessed from the DOM).
const DESKTOP: ProfileSpec = { name: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false, maxHeight: 16_000, outScale: 1, tileCss: 1800, tileWidth: 1024, maxTiles: 8, cover: 'all' };
const MOBILE: ProfileSpec = { name: 'mobile', width: 390, height: 844, dpr: 2, mobile: true, maxHeight: 14_000, outScale: 0.5, tileCss: 1688, tileWidth: 390, maxTiles: 2, cover: 'top' };

const KNOWN_CONSENT = [
  '#onetrust-accept-btn-handler', '#accept-recommended-btn-handler', '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', '#CybotCookiebotDialogBodyButtonAccept',
  '#didomi-notice-agree-button', '.qc-cmp2-summary-buttons button[mode="primary"]', '#truste-consent-button', '.cky-btn-accept', '.cmplz-accept', '.iubenda-cs-accept-btn',
  '[data-testid="uc-accept-all-button"]', '.osano-cm-accept-all', '#axeptio_btn_acceptAll', '.cc-allow', '.cc-accept', '#cookie-accept', '.js-cookie-accept', '[data-cookiefirst-action="accept"]', '#hs-eu-confirmation-button', '.fc-cta-consent',
];

function trackNetwork(page: Page) {
  let inflight = 0;
  let last = Date.now();
  const bump = () => { last = Date.now(); };
  page.on('request', () => { inflight++; bump(); });
  const done = () => { inflight = Math.max(0, inflight - 1); bump(); };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  return {
    async quiet(idleMs: number, maxMs: number) {
      const start = Date.now();
      while (Date.now() - start < maxMs) {
        if (inflight <= 2 && Date.now() - last >= idleMs) return true;
        await sleep(100);
      }
      return false;
    },
  };
}

async function handleConsent(page: Page): Promise<{ found: boolean; method: string | null }> {
  const present = await page.evaluate(`(${JSON.stringify(KNOWN_CONSENT)}).filter((s) => { try { const el = document.querySelector(s); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; } catch (e) { return false; } })`) as string[];
  for (const selector of present) {
    if (await page.locator(selector).first().click({ timeout: 1500 }).then(() => true).catch(() => false)) return { found: true, method: `known:${selector}` };
  }
  const marked = await runInPage<number>(page, MARK_CONSENT).catch(() => 0);
  if (marked) {
    for (const kind of ['accept', 'reject']) {
      const loc = page.locator(`[data-pg-consent="${kind}"]`);
      const count = await loc.count();
      for (let i = 0; i < Math.min(count, 4); i++) {
        const b = loc.nth(i);
        if (await b.isVisible().catch(() => false) && await b.click({ timeout: 1500 }).then(() => true).catch(() => false)) return { found: true, method: `text:${kind}` };
      }
    }
  }
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    if (!/consent|cmp|privacy|sourcepoint|trustarc|cookie|usercentrics|didomi|onetrust|sp_message/i.test(frame.url() + frame.name())) continue;
    const btn = frame.getByRole('button', { name: /^(accept|accept all|agree|allow all|i agree|ok|yes)/i }).first();
    if (await btn.isVisible().catch(() => false) && await btn.click({ timeout: 1500 }).then(() => true).catch(() => false)) return { found: true, method: 'iframe' };
  }
  return { found: false, method: null };
}

const BLOCKING = new Set(['cookie', 'age-gate', 'region', 'popup-offer', 'modal']);
const STILL_THERE = String.raw`({ id }) => { const el = document.querySelector('[data-pg-layer="' + id + '"]'); if (!el) return false; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.05 && r.width > 2 && r.height > 2; }`;

async function dismissOverlays(page: Page) {
  const dismissed: { kind: string; method: string; text: string }[] = [];
  for (let round = 0; round < 3; round++) {
    const layers = await runInPage<Layer[]>(page, DETECT_LAYERS).catch(() => [] as Layer[]);
    const targets = layers.filter((l) => l.onTop && BLOCKING.has(l.kind) && (l.cover >= 0.12 || l.kind === 'cookie'));
    if (!targets.length) break;
    for (const t of targets) {
      const stillThere = () => runInPage<boolean>(page, STILL_THERE, { id: t.id }).catch(() => false);
      await page.keyboard.press('Escape').catch(() => undefined);
      await sleep(250);
      if (!(await stillThere())) { dismissed.push({ kind: t.kind, method: 'escape', text: t.text }); continue; }
      const closers = await runInPage<number>(page, MARK_CLOSE, { id: t.id }).catch(() => 0);
      let closed = false;
      if (closers) {
        const loc = page.locator(`[data-pg-close="${t.id}"]`);
        const n = Math.min(await loc.count(), 3);
        for (let i = 0; i < n && !closed; i++) {
          await loc.nth(i).click({ timeout: 1000, force: true }).catch(() => undefined);
          await sleep(300);
          closed = !(await stillThere());
        }
      }
      if (closed) { dismissed.push({ kind: t.kind, method: 'close-button', text: t.text }); continue; }
      await runInPage(page, HIDE_LAYERS, { ids: [t.id] }).catch(() => undefined);
      dismissed.push({ kind: t.kind, method: 'hidden', text: t.text });
    }
    await sleep(200);
  }
  return dismissed;
}

const PERF_INIT = `(() => { const m = { lcp: 0, cls: 0 }; try { new PerformanceObserver((l) => { const e = l.getEntries(); const last = e[e.length - 1]; if (last) m.lcp = last.startTime || 0; }).observe({ type: 'largest-contentful-paint', buffered: true }); new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) m.cls += e.value || 0; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {} Object.defineProperty(window, '__pgPerf', { value: m, enumerable: false }); })();`;

type AttemptMode = 'standard' | 'thorough';
type Wall = { signals: string[]; loginWall: boolean; words: number; title: string; textSample: string };

async function captureProfile(browser: Browser, url: string, spec: ProfileSpec, opts: { dir: string; goalPattern: string; mode: AttemptMode; attempt: number; userAgent: string }): Promise<{ result?: ProfileCapture; wall?: Wall; error?: string }> {
  const timings: Record<string, number> = {};
  const mark = (k: string, t0: number) => { timings[k] = Date.now() - t0; };
  const thorough = opts.mode === 'thorough';
  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext({
      viewport: { width: spec.width, height: spec.height }, deviceScaleFactor: spec.dpr, isMobile: spec.mobile, hasTouch: spec.mobile,
      userAgent: opts.userAgent, locale: 'en-GB', serviceWorkers: 'block', acceptDownloads: false,
      extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
    });
    await context.addInitScript(PERF_INIT);
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const net = trackNetwork(page);
    let t0 = Date.now();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35_000 });
    mark('navigate', t0);
    t0 = Date.now();
    await page.waitForLoadState('load', { timeout: thorough ? 20_000 : 12_000 }).catch(() => undefined);
    await net.quiet(thorough ? 1500 : 800, thorough ? 12_000 : 5_000);
    await runInPage(page, SETTLE_DOM, { quietMs: 500, maxMs: thorough ? 6000 : 3500 }).catch(() => undefined);
    mark('settle', t0);

    let wall = await runInPage<Wall>(page, DETECT_WALL);
    if (wall.signals.length) {
      await sleep(7000);
      wall = await runInPage<Wall>(page, DETECT_WALL);
      if (wall.signals.length) return { wall };
    }

    const p = (name: string) => `${spec.name}-${name}`;
    const firstImpression = await page.screenshot({ type: 'jpeg', quality: 80, timeout: 20_000 });
    await writeFile(path.join(opts.dir, p('first.jpg')), spec.dpr > 1 ? await resizeJpeg(firstImpression, spec.width * 2) : firstImpression);
    const initialLayers = await runInPage<Layer[]>(page, DETECT_LAYERS).catch(() => [] as Layer[]);

    t0 = Date.now();
    const consent = await handleConsent(page);
    if (consent.found) await sleep(600);
    const dismissed = await dismissOverlays(page);
    mark('overlays', t0);

    t0 = Date.now();
    const unlock = await runInPage<{ unlocked: boolean }>(page, UNLOCK_SCROLL).catch(() => ({ unlocked: false }));
    const scroll = await runInPage<ProfileCapture['scroll']>(page, PROGRESSIVE_SCROLL, thorough
      ? { stepRatio: 0.5, pauseMs: 500, maxSteps: 120, maxHeight: spec.maxHeight, imageWaitMs: 1500, maxMs: 30_000 }
      : { stepRatio: 0.85, pauseMs: 180, maxSteps: 70, maxHeight: spec.maxHeight, imageWaitMs: 150, maxMs: 10_000 });
    await net.quiet(700, thorough ? 8000 : 4000);
    await runInPage(page, WAIT_IMAGES, { maxMs: thorough ? 5000 : 2500 }).catch(() => undefined);
    mark('scroll', t0);
    dismissed.push(...(await dismissOverlays(page)));
    const revealed = await runInPage<number>(page, REVEAL).catch(() => 0);
    await page.evaluate('window.scrollTo(0, 0)');
    await sleep(thorough ? 900 : 450);

    const hero = await page.screenshot({ type: 'jpeg', quality: 82, timeout: 20_000 });
    await writeFile(path.join(opts.dir, p('hero.jpg')), spec.dpr > 1 ? await resizeJpeg(hero, spec.width * 2, 82) : hero);

    const removedFixed = await runInPage<ProfileCapture['removedFixed']>(page, STABILIZE).catch(() => []);
    await sleep(300);
    t0 = Date.now();
    const facts = await runInPage<PageFacts>(page, EXTRACT, { goalPattern: opts.goalPattern });
    mark('extract', t0);
    const metrics = await page.evaluate(`(() => { const n = performance.getEntriesByType('navigation')[0]; const m = window.__pgPerf || {}; return { ttfb: n ? Math.round(n.responseStart) : null, load: n && n.loadEventEnd ? Math.round(n.loadEventEnd) : null, lcp: m.lcp ? Math.round(m.lcp) : null, cls: typeof m.cls === 'number' ? Math.round(m.cls * 1000) / 1000 : null }; })()`) as ProfileCapture['metrics'];

    t0 = Date.now();
    const capturedHeight = Math.max(spec.height, Math.min(facts.doc.height, spec.maxHeight));
    const full = await captureFullPage(page, spec.width, capturedHeight, spec.dpr, spec.outScale);
    await writeFile(path.join(opts.dir, p('full.jpg')), await encodeFull(full));
    const tiles = await makeTiles(full, { tileCss: spec.tileCss, outWidth: spec.tileWidth, maxTiles: spec.maxTiles, cover: spec.cover });
    const tileFiles: { file: string; y: number; h: number }[] = [];
    for (let i = 0; i < tiles.length; i++) {
      const name = p(`tile-${i}.jpg`);
      await writeFile(path.join(opts.dir, name), tiles[i].buffer);
      tileFiles.push({ file: name, y: tiles[i].yCss, h: tiles[i].hCss });
    }
    mark('screenshot', t0);

    const rawBands = findBlankBands(full, Math.round(spec.height * 1.1));
    const blankBands = rawBands.map((b) => ({ ...b, suspicious: facts.blocks.filter((blk) => blk.b.y >= b.y0 && blk.b.y + blk.b.h <= b.y1 && blk.t.length > 12).length >= 2 }));

    return {
      result: {
        profile: spec.name, viewport: { width: spec.width, height: spec.height, dpr: spec.dpr }, finalUrl: page.url(), status: response?.status() ?? null,
        facts, layers: initialLayers, consent, overlaysDismissed: dismissed, removedFixed, scroll, revealed, unlockedScroll: unlock.unlocked, capturedHeight,
        files: { firstImpression: p('first.jpg'), hero: p('hero.jpg'), full: p('full.jpg'), tiles: tileFiles }, timings, blankBands, metrics, attempt: opts.attempt,
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message.split('\n')[0] : String(error) };
  } finally {
    await context?.close().catch(() => undefined);
  }
}

export function assessProfile(p: ProfileCapture): { score: number; issues: CaptureIssue[]; retry: boolean } {
  const issues: CaptureIssue[] = [];
  let score = 100;
  let retry = false;
  const label = p.profile;
  if (p.status && p.status >= 400) { issues.push({ code: `${label}-http-${p.status}`, severity: 'error', message: `The page responded with HTTP ${p.status}.` }); score -= 40; }
  if (p.facts.content.words < 40) { issues.push({ code: `${label}-little-content`, severity: 'warning', message: `Very little readable text was found on the ${label} page (${p.facts.content.words} words).` }); score -= 25; retry = true; }
  if (p.scroll.truncated) { issues.push({ code: `${label}-truncated`, severity: label === 'mobile' ? 'info' : 'warning', message: `The ${label} page is longer than ${p.capturedHeight.toLocaleString('en-GB')}px, so only the first ${p.capturedHeight.toLocaleString('en-GB')}px were captured${p.scroll.growthEvents >= 4 ? ' (it appears to keep loading more content as you scroll)' : ''}.` }); score -= 8; }
  const suspicious = p.blankBands.filter((b) => b.suspicious);
  if (suspicious.length) { issues.push({ code: `${label}-blank-region`, severity: 'warning', message: `${suspicious.length} region(s) of the ${label} capture looked blank even though the page has content there.` }); score -= 15 * suspicious.length; retry = true; }
  if (p.facts.quality.unloadedImages > 3) { issues.push({ code: `${label}-images-unloaded`, severity: 'warning', message: `${p.facts.quality.unloadedImages} images had not finished loading when the ${label} page was captured.` }); score -= 10; retry = true; }
  if (p.facts.quality.stillHidden > 0) { issues.push({ code: `${label}-hidden-sections`, severity: 'warning', message: `${p.facts.quality.stillHidden} section(s) stayed hidden on the ${label} page, possibly behind an animation that never ran.` }); score -= 8 * p.facts.quality.stillHidden; retry = true; }
  const hiddenOverlays = p.overlaysDismissed.filter((o) => o.method === 'hidden' && o.kind !== 'cookie');
  if (hiddenOverlays.length) issues.push({ code: `${label}-overlay-hidden`, severity: 'info', message: `A ${hiddenOverlays[0].kind.replace('-', ' ')} could not be closed normally, so it was hidden for the capture.` });
  return { score: Math.max(0, score), issues, retry };
}

const normalize = (u: string) => u.replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');

function friendlyNavError(message?: string) {
  if (!message) return 'The page could not be loaded.';
  if (/ERR_NAME_NOT_RESOLVED/.test(message)) return 'The domain could not be found. Check the address and try again.';
  if (/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_EMPTY_RESPONSE/.test(message)) return 'The website refused or dropped the connection.';
  if (/ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY/.test(message)) return 'The address points to a network location that cannot be reviewed.';
  if (/ERR_CERT|SSL/.test(message)) return "The website's security certificate is invalid, so browsers warn visitors before showing it.";
  if (/Timeout|timeout/.test(message)) return 'The page took too long to load (over 35 seconds).';
  if (/ERR_TOO_MANY_REDIRECTS/.test(message)) return 'The page redirects in a loop and never loads.';
  return 'The page could not be loaded in a browser.';
}

export async function capturePage(url: string, opts: { dir: string; goalPattern: string; allowPrivate?: boolean; executablePath?: string; onStage?: (stage: string) => void }): Promise<CaptureResult> {
  const started = Date.now();
  await mkdir(opts.dir, { recursive: true });
  const proxy = await startGuardedProxy({ allowPrivate: opts.allowPrivate });
  let browser: Browser | undefined;
  const issues: CaptureIssue[] = [];
  const base = (status: CaptureResult['status'], extra: Partial<CaptureResult>): CaptureResult => ({ requestedUrl: url, finalUrl: url, redirected: false, status, completeness: 0, issues: [], desktop: null, mobile: null, network: proxy.stats, contentHash: '', durationMs: Date.now() - started, ...extra });
  try {
    browser = await chromium.launch({
      executablePath: opts.executablePath || process.env.CHROMIUM_PATH || undefined,
      headless: true,
      args: [...proxyChromeArgs(proxy.url), '--disable-dev-shm-usage', '--no-first-run', '--mute-audio', '--disable-background-networking', '--hide-scrollbars'],
    });
    const major = browser.version().split('.')[0];
    const desktopUA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
    const mobileUA = `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Mobile Safari/537.36`;

    opts.onStage?.('capture-desktop');
    let run = await captureProfile(browser, url, DESKTOP, { dir: opts.dir, goalPattern: opts.goalPattern, mode: 'standard', attempt: 1, userAgent: desktopUA });
    if (run.wall) {
      const w = run.wall;
      return base('blocked', { issues: [{ code: 'bot-protection', severity: 'error', message: `The site's bot protection blocked our browser${w.signals.length ? ` (${w.signals.join(', ')})` : ''}, so the real page could not be seen.` }] });
    }
    let assessment = run.result ? assessProfile(run.result) : null;
    let mode: AttemptMode = 'standard';
    if (!run.result || assessment?.retry) {
      mode = 'thorough';
      opts.onStage?.('capture-desktop-retry');
      const retry = await captureProfile(browser, url, DESKTOP, { dir: opts.dir, goalPattern: opts.goalPattern, mode, attempt: 2, userAgent: desktopUA });
      const retryAssessment = retry.result ? assessProfile(retry.result) : null;
      if (retry.result && (!assessment || (retryAssessment && retryAssessment.score >= assessment.score))) {
        run = retry;
        assessment = retryAssessment;
      } else if (!run.result) {
        run = retry;
      }
      if (run.wall) return base('blocked', { issues: [{ code: 'bot-protection', severity: 'error', message: "The site's bot protection blocked our browser, so the real page could not be seen." }] });
    }
    const desktop = run.result ?? null;
    if (!desktop) return base('failed', { issues: [{ code: 'desktop-failed', severity: 'error', message: friendlyNavError(run.error) }] });
    if (desktop.facts.content.words < 15 && desktop.facts.blocks.length < 8) {
      return base('failed', { finalUrl: desktop.finalUrl, desktop, issues: [{ code: 'empty-page', severity: 'error', message: 'The page rendered almost no visible content, so there was nothing meaningful to review.' }] });
    }
    issues.push(...(assessment?.issues ?? []));

    opts.onStage?.('capture-mobile');
    const mobileRun = await captureProfile(browser, desktop.finalUrl, MOBILE, { dir: opts.dir, goalPattern: opts.goalPattern, mode, attempt: 1, userAgent: mobileUA });
    const mobile = mobileRun.result ?? null;
    if (mobile) issues.push(...assessProfile(mobile).issues);
    else issues.push({ code: 'mobile-failed', severity: 'warning', message: 'The mobile version could not be captured, so mobile findings are limited.' });
    if (proxy.stats.blocked.length) issues.push({ code: 'private-requests-blocked', severity: 'info', message: `${proxy.stats.blocked.length} request(s) to private or disallowed addresses were blocked for security.` });
    if (proxy.stats.budgetExceeded) issues.push({ code: 'download-budget', severity: 'warning', message: 'The page downloaded an unusually large amount of data, so some assets were not loaded.' });

    const penalty = issues.reduce((n, i) => n + (i.severity === 'error' ? 35 : i.severity === 'warning' ? (i.code.startsWith('mobile') ? 6 : 10) : 0), 0);
    const hero = await readFile(path.join(opts.dir, desktop.files.hero));
    const contentHash = createHash('sha256').update(JSON.stringify([desktop.facts.blocks.map((b) => b.t), desktop.facts.ctas.map((c) => c.text), mobile?.facts.hero.headline?.text ?? '', await imageFingerprint(hero)])).digest('hex');
    return {
      requestedUrl: url, finalUrl: desktop.finalUrl, redirected: normalize(desktop.finalUrl) !== normalize(url),
      status: issues.some((i) => i.severity !== 'info') ? 'partial' : 'complete', completeness: Math.max(0, Math.min(100, 100 - penalty)), issues,
      desktop, mobile, network: proxy.stats, contentHash, durationMs: Date.now() - started,
    };
  } finally {
    await browser?.close().catch(() => undefined);
    await proxy.close().catch(() => undefined);
  }
}
