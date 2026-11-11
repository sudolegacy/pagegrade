import Link from 'next/link';
import { ChevronRight, Loader2, XCircle } from 'lucide-react';
import type { ReviewSummary } from '@/lib/server/reviews';
import { PAGE_TYPES } from '@/lib/engine/catalog';
import { GradeChip, scoreTone, toneText } from '@/components/ui/score';
import { cn } from '@/lib/cn';

import { hostPath, shortDate } from '@/lib/format';

export { hostPath, shortDate };

export function ReviewRows({ reviews }: { reviews: ReviewSummary[] }) {
  return (
    <ul className="card divide-y divide-zinc-100 overflow-hidden">
      {reviews.map((r) => (
        <li key={r.id}>
          <Link href={`/app/reviews/${r.id}`} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-zinc-50 sm:px-5">
            <div className="w-12 shrink-0 text-center">
              {r.status === 'complete' && r.score != null ? (
                <span className={cn('text-[20px] font-semibold tabular-nums tracking-tight', toneText[scoreTone(r.score)])}>{r.score}</span>
              ) : r.status === 'failed' ? <XCircle className="mx-auto size-5 text-zinc-300" aria-label="Failed" /> : <Loader2 className="mx-auto size-5 animate-spin text-brand-600" aria-label="In progress" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[14.5px] font-medium text-ink">{hostPath(r.finalUrl ?? r.url)}</p>
                {r.status === 'complete' && r.grade && r.score != null && <GradeChip grade={r.grade} score={r.score} className="hidden h-5 min-w-7 text-[11.5px] sm:inline-flex" />}
              </div>
              <p className="mt-0.5 truncate text-[13px] text-zinc-500">
                {r.status === 'complete' ? r.verdict : r.status === 'failed' ? (r.errorMessage ?? 'Review failed') : r.status === 'queued' ? 'Waiting to start…' : 'Review in progress…'}
              </p>
            </div>
            <div className="hidden shrink-0 text-right text-[12.5px] text-zinc-500 md:block">
              <p>{shortDate(r.createdAt)}</p>
              <p className="text-zinc-400">{PAGE_TYPES[r.pageType as keyof typeof PAGE_TYPES]?.split(/[ ,]/)[0] ?? r.pageType}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
