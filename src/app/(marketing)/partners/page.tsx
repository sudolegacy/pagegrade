import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { env } from '@/lib/server/env';
import { PLANS } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Partner programme: earn commission on referrals',
  description: 'Agencies, freelancers and consultants earn a share of every payment from customers they refer to PageGrade.',
  alternates: { canonical: '/partners' },
};

export default function PartnersPage() {
  const pct = env.referralPercent;
  const months = env.referralMonths;
  const min = env.referralPayoutMinGbp;
  const agency = PLANS.agency.priceGbp;
  const example = Math.round((agency * 10 * pct) / 100);
  const steps = [
    { title: 'Get your link', body: 'Create a free account. Your personal link is on the Refer and earn page.' },
    { title: 'Share it', body: 'In proposals, newsletters, on your website, or alongside the reports you send clients.' },
    { title: 'Earn every month', body: `${pct}% of every payment each customer you refer makes in their first ${months} months.` },
  ];
  const terms = [
    `${pct}% commission on payments (excluding VAT) from customers who sign up within 60 days of clicking your link.`,
    `Commission is earned on each referred customer's payments for their first ${months} months.`,
    'Each commission is held for 30 days, in case of refunds, then becomes payable.',
    `We pay by bank transfer once you have £${min} or more ready. Email us when you would like to be paid.`,
    'You cannot refer yourself, and you may not bid on the PageGrade name in paid search.',
    'We may change or end the programme with 30 days notice. Commission you have already earned is still paid.',
  ];
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-14 sm:px-8 sm:py-20">
      <section className="max-w-2xl">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-brand-700">Partner programme</p>
        <h1 className="mt-3 text-[36px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[44px]">Earn {pct}% for {months} months on every customer you send us</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-zinc-600">For agencies, freelancers and consultants whose clients need landing pages that convert. Recommend PageGrade and get a share of what they pay.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/signup?next=/app/referrals" size="lg">Get your link</ButtonLink>
          <ButtonLink href="/pricing" variant="secondary" size="lg">See pricing</ButtonLink>
        </div>
      </section>
      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="card p-6">
            <p className="text-[13px] font-semibold text-brand-700">Step {i + 1}</p>
            <h2 className="mt-2 text-[17px] font-semibold text-ink">{s.title}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-zinc-600">{s.body}</p>
          </div>
        ))}
      </section>
      <section className="mt-16 grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-[22px] font-semibold text-ink">What it can be worth</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">If 10 businesses you refer each take the Agency plan at £{agency} a month, you earn about £{example} a month for {months} months, with no extra work once they are set up.</p>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">You can see every sign-up, payment and payout on your Refer and earn page.</p>
        </div>
        <div>
          <h2 className="text-[22px] font-semibold text-ink">The terms</h2>
          <ul className="mt-4 space-y-3">
            {terms.map((t) => <li key={t} className="flex gap-2.5 text-[14.5px] leading-relaxed text-zinc-700"><Check className="mt-1 size-4 shrink-0 text-brand-600" aria-hidden />{t}</li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}
