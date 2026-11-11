import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser, isAdmin } from '@/lib/server/session';
import { entitledPlan, usageFor } from '@/lib/server/reviews';
import { listClients } from '@/lib/server/clients';
import { BULK_MAX } from '@/lib/plans';
import { PAGE_TYPES, GOALS } from '@/lib/engine/intake';
import { BulkForm } from '@/components/app/bulk-form';

export const metadata: Metadata = { title: 'Bulk review' };
export const dynamic = 'force-dynamic';

export default async function BulkPage({ searchParams }: { searchParams: Promise<{ client?: string | string[] }> }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { client } = await searchParams;
  const admin = isAdmin(user);
  const allowed = admin || !!entitledPlan(user).limits.bulk;
  const usage = usageFor(user, { admin });
  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Bulk review</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-zinc-500">Review several pages with the same goal and audience in one go, such as a new client's service pages. Each page uses one review, and they run side by side.</p>
      </header>
      <BulkForm allowed={allowed} max={BULK_MAX} remaining={usage.unlimited ? null : usage.remaining}
        pageTypes={Object.entries(PAGE_TYPES).map(([id, v]) => ({ id, label: v }))}
        goals={Object.entries(GOALS).map(([id, v]) => ({ id, label: v.label }))}
        clients={allowed ? listClients(user.id).map((c) => ({ id: c.id, name: c.name })) : []}
        initialClient={typeof client === 'string' ? client : undefined} />
    </div>
  );
}
