/**
 * Builds the public sample report from a real engine run on the fictional
 * "Brightline Digital" benchmark fixture (bench/fixtures/mixed-service.html).
 *
 *   npx tsx scripts/build-sample.ts [.data/bench/fx-mixed-service/report-1.json]
 *
 * Writes src/content/sample/report.json, copies the screenshots to
 * public/sample/ and publishes the fixture at public/demo/brightline-digital.html.
 */
import { copyFile, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const src = process.argv[2] || '.data/bench/fx-mixed-service/report-1.json';
const dir = path.dirname(src);
const raw = await readFile(src, 'utf8');
const report = JSON.parse(raw) as { url: string; capture: { desktop?: { files: Record<string, string> }; mobile?: { files: Record<string, string> } } };
const origin = report.url;
const tokenised = raw.split(origin).join('__DEMO_URL__');
await mkdir('src/content/sample', { recursive: true });
await writeFile('src/content/sample/report.json', JSON.stringify(JSON.parse(tokenised)));

await mkdir('public/sample', { recursive: true });
for (const p of [report.capture.desktop, report.capture.mobile]) {
  for (const f of Object.values(p?.files ?? {})) await copyFile(path.join(dir, f), path.join('public/sample', f));
}

let html = await readFile('bench/fixtures/mixed-service.html', 'utf8');
html = html
  .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">\n<!-- Fictional demo page used for the PageGrade sample report. Brightline Digital is not a real business. -->')
  .replace('<button class="btn" type="submit">Submit</button>', '<button class="btn" type="button">Submit</button>')
  .replace('</body>', '<p style="position:fixed;left:50%;bottom:12px;transform:translateX(-50%);margin:0;padding:6px 12px;border-radius:999px;background:#111;color:#fff;font:500 12px/1.4 system-ui,sans-serif;z-index:9999">Fictional demo page for the PageGrade sample report. Nothing here is real and the form does not send anything.</p>\n</body>');
await mkdir('public/demo', { recursive: true });
await writeFile('public/demo/brightline-digital.html', html);
console.log('sample built from', src, '(score', JSON.parse(raw).score + ')');
