import { LOGO_FILE_RE, readLogo } from '@/lib/server/brand';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Public: agency logos appear on shared reports. File names are random, so they can be cached for good. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!LOGO_FILE_RE.test(file)) return new Response('Not found', { status: 404 });
  const data = await readLogo(file);
  if (!data) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
}
