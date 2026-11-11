import sharp from 'sharp';
import type { Page } from 'playwright-core';

sharp.cache(false);
sharp.concurrency(1);

/** A stitched full-page capture kept as raw RGB so tiles and checks never re-decode a huge JPEG. */
export type RawCapture = { raw: Buffer; width: number; height: number; scale: number };

const fromRaw = (c: RawCapture) => sharp(c.raw, { raw: { width: c.width, height: c.height, channels: 3 } });

/** Finishes finite CSS/JS animations and cancels infinite ones so captures show the settled state. */
export const SETTLE_ANIMATIONS = String.raw`() => {
  let n = 0;
  try {
    for (const a of document.getAnimations()) {
      const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      if (t && Number.isFinite(t.endTime) && t.endTime < 60000) { try { a.finish(); n++; } catch (e) { a.cancel(); } }
      else { a.cancel(); n++; }
    }
  } catch (e) {}
  return n;
}`;

/**
 * Captures a tall page as clipped segments (rendered beyond the viewport, so the
 * layout never changes and 100vh sections keep their real height) and stitches
 * them into one raw RGB buffer.
 */
export async function captureFullPage(page: Page, cssWidth: number, cssHeight: number, dpr: number, outScale = 1): Promise<RawCapture> {
  const segment = 5000;
  const scale = dpr * outScale;
  const outWidth = Math.round(cssWidth * scale);
  const parts: Buffer[] = [];
  let outHeight = 0;
  const ta = Date.now();
  const settled = await page.evaluate(`(${SETTLE_ANIMATIONS})()`).catch(() => -1);
  if (process.env.PG_DEBUG) console.log('[capture] settle animations', settled, Date.now() - ta, 'ms');
  const cdp = await page.context().newCDPSession(page);
  try {
    for (let y = 0; y < cssHeight; y += segment) {
      // Fold a short remainder into this segment: every capture call has a fixed relayout cost.
      const remaining = cssHeight - y;
      const h = remaining <= segment * 1.25 ? remaining : segment;
      const t0 = Date.now();
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, captureBeyondViewport: true, fromSurface: true, clip: { x: 0, y, width: cssWidth, height: h, scale: 1 } });
      if (process.env.PG_DEBUG) console.log('[capture] segment', y, h, Date.now() - t0, 'ms');
      const targetH = Math.round(h * scale);
      const raw = await sharp(Buffer.from(data, 'base64')).removeAlpha().resize(outWidth, targetH, { fit: 'fill' }).raw().toBuffer();
      parts.push(raw);
      outHeight += targetH;
      if (h === remaining) break;
    }
  } finally {
    await cdp.detach().catch(() => undefined);
  }
  return { raw: Buffer.concat(parts), width: outWidth, height: Math.max(1, outHeight), scale };
}

export async function encodeFull(capture: RawCapture, quality = 80) {
  return fromRaw(capture).jpeg({ quality, chromaSubsampling: '4:2:0' }).toBuffer();
}

/** Splits a capture into AI-sized tiles. 'all' covers the whole page; 'top' keeps legible tiles of the first screens. */
export async function makeTiles(capture: RawCapture, opts: { tileCss: number; outWidth: number; maxTiles: number; cover: 'all' | 'top' }) {
  const { width, scale } = capture;
  let height = capture.height;
  let tilePx = Math.round(opts.tileCss * scale);
  if (Math.ceil(height / tilePx) > opts.maxTiles) {
    if (opts.cover === 'all') tilePx = Math.ceil(height / opts.maxTiles);
    else height = tilePx * opts.maxTiles;
  }
  const tiles: { buffer: Buffer; yCss: number; hCss: number }[] = [];
  for (let top = 0; top < height; top += tilePx) {
    const h = Math.min(tilePx, height - top);
    if (h < 40 && tiles.length) break;
    const buffer = await fromRaw(capture).extract({ left: 0, top, width, height: h }).resize({ width: Math.min(opts.outWidth, width) }).jpeg({ quality: 76, mozjpeg: true }).toBuffer();
    tiles.push({ buffer, yCss: Math.round(top / scale), hCss: Math.round(h / scale) });
  }
  return tiles;
}

export async function resizeJpeg(input: Buffer, width: number, quality = 78) {
  return sharp(input).resize({ width, withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
}

/**
 * Finds tall, visually uniform horizontal bands (in CSS px). A uniform band
 * where the DOM says text exists means the capture missed rendered content.
 */
export function findBlankBands(capture: RawCapture, minCss: number) {
  const { raw, width, height, scale } = capture;
  const samples = 48;
  const stepX = Math.max(1, Math.floor(width / samples));
  const rowStep = Math.max(1, Math.round(scale * 4)); // one sampled row every ~4 CSS px
  const bands: { y0: number; y1: number }[] = [];
  let start = -1;
  let prevMean = -1;
  for (let y = 0; y < height; y += rowStep) {
    let sum = 0, sq = 0, n = 0;
    for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * 3;
      const v = 0.299 * raw[i] + 0.587 * raw[i + 1] + 0.114 * raw[i + 2];
      sum += v; sq += v * v; n++;
    }
    const mean = sum / n;
    const sd = Math.sqrt(Math.max(0, sq / n - mean * mean));
    const uniform = sd < 2.5 && (prevMean < 0 || Math.abs(mean - prevMean) < 1.5);
    prevMean = mean;
    if (uniform) { if (start < 0) start = y; }
    else if (start >= 0) { bands.push({ y0: start, y1: y }); start = -1; }
  }
  if (start >= 0) bands.push({ y0: start, y1: height });
  return bands
    .map((b) => ({ y0: Math.round(b.y0 / scale), y1: Math.round(b.y1 / scale) }))
    .filter((b) => b.y1 - b.y0 >= minCss);
}

/** Tiny perceptual fingerprint used for result caching. */
export async function imageFingerprint(input: Buffer) {
  const { data } = await sharp(input).greyscale().resize(16, 10, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  return Array.from(data).map((v) => Math.round(v / 32).toString(16)).join('');
}
