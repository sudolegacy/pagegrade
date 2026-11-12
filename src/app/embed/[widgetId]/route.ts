import { randomBytes } from 'node:crypto';
import { env } from '@/lib/server/env';
import { brandFor } from '@/lib/server/brand';
import { publicWidget } from '@/lib/server/widget';
import { embedCsp, embedHeaders, embedHtml, frameAncestors, unavailableHtml } from '@/lib/server/widget-embed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The lead widget that agencies' websites show in an iframe (see /embed.js). It is
 * excluded from the site-wide headers in next.config.mjs, because those forbid framing;
 * its own CSP allows framing only by the sites the agency listed.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ widgetId: string }> }) {
  const { widgetId } = await params;
  const nonce = randomBytes(16).toString('base64');
  const https = env.appUrl.startsWith('https://');
  const found = publicWidget(widgetId);
  if (!found) return new Response(unavailableHtml(nonce), { status: 404, headers: embedHeaders(embedCsp(nonce, "'self' *", https)) });
  const brand = brandFor(found.owner);
  const html = embedHtml({
    widget: found.widget, nonce, appUrl: env.appUrl,
    brand: brand && { name: brand.name, color: brand.color, logoUrl: brand.logoUrl, whiteLabel: brand.whiteLabel },
  });
  return new Response(html, { headers: embedHeaders(embedCsp(nonce, frameAncestors(found.widget.allowedHosts), https)) });
}
