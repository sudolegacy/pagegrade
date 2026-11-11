import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { GradeChip, Meter, ScoreRing, scoreTone, toneText } from '@/components/ui/score';
import { Badge } from '@/components/ui/badge';
import { EvidenceCrop } from '@/components/report/evidence';
import { SAMPLE_ASSETS, SAMPLE_REPORT } from '@/content/sample';
import { cn } from '@/lib/cn';

/** Compact, real excerpt of the sample report used on the landing page. */
export function ReportPreview({ className }: { className?: string }) {
  const r = SAMPLE_REPORT;
  const issue = r.issues.find((i) => i.location?.profile === 'desktop') ?? r.issues[0];
  const asset = issue?.location ? SAMPLE_ASSETS[issue.location.profile] : null;
  return (
    <figure className={cn('relative', className)}>
      <div className="card overflow-hidden shadow-pop">
        <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden><span className="size-2.5 rounded-full bg-zinc-200" /><span className="size-2.5 rounded-full bg-zinc-200" /><span className="size-2.5 rounded-full bg-zinc-200" /></span>
          <span className="ml-2 truncate text-[12px] font-medium text-zinc-500">Review · Brightline Digital (demo page)</span>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-5">
            <ScoreRing score={r.score} size={96} stroke={8} label="of 100" className="shrink-0" />
            <div className="min-w-0">
              <GradeChip grade={r.grade} score={r.score} />
              <p className="mt-2 text-[15px] font-semibold leading-snug text-ink">{r.verdict}</p>
            </div>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-zinc-100 pt-4">
            {r.categories.slice(0, 4).map((c) => (
              <li key={c.id}>
                <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
                  <span className="font-medium text-zinc-700">{c.label}</span>
                  <span className={cn('font-semibold tabular-nums', c.score == null ? 'text-zinc-400' : toneText[scoreTone(c.score)])}>{c.score ?? '–'}</span>
                </div>
                <Meter value={c.score} />
              </li>
            ))}
          </ul>
          {issue && (
            <div className="mt-5 rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">1</span>
                <Badge tone={issue.severity === 'critical' ? 'red' : issue.severity === 'major' ? 'amber' : 'neutral'}>{issue.severity === 'critical' ? 'Critical' : issue.severity === 'major' ? 'Major' : 'Minor'}</Badge>
                {issue.potentialGain > 0 && <span className="text-[12px] font-medium text-brand-700">Up to +{issue.potentialGain} points</span>}
              </div>
              <p className="mt-2 text-[14px] font-semibold text-ink">{issue.title}</p>
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-zinc-600">{issue.problem}</p>
              {asset && issue.location && <div className="mt-3"><EvidenceCrop asset={asset} box={issue.location.box} profile={issue.location.profile} label={`Screenshot of the area this fix refers to: ${issue.title}`} /></div>}
            </div>
          )}
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[12.5px] text-zinc-500">
        Unedited output from our sample report on a fictional agency page. <Link href="/sample" className="inline-flex items-center gap-0.5 font-medium text-zinc-700 hover:text-ink">See the full report<ArrowRight className="size-3" aria-hidden /></Link>
      </figcaption>
    </figure>
  );
}
