import { db, kv } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    db().prepare('SELECT 1').get();
    const hb = kv.get('worker:heartbeat');
    const worker = hb ? (JSON.parse(hb) as { at: number; active: number }) : null;
    const backup = kv.get('backup:last');
    return Response.json({
      ok: true,
      worker: worker ? { lastSeenSeconds: Math.round((Date.now() - worker.at) / 1000), active: worker.active } : null,
      lastBackup: backup ? (JSON.parse(backup) as { at: number }).at : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
