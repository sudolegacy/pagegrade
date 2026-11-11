import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowDownRight, ArrowUpRight, ChartLine, GitCompareArrows, Minus, Plus, RotateCw } from 'lucide-react';
import { currentUser } from '@/lib/server/session';
import { listScoreHistory } from '@/lib/server/reviews';
import { ButtonLink } from '@/components/ui/button';
import { scoreTone, toneText } from '@/components/ui/score';
import { hostPath, shortDate } from '@/lib/format';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Pages' };

type PageRow = { key: string; url: string; points: { id: string; score: number; at: number }[] };

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="h-10" aria-hidden />;
  const w = 160, h = 40, pad = 4;
  const min = Math.min(...points), max = Math.max(...points);
  const span = Math.max(10, max - min);
  const lo = Math.max(0, (min + max) / 2 - span / 2);
  const xy = points.map((p, i) => [pad + (i * (w - pad * 2)) / (points.length - 1), h - pad - ((p - lo) / span) * (h - pad * 2)] as const);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full max-w-[160px]" role="img" aria-label={`Score trend: ${points.join(', ')}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-brand-600" />
      <circle cx={lx} cy={ly} r={3} className="fill-brand-600" />
    </svg>
  );
}

export default async function PagesView() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const history = listScoreHistory(user.id);
  const map = new Map<string, PageRow>();
  for (const r of history) {
    const url = r.finalUrl ?? r.url;
    const key = hostPath(url);
    const row = map.get(key) ?? { key, url, points: [] };
    row.url = url;
    row.points.push({ id: r.id, score: r.score!, at: r.createdAt });
    map.set(key, row);
  }
  const pages = [...map.values()].sort((a, b) => b.points[b.points.length - 1].at - a.points[a.points.length - 1].at);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-ink">Pages</h1>
          <p className="mt-1 text-[14.5px] text-zinc-600">Each page you have reviewed, with its score over time. Re-review after a change to see if it helped.</p>
        </div>
        <ButtonLink href="/app/new" className="hidden sm:inline-flex"><Plus className="size-4" aria-hidden />New review</ButtonLink>
      </div>

      {pages.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700"><ChartLine className="size-5" aria-hidden /></div>
          <h2 className="mt-4 text-[17px] font-semibold text-ink">No finished reviews yet</h2>
          <p className="mt-1.5 max-w-sm text-[14.5px] leading-relaxed text-zinc-600">Once a review finishes, the page appears here so you can track its score as you improve it.</p>
          <ButtonLink href="/app/new" className="mt-6"><Plus className="size-4" aria-hidden />Review a page</ButtonLink>
        </div>
      ) : (
        <ul className="card divide-y divide-zinc-100 overflow-hidden">
          {pages.map((p) => {
            const last = p.points[p.points.length - 1];
            const first = p.points[0];
            const prev = p.points.length > 1 ? p.points[p.points.length - 2] : null;
            const delta = prev ? last.score - prev.score : null;
            const best = Math.max(...p.points.map((x) => x.score));
            return (
              <li key={p.key} className="grid gap-4 px-4 py-4 sm:grid-cols-[1fr_170px_auto] sm:items-center sm:px-5">
                <div className="flex min-w-0 items-center gap-4">
                  <span className={cn('w-11 shrink-0 text-center text-[24px] font-semibold tabular-nums tracking-tight', toneText[scoreTone(last.score)])}>{last.score}</span>
                  <div className="min-w-0">
                    <Link href={`/app/reviews/${last.id}`} className="block truncate text-[14.5px] font-medium text-ink hover:underline">{p.key}</Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-zinc-500">
                      <span>{p.points.length} review{p.points.length === 1 ? '' : 's'}</span><span aria-hidden>·</span>
                      <span>Last {shortDate(last.at)}</span>
                      {p.points.length > 1 && <><span aria-hidden>·</span><span>Best {best}</span><span aria-hidden>·</span><span>{last.score - first.score >= 0 ? '+' : ''}{last.score - first.score} since first</span></>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Sparkline points={p.points.slice(-12).map((x) => x.score)} />
                  {delta != null && (
                    <span className={cn('inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium tabular-nums', delta > 0 ? 'text-brand-700' : delta < 0 ? 'text-red-600' : 'text-zinc-500')}>
                      {delta > 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : delta < 0 ? <ArrowDownRight className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 sm:justify-end">
                  {prev && <ButtonLink href={`/app/compare?a=${prev.id}&b=${last.id}`} variant="secondary" size="sm"><GitCompareArrows className="size-3.5" aria-hidden />Compare</ButtonLink>}
                  <ButtonLink href={`/app/new?from=${last.id}`} variant="secondary" size="sm"><RotateCw className="size-3.5" aria-hidden />Re-review</ButtonLink>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
