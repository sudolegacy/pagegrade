import { env } from '@/lib/server/env';
import { loaderScript } from '@/lib/server/widget-embed';

export const dynamic = 'force-dynamic';

/** The two-line install snippet loads this from the agency's website. */
export function GET() {
  return new Response(loaderScript(env.appUrl), {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
  });
}
