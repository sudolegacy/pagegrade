import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/session';
import { listMonitors, monitorQuota } from '@/lib/server/monitors';
import { entitledPlan, listReviews } from '@/lib/server/reviews';
import { listClients } from '@/lib/server/clients';
import { MonitorsPanel } from '@/components/app/monitors-panel';

export const metadata: Metadata = { title: 'Monitoring' };
export const dynamic = 'force-dynamic';

export default async function MonitoringPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const monitors = listMonitors(user);
  const watched = new Set(monitors.map((m) => m.url));
  // Any finished review can start a monitor; it becomes the baseline for the weekly comparison.
  const options: { id: string; url: string; score: number | null; at: number }[] = [];
  for (const r of listReviews(user.id, { status: 'complete', limit: 100 })) {
    if (r.origin === 'monitor' || watched.has(r.url)) continue;
    watched.add(r.url);
    options.push({ id: r.id, url: r.url, score: r.score, at: r.createdAt });
  }
  const clients = entitledPlan(user).limits.clients ? listClients(user.id).map((c) => ({ id: c.id, name: c.name })) : [];
  return <MonitorsPanel initial={monitors} quota={monitorQuota(user)} options={options} clients={clients} />;
}
