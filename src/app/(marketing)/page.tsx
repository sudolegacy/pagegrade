import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, Check, Crosshair, FileSearch, Gauge, LayoutTemplate, ListChecks, MessageSquareQuote, MousePointerClick, PenLine, ScanSearch, ShieldCheck, Smartphone, Sparkles,
} from 'lucide-react';
import { StartForm } from '@/components/app/start-form';
import { ButtonLink } from '@/components/ui/button';
import { ReportPreview } from '@/components/site/report-preview';
import { PricingTable } from '@/components/site/pricing-table';
import { Faq, faqJsonLd } from '@/components/site/faq';
import { EvidenceCrop } from '@/components/report/evidence';
import { CATEGORIES, CRITERIA } from '@/lib/engine/rubric';
import { CHECK_COUNT } from '@/lib/engine/catalog';
import { SAMPLE_ASSETS, SAMPLE_REPORT } from '@/content/sample';
import { BENCHMARK } from '@/content/benchmark';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: 'PageGrade: landing page reviews that show you what to fix' },
  description: SITE.description,
  alternates: { canonical: '/' },
};

const CATEGORY_ICONS = { clarity: Crosshair, cta: MousePointerClick, trust: ShieldCheck, design: LayoutTemplate, persuasion: MessageSquareQuote, mobile: Smartphone, technical: Gauge } as const;

const measured = CRITERIA.filter((c) => c.source === 'dom' || c.source === 'lighthouse').length;
const hybrid = CRITERIA.filter((c) => c.source === 'hybrid').length;
const judged = CRITERIA.filter((c) => c.source === 'ai').length;
const minutes = (s: number) => Math.max(1, Math.ceil(s / 60));

const FAQ = [
  { q: 'Which pages can PageGrade review?', a: 'Any publicly reachable web page: SaaS and product pages, service and agency pages, shop and product pages, lead generation pages and event sign-ups. It cannot review pages behind a login, and some sites block automated browsers. When that happens we tell you instead of guessing, and the review is not counted.' },
  { q: 'How long does a review take?', a: `In our latest benchmark, a complete review including the speed test took ${BENCHMARK.medianSeconds} seconds for a typical page, and none took longer than ${minutes(BENCHMARK.maxSeconds)} minutes. If other reviews are queued, yours starts as soon as a browser is free, and we can email you when it is ready.` },
  { q: 'How is the score worked out?', a: `Each of the ${CHECK_COUNT} checks is rated from 0 to 4. ${measured} are measured directly from the page, ${hybrid} combine measurements with AI judgement, and ${judged} are judged by AI against written criteria, in three independent passes with the median taken. Checks are weighted by how much they matter for your page type, and a few critical failures cap the score.` },
  { q: 'Is the score reliable?', a: `We test it. In our latest benchmark, ${BENCHMARK.pages} pages were each reviewed ${BENCHMARK.repeats} times; the largest difference between runs was ${BENCHMARK.maxSpread} points. It is still a review, not a guarantee: PageGrade cannot see your analytics or your visitors, so confirm big changes with real data.` },
  { q: 'Do failed reviews use up my allowance?', a: 'No. If a page cannot be loaded, is blocked or the review fails for any reason, it is not counted.' },
  { q: 'What happens to the pages I submit?', a: 'We store the screenshots and report in your account until you delete them. To produce the review, page text and screenshots are sent to OpenAI for analysis through their API. Delete a review, or your whole account, at any time from the app.' },
  { q: 'Can I share a report with my team or a client?', a: 'Yes. Each report can have a private link that anyone with the link can open without an account. You can turn the link off at any time.' },
  { q: 'Can I cancel my plan?', a: 'Yes, at any time from the billing page. You keep your plan until the end of the period you have paid for, and you will not be charged again.' },
];

export default function HomePage() {
  const r = SAMPLE_REPORT;
  const showcase = r.issues.filter((i) => i.location).slice(1, 3);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: SITE.name, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: SITE.url, offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' }, publisher: { '@type': 'Organization', name: SITE.company, email: SITE.supportEmail } }) }} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-200/70">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_0%,rgb(15_122_69/0.09),transparent_70%),radial-gradient(40%_40%_at_90%_10%,rgb(14_165_233/0.06),transparent_70%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(24_24_27/0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgb(24_24_27/0.035)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />
        <div className="container-page relative grid items-center gap-14 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-[12.5px] font-medium text-zinc-600 shadow-card">
              <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />Landing page reviews, backed by evidence
            </p>
            <h1 className="mt-6 text-balance text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[54px]">
              Find out what is stopping your landing page converting
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-zinc-600 sm:text-[18px]">
              PageGrade loads your page on desktop and mobile, runs {CHECK_COUNT} conversion checks and shows you, on your own screenshots, what to fix first and why.
            </p>
            <StartForm target="/grade" cta="Grade my page free" className="mt-8 max-w-xl" />
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] text-zinc-600">
              {['3 reviews free', 'No card needed', `Usually ready in ${minutes(BENCHMARK.maxSeconds)} minutes`].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check className="size-4 text-brand-600" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <ReportPreview className="mx-auto w-full max-w-[520px] lg:mr-0" />
        </div>
      </section>

      {/* What you get */}
      <section aria-label="What every report includes" className="border-b border-zinc-200/70 bg-white">
        <ul className="container-page grid grid-cols-2 gap-x-6 gap-y-5 py-8 text-[13.5px] font-medium text-zinc-700 sm:grid-cols-3 lg:grid-cols-6">
          {[
            [Gauge, 'Score out of 100'], [ListChecks, 'Fixes ranked by impact'], [ScanSearch, 'Evidence on your screenshots'],
            [PenLine, 'Rewrites you can test'], [Smartphone, 'Desktop and mobile'], [Sparkles, 'Speed and accessibility'],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Gauge;
            return <li key={label as string} className="flex items-center gap-2.5"><I className="size-[18px] shrink-0 text-brand-600" aria-hidden />{label as string}</li>;
          })}
        </ul>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-24">
        <div className="container-page">
          <SectionIntro eyebrow="How it works" title="A specialist’s review, in the time it takes to make a coffee">
            You tell us who the page is for and what it should achieve. We review it the way a conversion specialist would, and back every point with evidence from the page itself.
          </SectionIntro>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { icon: FileSearch, title: 'Tell us about the page', body: 'Paste the address, choose the page type and the action you want visitors to take, and describe your audience in a sentence.' },
              { icon: ScanSearch, title: 'We review it like a visitor', body: 'A real browser loads the page on a 1440px desktop and a 390px phone, dismisses cookie banners, loads lazy content, measures layout, contrast and tap targets, and runs a Lighthouse speed test.' },
              { icon: ListChecks, title: 'You get a plan, not a lecture', body: 'A score out of 100, fixes ranked by impact and effort, the exact spot on your screenshot for each one, and example copy to try.' },
            ].map((s, i) => (
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

      {/* Checks */}
      <section className="border-y border-zinc-200/70 bg-white py-20 sm:py-24">
        <div className="container-page">
          <SectionIntro eyebrow="What we check" title={`${CHECK_COUNT} checks, weighted by what matters most`}>
            Clarity and calls to action carry the most weight, because a visitor who does not understand the offer or cannot find the next step never reaches the rest. Weights adjust for your page type.
          </SectionIntro>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).map((id) => {
              const c = CATEGORIES[id];
              const Icon = CATEGORY_ICONS[id];
              const checks = CRITERIA.filter((x) => x.category === id);
              return (
                <div key={id} className="rounded-xl border border-zinc-200/80 bg-canvas/60 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2.5 text-[15.5px] font-semibold text-ink"><Icon className="size-[18px] text-brand-600" aria-hidden />{c.label}</h3>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[12px] font-medium tabular-nums text-zinc-600 ring-1 ring-inset ring-zinc-200">{Math.round(c.weight * 100)}% of score</span>
                  </div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-600">{c.blurb}</p>
                  <ul className="mt-4 space-y-1.5 text-[13.5px] text-zinc-700">
                    {checks.map((x) => <li key={x.id} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden />{x.label}</li>)}
                  </ul>
                </div>
              );
            })}
            <div className="flex flex-col justify-between rounded-xl bg-ink p-6 text-white lg:col-span-2">
              <div>
                <p className="text-[15.5px] font-semibold">Can AI assistants recommend you?</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-300">The clarity and trust checks above are also what ChatGPT and Google&rsquo;s AI rely on. Our free audit checklist covers the rest.</p>
              </div>
              <Link href="/blog/ai-visibility-audit" className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-white hover:text-brand-200">Read the AI visibility audit<ArrowRight className="size-4" aria-hidden /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* Evidence */}
      <section className="py-20 sm:py-24">
        <div className="container-page grid items-start gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow">Evidence, not opinions</p>
            <h2 className="mt-2 text-balance text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[36px]">Every fix points at the exact problem</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-zinc-600">Findings are pinned to the element on your screenshot, quote your own copy and explain why it matters to a visitor. Quotes are checked against the text captured from your page; anything we cannot find there is left out.</p>
            <ul className="mt-6 space-y-3 text-[14.5px] text-zinc-700">
              {['Ranked by the points you stand to gain', 'Impact and effort for every fix', 'Example copy in your voice, for your audience', 'Desktop and phone screenshots side by side'].map((t) => (
                <li key={t} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />{t}</li>
              ))}
            </ul>
            <ButtonLink href="/sample" variant="secondary" className="mt-8">Open the sample report<ArrowRight className="size-4" aria-hidden /></ButtonLink>
          </div>
          <div className="space-y-5">
            {showcase.map((issue, i) => {
              const asset = issue.location ? SAMPLE_ASSETS[issue.location.profile] : null;
              return (
                <article key={issue.id} className="card p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">{i + 2}</span>
                    <span className="font-medium text-zinc-500">{issue.impact === 'high' ? 'High impact' : issue.impact === 'medium' ? 'Medium impact' : 'Low impact'} · {issue.effort === 'low' ? 'Quick win' : issue.effort === 'medium' ? 'Moderate effort' : 'Bigger change'}</span>
                    {issue.potentialGain > 0 && <span className="ml-auto font-medium text-brand-700">Up to +{issue.potentialGain} points</span>}
                  </div>
                  <h3 className="mt-3 text-[17px] font-semibold text-ink">{issue.title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-zinc-600">{issue.problem}</p>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-zinc-800"><span className="font-semibold text-ink">What to do: </span>{issue.recommendation}</p>
                  {asset && issue.location && <div className="mt-4"><EvidenceCrop asset={asset} box={issue.location.box} profile={issue.location.profile} label={`Screenshot of the area this fix refers to: ${issue.title}`} /></div>}
                </article>
              );
            })}
            <p className="text-center text-[12.5px] text-zinc-500">Fixes 2 and 3 from the <Link href="/sample" className="link">sample report</Link>, shown exactly as the engine wrote them.</p>
          </div>
        </div>
      </section>

      {/* Method */}
      <section className="border-y border-zinc-200/70 bg-white py-20 sm:py-24">
        <div className="container-page">
          <SectionIntro eyebrow="How the score works" title="Measured where it can be, judged where it must be">
            We would rather show our working than ask you to trust a number. Here is what goes into every score, and what it cannot tell you.
          </SectionIntro>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <Stat value={`${measured}`} label="checks measured directly" body="Button positions, contrast, text size, tap targets, layout on a phone, page speed and search basics, read straight from the rendered page." />
            <Stat value={`${hybrid + judged}`} label="checks judged with AI" body={`Things like offer clarity and proof quality are rated against written criteria in three independent passes; the median counts. ${hybrid} of these also use measurements.`} />
            <Stat value={`≤${BENCHMARK.maxSpread}`} label="points of change between repeat runs" body={`In our latest benchmark, ${BENCHMARK.pages} pages (${BENCHMARK.testPages} purpose-built test pages and ${BENCHMARK.publicSites} public websites) were each reviewed ${BENCHMARK.repeats} times. The largest change in score was ${BENCHMARK.maxSpread} points.`} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200/80 bg-canvas/60 p-6">
              <h3 className="text-[15.5px] font-semibold text-ink">It separates strong pages from weak ones</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-zinc-600">We built test pages to be strong, average and weak. They scored <strong className="font-semibold text-ink">{BENCHMARK.testPageScores.strong}</strong>, <strong className="font-semibold text-ink">{BENCHMARK.testPageScores.mixed}</strong> and <strong className="font-semibold text-ink">{BENCHMARK.testPageScores.weak[0]}–{BENCHMARK.testPageScores.weak[1]}</strong>, and we re-run the benchmark whenever the engine changes.</p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-canvas/60 p-6">
              <h3 className="text-[15.5px] font-semibold text-ink">What it cannot do</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-zinc-600">PageGrade sees your page, not your analytics. It cannot know where your traffic comes from, watch real visitors or promise a conversion rate. Treat the report as a well-evidenced expert review, and confirm big changes with real data.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 py-20 sm:py-24">
        <div className="container-page">
          <SectionIntro eyebrow="Pricing" title="Start free. Upgrade when you are reviewing every page." center>
            Every plan includes the full report. Paid plans add more reviews each month.
          </SectionIntro>
          <div className="mt-12"><PricingTable /></div>
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
          <Faq items={FAQ} />
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:px-8 sm:pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl bg-ink px-6 py-14 text-center sm:px-12 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgb(15_122_69/0.35),transparent_70%)]" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-[30px] font-semibold leading-tight tracking-[-0.025em] text-white sm:text-[38px]">See your page the way a first-time visitor does</h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-zinc-300">Your first three reviews are free. No card, no sales call.</p>
            <StartForm target="/grade" cta="Grade my page free" dark className="mx-auto mt-8 max-w-xl" />
          </div>
        </div>
      </section>
    </>
  );
}

function SectionIntro({ eyebrow, title, children, center }: { eyebrow: string; title: string; children: React.ReactNode; center?: boolean }) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-balance text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[36px]">{title}</h2>
      <p className="mt-4 text-pretty text-[16px] leading-relaxed text-zinc-600">{children}</p>
    </div>
  );
}

function Stat({ value, label, body }: { value: string; label: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-canvas/60 p-6">
      <p className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-ink tabular-nums">{value}</p>
      <p className="mt-2 text-[14px] font-semibold text-zinc-800">{label}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">{body}</p>
    </div>
  );
}
