import type { Metadata } from 'next';
import { PricingTable } from '@/components/site/pricing-table';
import { Faq, faqJsonLd } from '@/components/site/faq';
import { CHECK_COUNT } from '@/lib/engine/catalog';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Start with 3 free landing page reviews. Paid plans from £9 a month add more reviews, with the full report on every plan. Cancel any time.',
  alternates: { canonical: '/pricing' },
};

const FAQ = [
  { q: 'What counts as a review?', a: `One page, reviewed once: desktop and mobile capture, all ${CHECK_COUNT} checks, the speed test, prioritised fixes and rewrites. Reviewing the same page again after you change it counts as a new review.` },
  { q: 'Do unused reviews roll over?', a: 'No. Monthly allowances reset at the start of each billing period. The 3 free reviews never expire.' },
  { q: 'What if a review fails?', a: 'It is not counted. That includes pages that are blocked, need a login or do not load.' },
  { q: 'Can I change plan or cancel?', a: 'Yes, at any time from the billing page in the app. Upgrades take effect straight away and the difference is prorated. If you cancel, you keep your plan until the end of the period you have paid for.' },
  { q: 'How do I pay?', a: 'By card through Stripe, billed monthly in pounds sterling. We never see or store your full card details. Invoices and receipts are available from the billing portal.' },
  { q: 'Do you offer annual or team plans?', a: `Not yet. If you need more than 100 reviews a month or invoicing by bank transfer, email ${SITE.supportEmail}.` },
];

export default function PricingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ)) }} />
      <section className="border-b border-zinc-200/70 py-16 sm:py-20">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Pricing</p>
            <h1 className="mt-2 text-balance text-[38px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[48px]">Simple plans. The full report on every one.</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-zinc-600">Start with 3 free reviews. Upgrade when you want to review every page you publish.</p>
          </div>
          <div className="mt-12"><PricingTable /></div>
        </div>
      </section>
      <section className="py-16 sm:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-ink">Billing questions</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-zinc-600">Something not covered here? Email <a className="link" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.</p>
          </div>
          <Faq items={FAQ} />
        </div>
      </section>
    </>
  );
}
