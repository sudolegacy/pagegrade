import { handler } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { limitOrThrow } from '@/lib/server/auth-flows';
import { reviewsCsv } from '@/lib/server/csv';
import type { ReviewStatus } from '@/lib/server/reviews';

export const dynamic = 'force-dynamic';

const STATUSES: ReviewStatus[] = ['queued', 'running', 'complete', 'failed'];

/** Download the caller's reviews as a CSV: one bulk batch, one client folder, or everything (same filters as the History page). */
export const GET = handler(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`export:user:${user.id}`, 30, 3600_000, 'You have downloaded a lot of exports in the last hour. Please try again shortly.');
  const params = req.nextUrl.searchParams;
  const { csv } = reviewsCsv(user.id, {
    batchId: params.get('batch') || undefined,
    clientId: params.get('client') || undefined,
    status: STATUSES.find((s) => s === params.get('status')),
    q: params.get('q') || undefined,
  });
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pagegrade-reviews-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
