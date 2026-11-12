import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser, isAdmin } from '@/lib/server/session';
import { entitledPlan } from '@/lib/server/reviews';
import { listClients } from '@/lib/server/clients';
import { canBrand } from '@/lib/server/brand';
import { ClientsPanel } from '@/components/app/clients-panel';

export const metadata: Metadata = { title: 'Clients' };
export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const allowed = isAdmin(user) || !!entitledPlan(user).limits.clients;
  return <ClientsPanel initial={allowed ? listClients(user.id) : []} allowed={allowed} branding={allowed && canBrand(user)} />;
}
