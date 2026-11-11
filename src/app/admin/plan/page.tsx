import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Alert } from '@/components/ui/field';
import { Meter } from '@/components/ui/score';
import { CopyButton } from '@/components/app/copy-button';
import { LeadNote, LeadStatusSelect } from '@/components/app/lead-status-button';
import { cn } from '@/lib/cn';
import { hostPath } from '@/lib/format';
import { planMetrics, type CheckpointStatus, type ChecklistItem } from '@/lib/server/plan-metrics';
import { LEAD_STATUSES, listLeads, type Lead, type LeadKind } from '@/lib/server/leads';
import {
  ASSUMPTIONS, AUTOPILOT, BUDGET_EXCLUDED, BUDGET_LINES, BUDGET_TOTAL, CALL_AGENDA, CHANNELS, CHURN_CEILING, CONTENT_CALENDAR, COSTS, CUSTOMERS,
  DO_NOT, EMAIL_RULES, FIRST_WEEK, GOAL, INTERVIEW_QUESTIONS, KEY_DATES, MAILBOX, MIXES, MORE_MAILBOXES, MRR_CHECKPOINTS, OUTREACH_FOOTER,
  OUTREACH_TEMPLATES, OWNER_STEPS, PACK_RULE, PACK_STEPS, PASSES_TARGET, PLACEHOLDERS, PLAN_META, PLAN_SECTIONS, POSITIONING, PRICE_RISE_STEPS,
  PRICE_TABLE, PRICING_RULES, PROJECTION_NOTES, PROJECTIONS, PROSPECT_SOURCES, QUALIFICATION, REPLY_TEMPLATES, RETENTION, RISKS, ROADMAP,
  ROUTINE_DAILY, ROUTINE_NOTE, ROUTINE_WEEKLY, SAFEGUARDS, SALES_FLOW, SEND_LIMITS, STRATEGY_AVOID, STRATEGY_LATER, STRATEGY_NOW, TARGETS, TAX,
  WEEK_TWO_CHECK, WEEKLY_METRICS, WHO_DOES_WHAT, gbp, mailboxCeiling, planDate, sectionTitle, triggerStatus,
  type LiveNumbers, type MetricId, type PlanSectionId,
} from '@/content/business-plan';

export const metadata: Metadata = { title: 'Business plan' };
export const dynamic = 'force-dynamic';

const DAY = 86_400_000;
const dateTime = (t: number) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const usd = (n: number) => `$${n.toFixed(n < 10 ? 3 : 2)}`;
const pct = (n: number | null) => (n == null ? '—' : `${n}%`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const th = 'px-4 py-2.5 text-left text-[12px] font-medium text-zinc-500';
const td = 'px-4 py-2.5 align-top text-[13px] leading-relaxed text-zinc-700';

function Stat({ label, value, detail, tone, children }: { label: string; value: ReactNode; detail?: ReactNode; tone?: BadgeTone; children?: ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-[12.5px] font-medium text-zinc-500">{label}</p>
      <p className={cn('mt-1 text-[24px] font-semibold tabular-nums tracking-tight', tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : 'text-ink')}>{value}</p>
      {detail && <p className="mt-0.5 text-[12.5px] leading-snug text-zinc-500">{detail}</p>}
      {children}
    </div>
  );
}

function Section({ id, lede, count, children }: { id: PlanSectionId; lede?: ReactNode; count?: number; children: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-20">
      <h2 className="flex items-center gap-2 text-[18px] font-semibold text-ink">{sectionTitle(id)}{count != null && <span className="text-[13px] font-normal tabular-nums text-zinc-500">{count}</span>}</h2>
      {lede && <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-zinc-600">{lede}</p>}
      <div className="mt-4 space-y-6">{children}</div>
    </section>
  );
}

const Sub = ({ children }: { children: ReactNode }) => <h3 className="mb-2 text-[14px] font-semibold text-ink">{children}</h3>;
const P = ({ children, className }: { children: ReactNode; className?: string }) => <p className={cn('max-w-3xl text-[14px] leading-relaxed text-zinc-700', className)}>{children}</p>;
const Empty = ({ children }: { children: ReactNode }) => <p className="card px-4 py-6 text-center text-[13.5px] text-zinc-500">{children}</p>;

const Bullets = ({ items }: { items: ReactNode[] }) => (
  <ul className="max-w-3xl list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-zinc-700 marker:text-brand-500">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
);
const Steps = ({ items }: { items: ReactNode[] }) => (
  <ol className="max-w-3xl list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-zinc-700 marker:font-medium marker:text-zinc-500">{items.map((x, i) => <li key={i}>{x}</li>)}</ol>
);

function Callout({ title, tone = 'brand', children }: { title?: string; tone?: 'brand' | 'amber'; children: ReactNode }) {
  return (
    <div className={cn('max-w-3xl rounded-lg border px-4 py-3 text-[14px] leading-relaxed', tone === 'brand' ? 'border-brand-200/70 bg-brand-50/60 text-zinc-800' : 'border-amber-200 bg-amber-50 text-amber-900')}>
      {title && <p className="mb-0.5 text-[12.5px] font-semibold uppercase tracking-wide text-zinc-500">{title}</p>}
      {children}
    </div>
  );
}

function DefList({ items }: { items: { label: string; text: ReactNode }[] }) {
  return (
    <dl className="space-y-3">
      {items.map((x) => (
        <div key={x.label}>
          <dt className="text-[12.5px] font-medium text-zinc-500">{x.label}</dt>
          <dd className="mt-0.5 text-[14px] leading-relaxed text-zinc-700">{x.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function DataTable({ head, rows, minWidth = 'min-w-[560px]', right = [], highlight }: { head: string[]; rows: ReactNode[][]; minWidth?: string; right?: number[]; highlight?: number }) {
  return (
    <div className="card overflow-x-auto">
      <table className={cn('w-full', minWidth)}>
        <thead className="border-b border-zinc-100"><tr>{head.map((h, i) => <th key={i} className={cn(th, right.includes(i) && 'text-right')}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row, r) => (
            <tr key={r} className={r === highlight ? 'bg-brand-50/40' : undefined}>
              {row.map((cell, c) => <td key={c} className={cn(td, c === 0 && 'font-medium text-ink', right.includes(c) && 'text-right tabular-nums')}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="card">
      <summary className="cursor-pointer select-none px-4 py-3 text-[14px] font-medium text-ink marker:text-zinc-400">{title}</summary>
      <div className="space-y-3 border-t border-zinc-100 px-4 py-3">{children}</div>
    </details>
  );
}

function TemplateCard({ label, when, body }: { label: string; when?: string; body: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-ink">{label}</p>
          {when && <p className="text-[12.5px] text-zinc-500">{when}</p>}
        </div>
        <CopyButton value={body} />
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words bg-zinc-50/70 px-4 py-3 font-sans text-[13px] leading-relaxed text-zinc-800">{body}</pre>
    </div>
  );
}

const KIND: Record<LeadKind, { label: string; tone: BadgeTone }> = {
  pack: { label: 'Pack', tone: 'brand' }, call: { label: 'Call', tone: 'blue' }, partner: { label: 'Partner', tone: 'amber' }, other: { label: 'Other', tone: 'neutral' },
};
const STATUS_LABEL: Record<CheckpointStatus, { tone: BadgeTone; label: string }> = {
  ahead: { tone: 'brand', label: 'At the fast case' }, on_track: { tone: 'brand', label: 'At the base case' }, behind: { tone: 'amber', label: 'Below the base case' },
};

const webHref = (value: string): string | null => {
  const v = value.trim();
  if (!v) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
};
const EMAIL_RE = /^[^\s@<>"?&%]+@[^\s@<>"?&%]+$/;

function LeadRow({ lead }: { lead: Lead }) {
  const site = webHref(lead.website);
  return (
    <tr>
      <td className={cn(td, 'whitespace-nowrap tabular-nums')}>{dateTime(lead.createdAt)}</td>
      <td className={td}>
        <Badge tone={KIND[lead.kind].tone}>{KIND[lead.kind].label}</Badge>
        {lead.source && <span className="mt-1 block text-[12px] text-zinc-500">{lead.source}</span>}
      </td>
      <td className={td}>
        <span className="font-medium text-ink">{lead.name || lead.company || lead.email}</span>
        {lead.name && lead.company && <span className="block text-[12.5px] text-zinc-500">{lead.company}</span>}
        {EMAIL_RE.test(lead.email) ? <a href={`mailto:${lead.email}`} className="link block text-[12.5px]">{lead.email}</a> : <span className="block text-[12.5px]">{lead.email}</span>}
        {lead.message && <p className="mt-1 line-clamp-3 max-w-[260px] break-words text-[12.5px] leading-snug text-zinc-500" title={lead.message}>{lead.message}</p>}
      </td>
      <td className={td}>{site ? <a href={site} target="_blank" rel="noopener noreferrer" className="link">{hostPath(site)}</a> : lead.website || '—'}</td>
      <td className={td}>
        {lead.prospects.length === 0 ? '—' : (
          <ul className="space-y-0.5">{lead.prospects.map((p, i) => <li key={i} className="max-w-[200px] truncate" title={p}>{hostPath(p)}</li>)}</ul>
        )}
      </td>
      <td className={td}><LeadStatusSelect key={`${lead.id}:${lead.status}`} id={lead.id} status={lead.status} statuses={LEAD_STATUSES.map(({ id, label }) => ({ id, label }))} /></td>
      <td className={td}><LeadNote key={`${lead.id}:${lead.note}`} id={lead.id} note={lead.note} /></td>
    </tr>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const tone: BadgeTone = item.ok ? 'brand' : item.severity === 'required' ? 'red' : 'amber';
  return (
    <li className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="sm:w-24 sm:shrink-0"><Badge tone={tone} dot>{item.ok ? 'Ready' : item.severity === 'required' ? 'Fix first' : 'Advised'}</Badge></div>
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-ink">{item.label}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">{item.detail}</p>
      </div>
    </li>
  );
}

function Toc() {
  return (
    <nav aria-label="On this page" className="mb-6 xl:sticky xl:top-6 xl:mb-0 xl:max-h-[calc(100vh-3rem)] xl:self-start xl:overflow-y-auto">
      {(['Live numbers', 'The plan'] as const).map((group) => (
        <div key={group} className="mb-3">
          <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-zinc-400">{group}</p>
          <ul className="flex flex-wrap gap-1.5 xl:block xl:space-y-0.5">
            {PLAN_SECTIONS.filter((s) => s.group === group).map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-md bg-zinc-100 px-2 py-1 text-[12.5px] text-zinc-700 hover:bg-zinc-200/70 hover:text-ink xl:bg-transparent xl:hover:bg-zinc-100">{s.title}</a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function BusinessPlanPage() {
  const m = planMetrics();
  const leads = listLeads({ open: true, limit: 100 });
  const live: LiveNumbers = { mrr: m.mrr, customers: m.payingCustomers, agencies: m.agencies.count, at: m.at };
  const next = m.nextCheckpoint;
  const last = m.lastCheckpoint;
  const nextBadge = next && (next.status === 'behind' ? { tone: 'neutral' as BadgeTone, label: `${gbp(next.gapToBase)} to the base case` } : STATUS_LABEL[next.status]);
  const closed = m.leads.total - m.leads.open;
  const lost = Math.max(0, closed - m.leads.won);
  const spendRatio = m.ai.capUsd > 0 ? m.ai.spendTodayUsd / m.ai.capUsd : 0;
  const cohortTone: BadgeTone | undefined = m.signupToPaid.cohort >= 20 && (m.signupToPaid.pct ?? 0) < TARGETS.signupToPaidPct ? 'amber' : undefined;
  const churnPct = m.churn.monthlyPct;
  const churnTone: BadgeTone | undefined = churnPct == null ? undefined : churnPct >= TARGETS.churnAlarmPct ? 'red' : churnPct >= TARGETS.churnPct ? 'amber' : undefined;

  const metricNow = (id: MetricId): { text: string; tone?: 'good' | 'warn' } => {
    switch (id) {
      case 'pack-requests': return { text: `${m.leads.packs7} this week · ${m.leads.packs30} in 30 days (needs your prospect count for the rate)` };
      case 'pack-conversion': return m.leads.packToCustomerPct == null ? { text: 'No packs sent yet' }
        : { text: `${m.leads.packToCustomerPct}% (${m.leads.packsWon} of ${m.leads.packsSent})`, tone: m.leads.packToCustomerPct >= TARGETS.packToCustomerPct ? 'good' : 'warn' };
      case 'signup-paid': return m.signupToPaid.pct == null ? { text: 'No sign-ups older than 60 days yet' }
        : { text: `${m.signupToPaid.pct}% (${m.signupToPaid.paid} of ${m.signupToPaid.cohort})`, tone: m.signupToPaid.pct >= TARGETS.signupToPaidPct ? 'good' : 'warn' };
      case 'churn': return churnPct == null ? { text: 'No customers yet' }
        : { text: `${churnPct}% (${plural(m.churn.cancelled30, 'cancellation')} in 30 days)`, tone: churnPct < TARGETS.churnPct ? 'good' : 'warn' };
      case 'ai-spend': return { text: `${usd(m.ai.spendTodayUsd)} of ${usd(m.ai.capUsd)} today`, tone: spendRatio >= 0.8 ? 'warn' : 'good' };
      default: return { text: 'Autopilot dashboard' };
    }
  };

  return (
    <div id="top">
      <header className="mb-6">
        <p className="eyebrow">{PLAN_META.version} · {PLAN_META.date}</p>
        <h1 className="mt-1 text-[26px] font-semibold text-ink">Business plan</h1>
        <p className="mt-1.5 max-w-3xl text-[14.5px] leading-relaxed text-zinc-600">{PLAN_META.disclaimer}</p>
        <p className="mt-1.5 text-[12.5px] text-zinc-500">Live numbers as of {dateTime(m.at)} (UK time). Refresh the page to update. MRR is at list price.</p>
      </header>

      <div className="xl:grid xl:grid-cols-[11.5rem_minmax(0,1fr)] xl:gap-10">
        <Toc />
        <div className="min-w-0">
          <section id="scoreboard" className="scroll-mt-20">
            <h2 className="sr-only">{sectionTitle('scoreboard')}</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label={`MRR against ${gbp(m.progress.targetMrr)}`} value={gbp(m.mrr)} detail={`${m.progress.pct}% of the goal · ${gbp(m.progress.remaining)} to go`}>
                <Meter className="mt-2.5" value={m.mrr > 0 ? m.progress.pct : null} tone="good" />
              </Stat>
              <Stat label="Paying customers" value={m.payingCustomers}
                detail={m.byPlan.map((p) => `${p.name} ${p.count}`).join(' · ') + (m.pastDue ? ` · ${m.pastDue} past due` : '')} tone={m.pastDue ? 'amber' : undefined} />
              <Stat label={`Agencies to the ${gbp(TARGETS.newAgencyPriceGbp)} price`} value={`${m.agencies.count} of ${m.agencies.priceRiseAt}`}
                detail={m.agencies.untilPriceRise > 0 ? `${m.agencies.untilPriceRise} to go, then Agency rises for new customers` : `Time to raise Agency to ${gbp(TARGETS.newAgencyPriceGbp)} for new customers`}>
                <Meter className="mt-2.5" value={m.agencies.count > 0 ? (m.agencies.count / m.agencies.priceRiseAt) * 100 : null} tone="good" />
              </Stat>
              {next ? (
                <Stat label="Next checkpoint" value={planDate(next.at)} detail={`${next.label} · in ${plural(next.days, 'day')} · base ${gbp(next.baseMrr)} · fast ${gbp(next.fastMrr)}`}>
                  {nextBadge && <div className="mt-2"><Badge tone={nextBadge.tone} dot>{nextBadge.label}</Badge></div>}
                </Stat>
              ) : <Stat label="Next checkpoint" value="None left" detail="Every dated checkpoint has passed." />}
              <Stat label="Monthly churn" value={pct(churnPct)} tone={churnTone}
                detail={churnPct == null ? `No customers yet · target under ${TARGETS.churnPct}%` : `${plural(m.churn.cancelled30, 'cancellation')} in 30 days · target under ${TARGETS.churnPct}%${m.churn.scheduled ? ` · ${m.churn.scheduled} set to cancel` : ''}`} />
              <Stat label="Sign-ups who now pay" value={pct(m.signupToPaid.pct)} tone={cohortTone}
                detail={m.signupToPaid.cohort === 0 ? `No sign-ups older than 60 days yet · target ${TARGETS.signupToPaidPct}%+` : `${m.signupToPaid.paid} of ${m.signupToPaid.cohort} sign-ups older than 60 days · target ${TARGETS.signupToPaidPct}%+`} />
              <Stat label="Pack requests (7 days)" value={m.leads.packs7} detail={`${m.leads.packs30} in 30 days · ${m.leads.open} open · ${m.leads.won} won`} />
              <Stat label="AI spend today (UTC)" value={usd(m.ai.spendTodayUsd)} tone={spendRatio >= 1 ? 'red' : spendRatio >= 0.8 || m.ai.capTooHigh ? 'amber' : undefined}
                detail={`Cap ${usd(m.ai.capUsd)}${m.ai.capTooHigh ? ` · plan says ${usd(m.ai.recommendedCapUsd)}` : ''}`} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[12.5px] text-zinc-600">
              <span className="rounded-md bg-zinc-100 px-2 py-1 tabular-nums">Free grades (7 days) <b className="font-semibold text-ink">{m.grader.grades7}</b></span>
              <span className="rounded-md bg-zinc-100 px-2 py-1 tabular-nums">Unlocked by sign-ups <b className="font-semibold text-ink">{m.grader.claimed7}</b></span>
              <span className="rounded-md bg-zinc-100 px-2 py-1 tabular-nums">Cancellation reasons (30 days) <b className="font-semibold text-ink">{m.churn.reasons30}</b></span>
              <span className="rounded-md bg-zinc-100 px-2 py-1 tabular-nums">Launch checks ready <b className="font-semibold text-ink">{m.launch.ready}/{m.launch.items.length}</b></span>
            </div>
            {last && (
              <Alert className="mt-3" tone={last.status === 'behind' ? 'warning' : 'success'}
                title={last.status === 'behind' ? `Behind at the ${last.label} checkpoint (${planDate(last.at)})` : `${STATUS_LABEL[last.status].label} at the ${last.label} checkpoint (${planDate(last.at)})`}>
                MRR is {gbp(m.mrr)} against a base case of {gbp(last.baseMrr)} and a fast case of {gbp(last.fastMrr)}. {last.status === 'behind' ? last.ifBehind : last.decision ? last.ifBehind : null}
              </Alert>
            )}
          </section>

          <Section id="launch" lede="Computed from this server's configuration. It shows whether things are set, never what they are set to.">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={m.launch.blocking ? 'red' : 'brand'} dot>{m.launch.blocking ? `${plural(m.launch.blocking, 'thing')} to fix before taking payments` : 'Nothing blocking launch'}</Badge>
              <span className="text-[13px] text-zinc-500">{m.launch.ready} of {m.launch.items.length} ready. Red items block launch; amber items are advised.</span>
            </div>
            <ul className="card divide-y divide-zinc-100">{m.launch.items.map((item) => <ChecklistRow key={item.id} item={item} />)}</ul>
          </Section>

          <Section id="pipeline" count={leads.length} lede="Agencies and others who asked for a pack, a call or a partner link through the site. Replies to Autopilot emails stay in Gmail and the Autopilot dashboard.">
            {leads.length === 0 ? <Empty>No open requests. Requests from the agencies page appear here and email you.</Empty> : (
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead className="border-b border-zinc-100">
                    <tr><th className={th}>When</th><th className={th}>Request</th><th className={th}>Contact</th><th className={th}>Website</th><th className={th}>Prospects</th><th className={th}>Status</th><th className={th}>Note</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">{leads.map((lead) => <LeadRow key={lead.id} lead={lead} />)}</tbody>
                </table>
              </div>
            )}
            <p className="text-[13px] text-zinc-500">
              {m.leads.open} open · {m.leads.won} became customers · {lost} not now · {m.leads.total} in total.
              {m.leads.packsSent > 0 && <> Packs that became customers: {pct(m.leads.packToCustomerPct)} ({m.leads.packsWon} of {m.leads.packsSent}).</>} Aim to send each pack within 24 hours (see Sales workflow).
            </p>
          </Section>

          <Section id="goal" lede={GOAL.summary}>
            <Callout title="The goal">{GOAL.headline}</Callout>
            <div>
              <Sub>When it could happen</Sub>
              <DataTable head={['Case', 'Passes £10,000 MRR', 'What has to be true']} minWidth="min-w-[640px]"
                rows={GOAL.timeline.map((t) => [t.scenario, t.passes, t.needs])} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div><Sub>At a glance</Sub><DefList items={GOAL.atAGlance} /></div>
              <div><Sub>Where PageGrade starts</Sub><DefList items={GOAL.start} /></div>
            </div>
            <div>
              <Sub>Key dates</Sub>
              <DataTable head={['When', 'What']} rows={KEY_DATES.map((d) => [d.when, d.what])} highlight={KEY_DATES.findIndex((d) => d.at != null && d.at > m.at)} />
            </div>
            <div><Sub>What changed in version 2</Sub><Bullets items={GOAL.changedInV2} /></div>
          </Section>

          <Section id="positioning" lede="What PageGrade is, who it is for, and the exact words to use.">
            <Callout title="Positioning statement">{POSITIONING.statement}</Callout>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="card p-4"><Badge tone="brand" dot>Say</Badge><p className="mt-2 text-[14px] leading-relaxed text-zinc-700">{POSITIONING.aiSay}</p></div>
              <div className="card p-4"><Badge tone="red" dot>Do not say</Badge><p className="mt-2 text-[14px] leading-relaxed text-zinc-700">{POSITIONING.aiDoNotSay}</p></div>
            </div>
            <div><Sub>When someone says {POSITIONING.chatgpt.question}</Sub><P>{POSITIONING.chatgpt.answer}</P></div>
            <div><Sub>Why agencies' own sites are not reviewed</Sub><P>{POSITIONING.whyNoOwnSiteAudits}</P></div>
            <div><Sub>Claims</Sub><Bullets items={POSITIONING.claims} /></div>
          </Section>

          <Section id="customers" lede="Agencies are the main market, business owners the second, and partners send both.">
            <div className="grid gap-3 lg:grid-cols-3">
              {CUSTOMERS.map((c) => (
                <div key={c.id} className="card p-4">
                  <Badge tone={c.id === 'agencies' ? 'brand' : 'neutral'}>{c.role}</Badge>
                  <h3 className="mt-2 text-[16px] font-semibold text-ink">{c.name}</h3>
                  <div className="mt-3">
                    <DefList items={[{ label: 'Who', text: c.who }, { label: 'Why they pay', text: c.why }, { label: 'The offer', text: c.offer }, { label: 'The path', text: c.path }]} />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="pricing" lede="Prices live in src/lib/plans.ts, and this table reads from it.">
            <DataTable head={['Plan', 'Monthly', 'Yearly', 'Includes']} minWidth="min-w-[640px]" right={[1, 2]} rows={PRICE_TABLE.map((r) => [r.plan, r.monthly, r.yearly, r.includes])} />
            <DefList items={PRICING_RULES.map((r) => ({ label: r.title, text: r.text }))} />
            <div><Sub>How to raise the Agency price</Sub><Steps items={PRICE_RISE_STEPS} /></div>
          </Section>

          <Section id="budget" lede="Start-up cost, what the estimate leaves out, and the settings that stop a small budget being overspent.">
            <DataTable head={['Item', 'Cost', 'Notes']} minWidth="min-w-[600px]"
              rows={[...BUDGET_LINES.map((l) => [l.item, l.cost, l.note]), [<b key="t">Total</b>, <b key="c">{BUDGET_TOTAL.cost}</b>, BUDGET_TOTAL.note]]} />
            <div><Sub>Not in the £20</Sub><DataTable head={['Cost', 'Notes']} minWidth="min-w-[560px]" rows={BUDGET_EXCLUDED.map((x) => [x.item, x.note])} /></div>
            <div>
              <Sub>Settings that protect the budget</Sub>
              <DataTable head={['Setting', 'Plan value', 'Usual default', 'Why']} minWidth="min-w-[760px]" rows={SAFEGUARDS.map((s) => [<code key={s.setting} className="text-[12px]">{s.setting}</code>, s.value, s.usual || '—', s.why])} />
              <p className="mt-2 text-[13px] text-zinc-500">
                Right now: AI cap {usd(m.ai.capUsd)} a day (plan {usd(m.ai.recommendedCapUsd)}) and {m.ai.graderDailyLimit} free grades a day (plan {TARGETS.graderDailyLimit}).
                {(m.ai.capTooHigh || m.ai.graderLimitTooHigh) && <span className="font-medium text-amber-700"> Lower them before launch: see the launch checklist.</span>}
              </p>
            </div>
          </Section>

          <Section id="economics" lede="What each customer costs, what £10k a month is made of, and why cancellations matter as much as sales.">
            <Bullets items={COSTS} />
            <div><Sub>Tax</Sub><Bullets items={TAX} /></div>
            <div>
              <Sub>What £10k a month looks like</Sub>
              <DataTable head={['Mix', 'Customers', 'MRR']} minWidth="min-w-[480px]" right={[1, 2]} rows={MIXES.map((x) => [x.label, x.customers, gbp(x.mrr)])} />
              <P className="mt-3">{CHURN_CEILING}</P>
            </div>
            <div>
              <Sub>What one mailbox produces</Sub>
              <P className="mb-3">{MAILBOX.intro}</P>
              <DataTable head={['One mailbox, per month', 'Slow', 'Base', 'Fast']} minWidth="min-w-[640px]" rows={MAILBOX.rows.map((r) => [r.label, r.slow, r.base, r.fast])} />
              <P className="mt-3">{MAILBOX.note}</P>
              <P className="mt-2">On its own, one mailbox levels off at about {gbp(mailboxCeiling('slow'))} (slow), {gbp(mailboxCeiling('base'))} (base) and {gbp(mailboxCeiling('fast'))} (fast) of MRR: new MRR a month divided by the monthly cancellation rate, and it gets there slowly.</P>
            </div>
          </Section>

          <Section id="projections" lede="Three scenarios with every assumption shown. Nobody knows these rates before the first 200 prospects.">
            <DataTable head={['MRR at the end of', 'Slow', 'Base', 'Fast']} minWidth="min-w-[560px]" right={[1, 2, 3]}
              rows={[...PROJECTIONS.map((p) => [`Month ${p.month} · ${p.endsIn}`, gbp(p.slow), gbp(p.base), gbp(p.fast)]), ['Passes £10,000', PASSES_TARGET.slow, PASSES_TARGET.base, PASSES_TARGET.fast]]} />
            <div><Sub>Assumptions</Sub><DataTable head={['Assumption', 'Slow', 'Base', 'Fast']} minWidth="min-w-[760px]" rows={ASSUMPTIONS.map((a) => [a.label, a.slow, a.base, a.fast])} /></div>
            <Bullets items={PROJECTION_NOTES} />
          </Section>

          <Section id="checkpoints" lede="Check every Monday. The dated rows compare your MRR with the plan; the right-hand column says what to change if you are behind.">
            <DataTable head={['Date', 'Checkpoint', 'Slow', 'Base', 'Fast', 'You', "If you're behind"]} minWidth="min-w-[920px]" right={[2, 3, 4]}
              highlight={next ? MRR_CHECKPOINTS.findIndex((c) => c.id === next.id) + 1 : undefined}
              rows={[
                [planDate(WEEK_TWO_CHECK.at), WEEK_TWO_CHECK.label, '—', '—', '—', WEEK_TWO_CHECK.at <= m.at ? <Badge key="w">Passed</Badge> : `in ${plural(Math.ceil((WEEK_TWO_CHECK.at - m.at) / DAY), 'day')}`, `${WEEK_TWO_CHECK.check} ${WEEK_TWO_CHECK.ifBehind}`],
                ...m.checkpoints.map((c) => [
                  planDate(c.at),
                  <span key="l">{c.label}{c.decision && <Badge tone="dark" className="ml-2">Decision</Badge>}</span>,
                  gbp(c.slowMrr), gbp(c.baseMrr), gbp(c.fastMrr),
                  c.passed ? <Badge key="s" tone={STATUS_LABEL[c.status].tone} dot>{STATUS_LABEL[c.status].label}</Badge> : `in ${plural(c.days, 'day')}`,
                  c.ifBehind,
                ]),
              ]} />
            <P>All checkpoints are Mondays. Your MRR today is {gbp(m.mrr)}.</P>
          </Section>

          <Section id="strategy" lede="Ranked by expected new MRR for each hour of your time, at almost no cost.">
            <div>
              <Sub>Do now</Sub>
              <DataTable head={['#', 'Strategy', 'Why', "What's automated"]} minWidth="min-w-[760px]" rows={STRATEGY_NOW.map((s) => [s.rank, s.strategy, s.why, s.automated])} />
            </div>
            <div>
              <Sub>Start later, when the trigger happens</Sub>
              <DataTable head={['Strategy', 'Start when', 'Right now']} minWidth="min-w-[760px]"
                rows={STRATEGY_LATER.map((s) => {
                  const state = triggerStatus(s.triggers, live);
                  return [s.strategy, s.startWhen, state.ready ? <Badge key="r" tone="brand" dot>Ready</Badge> : <span key="n" className="text-[12.5px] text-zinc-500">{state.label}</span>];
                })} />
            </div>
            <div>
              <Sub>Avoid</Sub>
              <DataTable head={['Do not', 'Why']} minWidth="min-w-[560px]" rows={STRATEGY_AVOID.map((s) => [s.strategy, s.why])} />
            </div>
          </Section>

          <Section id="sales" lede="The main funnel: automated outreach offering a free prospect pack, then the pack, then a 15-minute call, then the Agency plan.">
            <div><Sub>How it flows</Sub><Steps items={SALES_FLOW} /></div>
            <div><Sub>Who does what</Sub><DataTable head={['Job', 'Done by', 'Your time']} minWidth="min-w-[600px]" rows={WHO_DOES_WHAT.map((w) => [w.job, w.doneBy, w.time])} /></div>
            <div>
              <Sub>Making a prospect pack (10 minutes)</Sub>
              <Callout title="Rule">{PACK_RULE}</Callout>
              <div className="mt-3"><Steps items={PACK_STEPS} /></div>
            </div>
            <div><Sub>Business-owner prospects (15 minutes a day)</Sub><Steps items={OWNER_STEPS} /></div>
            <div>
              <Sub>The 15-minute call</Sub>
              <DataTable head={['Step', 'Minutes']} minWidth="min-w-[480px]" right={[1]} rows={CALL_AGENDA.map((c) => [c.step, c.minutes])} />
            </div>
            <div>
              <Sub>Adding mailboxes: the main way to grow faster</Sub>
              <P className="mb-2"><b className="font-semibold text-ink">When:</b> {MORE_MAILBOXES.when}</P>
              <Bullets items={MORE_MAILBOXES.how} />
            </div>
            <div className="space-y-3">
              <Sub>Outreach Autopilot</Sub>
              <P>{AUTOPILOT.intro}</P>
              <Fold title="Set up (about 15 minutes)"><Steps items={AUTOPILOT.setup} /></Fold>
              <Fold title="What it does on its own"><Bullets items={AUTOPILOT.onItsOwn} /></Fold>
              <Fold title="Settings and statuses">
                <DataTable head={['Setting', 'Value', 'What it is for']} minWidth="min-w-[560px]" rows={AUTOPILOT.settings.map((s) => [s.setting, s.value, s.note])} />
                <P>{AUTOPILOT.statuses}</P>
                <P>{AUTOPILOT.limits}</P>
              </Fold>
              <Fold title="If something goes wrong"><Bullets items={AUTOPILOT.stuck} /></Fold>
            </div>
          </Section>

          <Section id="compliance" lede="Who you may email, where to find them, and the rules that keep the outreach legal and the mailboxes healthy. This is the plan's reading of the rules, not legal advice.">
            <div><Sub>Where to find agencies</Sub><DefList items={PROSPECT_SOURCES.map((p) => ({ label: p.title, text: p.text }))} /></div>
            <div><Sub>Before you set OK to email</Sub><Steps items={QUALIFICATION} /></div>
            <div><Sub>Email rules (UK company law, PECR, UK GDPR and, in the US, CAN-SPAM)</Sub><Bullets items={EMAIL_RULES} /></div>
            <div><Sub>Limits and thresholds</Sub><DataTable head={['Rule', 'Limit', 'What to do']} minWidth="min-w-[680px]" rows={SEND_LIMITS.map((s) => [s.rule, s.limit, s.action])} /></div>
          </Section>

          <Section id="marketing" lede="Each channel, when it starts, and a simple weekly rhythm. Never automate posts or messages in communities or on LinkedIn.">
            <DataTable head={['Channel', 'What you do', 'Starts', 'Your time']} minWidth="min-w-[820px]" rows={CHANNELS.map((c) => [c.channel, c.what, c.starts, c.time])} />
            <div>
              <Sub>Weekly content calendar</Sub>
              <DataTable head={['Day', 'What goes out', 'Where', 'Your time', 'Starts']} minWidth="min-w-[820px]" rows={CONTENT_CALENDAR.map((c) => [c.day, c.goesOut, c.where, c.time, c.starts])} />
            </div>
          </Section>

          <Section id="templates" lede="The Autopilot's templates, copied from its Settings sheet, and the replies you send yourself. Change the words so they sound like you.">
            {OUTREACH_TEMPLATES.map((group) => (
              <div key={group.id} className="space-y-3">
                <div><Sub>{group.track} track</Sub><p className="text-[13px] text-zinc-500">{group.note}</p></div>
                <TemplateCard label="Subject" body={group.subject} />
                {group.emails.map((e) => <TemplateCard key={e.id} label={e.label} when={e.when} body={e.body} />)}
              </div>
            ))}
            <div className="space-y-3">
              <Sub>Footer and placeholders</Sub>
              <TemplateCard label={OUTREACH_FOOTER.label} when={OUTREACH_FOOTER.when} body={OUTREACH_FOOTER.body} />
              <P className="text-[13px] text-zinc-600">{PLACEHOLDERS}</P>
            </div>
            <div className="space-y-3">
              <Sub>What to send after a reply</Sub>
              {REPLY_TEMPLATES.map((t) => <TemplateCard key={t.id} label={t.label} when={t.when} body={t.body} />)}
            </div>
          </Section>

          <Section id="retention" lede="Monitoring is the reason customers stay. The target is under 4% of customers cancelling a month.">
            <DefList items={RETENTION.map((r) => ({ label: r.title, text: r.text }))} />
            <div><Sub>Five questions for every new paying customer (15 minutes)</Sub><Steps items={INTERVIEW_QUESTIONS} /></div>
          </Section>

          <Section id="roadmap" lede="Small changes that remove manual work, built in this order between sales tasks, not instead of them.">
            <DataTable head={['When', 'Build', 'Why', 'Size', 'Status']} minWidth="min-w-[860px]"
              rows={ROADMAP.map((r) => [
                r.phase, r.item, r.why, r.size,
                r.shipped ? <div key="s"><Badge tone="brand" dot>Shipped</Badge>{r.note && <p className="mt-1 text-[12px] leading-snug text-zinc-500">{r.note}</p>}</div> : <Badge key="t">To do</Badge>,
              ])} />
          </Section>

          <Section id="metrics" lede="Check every Monday. Where the app can measure a number, it is shown next to the target.">
            <DataTable head={['Measure', 'Target', 'Right now', 'If it is worse']} minWidth="min-w-[820px]"
              rows={WEEKLY_METRICS.map((w) => {
                const now = metricNow(w.id);
                return [w.measure, w.target, <span key="n" className={now.tone === 'good' ? 'font-medium text-brand-700' : now.tone === 'warn' ? 'font-medium text-amber-700' : undefined}>{now.text}</span>, w.ifWorse];
              })} />
          </Section>

          <Section id="routine" lede={ROUTINE_NOTE}>
            <div><Sub>Every weekday</Sub><DataTable head={['When', 'What', 'Time']} minWidth="min-w-[560px]" rows={ROUTINE_DAILY.map((r) => [r.when, r.what, r.time])} /></div>
            <div><Sub>Each week</Sub><DataTable head={['When', 'What', 'Time']} minWidth="min-w-[560px]" rows={ROUTINE_WEEKLY.map((r) => [r.when, r.what, r.time])} /></div>
          </Section>

          <Section id="first-week" lede="Dated for the launch week of 10 November 2026. Shift the dates if you start later.">
            <DataTable head={['Day', 'What']} minWidth="min-w-[560px]" rows={FIRST_WEEK.map((f) => [f.day, f.text])} />
          </Section>

          <Section id="risks">
            <DataTable head={['Risk', 'Early sign', 'What to do']} minWidth="min-w-[680px]" rows={RISKS.map((r) => [r.risk, r.sign, r.response])} />
          </Section>

          <Section id="avoid" lede="Hard rules, on top of the strategies to avoid above.">
            <DataTable head={['Do not', 'Why']} minWidth="min-w-[560px]" rows={DO_NOT.map((d) => [d.rule, d.why])} />
          </Section>

          <p className="mt-10 text-[12.5px] text-zinc-500"><a href="#top" className="link">Back to the top</a> · Plan text and numbers are from {PLAN_META.title.toLowerCase()}, {PLAN_META.version.toLowerCase()}, {PLAN_META.date}.</p>
        </div>
      </div>
    </div>
  );
}
