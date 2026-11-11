'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Meter } from '@/components/ui/score';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { PAID_PLANS, PLANS, priceFor, yearlySaving, type BillingInterval, type PlanId } from '@/lib/plans';
import type { AccountView } from '@/lib/server/account';
import { cn } from '@/lib/cn';
import { SITE } from '@/lib/site';

const date = (t: number | null) => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }) : '');

export function BillingPanel({ account: initial, configured }: { account: AccountView; configured: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [account, setAccount] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingInterval>(params.get('interval') === 'year' || (initial.plan.id !== 'free' && initial.billingInterval === 'year') ? 'year' : 'month');
  const synced = useRef(false);
  const checkout = params.get('checkout');
  const wanted = PAID_PLANS.find((p) => p.id === params.get('plan')) ?? null;

  useEffect(() => {
    if (synced.current) return;
    if (checkout === 'success' || params.get('portal')) {
      synced.current = true;
      setBusy('sync');
      api<AccountView>('/api/billing/sync', { body: { sessionId: params.get('session_id') } })
        .then((a) => { setAccount(a); if (checkout === 'success') toast(`You are on the ${a.plan.name} plan`); router.replace('/app/billing'); router.refresh(); })
        .catch((e) => setError((e as Error).message))
        .finally(() => setBusy(null));
    }
  }, [checkout, params, router, toast]);

  const go = async (key: string, path: string, body: unknown = {}) => {
    setBusy(key); setError(null);
    try { const { url } = await api<{ url: string }>(path, { body }); window.location.assign(url); }
    catch (e) { setError((e as Error).message); setBusy(null); }
  };

  const plan = PLANS[account.plan.id];
  const paid = plan.id !== 'free';
  const { usage } = account;
  const pct = usage.unlimited || !usage.limit ? 0 : (usage.used / usage.limit) * 100;

  return (
    <div className="space-y-8">
      {wanted && wanted.id !== account.plan.id && configured && checkout !== 'cancelled' && (
        <div className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[14.5px] font-semibold text-brand-950">Continue with the {wanted.name} plan</p>
            <p className="mt-0.5 text-[13.5px] text-brand-900/80">{cycle === 'year' ? `£${priceFor(wanted, 'year')} a year (2 months free)` : `£${wanted.priceGbp} a month`} for {wanted.reviews} reviews a month. You can change or cancel at any time.</p>
          </div>
          <Button onClick={() => go(wanted.id, '/api/billing/checkout', { plan: wanted.id, interval: cycle })} loading={busy === wanted.id} disabled={busy === 'sync'} className="shrink-0">Continue to checkout</Button>
        </div>
      )}
      {checkout === 'cancelled' && <Alert tone="info" title="Checkout cancelled">No payment was taken. You can choose a plan whenever you are ready.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {!configured && <Alert tone="warning" title="Billing is not available yet">Payments have not been set up on this server. Contact support if you need more reviews.</Alert>}
      {account.plan.status === 'past_due' && <Alert tone="warning" title="Your last payment failed">Update your payment method to keep your plan. Stripe will retry automatically.</Alert>}

      <section className="card grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[18px] font-semibold text-ink">{plan.name} plan</h2>
            {paid && <Badge tone={account.plan.status === 'past_due' ? 'amber' : account.plan.cancelAtPeriodEnd ? 'neutral' : 'brand'} dot>{account.plan.status === 'past_due' ? 'Payment failed' : account.plan.cancelAtPeriodEnd ? `Ends ${date(account.plan.periodEnd)}` : 'Active'}</Badge>}
          </div>
          <p className="mt-1 text-[14px] text-zinc-600">
            {paid ? <>£{priceFor(plan, account.billingInterval)} per {account.billingInterval === 'year' ? 'year' : 'month'} · {plan.reviews} reviews a month{account.plan.periodEnd && !account.plan.cancelAtPeriodEnd ? ` · renews ${date(account.plan.periodEnd)}` : ''}</> : <>{plan.reviews} reviews in total, free forever.</>}
          </p>
          {!usage.unlimited && (
            <div className="mt-4 max-w-md">
              <div className="mb-1.5 flex justify-between text-[13px]"><span className="text-zinc-600">{usage.used} of {usage.limit} used</span><span className="text-zinc-500">{usage.remaining} left{usage.resetsAt ? ` · resets ${date(usage.resetsAt)}` : ''}</span></div>
              <Meter value={pct} tone={pct >= 100 ? 'bad' : pct >= 80 ? 'ok' : 'good'} />
            </div>
          )}
          {usage.unlimited && <p className="mt-3 text-[13.5px] text-zinc-500">Admin account: reviews are not limited.</p>}
        </div>
        {account.hasBillingAccount && configured && (
          <Button variant="secondary" onClick={() => go('portal', '/api/billing/portal')} loading={busy === 'portal'}>Manage billing<ExternalLink className="size-3.5" aria-hidden /></Button>
        )}
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-ink">{paid ? 'Change plan' : 'Choose a plan'}</h2>
        <p className="mt-1 text-[14px] text-zinc-600">Pay monthly, or yearly and get 2 months free. Prices in GBP. Cancel any time; you keep your plan until the end of the period.{paid ? ' Changes are prorated.' : ''}</p>
        <div role="radiogroup" aria-label="Billing period" className="mt-3 inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-[13px] font-medium">
          {(['month', 'year'] as const).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)}
              className={cn('rounded-md px-3 py-1.5 transition-colors', cycle === c ? 'bg-ink text-white' : 'text-zinc-600 hover:text-ink')}>{c === 'month' ? 'Monthly' : 'Yearly · 2 months free'}</button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {PAID_PLANS.map((p) => {
            const current = p.id === plan.id && account.billingInterval === cycle;
            return (
              <div key={p.id} className={cn('card relative flex flex-col p-5', p.highlight && !current && 'ring-2 ring-brand-600/80', current && 'bg-zinc-50/60')}>
                {p.highlight && !current && <span className="absolute -top-2.5 left-5 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">Recommended</span>}
                <h3 className="text-[15px] font-semibold text-ink">{p.name}</h3>
                <p className="mt-2"><span className="text-[30px] font-semibold tracking-tight text-ink">£{priceFor(p, cycle)}</span><span className="text-[13.5px] text-zinc-500"> / {cycle === 'year' ? 'year' : 'month'}</span></p>
                {cycle === 'year' && <p className="text-[12.5px] font-medium text-brand-700">Save £{yearlySaving(p)} a year</p>}
                <p className="mt-1 text-[13.5px] text-zinc-600">{p.blurb}</p>
                <ul className="mt-4 flex-1 space-y-2 text-[13.5px] text-zinc-700">
                  {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />{f}</li>)}
                </ul>
                <Button className="mt-5 w-full" variant={current ? 'secondary' : p.highlight ? 'primary' : 'dark'} disabled={current || !configured || busy === 'sync'} loading={busy === p.id}
                  onClick={() => go(p.id, '/api/billing/checkout', { plan: p.id as PlanId, interval: cycle })}>
                  {current ? 'Current plan' : paid ? (p.id === plan.id ? `Switch to ${cycle === 'year' ? 'yearly' : 'monthly'}` : `Switch to ${p.name}`) : `Choose ${p.name}`}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[13px] text-zinc-500">Payments are handled securely by Stripe. Reviews that fail are never counted. Questions about billing? Email <a className="link" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.</p>
      </section>
    </div>
  );
}
