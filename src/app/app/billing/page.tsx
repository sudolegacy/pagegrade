import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/session';
import { accountView } from '@/lib/server/account';
import { billingConfigured } from '@/lib/server/billing';
import { BillingPanel } from '@/components/app/billing-panel';

export const metadata: Metadata = { title: 'Plan & billing' };

export default async function BillingPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return (
    <div>
      <h1 className="text-[26px] font-semibold text-ink">Plan & billing</h1>
      <p className="mb-7 mt-1 text-[14.5px] text-zinc-600">Your allowance, plan and invoices.</p>
      <Suspense><BillingPanel account={accountView(user)} configured={billingConfigured()} /></Suspense>
    </div>
  );
}
