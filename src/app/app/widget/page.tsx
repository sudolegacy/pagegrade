import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser, isAdmin } from '@/lib/server/session';
import { env } from '@/lib/server/env';
import { brandFor } from '@/lib/server/brand';
import { WIDGET_DEFAULTS, WIDGET_TEXT_MAX, ensureWidget, listWidgetLeads, widgetLeadCounts, widgetLimit, widgetUsage } from '@/lib/server/widget';
import { LeadsTable, WidgetPanel, WidgetUpsell } from '@/components/app/widget-panel';

export const metadata: Metadata = { title: 'Lead widget' };
export const dynamic = 'force-dynamic';

export default async function WidgetPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const admin = isAdmin(user);
  const leads = listWidgetLeads(user.id);
  // Without the Agency plan: the pitch, plus any leads from before the plan changed (they are still the account's).
  if (!widgetLimit(user, { admin })) {
    return (
      <div className="space-y-6">
        <WidgetUpsell />
        {leads.length > 0 && <LeadsTable initial={leads} />}
      </div>
    );
  }
  const widget = ensureWidget(user.id);
  return (
    <WidgetPanel
      widget={widget} usage={widgetUsage(user, { admin })} counts={widgetLeadCounts(user.id)} leads={leads}
      appUrl={env.appUrl} branded={!!brandFor(user)} defaults={WIDGET_DEFAULTS} maxLengths={WIDGET_TEXT_MAX}
    />
  );
}
