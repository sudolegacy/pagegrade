import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { currentUser } from '@/lib/server/session';
import { canReadFiles, reviewDir } from '@/lib/server/reviews';
import { checkPrintToken } from '@/lib/server/pdf';

export const dynamic = 'force-dynamic';
const ALLOWED = /^(desktop|mobile)-(hero|full|first)\.jpg$/;

/** Screenshots for a report: readable by the owner, or by anyone holding the share link. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; name: string }> }) {
  const { id, name } = await params;
  if (!ALLOWED.test(name) || !/^[A-Za-z0-9_-]{8,40}$/.test(id)) return new Response('Not found', { status: 404 });
  // Print tokens let the PDF renderer (a headless browser with no session) load screenshots for a few minutes.
  const pt = req.nextUrl.searchParams.get('pt');
  if (!(pt && checkPrintToken(id, pt))) {
    const user = await currentUser();
    if (!canReadFiles(id, { userId: user?.id, shareId: req.nextUrl.searchParams.get('s') })) return new Response('Not found', { status: 404 });
  }
  try {
    const data = await readFile(path.join(reviewDir(id), name));
    return new Response(new Uint8Array(data), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400', 'X-Robots-Tag': 'noindex' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
