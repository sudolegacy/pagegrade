import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, Check, Crosshair, FileText, Gauge, ListChecks, PackageCheck, PenLine, Send, Smartphone, X, type LucideIcon } from 'lucide-react';
import { PackRequestForm } from '@/components/site/pack-request-form';
import { ReportPreview } from '@/components/site/report-preview';
import { Faq, faqJsonLd } from '@/components/site/faq';
import { ButtonLink, buttonClass } from '@/components/ui/button';
import { CHECK_COUNT } from '@/lib/engine/catalog';
import { BULK_MAX, PLANS, yearlySaving } from '@/lib/plans';
import { env } from '@/lib/server/env';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'For agencies: three free branded audits',
  description: 'Get three free, ready-to-send audits of businesses you want to win, with your agency’s name and logo on them. Sent within one working day. No card needed.',
  alternates: { canonical: '/agencies' },
};

// Static page, regenerated hourly so the founding-price notice disappears by itself after its deadline.
export const revalidate = 3600;

/** Commercial terms that are not product constants. Change them here when the plan changes. */
const FOUNDING = { label: '31 January 2027', endsAt: Date.UTC(2027, 0, 31, 23, 59, 59) };
const FIRST_AGENCIES = 15;
const RAISED_PRICE_GBP = 149;

const agency = PLANS.agency;

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Crosshair, title: 'Tell us three prospects', body: 'Send the pages of three businesses you would like to win, with your agency’s name and website. Not sure who to pick? Leave them blank, tell us your niche and city, and we will choose three.' },
  { icon: PackageCheck, title: 'We send a branded pack', body: 'We review each page on desktop and mobile and put the results into three PDFs with your name and logo on them. You get them by email within one working day.' },
  { icon: Send, title: 'You send them and start the conversation', body: 'Email the audits to your prospects with a note of your own. Each one shows what is holding the page back and what to fix first, which gives you a reason to talk about the work.' },
];

const PACK: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Gauge, title: 'A score out of 100', body: `Each page is graded on ${CHECK_COUNT} checks across clarity, calls to action, trust, design, persuasion, mobile and speed.` },
  { icon: ListChecks, title: 'Fixes in priority order', body: 'Ranked by impact and effort. Each one points to the exact spot on the screenshot and quotes the page’s own words.' },
  { icon: Smartphone, title: 'Desktop and mobile screenshots', body: 'The page as a visitor sees it on a 1440px desktop and a 390px phone, so every problem is easy to show.' },
  { icon: PenLine, title: 'A rewritten headline and button', body: 'Example copy for the headline and main call to action, written for that business and its audience.' },
  { icon: Bot, title: 'AI search readiness', body: 'Whether AI search tools such as ChatGPT search can reach and read the page. It checks the page itself, not whether those tools mention the business.' },
  { icon: FileText, title: 'A PDF with your logo', body: 'Your agency’s name, logo and colour on every page, with PageGrade’s name hidden, so it reads as your work.' },
];

const INCLUDED = [
  `${agency.reviews} reviews a month, for prospects and for clients`,
  `Bulk reviews: up to ${BULK_MAX} pages in one go`,
  'Client folders that keep each client’s reviews and weekly checks together',
  `${agency.limits.monitors} pages re-checked every week, with email alerts`,
  `A lead widget for your own website: visitors check their page, you get the lead and the full report (${agency.limits.widget} checks a month, on top of your reviews)`,
  'Your name, logo and colour on shared reports and PDFs, plus an optional white label that hides PageGrade’s name',
  'Everything in Pro, including competitor checks and priority in the review queue',
];

const FOR_YOU = [
  'Agencies and freelancers with 1–20 people who do client work: web design and development, SEO and marketing.',
  'Teams that pitch for new work and want to open with evidence instead of opinion.',
  'Teams that keep clients by showing progress, month after month.',
];
const NOT_FOR_YOU = [
  'One-off audits. For a page or two now and then, the free grader is a better fit.',
  'Auditing your own agency website. The free pack is for businesses you want to win.',
  'Promising clients a conversion rate. A review shows what to fix first. It cannot see analytics or predict results.',
];

export default function AgenciesPage() {
  const bookingUrl = /^https?:\/\//i.test(env.bookingUrl) ? env.bookingUrl : '';
  const call = bookingUrl
    ? { href: bookingUrl, external: true }
    : { href: `mailto:${SITE.supportEmail}?subject=${encodeURIComponent('A 15-minute call about PageGrade for agencies')}`, external: false };
  const startHref = `/signup?next=${encodeURIComponent('/app/billing?plan=agency')}`;
  const foundingOpen = Date.now() <= FOUNDING.endsAt;

  const faq: { q: string; a: string; node?: ReactNode }[] = [
    { q: 'Do you audit my own website?', a: 'No. The free pack is for businesses you want to win as clients, so you have something useful to send them. You can always try the free grader on your own pages.' },
    { q: 'Can I put my logo on the audits?', a: 'Yes. Every audit in your pack carries your agency’s name and logo, and PageGrade’s name is hidden. On the Agency plan you can do the same for every report and PDF you share: your logo and colour, with an optional white label that hides PageGrade’s name.' },
    { q: 'Can I review many pages at once?', a: `Yes. Bulk review on the Agency plan takes up to ${BULK_MAX} pages in one go and files the results in a client folder.` },
    { q: 'Can I put the check on my own website?', a: `Yes. The Agency plan includes a lead widget: paste two lines into your site and visitors can check their own page in about a minute. They see their score and biggest problems in your colours; you get their name, email and the full report, so your follow-up opens with evidence. It includes ${agency.limits.widget} checks a month, separate from your reviews.` },
    { q: 'How accurate is it?', a: 'Some checks are measured directly from the page, such as text size, contrast and speed. Others, such as how clear the offer is, are judged by AI against written criteria, in three independent passes with the median taken. Every finding points to the spot on the screenshot and quotes the page’s own words, so you can check it yourself. It is a well-evidenced expert review, not a guarantee of results: PageGrade cannot see a business’s analytics or its visitors.' },
    { q: 'Which pages can you audit?', a: 'Any public web page. Pages behind a login cannot be reviewed, and a few sites block automated browsers. If one of your three cannot be done, we will let you know.' },
    { q: 'Do you contact the businesses on my list?', a: 'No. We use the addresses only to make your pack, and we send the audits to you, not to them.' },
    {
      q: 'What happens after the free pack?',
      a: `Nothing, unless you want it to. You send the audits to your prospects. If you would like to do the same every week, the Agency plan is £${agency.priceGbp} a month or £${agency.yearlyPriceGbp} a year, and you can book a 15-minute call to see how it works on your own prospects. There is no obligation.`,
      node: <>Nothing, unless you want it to. You send the audits to your prospects. If you would like to do the same every week, the Agency plan is £{agency.priceGbp} a month or £{agency.yearlyPriceGbp} a year, and you can <a className="link" href={call.href} {...(call.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>book a 15-minute call</a> to see how it works on your own prospects. There is no obligation.</>,
    },
    {
      q: 'Do you offer a money-back promise?',
      a: 'Please ask us. Our terms are on the terms page, and they cover refunds and cancellation.',
      node: <>Please ask us at <a className="link" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. Our terms are on the <Link className="link" href="/terms">terms page</Link>, and they cover refunds and cancellation.</>,
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faq)) }} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-200/70">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_0%,rgb(15_122_69/0.09),transparent_70%),radial-gradient(40%_40%_at_90%_10%,rgb(14_165_233/0.06),transparent_70%)]" />
        <div className="container-page relative grid items-center gap-14 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-[12.5px] font-medium text-zinc-600 shadow-card">
              <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />For agencies and freelancers
            </p>
            <h1 className="mt-6 text-balance text-[38px] font-semibold leading-[1.06] tracking-[-0.035em] text-ink sm:text-[48px]">
              Three free audits of businesses you want to win, with your logo on them
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-zinc-600 sm:text-[18px]">
              Tell us three businesses you would like as clients. Within one working day we send you three audits of their pages, ready to send, with your agency’s name and logo on every one. No card and nothing to sign.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="#request-pack" size="lg">Get my free pack<ArrowRight className="size-4" aria-hidden /></ButtonLink>
              <ButtonLink href="/sample" variant="secondary" size="lg">See a sample report</ButtonLink>
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] text-zinc-600">
              {['Free, with no card', 'Ready within one working day', 'Your name and logo, not ours'].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check className="size-4 text-brand-600" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <div className="mx-auto w-full max-w-[520px] lg:mr-0">
            <ReportPreview />
            <p className="mt-4 text-center text-[13.5px] leading-relaxed text-zinc-600">Your pack has three reports like this, as PDFs with <strong className="font-semibold text-ink">your</strong> agency’s name and logo.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-24">
        <div className="container-page">
          <SectionIntro eyebrow="How it works" title="From three names to three audits you can send">
            You choose the prospects. We do the reviewing and the branding. There is nothing to install and nothing to learn.
          </SectionIntro>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card relative p-6">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200/70"><s.icon className="size-5" aria-hidden /></span>
                  <span className="text-[13px] font-semibold tabular-nums text-zinc-300">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-[16.5px] font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-zinc-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What is in a pack */}
      <section className="border-y border-zinc-200/70 bg-white py-20 sm:py-24">
        <div className="container-page">
          <SectionIntro eyebrow="What is in a pack" title="Three full reports, ready to send">
            Each audit is a complete PageGrade report as a PDF, with your branding on it.
          </SectionIntro>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PACK.map((p) => (
              <li key={p.title} className="rounded-xl border border-zinc-200/80 bg-canvas/60 p-5">
                <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200/70"><p.icon className="size-[18px]" aria-hidden /></span>
                <h3 className="mt-4 text-[15.5px] font-semibold text-ink">{p.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-600">{p.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[14px] text-zinc-600">Want to see one first? <Link href="/sample" className="link">Open the sample report</Link>.</p>
        </div>
      </section>

      {/* Request form */}
      <section id="request-pack" className="scroll-mt-20 py-20 sm:py-24">
        <div className="container-page grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow">Free prospect pack</p>
            <h2 className="mt-2 text-balance text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[36px]">Tell us who you would like to win</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-zinc-600">Fill in the form and your three audits arrive by email within one working day. It takes about a minute.</p>
            <ul className="mt-6 space-y-3 text-[14.5px] text-zinc-700">
              {['Free, with no card and nothing to sign', 'Branded with your agency’s name and logo', 'We never contact the businesses on your list'].map((t) => (
                <li key={t} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <PackRequestForm bookingUrl={bookingUrl} supportEmail={SITE.supportEmail} />
        </div>
      </section>

      {/* The Agency plan and its price */}
      <section className="border-y border-zinc-200/70 bg-white py-20 sm:py-24">
        <div className="container-page grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <SectionIntro eyebrow="After the free pack" title="Do it for every prospect and every client">
              The pack shows the idea. The Agency plan lets you keep going, with your branding on everything you send.
            </SectionIntro>
            <ul className="mt-8 space-y-3.5">
              {INCLUDED.map((t) => (
                <li key={t} className="flex gap-2.5 text-[15px] leading-relaxed text-zinc-700"><Check className="mt-1 size-4 shrink-0 text-brand-600" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <div className="card p-6 sm:p-8">
            <p className="eyebrow">{agency.name} plan</p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-[44px] font-semibold leading-none tracking-[-0.03em] text-ink">£{agency.priceGbp}</span>
              <span className="text-[14px] text-zinc-500">a month</span>
            </p>
            <p className="mt-2 text-[14.5px] font-medium text-brand-700">or £{agency.yearlyPriceGbp} a year: two months free, a saving of £{yearlySaving(agency)}</p>
            {foundingOpen && (
              <p className="mt-5 rounded-lg border border-brand-200/70 bg-brand-50/60 px-4 py-3 text-[14px] leading-relaxed text-zinc-800">
                <strong className="font-semibold text-ink">Founding price.</strong> Start by {FOUNDING.label} and keep this price for life, for as long as your subscription stays active.
              </p>
            )}
            <p className="mt-4 text-[14px] leading-relaxed text-zinc-600">After the first {FIRST_AGENCIES} agencies, the price for new agencies rises to £{RAISED_PRICE_GBP} a month. Anyone already subscribed keeps their price.</p>
            <ButtonLink href={startHref} size="lg" className="mt-6 w-full">Start on Agency</ButtonLink>
            <p className="mt-3 text-center text-[12.5px] leading-relaxed text-zinc-500">Billed in pounds sterling through Stripe. Cancel at any time. Not sure yet? <a href="#request-pack" className="link">Get the free pack first</a>.</p>
          </div>
        </div>
      </section>

      {/* Who it is for */}
      <section className="py-20 sm:py-24">
        <div className="container-page">
          <SectionIntro eyebrow="Is it for you?" title="Built for small agencies that do client work">
            We would rather you know before you ask.
          </SectionIntro>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="card p-6 sm:p-7">
              <h3 className="text-[17px] font-semibold text-ink">Who it is for</h3>
              <ul className="mt-4 space-y-3">
                {FOR_YOU.map((t) => <li key={t} className="flex gap-2.5 text-[14.5px] leading-relaxed text-zinc-700"><Check className="mt-1 size-4 shrink-0 text-brand-600" aria-hidden />{t}</li>)}
              </ul>
            </div>
            <div className="card p-6 sm:p-7">
              <h3 className="text-[17px] font-semibold text-ink">Who it is not for</h3>
              <ul className="mt-4 space-y-3">
                {NOT_FOR_YOU.map((t) => <li key={t} className="flex gap-2.5 text-[14.5px] leading-relaxed text-zinc-700"><X className="mt-1 size-4 shrink-0 text-zinc-400" aria-hidden />{t}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-zinc-200/70 bg-white py-20 sm:py-24">
        <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow">Questions</p>
            <h2 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[36px]">Good questions to ask</h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-zinc-600">Anything else? Email <a href={`mailto:${SITE.supportEmail}`} className="link">{SITE.supportEmail}</a> and a person will reply.</p>
          </div>
          <Faq items={faq.map((f) => ({ q: f.q, a: f.node ?? f.a }))} />
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 pt-20 sm:px-8 sm:pb-24 sm:pt-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl bg-ink px-6 py-14 text-center sm:px-12 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgb(15_122_69/0.35),transparent_70%)]" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-[30px] font-semibold leading-tight tracking-[-0.025em] text-white sm:text-[38px]">Start with three free audits</h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-zinc-300">Tell us who you would like to win. Your pack arrives within one working day, with no card and nothing to sign.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="#request-pack" size="lg">Get my free pack<ArrowRight className="size-4" aria-hidden /></ButtonLink>
              <a href={call.href} className={buttonClass('secondary', 'lg')} {...(call.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                Book a 15-minute call{call.external && <span className="sr-only"> (opens in a new tab)</span>}
              </a>
            </div>
            <p className="mt-6 text-[14px] text-zinc-400">Already sure? <Link href={startHref} className="font-medium text-white underline decoration-zinc-500 underline-offset-4 hover:decoration-white">Start on Agency</Link></p>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-balance text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[36px]">{title}</h2>
      <p className="mt-4 text-pretty text-[16px] leading-relaxed text-zinc-600">{children}</p>
    </div>
  );
}
