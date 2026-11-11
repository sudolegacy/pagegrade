import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CheckCircle2, GitCompareArrows, Plus, XCircle } from 'lucide-react';
import { currentUser } from '@/lib/server/session';
import { getReview, listScoreHistory } from '@/lib/server/reviews';
import type { Report } from '@/lib/engine/report';
import { ButtonLink } from '@/components/ui/button';
import { ScoreRing, scoreTone, toneText } from '@/components/ui/score';
import { hostPath, shortDate } from '@/lib/format';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Compare' };

const selectClass = 'h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-[14px] text-ink shadow-card outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

function Delta({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return <span className={cn('text-zinc-400', className)}>—</span>;
  const v = Math.round(value);
  return <span className={cn('font-medium tabular-nums', v > 0 ? 'text-brand-700' : v < 0 ? 'text-red-600' : 'text-zinc-500', className)}>{v > 0 ? `+${v}` : v}</span>;
}

function changed(a: Report, b: Report) {
  const before = new Map(a.criteria.map((c) => [c.id, c]));
  const fixed: string[] = [], worse: string[] = [];
  for (const c of b.criteria) {
    const p = before.get(c.id);
    if (!p || p.status === 'na' || c.status === 'na') continue;
    const rank = { pass: 2, warn: 1, fail: 0 } as const;
    const pr = rank[p.status as keyof typeof rank], cr = rank[c.status as keyof typeof rank];
    if (cr > pr) fixed.push(c.label);
    else if (cr < pr) worse.push(c.label);
  }
  return { fixed, worse };
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;
  const history = listScoreHistory(user.id).reverse(); // newest first for the pickers

  const header = (
    <div className="mb-6">
      <h1 className="text-[26px] font-semibold text-ink">Compare</h1>
      <p className="mt-1 text-[14.5px] text-zinc-600">Put two reviews side by side to see what changed: score, categories and which checks improved or slipped.</p>
    </div>
  );

  if (history.length < 2) {
    return (
      <div>
        {header}
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700"><GitCompareArrows className="size-5" aria-hidden /></div>
          <h2 className="mt-4 text-[17px] font-semibold text-ink">You need two finished reviews</h2>
          <p className="mt-1.5 max-w-sm text-[14.5px] leading-relaxed text-zinc-600">Review a page, make a change, then review it again. Or compare your page with a competitor&rsquo;s.</p>
          <ButtonLink href="/app/new" className="mt-6"><Plus className="size-4" aria-hidden />New review</ButtonLink>
        </div>
      </div>
    );
  }

  // Default: the latest review against the previous review of the same page, or the one before it.
  const latest = history[0];
  const samePage = history.find((r) => r.id !== latest.id && hostPath(r.finalUrl ?? r.url) === hostPath(latest.finalUrl ?? latest.url));
  const aId = sp.a ?? (samePage ?? history[1]).id;
  const bId = sp.b ?? latest.id;
  const A = getReview(aId, user.id);
  const B = getReview(bId, user.id);
  const a = A?.report, b = B?.report;
  const label = (r: (typeof history)[number]) => `${hostPath(r.finalUrl ?? r.url)} · ${r.score} · ${shortDate(r.createdAt)}`;

  return (
    <div className="space-y-8">
      {header}
      <form action="/app/compare" method="get" className="card grid gap-3 p-4 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end sm:p-5">
        <label className="block text-[13px] font-medium text-zinc-700">Before
          <select name="a" defaultValue={aId} className={cn(selectClass, 'mt-1.5')}>
            {history.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
          </select>
        </label>
        <ArrowRight className="mx-auto hidden size-4 text-zinc-400 sm:mb-3 sm:block" aria-hidden />
        <label className="block text-[13px] font-medium text-zinc-700">After
          <select name="b" defaultValue={bId} className={cn(selectClass, 'mt-1.5')}>
            {history.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-lg bg-ink px-4 text-[14px] font-medium text-white hover:bg-zinc-800">Compare</button>
      </form>

      {!a || !b || !A || !B ? (
        <p className="text-[14.5px] text-zinc-600">One of those reviews could not be found. Pick two finished reviews above.</p>
      ) : (
        <>
          <section className="card grid gap-6 p-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            {[{ r: a, d: A }, null, { r: b, d: B }].map((x, i) => x ? (
              <Link key={x.d.id} href={`/app/reviews/${x.d.id}`} className="group flex items-center gap-4">
                <ScoreRing score={x.r.score} size={80} stroke={7} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-zinc-500">{i === 0 ? 'Before' : 'After'} · {shortDate(x.d.createdAt)}</p>
                  <p className="mt-0.5 truncate text-[15px] font-semibold text-ink group-hover:underline">{hostPath(x.r.finalUrl)}</p>
                  <p className="mt-1 line-clamp-2 text-[13.5px] text-zinc-600">{x.r.verdict}</p>
                </div>
              </Link>
            ) : (
              <div key="delta" className="text-center">
                <p className="text-[12.5px] font-medium text-zinc-500">Change</p>
                <Delta value={b.score - a.score} className="text-[30px] leading-tight" />
              </div>
            ))}
          </section>

          <section>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">By category</h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead><tr className="border-b border-zinc-100 text-left text-[12.5px] text-zinc-500"><th className="px-5 py-2.5 font-medium">Category</th><th className="px-3 py-2.5 text-right font-medium">Before</th><th className="px-3 py-2.5 text-right font-medium">After</th><th className="px-5 py-2.5 text-right font-medium">Change</th></tr></thead>
                <tbody className="divide-y divide-zinc-100">
                  {b.categories.map((c) => {
                    const p = a.categories.find((x) => x.id === c.id);
                    return (
                      <tr key={c.id}>
                        <th scope="row" className="px-5 py-2.5 text-left font-medium text-ink">{c.label}</th>
                        <td className={cn('px-3 py-2.5 text-right tabular-nums', p?.score != null ? toneText[scoreTone(p.score)] : 'text-zinc-400')}>{p?.score != null ? Math.round(p.score) : '—'}</td>
                        <td className={cn('px-3 py-2.5 text-right tabular-nums', c.score != null ? toneText[scoreTone(c.score)] : 'text-zinc-400')}>{c.score != null ? Math.round(c.score) : '—'}</td>
                        <td className="px-5 py-2.5 text-right"><Delta value={p?.score != null && c.score != null ? c.score - p.score : null} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {(() => {
            const { fixed, worse } = changed(a, b);
            return (
              <section className="grid gap-4 md:grid-cols-2">
                <div className="card p-5">
                  <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><CheckCircle2 className="size-4 text-brand-600" aria-hidden />Improved ({fixed.length})</h2>
                  {fixed.length ? <ul className="mt-3 space-y-1.5 text-[14px] text-zinc-700">{fixed.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="mt-3 text-[14px] text-zinc-500">No checks moved up.</p>}
                </div>
                <div className="card p-5">
                  <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><XCircle className="size-4 text-red-500" aria-hidden />Got worse ({worse.length})</h2>
                  {worse.length ? <ul className="mt-3 space-y-1.5 text-[14px] text-zinc-700">{worse.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="mt-3 text-[14px] text-zinc-500">No checks moved down.</p>}
                </div>
              </section>
            );
          })()}

          {hostPath(a.finalUrl) !== hostPath(b.finalUrl) && <p className="text-[13.5px] text-zinc-500">These are different pages, so the comparison shows how they stack up rather than what changed.</p>}
        </>
      )}
    </div>
  );
}
