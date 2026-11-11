import { Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { PLANS, type Plan } from '@/lib/plans';
import { cn } from '@/lib/cn';

function PlanCard({ plan }: { plan: Plan }) {
  const free = plan.priceGbp === 0;
  const href = free ? '/signup' : `/signup?next=${encodeURIComponent(`/app/billing?plan=${plan.id}`)}`;
  return (
    <div className={cn('card relative flex flex-col p-6', plan.highlight && 'ring-2 ring-brand-600/85')}>
      {plan.highlight && <span className="absolute -top-2.5 left-6 rounded-full bg-brand-600 px-2.5 py-0.5 text-[11.5px] font-semibold text-white">Recommended</span>}
      <h3 className="text-[16px] font-semibold text-ink">{plan.name}</h3>
      <p className="mt-1 min-h-10 text-[13.5px] leading-snug text-zinc-600">{plan.blurb}</p>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-[36px] font-semibold tracking-[-0.03em] text-ink">£{plan.priceGbp}</span>
        <span className="text-[13.5px] text-zinc-500">{free ? 'forever' : '/ month'}</span>
      </p>
      <p className="text-[13px] text-zinc-500">{free ? `${plan.reviews} reviews in total` : `${plan.reviews} reviews a month · about £${(plan.priceGbp / plan.reviews).toFixed(2)} each`}</p>
      {!free && plan.yearlyPriceGbp != null && <p className="mt-0.5 text-[12.5px] font-medium text-brand-700">or £{plan.yearlyPriceGbp} a year: 2 months free</p>}
      <ButtonLink href={href} variant={plan.highlight ? 'primary' : free ? 'secondary' : 'dark'} className="mt-5 w-full">{free ? 'Start free' : `Choose ${plan.name}`}</ButtonLink>
      <ul className="mt-6 space-y-2.5 border-t border-zinc-100 pt-5 text-[13.5px] text-zinc-700">
        {plan.features.map((f) => <li key={f} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />{f}</li>)}
      </ul>
    </div>
  );
}

export function PricingTable() {
  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Object.values(PLANS).map((p) => <PlanCard key={p.id} plan={p} />)}
      </div>
      <p className="mt-6 text-center text-[13.5px] text-zinc-500">Monthly plans, billed in GBP through Stripe. Change or cancel at any time. Reviews that fail are never counted.</p>
    </div>
  );
}
