import { handler, json, HttpError } from '@/lib/server/http';
import { widgetAuditView } from '@/lib/server/widget';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ widgetId: string; leadId: string }> };

/** Public, for the visitor's own browser only: the key from starting the audit is required. */
export const GET = handler<Ctx>(async (req, { params }) => {
  const { widgetId, leadId } = await params;
  const view = widgetAuditView(widgetId, leadId, req.headers.get('x-widget-key'));
  if (!view) throw new HttpError(404, 'This check was not found.', 'not_found');
  return json(view, { headers: { 'Cache-Control': 'no-store' } });
});
