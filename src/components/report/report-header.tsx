import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { PAGE_TYPES, GOALS } from '@/lib/engine/catalog';
import { hostPath } from '@/lib/format';

/** Title block above a report: page address, intake summary and an optional action area. */
export function ReportHeader({ url, pageType, goal, createdAt, eyebrow, actions }: {
  url: string; pageType: string; goal: string; createdAt: number; eyebrow?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow}
        <h1 className="truncate text-[24px] font-semibold text-ink">{hostPath(url)}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13.5px] text-zinc-500">
          <span>{PAGE_TYPES[pageType as keyof typeof PAGE_TYPES] ?? pageType}</span><span aria-hidden>·</span>
          <span>{GOALS[goal as keyof typeof GOALS]?.label ?? goal}</span><span aria-hidden>·</span>
          <span>{new Date(createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })}</span>
          <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-0.5 font-medium text-zinc-600 hover:text-ink">Open page<ArrowUpRight className="size-3.5" aria-hidden /></a>
        </p>
      </div>
      {actions}
    </div>
  );
}
