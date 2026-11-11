'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bot, Check, Copy, Gauge, Loader2, Lock, Sparkles } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Alert } from '@/components/ui/field';
import { GradeChip, Meter, ScoreRing, scoreTone } from '@/components/ui/score';
import { api } from '@/lib/api';
import { hostPath } from '@/lib/format';
import type { GradeTeaser } from '@/lib/server/grader';

const STAGES: Record<string, string> = {
  starting: 'Opening the page', 'capture-desktop': 'Loading the page on desktop', 'capture-desktop-retry': 'The page was still changing, taking a slower look',
  'capture-mobile': 'Loading the page on a phone', analyse: 'Running the checks', write: 'Summing up', finalise: 'Scoring the page',
};
const SEVERITY: Record<string, { label: string; tone: BadgeTone }> = {
  critical: { label: 'Critical', tone: 'red' }, major: { label: 'Major', tone: 'amber' }, minor: { label: 'Minor', tone: 'neutral' },
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function GradeResult({ initial, signedIn }: { initial: GradeTeaser; signedIn: boolean }) {
  const router = useRouter();
  const [g, setG] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = g.status === 'queued' || g.status === 'running';

  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setTimeout>;
    let delay = 2000;
    let stopped = false;
    const poll = async () => {
      try {
        const next = await api<GradeTeaser>(`/api/grade/${g.id}`);
        if (stopped) return;
        setG(next);
        delay = 2000;
        if (next.status === 'complete' || next.status === 'failed') return;
      } catch { delay = Math.min(delay * 2, 15000); }
      timer = setTimeout(poll, document.hidden ? Math.max(delay, 6000) : delay);
    };
    timer = setTimeout(poll, 1500);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { stopped = true; clearTimeout(timer); clearInterval(tick); };
  }, [g.id, running]);

  const host = hostPath(g.finalUrl ?? g.url);
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  const unlock = async () => {
    setUnlocking(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>(`/api/grade/${g.id}/claim`, { method: 'POST' });
      router.push(`/app/reviews/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setUnlocking(false);
    }
  };

  if (running) {
    const secs = Math.max(0, Math.round((now - (g.startedAt ?? g.createdAt)) / 1000));
    return (
      <div className="card mx-auto max-w-xl p-6" aria-live="polite">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 shrink-0 animate-spin text-brand-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ink">Grading {host}</p>
            <p className="text-[13px] text-zinc-500">
              {g.status === 'queued' ? `Waiting for a free browser${g.queuePosition ? ` · position ${g.queuePosition}` : ''}` : STAGES[g.stage ?? 'starting'] ?? 'Working on it'}
            </p>
          </div>
          <span className="font-mono text-[13px] tabular-nums text-zinc-500">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-zinc-500">Most grades take about a minute. You can keep this tab open, or copy the link and come back later.</p>
      </div>
    );
  }

  if (g.status === 'failed') {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Alert tone="error" title={`We could not grade ${host}`}>{g.errorMessage ?? 'Something went wrong while loading the page.'}</Alert>
        <ButtonLink href="/grade" variant="secondary">Try another page</ButtonLink>
      </div>
    );
  }

  const r = g.result;
  if (!r) {
    return (
      <div className="card mx-auto max-w-xl p-6 text-center">
        <Lock className="mx-auto size-6 text-zinc-400" aria-hidden />
        <p className="mt-3 text-[15px] font-semibold text-ink">This grade has been saved to an account</p>
        <p className="mt-1 text-[14px] text-zinc-500">So its details are private now. You can grade any page yourself, free.</p>
        <ButtonLink href="/grade" className="mt-5">Grade a page</ButtonLink>
      </div>
    );
  }

  const more = Math.max(0, r.issueCount - r.topIssues.length);
  const speed = r.performance == null ? null : Math.round(r.performance <= 1 ? r.performance * 100 : r.performance);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="card p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <ScoreRing score={r.score} label="Score" />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="truncate text-[13px] font-medium text-zinc-500">{host}</p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-[22px] font-semibold tracking-tight text-ink">{r.verdict}</h1>
              <GradeChip grade={r.grade} score={r.score} />
            </div>
            <p className="mt-2 text-[14.5px] leading-relaxed text-zinc-600">{r.summary}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button variant="secondary" size="sm" onClick={share}>{copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}{copied ? 'Link copied' : 'Copy link to share'}</Button>
              <ButtonLink href="/grade" variant="ghost" size="sm">Grade another page</ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-[15px] font-semibold text-ink">Score by area</h2>
          <ul className="mt-4 space-y-3.5">
            {r.categories.map((c) => (
              <li key={c.id}>
                <div className="flex items-baseline justify-between text-[13.5px]"><span className="text-zinc-700">{c.label}</span><span className="tabular-nums text-zinc-500">{c.score ?? '–'}</span></div>
                <Meter value={c.score} tone={c.score == null ? undefined : scoreTone(c.score)} className="mt-1.5" />
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="text-[15px] font-semibold text-ink">Biggest problems</h2>
          {r.topIssues.length === 0 ? <p className="mt-3 text-[14px] text-zinc-500">No major problems found. The full report lists smaller improvements.</p> : (
            <ol className="mt-4 space-y-4">
              {r.topIssues.map((issue, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-[12px] font-semibold text-zinc-600">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium leading-snug text-ink">{issue.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone={SEVERITY[issue.severity]?.tone ?? 'neutral'}>{SEVERITY[issue.severity]?.label ?? issue.severity}</Badge>
                      <span className="flex items-center gap-1 text-[12.5px] text-zinc-400"><Lock className="size-3" aria-hidden />The fix is in the full report</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {more > 0 && <p className="mt-4 text-[13px] text-zinc-500">+ {plural(more, 'more issue')} in the full report</p>}
        </section>
      </div>

      {(speed != null || r.ai) && (
        <section className="card grid gap-5 p-6 sm:grid-cols-2">
          {speed != null && (
            <div className="flex gap-3">
              <Gauge className="mt-0.5 size-5 shrink-0 text-zinc-400" aria-hidden />
              <div>
                <p className="text-[14px] font-medium text-ink">Speed score {speed}/100</p>
                <p className="mt-0.5 text-[13px] text-zinc-500">{r.lcpMs != null ? `The main content appears after ${(r.lcpMs / 1000).toFixed(1)}s.` : 'Measured with Lighthouse.'}</p>
              </div>
            </div>
          )}
          {r.ai && (
            <div className="flex gap-3">
              <Bot className="mt-0.5 size-5 shrink-0 text-zinc-400" aria-hidden />
              <div>
                <p className="text-[14px] font-medium text-ink">AI search readiness: {r.ai.passed} of {r.ai.total} checks passed</p>
                <p className="mt-0.5 text-[13px] text-zinc-500">{r.ai.blocked.length ? `Blocked: ${r.ai.blocked.join(', ')}.` : 'AI search crawlers can reach the page.'} The full report shows each check and how to fix it.</p>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="bg-ink px-6 py-6 text-white sm:px-8">
          <p className="flex items-center gap-2 text-[13px] font-medium text-brand-300"><Sparkles className="size-4" aria-hidden />The full report</p>
          <h2 className="mt-2 text-[20px] font-semibold tracking-tight">See every fix for {host}</h2>
          <ul className="mt-3 space-y-1.5 text-[14px] text-zinc-300">
            <li>• {plural(r.issueCount, 'issue')} with step-by-step fixes and examples</li>
            {r.rewriteCount > 0 && <li>• {r.rewriteCount} rewrites of your headline and buttons, written for your visitors</li>}
            <li>• Desktop and phone screenshots of what visitors see first</li>
            {r.strengthCount > 0 && <li>• {plural(r.strengthCount, 'thing')} the page already does well</li>}
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
            {!signedIn ? (
              <>
                <ButtonLink href={`/signup?next=${encodeURIComponent(`/app/reviews/${g.id}`)}`} size="lg">Create a free account to see the fixes</ButtonLink>
                <Link href={`/login?next=${encodeURIComponent(`/grade/${g.id}`)}`} className="text-[14px] font-medium text-zinc-300 hover:text-white">I already have an account</Link>
              </>
            ) : g.mine && !g.claimed ? (
              <Button size="lg" loading={unlocking} onClick={unlock}>Unlock the full report · uses 1 review</Button>
            ) : (
              <ButtonLink href={`/app/new?url=${encodeURIComponent(g.finalUrl ?? g.url)}`} size="lg">Review this page from your account</ButtonLink>
            )}
          </div>
          {!signedIn && <p className="mt-3 text-[12.5px] text-zinc-400">Free: this report plus 3 more full reviews. No card needed.</p>}
          {error && <Alert tone="error" className="mt-4">{error}</Alert>}
        </div>
      </section>
    </div>
  );
}
