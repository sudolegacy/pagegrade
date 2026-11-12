import { handler } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { limitOrThrow } from '@/lib/server/auth-flows';
import { widgetLeadsCsv } from '@/lib/server/widget';

export const dynamic = 'force-dynamic';

/** Download the account's widget leads as a CSV, for a CRM or a spreadsheet. Allowed after a plan lapses too: the leads are theirs. */
export const GET = handler(async () => {
  const user = await requireApiUser();
  limitOrThrow(`export:user:${user.id}`, 30, 3600_000, 'You have downloaded a lot of exports in the last hour. Please try again shortly.');
  return new Response(widgetLeadsCsv(user.id), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pagegrade-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
