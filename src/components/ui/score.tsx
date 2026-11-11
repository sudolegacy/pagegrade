import { cn } from '@/lib/cn';

export type Tone = 'good' | 'ok' | 'poor' | 'bad';
export const scoreTone = (score: number | null | undefined): Tone =>
  score == null ? 'ok' : score >= 80 ? 'good' : score >= 60 ? 'ok' : score >= 40 ? 'poor' : 'bad';

const stroke: Record<Tone, string> = { good: '#0f7a45', ok: '#b7791f', poor: '#dd6b20', bad: '#d92d20' };
export const toneText: Record<Tone, string> = { good: 'text-brand-700', ok: 'text-amber-700', poor: 'text-orange-700', bad: 'text-red-700' };
export const toneBg: Record<Tone, string> = { good: 'bg-brand-600', ok: 'bg-amber-500', poor: 'bg-orange-500', bad: 'bg-red-600' };
export const toneSoft: Record<Tone, string> = { good: 'bg-brand-50 text-brand-800 ring-brand-200', ok: 'bg-amber-50 text-amber-800 ring-amber-200', poor: 'bg-orange-50 text-orange-800 ring-orange-200', bad: 'bg-red-50 text-red-700 ring-red-200' };

export function ScoreRing({ score, size = 132, stroke: width = 10, label, className }: { score: number; size?: number; stroke?: number; label?: string; className?: string }) {
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  const tone = scoreTone(score);
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }} role="img" aria-label={`Score ${score} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4e4e7" strokeWidth={width} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke[tone]} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="font-semibold tabular-nums tracking-[-0.04em] text-ink" style={{ fontSize: size * 0.3, lineHeight: 1 }}>{score}</span>
        {label && <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500" style={{ fontSize: Math.max(10, size * 0.085) }}>{label}</span>}
      </div>
    </div>
  );
}

export function GradeChip({ grade, score, className }: { grade: string; score: number; className?: string }) {
  return <span className={cn('inline-flex h-6 min-w-8 items-center justify-center rounded-md px-1.5 text-[13px] font-semibold ring-1 ring-inset', toneSoft[scoreTone(score)], className)}>{grade}</span>;
}

export function Meter({ value, className, tone }: { value: number | null; className?: string; tone?: Tone }) {
  const t = tone ?? scoreTone(value);
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/70', className)}>
      {value != null && <div className={cn('h-full rounded-full', toneBg[t])} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />}
    </div>
  );
}
