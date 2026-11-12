import type { Metadata } from 'next';
import Link from 'next/link';
import { adminOverview } from '@/lib/server/admin';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { hostPath } from '@/lib/format';
import { planById } from '@/lib/plans';
import { cn } from '@/lib/cn';
import { SIGNUP_REASONS } from '@/lib/server/feedback';
import { MarkPaidButton } from '@/components/app/mark-paid-button';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

const ago = (t: number | null | undefined, from: number) => {
  if (!t) return '—';
  const s = Math.max(0, Math.round((from - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};
const dateTime = (t: number) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const usd = (n: number) => `$${n.toFixed(n < 10 ? 3 : 2)}`;
const bytes = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} kB`);

function Stat({ label, value, detail, tone }: { label: string; value: React.ReactNode; detail?: React.ReactNode; tone?: BadgeTone }) {
  return (
    <div className="card p-4">
      <p className="text-[12.5px] font-medium text-zinc-500">{label}</p>
      <p className={cn('mt-1 text-[24px] font-semibold tabular-nums tracking-tight', tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : 'text-ink')}>{value}</p>
      {detail && <p className="mt-0.5 text-[12.5px] text-zinc-500">{detail}</p>}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink">{title}{count != null && <span className="text-[13px] font-normal tabular-nums text-zinc-500">{count}</span>}</h2>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="card px-4 py-6 text-center text-[13.5px] text-zinc-500">{children}</p>;
const th = 'px-4 py-2.5 text-left text-[12px] font-medium text-zinc-500';
const td = 'px-4 py-2.5 align-top text-[13px] text-zinc-700';

export default function AdminPage() {
  const o = adminOverview();
  const t = o.generatedAt;
  const workerAge = o.worker ? (t - o.worker.at) / 1000 : null;
  const workerTone: BadgeTone = workerAge == null || workerAge > 120 ? 'red' : workerAge > 45 ? 'amber' : 'brand';
  const backupAge = o.backup ? (t - o.backup.at) / 3600_000 : null;
  const queued = o.byStatus.queued ?? 0;
  const running = o.byStatus.running ?? 0;
  const paidTotal = o.paid.reduce((s, p) => s + p.n, 0);
  const mrr = o.mrrGbp;
  const reason = (id: string) => SIGNUP_REASONS.find((r) => r.id === id)?.label ?? id.replace(/_/g, ' ');
  const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;
  const failRate = o.day.finished ? Math.round((o.day.failed / o.day.finished) * 100) : 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold text-ink">Admin</h1>
          <p className="mt-1 text-[14.5px] text-zinc-600">Live operational view. Times are UK time; refresh the page to update. Targets and the plan: <Link href="/admin/plan" className="link">Business plan</Link>.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={workerTone} dot>{o.worker ? `Worker seen ${ago(o.worker.at, t)} · ${o.worker.active} active` : 'Worker has never reported'}</Badge>
          <Badge tone={backupAge == null || backupAge > 30 ? 'amber' : 'neutral'} dot>{o.backup ? `Backup ${ago(o.backup.at, t)} · ${bytes(o.backup.bytes)}` : 'No backup yet'}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Users" value={o.users.total} detail={`${o.users.verified} verified · ${o.users.lastWeek} new this week`} />
        <Stat label="Paying" value={paidTotal} detail={paidTotal ? `£${mrr}/month list price${o.pastDue ? ` · ${o.pastDue} past due` : ''}` : 'No active subscriptions'} tone={o.pastDue ? 'amber' : undefined} />
        <Stat label="AI spend today (UTC)" value={usd(o.spendToday)} detail={`Budget ${usd(o.budgetUsd)} · hard cap ${usd(o.hardCapUsd)} · 30 days ${usd(o.month.spend)}`} tone={o.spendToday >= o.hardCapUsd ? 'red' : o.spendToday >= o.budgetUsd * 0.8 ? 'amber' : undefined} />
        <Stat label="Last 24 hours" value={o.day.complete} detail={`complete · ${o.day.failed} failed (${failRate}%)${o.day.avgMs ? ` · avg ${Math.round(o.day.avgMs / 1000)}s` : ''}`} tone={failRate >= 25 && o.day.finished >= 4 ? 'red' : undefined} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[12.5px] text-zinc-600">
        {(['queued', 'running', 'complete', 'failed'] as const).map((s) => (
          <span key={s} className="rounded-md bg-zinc-100 px-2 py-1 tabular-nums">{s} <b className="font-semibold text-ink">{o.byStatus[s] ?? 0}</b></span>
        ))}
        {o.paid.map((p) => <span key={p.plan} className="rounded-md bg-brand-50 px-2 py-1 tabular-nums text-brand-800">{planById(p.plan)?.name ?? p.plan} <b className="font-semibold">{p.n}</b></span>)}
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat label="Free grades (7 days)" value={o.growth.grades} detail={`${o.growth.claimed} unlocked by signed-up users`} />
        <Stat label="Monitored pages" value={o.monitors} detail={`${o.growth.checks} weekly checks in the last 7 days`} />
        <Stat label="Bulk reviews (7 days)" value={o.growth.bulk} detail={`${o.yearlyCustomers} customer${o.yearlyCustomers === 1 ? '' : 's'} on yearly billing`} />
        <Stat label="Widget checks (7 days)" value={o.growth.widget} detail={`${o.widgets} live lead widget${o.widgets === 1 ? '' : 's'}`} />
        <Stat label="Referred sign-ups" value={o.referred} detail={`${o.partners.length} partner${o.partners.length === 1 ? '' : 's'}`} />
      </div>

      <Section title="What users say" count={o.feedback.length}>
        {(o.signupReasons.length > 0 || o.cancelReasons.length > 0) && (
          <div className="flex flex-wrap gap-2 px-4 pt-3 text-[12.5px]">
            {o.signupReasons.map((r) => <span key={`s-${r.answer}`} className="rounded-md bg-brand-50 px-2 py-1 text-brand-800">{reason(r.answer)} <b className="font-semibold">{r.n}</b></span>)}
            {o.cancelReasons.map((r) => <span key={`c-${r.answer}`} className="rounded-md bg-red-50 px-2 py-1 text-red-800">Cancelled: {r.answer.replace(/_/g, ' ')} <b className="font-semibold">{r.n}</b></span>)}
          </div>
        )}
        {o.feedback.length === 0 ? <p className="px-4 py-3 text-[13px] text-zinc-500">No feedback yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={th}>When</th><th className={th}>Type</th><th className={th}>Answer</th><th className={th}>Comment</th><th className={th}>User</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {o.feedback.map((f) => (
                  <tr key={f.id}>
                    <td className={td}>{ago(f.createdAt, t)}</td>
                    <td className={td}>{f.kind}</td>
                    <td className={td}>{f.kind === 'signup' ? reason(f.answer) : f.answer.replace(/_/g, ' ')}</td>
                    <td className={cn(td, 'max-w-md whitespace-pre-wrap')}>{f.comment || '–'}</td>
                    <td className={td}>{f.email ?? 'Deleted user'}{f.plan ? ` · ${planById(f.plan)?.name ?? f.plan}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Partners" count={o.partners.length}>
        {o.partners.length === 0 ? <p className="px-4 py-3 text-[13px] text-zinc-500">No referrals yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={th}>Partner</th><th className={th}>Sign-ups</th><th className={th}>On hold</th><th className={th}>Payable</th><th className={th}>Paid</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {o.partners.map((p) => (
                  <tr key={p.id}>
                    <td className={td}>{p.email}<span className="block text-[12px] text-zinc-500">{p.code}</span></td>
                    <td className={td}>{p.signups}</td>
                    <td className={td}>{gbp(p.pendingPence)}</td>
                    <td className={cn(td, 'font-medium text-ink')}>{gbp(p.payablePence)}</td>
                    <td className={td}>{gbp(p.paidPence)}</td>
                    <td className={td}>{p.payablePence > 0 && <MarkPaidButton referrerId={p.id} label={`${gbp(p.payablePence)} to ${p.email}`} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Queue" count={queued + running}>
        {o.queue.length === 0 ? <Empty>Nothing queued or running.</Empty> : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-zinc-100"><tr><th className={th}>Page</th><th className={th}>Status</th><th className={th}>User</th><th className={th}>Waiting</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {o.queue.map((r) => (
                  <tr key={r.id}>
                    <td className={cn(td, 'max-w-[280px] truncate font-medium text-ink')} title={r.url}>{hostPath(r.url)}</td>
                    <td className={td}><Badge tone={r.status === 'running' ? 'blue' : 'neutral'}>{r.status === 'running' ? (r.stage ?? 'running') : 'queued'}</Badge>{r.attempts > 1 && <span className="ml-2 text-[12px] text-amber-700">attempt {r.attempts}</span>}</td>
                    <td className={td}>{r.email} <span className="text-zinc-400">· {r.plan}</span></td>
                    <td className={cn(td, 'tabular-nums')}>{ago(r.createdAt, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Recent failures" count={o.failures.length}>
        {o.failures.length === 0 ? <Empty>No failed reviews.</Empty> : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-zinc-100"><tr><th className={th}>When</th><th className={th}>Page</th><th className={th}>Reason</th><th className={th}>User</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {o.failures.map((r) => (
                  <tr key={r.id}>
                    <td className={cn(td, 'whitespace-nowrap tabular-nums')}>{r.at ? dateTime(r.at) : '—'}</td>
                    <td className={cn(td, 'max-w-[240px] truncate font-medium text-ink')} title={r.url}>{hostPath(r.url)}</td>
                    <td className={td}><code className="rounded bg-zinc-100 px-1 py-0.5 text-[12px]">{r.code ?? 'unknown'}</code><p className="mt-1 max-w-[360px] text-[12.5px] leading-snug text-zinc-500">{r.message}</p></td>
                    <td className={td}>{r.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Newest users" count={o.users.total}>
        {o.recentUsers.length === 0 ? <Empty>No users yet.</Empty> : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-zinc-100"><tr><th className={th}>Email</th><th className={th}>Plan</th><th className={th}>Reviews used</th><th className={th}>Joined</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {o.recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td className={cn(td, 'font-medium text-ink')}>{u.email}{!u.verifiedAt && <span className="ml-2 text-[12px] font-normal text-amber-700">unverified</span>}</td>
                    <td className={td}>{planById(u.plan)?.name ?? u.plan}{u.plan !== 'free' && u.planStatus !== 'active' && <span className="ml-1 text-zinc-500">({u.planStatus.replace('_', ' ')})</span>}</td>
                    <td className={cn(td, 'tabular-nums')}>{u.reviews}</td>
                    <td className={cn(td, 'whitespace-nowrap tabular-nums')}>{dateTime(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {o.stripeErrors.length > 0 && (
        <Section title="Stripe webhook errors" count={o.stripeErrors.length}>
          <ul className="card divide-y divide-zinc-100">
            {o.stripeErrors.map((e) => (
              <li key={e.id} className="px-4 py-2.5 text-[13px]"><span className="tabular-nums text-zinc-500">{dateTime(e.at)}</span> · <code className="text-[12px]">{e.type}</code> · <span className="text-red-700">{e.error}</span></li>
            ))}
          </ul>
        </Section>
      )}

      <p className="mt-8 text-[12.5px] text-zinc-500">Machine-readable status: <a href="/api/health" className="link">/api/health</a></p>
    </div>
  );
}
