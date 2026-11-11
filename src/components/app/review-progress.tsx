'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { CHECK_COUNT } from '@/lib/engine/catalog';

type Status = { status: 'queued' | 'running' | 'complete' | 'failed'; stage: string | null; queuePosition: number | null; startedAt: number | null; createdAt: number };

const STEPS = [
  { id: 'queued', label: 'In the queue', detail: 'Your review starts as soon as a browser is free.' },
  { id: 'capture-desktop', label: 'Loading the page on desktop', detail: 'Dismissing cookie banners, scrolling to load lazy content, taking full-page screenshots.' },
  { id: 'capture-mobile', label: 'Loading the page on a phone', detail: 'Checking layout, text size and the first screen on a 390px-wide device.' },
  { id: 'analyse', label: `Running ${CHECK_COUNT} checks`, detail: 'Measuring the page, testing speed, and three independent AI assessments of the screenshots.' },
  { id: 'write', label: 'Writing your fixes', detail: 'Prioritising what to change and drafting rewrites for your audience.' },
  { id: 'finalise', label: 'Putting the report together', detail: 'Scoring, checking every quote against the page, and saving screenshots.' },
];
const ORDER: Record<string, number> = { queued: 0, starting: 1, 'capture-desktop': 1, 'capture-desktop-retry': 1, 'capture-mobile': 2, analyse: 3, write: 4, finalise: 5 };

export function ReviewProgress({ id, initial, notify }: { id: string; initial: Status; notify: boolean }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const done = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let delay = 2000;
    const poll = async () => {
      try {
        const next = await api<Status>(`/api/reviews/${id}?view=status`);
        setS(next);
        delay = 2000;
        if ((next.status === 'complete' || next.status === 'failed') && !done.current) { done.current = true; router.refresh(); return; }
      } catch { delay = Math.min(delay * 2, 15000); }
      timer = setTimeout(poll, document.hidden ? Math.max(delay, 6000) : delay);
    };
    timer = setTimeout(poll, 1500);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(timer); clearInterval(tick); };
  }, [id, router]);

  const current = s.status === 'queued' ? 0 : ORDER[s.stage ?? 'starting'] ?? 1;
  const since = s.startedAt ?? s.createdAt;
  const secs = Math.max(0, Math.round((now - since) / 1000));
  const elapsed = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const retry = s.stage === 'capture-desktop-retry';
  return (
    <div className="card mx-auto max-w-xl overflow-hidden">
      <div className="border-b border-zinc-100 px-6 py-5">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold text-ink">{s.status === 'queued' ? 'Waiting to start' : 'Reviewing your page'}</p>
          <span className="font-mono text-[13px] tabular-nums text-zinc-500" aria-label="Elapsed time">{elapsed}</span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full bg-brand-600 transition-[width] duration-700 ease-out" style={{ width: `${Math.min(96, 6 + (current / (STEPS.length - 1)) * 86)}%` }} />
        </div>
      </div>
      <ol className="space-y-0 px-6 py-5">
        {STEPS.map((step, i) => {
          const state = i < current ? 'done' : i === current ? 'active' : 'todo';
          return (
            <li key={step.id} className="relative flex gap-3.5 pb-5 last:pb-0">
              {i < STEPS.length - 1 && <span className={cn('absolute left-[11px] top-6 h-[calc(100%-16px)] w-px', i < current ? 'bg-brand-300' : 'bg-zinc-200')} aria-hidden />}
              <span className={cn('relative z-10 grid size-[23px] shrink-0 place-items-center rounded-full border text-[11px] font-semibold',
                state === 'done' ? 'border-brand-600 bg-brand-600 text-white' : state === 'active' ? 'border-brand-600 bg-white text-brand-700' : 'border-zinc-200 bg-white text-zinc-400')}>
                {state === 'done' ? <Check className="size-3.5" aria-hidden /> : state === 'active' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={cn('text-[14px] font-medium', state === 'todo' ? 'text-zinc-400' : 'text-ink')}>
                  {step.label}{state === 'active' && i === 0 && s.queuePosition ? ` · position ${s.queuePosition}` : ''}
                </p>
                {state === 'active' && <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-500">{retry && i === 1 ? 'The page was still changing, so we are taking a slower, more careful look.' : step.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="border-t border-zinc-100 bg-zinc-50/60 px-6 py-3.5 text-[13px] text-zinc-500">
        Most reviews take 1–3 minutes. {notify ? 'You can leave this page; we will email you when the report is ready.' : 'You can leave this page; the review keeps running.'}
      </p>
    </div>
  );
}
