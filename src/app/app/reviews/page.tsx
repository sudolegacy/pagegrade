import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Download, FileSearch, Plus, Search } from 'lucide-react';
import { currentUser } from '@/lib/server/session';
import { listReviews, type ReviewStatus } from '@/lib/server/reviews';
import { ReviewRows } from '@/components/app/review-list';
import { getClient } from '@/lib/server/clients';
import { ButtonLink, buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'History' };

const FILTERS: { id: '' | ReviewStatus; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'complete', label: 'Complete' },
  { id: 'running', label: 'In progress' },
  { id: 'failed', label: 'Failed' },
];

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ before?: string; q?: string; status?: string; client?: string; batch?: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;
  const before = Number(sp.before) || undefined;
  const q = (sp.q ?? '').slice(0, 200);
  const status = FILTERS.some((f) => f.id && f.id === sp.status) ? (sp.status as ReviewStatus) : undefined;
  const clientId = typeof sp.client === 'string' && sp.client ? sp.client : undefined;
  const batchId = typeof sp.batch === 'string' && sp.batch ? sp.batch : undefined;
  const client = clientId ? getClient(user.id, clientId) : null;
  const reviews = listReviews(user.id, { limit: 50, before, q, status, clientId, batchId });
  const filtered = !!q || !!status || !!clientId || !!batchId;
  const scope = client ? `Client: ${client.name}` : clientId ? 'Client folder not found' : batchId ? 'One bulk review batch' : null;
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: q || undefined, status, client: clientId, batch: batchId, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return `/app/reviews${s ? `?${s}` : ''}`;
  };
  // The CSV covers everything the current filters match, not just the 50 rows on this page.
  const exportQuery = new URLSearchParams(Object.entries({ q: q || undefined, status, client: clientId, batch: batchId }).filter((e): e is [string, string] => !!e[1])).toString();
  const exportHref = `/api/reviews/export${exportQuery ? `?${exportQuery}` : ''}`;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-ink">History</h1>
          {scope && <p className="mt-1 text-[13.5px] text-zinc-600">{scope} · <Link href="/app/reviews" className="font-medium text-brand-700 hover:text-brand-800">Show all reviews</Link></p>}
          <p className="mt-1 text-[14.5px] text-zinc-600">Every review you have run, newest first.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {reviews.length > 0 && <a href={exportHref} className={buttonClass('secondary', 'sm')}><Download className="size-3.5" aria-hidden />Download CSV</a>}
          <ButtonLink href="/app/new" className="hidden sm:inline-flex"><Plus className="size-4" aria-hidden />New review</ButtonLink>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form action="/app/reviews" method="get" role="search" className="relative w-full sm:max-w-xs">
          {status && <input type="hidden" name="status" value={status} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <label htmlFor="history-q" className="sr-only">Search by page address</label>
          <input id="history-q" name="q" defaultValue={q} placeholder="Search by page address" autoComplete="off"
            className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-[14px] text-ink shadow-card outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
        </form>
        <nav aria-label="Filter by status" className="flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => {
            const active = (status ?? '') === f.id;
            return (
              <Link key={f.label} href={href({ status: f.id || undefined })} aria-current={active ? 'page' : undefined}
                className={cn('whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium', active ? 'bg-white text-ink shadow-card ring-1 ring-zinc-200' : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-ink')}>
                {f.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {reviews.length === 0 && !before ? (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700"><FileSearch className="size-5" aria-hidden /></div>
          {filtered ? (
            <>
              <h2 className="mt-4 text-[17px] font-semibold text-ink">No matching reviews</h2>
              <p className="mt-1.5 max-w-sm text-[14.5px] leading-relaxed text-zinc-600">Try a different address or clear the filters.</p>
              <Link href="/app/reviews" className={cn(buttonClass('secondary'), 'mt-6')}>Clear filters</Link>
            </>
          ) : (
            <>
              <h2 className="mt-4 text-[17px] font-semibold text-ink">No reviews yet</h2>
              <p className="mt-1.5 max-w-sm text-[14.5px] leading-relaxed text-zinc-600">Review your first landing page to see what is costing you conversions and what to fix first.</p>
              <ButtonLink href="/app/new" className="mt-6"><Plus className="size-4" aria-hidden />Review a page</ButtonLink>
            </>
          )}
        </div>
      ) : (
        <>
          <ReviewRows reviews={reviews} />
          {reviews.length === 50 && <div className="mt-4 text-center"><ButtonLink href={href({ before: String(reviews[reviews.length - 1].createdAt) })} variant="secondary">Older reviews</ButtonLink></div>}
        </>
      )}
    </div>
  );
}
