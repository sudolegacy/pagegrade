'use client';
import { useMemo, useState, type ReactNode } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import {
  AlertTriangle, ArrowUpRight, Check, CheckCircle2, ChevronDown, ClipboardCopy, Gauge, Info, Lightbulb, MinusCircle, Monitor, Smartphone, XCircle, Zap,
} from 'lucide-react';
import type { Report, ReportIssue } from '@/lib/engine/report';
import type { AiReadiness } from '@/lib/engine/ai-readiness';
import { PAGE_TYPES, GOALS } from '@/lib/engine/catalog';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { GradeChip, Meter, ScoreRing, scoreTone, toneText } from '@/components/ui/score';
import { Tooltip } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { EvidenceCrop, PageMap } from './evidence';
import type { ReportAssets } from './assets';

export type { ReportAssets };


const SEVERITY: Record<ReportIssue['severity'], { label: string; tone: BadgeTone }> = {
  critical: { label: 'Critical', tone: 'red' },
  major: { label: 'Major', tone: 'amber' },
  minor: { label: 'Minor', tone: 'neutral' },
};

const SECTIONS = [
  { id: 'summary', label: 'Summary' },
  { id: 'fixes', label: 'Priority fixes' },
  { id: 'rewrites', label: 'Rewrites' },
  { id: 'strengths', label: 'What works' },
  { id: 'page', label: 'Page map' },
  { id: 'checks', label: 'All checks' },
  { id: 'speed', label: 'Speed' },
  { id: 'ai', label: 'AI search' },
  { id: 'details', label: 'About this review' },
];


/** `nav="app"` offsets the sticky section bar below the app's mobile header; `"page"` sticks to the top. */
export function ReportView({ report, assets, header, nav = 'app' }: { report: Report; assets: ReportAssets; header?: ReactNode; nav?: 'app' | 'page' }) {
  const sections = SECTIONS.filter((s) => (s.id !== 'rewrites' || report.rewrites) && (s.id !== 'speed' || report.performance) && (s.id !== 'ai' || report.aiReadiness) && (s.id !== 'strengths' || report.strengths.length));
  return (
    <div className="space-y-10 pb-16">
      {header}
      <nav aria-label="Report sections" className={cn('sticky z-30 -mx-4 overflow-x-auto border-b border-zinc-200/80 bg-canvas/90 px-4 backdrop-blur sm:-mx-8 sm:px-8', nav === 'app' ? 'top-14 lg:top-0' : 'top-0')}>
        <ul className="flex gap-1 py-2 text-[13px] font-medium text-zinc-600">
          {sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="block whitespace-nowrap rounded-md px-2.5 py-1.5 hover:bg-zinc-200/50 hover:text-ink">{s.label}</a></li>)}
        </ul>
      </nav>
      <Summary report={report} />
      <Fixes report={report} assets={assets} />
      {report.rewrites && <Rewrites rewrites={report.rewrites} facts={report.facts} />}
      {report.strengths.length > 0 && <Strengths report={report} />}
      <PageSection report={report} assets={assets} />
      <Checks report={report} />
      {report.performance && <Speed report={report} />}
      {report.aiReadiness && <AiSearch ai={report.aiReadiness} />}
      <Details report={report} />
    </div>
  );
}

function SectionTitle({ id, title, children, aside }: { id: string; title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div id={id} className="mb-4 flex scroll-mt-32 flex-wrap items-end justify-between gap-3 lg:scroll-mt-20">
      <div>
        <h2 className="text-[19px] font-semibold text-ink">{title}</h2>
        {children && <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-zinc-600">{children}</p>}
      </div>
      {aside}
    </div>
  );
}

// ------------------------------------------------------------------ summary

function Summary({ report }: { report: Report }) {
  const conf = report.confidence;
  const capped = report.caps.find((c) => c.applied);
  return (
    <section aria-labelledby="summary-title">
      <h2 id="summary" className="sr-only scroll-mt-32">Summary</h2>
      <div className="card overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
          <div className="p-6 sm:p-7">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <ScoreRing score={report.score} size={128} label="of 100" className="shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <GradeChip grade={report.grade} score={report.score} />
                  <Tooltip content={<>{conf.reasons.join(' ')}</>}>
                    <span className="inline-flex cursor-help items-center gap-1 text-[12.5px] font-medium text-zinc-500">
                      <span className={cn('size-1.5 rounded-full', conf.level === 'high' ? 'bg-brand-500' : conf.level === 'medium' ? 'bg-amber-500' : 'bg-red-500')} aria-hidden />
                      {conf.level === 'high' ? 'High' : conf.level === 'medium' ? 'Medium' : 'Low'} confidence
                    </span>
                  </Tooltip>
                </div>
                <p id="summary-title" className="mt-3 text-[19px] font-semibold leading-snug text-ink">{report.verdict}</p>
                <p className="mt-2.5 text-[15px] leading-relaxed text-zinc-600">{report.summary}</p>
                {capped && (
                  <p className="mt-3 inline-flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Score capped at {capped.max}: {capped.label.toLowerCase()}. Fix this first; the rest of the page cannot make up for it.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 grid gap-3 border-t border-zinc-100 pt-5 sm:grid-cols-2">
              <Read label="What a visitor takes away in five seconds" value={report.page.fiveSecond} />
              <Read label="Offer, as we read it" value={report.page.offer} />
              {report.page.mismatch && <Read label="Mismatch with your goal" value={report.page.mismatch} warn className="sm:col-span-2" />}
            </div>
          </div>
          <div className="border-t border-zinc-100 bg-zinc-50/60 p-6 sm:p-7 lg:border-l lg:border-t-0">
            <p className="mb-4 text-[13px] font-medium text-zinc-500">Score by category</p>
            <ul className="space-y-3.5">
              {report.categories.map((c) => (
                <li key={c.id}>
                  <Tooltip content={c.blurb}>
                    <div className="cursor-default">
                      <div className="mb-1.5 flex items-baseline justify-between text-[13.5px]">
                        <span className="font-medium text-zinc-800">{c.label}</span>
                        <span className={cn('tabular-nums font-semibold', c.score == null ? 'text-zinc-400' : toneText[scoreTone(c.score)])}>{c.score ?? '–'}<span className="ml-1 text-[11.5px] font-normal text-zinc-400">· {c.weight}%</span></span>
                      </div>
                      <Meter value={c.score} />
                    </div>
                  </Tooltip>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] leading-relaxed text-zinc-500">Percentages show how much each category counts towards the overall score for this page type.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Read({ label, value, warn, className }: { label: string; value: string; warn?: boolean; className?: string }) {
  if (!value) return null;
  return (
    <div className={cn('rounded-lg px-3.5 py-3', warn ? 'bg-amber-50 text-amber-950' : 'bg-zinc-50', className)}>
      <p className={cn('text-[12px] font-medium', warn ? 'text-amber-700' : 'text-zinc-500')}>{label}</p>
      <p className="mt-1 text-[14px] leading-relaxed">{value}</p>
    </div>
  );
}

// ------------------------------------------------------------------ fixes

function Fixes({ report, assets }: { report: Report; assets: ReportAssets }) {
  const gain = Math.round(report.issues.reduce((n, i) => n + i.potentialGain, 0));
  return (
    <section>
      <SectionTitle id="fixes" title={`Priority fixes (${report.issues.length})`} aside={gain > 0 ? <span className="text-[13px] text-zinc-500">Up to <strong className="font-semibold text-ink">+{Math.min(gain, 100 - report.score)}</strong> points available</span> : undefined}>
        Ordered by how much each change should help. Each fix links to the checks it improves and shows where on the page the problem is.
      </SectionTitle>
      {report.issues.length === 0 ? (
        <div className="card p-6 text-[14px] text-zinc-600">No significant problems found. See the full checks below for smaller refinements.</div>
      ) : (
        <ol className="space-y-4">{report.issues.map((issue, i) => <IssueCard key={issue.id} n={i + 1} issue={issue} report={report} assets={assets} />)}</ol>
      )}
    </section>
  );
}

function IssueCard({ n, issue, report, assets }: { n: number; issue: ReportIssue; report: Report; assets: ReportAssets }) {
  const sev = SEVERITY[issue.severity];
  const asset = issue.location ? assets[issue.location.profile] : null;
  const criteria = issue.criteria.map((id) => report.criteria.find((c) => c.id === id)).filter(Boolean) as Report['criteria'];
  const quickWin = issue.impact === 'high' && issue.effort === 'low';
  return (
    <li id={`fix-${n}`} className="card scroll-mt-32 overflow-hidden lg:scroll-mt-20">
      <div className="grid lg:grid-cols-[1fr_minmax(0,0.95fr)]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-ink text-[12px] font-semibold text-white">{n}</span>
            <Badge tone={sev.tone} dot>{sev.label}</Badge>
            {quickWin && <Badge tone="brand"><Zap className="size-3" aria-hidden />Quick win</Badge>}
            <span className="text-[12.5px] text-zinc-500">{cap(issue.impact)} impact · {cap(issue.effort)} effort</span>
            {issue.potentialGain >= 1 && <span className="ml-auto text-[12.5px] font-medium text-brand-700">up to +{Math.round(issue.potentialGain)} pts</span>}
          </div>
          <h3 className="mt-3 text-[17px] font-semibold leading-snug text-ink">{issue.title}</h3>
          <p className="mt-2 text-[14.5px] leading-relaxed text-zinc-600">{issue.problem}</p>
          <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50/50 p-4">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-800"><Lightbulb className="size-3.5" aria-hidden />What to do</p>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-zinc-800">{issue.recommendation}</p>
          </div>
          {issue.example && <ExampleBlock text={issue.example} />}
          {criteria.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {criteria.map((c) => <a key={c.id} href={`#check-${c.id}`} className="rounded-md bg-zinc-100 px-2 py-1 text-[12px] font-medium text-zinc-600 hover:bg-zinc-200 hover:text-ink">{c.label}</a>)}
            </div>
          )}
        </div>
        {asset && issue.location && (
          <div className="border-t border-zinc-100 bg-zinc-50/60 p-4 sm:p-5 lg:border-l lg:border-t-0">
            <EvidenceCrop asset={asset} box={issue.location.box} profile={issue.location.profile} label={`Where on the page: ${issue.title}`} />
          </div>
        )}
      </div>
    </li>
  );
}

function ExampleBlock({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-3.5 py-2">
        <span className="text-[12px] font-medium text-zinc-500">Example</span>
        <CopyButton text={text} />
      </div>
      <p className="whitespace-pre-line px-3.5 py-3 text-[14px] leading-relaxed text-zinc-800">{text}</p>
    </div>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-ink"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); toast('Copied to clipboard'); setTimeout(() => setDone(false), 1500); } catch { toast('Could not copy', 'error'); } }}>
      {done ? <Check className="size-3.5" aria-hidden /> : <ClipboardCopy className="size-3.5" aria-hidden />}{label}
    </button>
  );
}

// ------------------------------------------------------------------ rewrites & strengths

function Rewrites({ rewrites, facts }: { rewrites: NonNullable<Report['rewrites']>; facts: Report['facts'] }) {
  return (
    <section>
      <SectionTitle id="rewrites" title="Rewrites to test">Alternatives written for your goal and audience. Anything in [brackets] needs a real detail from you; we never invent facts, numbers or customers.</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <RewriteCard title="Headline" current={facts.headline} items={rewrites.headlines} />
        <RewriteCard title="Subheadline" current={facts.subheadline} items={rewrites.subheadline ? [rewrites.subheadline] : []} />
        <RewriteCard title="Main button" current={facts.primaryCta} items={rewrites.ctas} />
      </div>
    </section>
  );
}

function RewriteCard({ title, current, items }: { title: string; current: string | null; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="card flex flex-col p-5">
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      {current && <p className="mt-2 text-[13px] leading-relaxed text-zinc-500"><span className="font-medium text-zinc-400">Now: </span><span className="line-through decoration-zinc-300">{current}</span></p>}
      <ul className="mt-3 space-y-2">
        {items.map((t) => (
          <li key={t} className="group flex items-start justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2.5 text-[14px] leading-snug text-ink">
            <span>{t}</span>
            <span className="opacity-60 group-hover:opacity-100"><CopyButton text={t} label="" /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Strengths({ report }: { report: Report }) {
  return (
    <section>
      <SectionTitle id="strengths" title="What is already working">Keep these when you make changes.</SectionTitle>
      <ul className="grid gap-3 sm:grid-cols-2">
        {report.strengths.map((s) => (
          <li key={s.criterion + s.title} className="card flex gap-3 p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
            <div><p className="text-[14.5px] font-medium text-ink">{s.title}</p><p className="mt-1 text-[13.5px] leading-relaxed text-zinc-600">{s.detail}</p></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------ page map

function PageSection({ report, assets }: { report: Report; assets: ReportAssets }) {
  const [profile, setProfile] = useState<'desktop' | 'mobile'>('desktop');
  const asset = assets[profile];
  const markers = useMemo(() => report.issues.map((i, idx) => ({ n: idx + 1, issue: i })).filter((m) => m.issue.location?.profile === profile).map((m) => ({ n: m.n, box: m.issue.location!.box, title: m.issue.title })), [report.issues, profile]);
  const summary = report.capture[profile];
  return (
    <section>
      <SectionTitle id="page" title="Page map" aside={
        <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 shadow-card" role="tablist" aria-label="Device">
          {(['desktop', 'mobile'] as const).map((p) => (
            <button key={p} role="tab" aria-selected={profile === p} disabled={!assets[p]} onClick={() => setProfile(p)}
              className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition disabled:opacity-40', profile === p ? 'bg-ink text-white' : 'text-zinc-600 hover:text-ink')}>
              {p === 'desktop' ? <Monitor className="size-3.5" aria-hidden /> : <Smartphone className="size-3.5" aria-hidden />}{p === 'desktop' ? 'Desktop' : 'Mobile'}
            </button>
          ))}
        </div>
      }>
        The page exactly as we captured it{summary ? ` (${summary.viewport.width}px wide${summary.capturedHeight < summary.docHeight ? `, first ${summary.capturedHeight.toLocaleString('en-GB')}px of ${summary.docHeight.toLocaleString('en-GB')}px` : ''})` : ''}. Numbers match the priority fixes.
      </SectionTitle>
      {asset ? (
        <div className={cn('card mx-auto overflow-hidden', profile === 'mobile' ? 'max-w-[400px]' : '')}>
          <div className="max-h-[760px] overflow-y-auto overscroll-contain">
            <PageMap asset={asset} markers={markers} onSelect={(n) => document.getElementById(`fix-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
          </div>
        </div>
      ) : <div className="card p-6 text-[14px] text-zinc-500">No {profile} screenshot is available for this review.</div>}
    </section>
  );
}

// ------------------------------------------------------------------ checks

const STATUS = {
  pass: { icon: CheckCircle2, cls: 'text-brand-600', label: 'Pass' },
  warn: { icon: AlertTriangle, cls: 'text-amber-500', label: 'Needs work' },
  fail: { icon: XCircle, cls: 'text-red-500', label: 'Fail' },
  na: { icon: MinusCircle, cls: 'text-zinc-300', label: 'Not applicable' },
} as const;

const SOURCE: Record<string, string> = { ai: 'Expert judgement (AI, 3 passes)', dom: 'Measured on the page', hybrid: 'Judgement checked against measurements', lighthouse: 'Lighthouse lab test' };

function Checks({ report }: { report: Report }) {
  const counts = report.criteria.reduce((m, c) => ({ ...m, [c.status]: (m[c.status] ?? 0) + 1 }), {} as Record<string, number>);
  return (
    <section>
      <SectionTitle id="checks" title={`All ${report.criteria.length} checks`} aside={
        <div className="flex gap-3 text-[12.5px] text-zinc-500">
          {(['pass', 'warn', 'fail'] as const).map((s) => { const S = STATUS[s]; return <span key={s} className="inline-flex items-center gap-1"><S.icon className={cn('size-3.5', S.cls)} aria-hidden />{counts[s] ?? 0} {S.label.toLowerCase()}</span>; })}
        </div>
      }>Every check is rated 0–4 against a fixed rubric. Measured checks come straight from the page; judgement checks are rated independently three times and the median is used.</SectionTitle>
      <Accordion.Root type="multiple" className="space-y-3" defaultValue={[]}>
        {report.categories.map((cat) => {
          const items = report.criteria.filter((c) => c.category === cat.id);
          return (
            <Accordion.Item key={cat.id} value={cat.id} className="card overflow-hidden">
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-zinc-50/70">
                  <span className={cn('w-9 text-[17px] font-semibold tabular-nums', cat.score == null ? 'text-zinc-400' : toneText[scoreTone(cat.score)])}>{cat.score ?? '–'}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">{cat.label}</span><span className="block truncate text-[13px] text-zinc-500">{cat.blurb}</span></span>
                  <span className="hidden gap-1 sm:flex">{items.map((c) => { const S = STATUS[c.status]; return <S.icon key={c.id} className={cn('size-4', S.cls)} aria-label={`${c.label}: ${S.label}`} />; })}</span>
                  <ChevronDown className="size-4 text-zinc-400 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="border-t border-zinc-100">
                <ul className="divide-y divide-zinc-100">
                  {items.map((c) => { const S = STATUS[c.status]; return (
                    <li key={c.id} id={`check-${c.id}`} className="scroll-mt-32 px-5 py-4 lg:scroll-mt-20">
                      <div className="flex items-start gap-3">
                        <S.icon className={cn('mt-0.5 size-[18px] shrink-0', S.cls)} aria-label={S.label} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <p className="text-[14.5px] font-medium text-ink">{c.label}</p>
                            <p className="text-[12.5px] tabular-nums text-zinc-500">{c.rating == null ? 'Not rated' : <><span className="font-semibold text-zinc-700">{c.rating}</span>/4</>}<span className="mx-1.5 text-zinc-300">·</span>{SOURCE[c.source] ?? c.source}</p>
                          </div>
                          <p className="mt-1 text-[14px] leading-relaxed text-zinc-600">{c.evidence}</p>
                          {c.quote && <p className="mt-2 border-l-2 border-zinc-200 pl-3 text-[13.5px] italic text-zinc-500">“{c.quote}”</p>}
                          {c.adjusted && <p className="mt-2 text-[12.5px] text-zinc-500"><Info className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />Adjusted from {c.adjusted.from} to {c.rating}: {c.adjusted.reason}.</p>}
                          <details className="mt-2 text-[13px] text-zinc-500 [&_summary::-webkit-details-marker]:hidden">
                            <summary className="cursor-pointer select-none font-medium text-zinc-500 hover:text-zinc-800">Why this matters</summary>
                            <p className="mt-1.5 leading-relaxed">{c.why}</p>
                          </details>
                        </div>
                      </div>
                    </li>
                  ); })}
                </ul>
              </Accordion.Content>
            </Accordion.Item>
          );
        })}
      </Accordion.Root>
    </section>
  );
}

// ------------------------------------------------------------------ speed

function Speed({ report }: { report: Report }) {
  const p = report.performance!;
  const ms = (v: number | null) => (v == null ? '–' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
  const metric = (label: string, value: string, good: boolean | null, hint: string) => (
    <div className="rounded-lg bg-zinc-50 px-4 py-3">
      <p className="text-[12px] font-medium text-zinc-500">{label}</p>
      <p className={cn('mt-1 text-[20px] font-semibold tabular-nums tracking-tight', good == null ? 'text-ink' : good ? 'text-brand-700' : 'text-amber-700')}>{value}</p>
      <p className="mt-0.5 text-[11.5px] text-zinc-400">{hint}</p>
    </div>
  );
  return (
    <section>
      <SectionTitle id="speed" title="Speed & technical">
        {p.source === 'pagespeed' ? 'Measured with Google PageSpeed Insights on a simulated mid-range phone' : 'Measured with Lighthouse on a simulated mid-range phone with throttled network and CPU'}. Lab results vary between runs; treat them as a guide.
        {p.field ? ' Real-visitor data from the Chrome UX Report is shown where Google has enough traffic.' : ''}
      </SectionTitle>
      <div className="card p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['performance', 'accessibility', 'bestPractices', 'seo'] as const).map((k) => {
            const v = p.scores[k];
            return (
              <div key={k} className="flex items-center gap-3 rounded-lg border border-zinc-100 px-3 py-3">
                {v != null ? <ScoreRing score={v} size={48} stroke={5} /> : <Gauge className="size-8 text-zinc-300" aria-hidden />}
                <span className="text-[13px] font-medium text-zinc-700">{{ performance: 'Performance', accessibility: 'Accessibility', bestPractices: 'Best practices', seo: 'SEO' }[k]}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metric('Largest Contentful Paint', ms(p.metrics.lcpMs), p.metrics.lcpMs == null ? null : p.metrics.lcpMs <= 2500, 'Good: under 2.5 s')}
          {metric('First Contentful Paint', ms(p.metrics.fcpMs), p.metrics.fcpMs == null ? null : p.metrics.fcpMs <= 1800, 'Good: under 1.8 s')}
          {metric('Total Blocking Time', ms(p.metrics.tbtMs), p.metrics.tbtMs == null ? null : p.metrics.tbtMs <= 200, 'Good: under 200 ms')}
          {metric('Layout shift (CLS)', p.metrics.cls == null ? '–' : p.metrics.cls.toFixed(2), p.metrics.cls == null ? null : p.metrics.cls <= 0.1, 'Good: under 0.1')}
        </div>
        {p.field && (
          <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-3 text-[13.5px] text-sky-950">
            <span className="font-medium">Real visitors (last 28 days): </span>
            LCP {ms(p.field.lcpMs)} · CLS {p.field.cls?.toFixed(2) ?? '–'} · INP {ms(p.field.inpMs)}{p.field.category ? ` · overall ${p.field.category.toLowerCase()}` : ''}
          </div>
        )}
        {(p.opportunities.length > 0 || p.accessibilityFailures.length > 0) && (
          <div className="mt-5 grid gap-5 border-t border-zinc-100 pt-5 md:grid-cols-2">
            {p.opportunities.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-ink">Biggest speed opportunities</p>
                <ul className="mt-2 space-y-1.5 text-[13.5px] text-zinc-600">
                  {p.opportunities.slice(0, 6).map((o) => <li key={o.id} className="flex justify-between gap-3"><span>{o.title}</span><span className="shrink-0 tabular-nums text-zinc-400">{o.savingsMs ? `~${ms(o.savingsMs)}` : `${Math.round(o.savingsBytes / 1024)} KB`}</span></li>)}
                </ul>
              </div>
            )}
            {p.accessibilityFailures.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-ink">Accessibility issues found</p>
                <ul className="mt-2 space-y-1.5 text-[13.5px] text-zinc-600">
                  {p.accessibilityFailures.slice(0, 6).map((a) => <li key={a.id} className="flex justify-between gap-3"><span>{a.title}</span>{a.count > 1 && <span className="shrink-0 tabular-nums text-zinc-400">×{a.count}</span>}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ details

const AI_ROLE: Record<AiReadiness['crawlers'][number]['role'], string> = { search: 'Search', assistant: 'Assistant', training: 'Training' };

function AiSearch({ ai }: { ai: AiReadiness }) {
  const icon = {
    pass: <CheckCircle2 className="size-4 text-brand-600" aria-hidden />,
    warn: <AlertTriangle className="size-4 text-amber-500" aria-hidden />,
    fail: <XCircle className="size-4 text-red-500" aria-hidden />,
  };
  const robots = ai.robots === 'missing' ? ' (no robots.txt, so all are allowed)' : ai.robots === 'error' ? ' (robots.txt could not be read)' : '';
  return (
    <section>
      <SectionTitle id="ai" title={`AI search readiness (${ai.passed}/${ai.total})`}>
        Whether AI search tools such as ChatGPT search, Perplexity and Google's AI Overviews can reach and understand this page. This checks the page itself; it does not measure whether those tools currently mention your business.
      </SectionTitle>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ul className="card divide-y divide-zinc-100">
          {ai.checks.map((c) => (
            <li key={c.id} className="flex gap-3 p-4">
              <span className="mt-0.5 shrink-0">{icon[c.status]}</span>
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-ink">{c.label}</p>
                <p className="mt-0.5 text-[13.5px] leading-relaxed text-zinc-600">{c.detail}</p>
                {c.fix && c.status !== 'pass' && <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-800"><span className="font-medium">Fix: </span>{c.fix}</p>}
              </div>
            </li>
          ))}
        </ul>
        <div className="card self-start overflow-hidden">
          <p className="border-b border-zinc-100 px-4 py-3 text-[13.5px] font-semibold text-ink">AI crawlers{robots}</p>
          <table className="w-full text-left text-[13px]">
            <tbody className="divide-y divide-zinc-100">
              {ai.crawlers.map((c) => (
                <tr key={c.agent}>
                  <td className="px-4 py-2"><span className="font-medium text-ink">{c.agent}</span><span className="block text-[12px] text-zinc-500">{c.product}</span></td>
                  <td className="px-4 py-2 text-zinc-500">{AI_ROLE[c.role]}</td>
                  <td className="px-4 py-2 text-right">
                    <Badge tone={c.status === 'blocked' ? (c.role === 'training' ? 'neutral' : 'red') : c.status === 'allowed' ? 'brand' : 'neutral'}>{c.status === 'blocked' ? 'Blocked' : c.status === 'allowed' ? 'Allowed' : 'Unknown'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-zinc-100 px-4 py-3 text-[12.5px] leading-relaxed text-zinc-500">Blocking training crawlers is a fair choice. Blocking search and assistant crawlers keeps the page out of AI answers.</p>
        </div>
      </div>
    </section>
  );
}

function Details({ report }: { report: Report }) {
  const c = report.capture;
  const notes = c.issues;
  const intake = report.intake;
  return (
    <section>
      <SectionTitle id="details" title="About this review" />
      <div className="card grid gap-6 p-5 text-[13.5px] sm:p-6 md:grid-cols-2">
        <dl className="space-y-2.5">
          <Row k="Page" v={<a href={report.finalUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all font-medium text-ink hover:underline">{report.finalUrl}<ArrowUpRight className="size-3.5 shrink-0" aria-hidden /></a>} />
          <Row k="Page type" v={PAGE_TYPES[intake.pageType as keyof typeof PAGE_TYPES] ?? intake.pageType} />
          <Row k="Goal" v={GOALS[intake.goal as keyof typeof GOALS]?.label ?? intake.goal} />
          <Row k="Audience" v={intake.audience} />
          {intake.context && <Row k="Context" v={intake.context} />}
          <Row k="Reviewed" v={new Date(report.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })} />
        </dl>
        <dl className="space-y-2.5">
          <Row k="Capture" v={`${c.status === 'complete' ? 'Complete' : 'Partial'} (${c.completeness}% verified) · desktop ${c.desktop ? `${c.desktop.viewport.width}px` : '–'} · mobile ${c.mobile ? `${c.mobile.viewport.width}px` : '–'}`} />
          <Row k="Confidence" v={<>{cap(report.confidence.level)}. {report.confidence.reasons.join(' ')}</>} />
          <Row k="Method" v={`${report.criteria.filter((x) => x.source === 'dom' || x.source === 'lighthouse').length} measured checks, ${report.criteria.filter((x) => x.source === 'ai' || x.source === 'hybrid').length} judgement checks (${report.meta.evaluationRuns} independent passes, ${Math.round(report.meta.agreement * 100)}% agreement)`} />
          <Row k="Engine" v={`v${report.engineVersion} · ${Math.round(report.meta.durationMs / 1000)}s${report.meta.cached ? ' · unchanged page, analysis reused' : ''}`} />
          {notes.length > 0 && <Row k="Capture notes" v={<ul className="space-y-1">{notes.map((i) => <li key={i.code + i.message}>{i.message}</li>)}</ul>} />}
        </dl>
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="grid grid-cols-[110px_1fr] gap-3"><dt className="text-zinc-500">{k}</dt><dd className="min-w-0 text-zinc-800">{v}</dd></div>;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
