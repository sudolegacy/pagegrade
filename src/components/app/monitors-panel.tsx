'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Activity, Pause, Play, Trash2 } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, Field, Input, Select } from '@/components/ui/field';
import { scoreTone, toneText } from '@/components/ui/score';
import { api } from '@/lib/api';
import { hostPath, shortDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PAID_PLANS } from '@/lib/plans';
import type { Monitor } from '@/lib/server/monitors';

type Option = { id: string; url: string; score: number | null; at: number };

export function MonitorsPanel({ initial, quota, options, clients }: { initial: Monitor[]; quota: { limit: number; used: number }; options: Option[]; clients: { id: string; name: string }[] }) {
  const [monitors, setMonitors] = useState(initial);
  const available = options.filter((o) => !monitors.some((m) => m.url === o.url));
  const [reviewId, setReviewId] = useState(available[0]?.id ?? '');
  const [kind, setKind] = useState<'own' | 'competitor'>('own');
  const [label, setLabel] = useState('');
  const [clientId, setClientId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = monitors.length >= quota.limit;

  const fail = (err: unknown, fallback: string) => setError(err instanceof Error ? err.message : fallback);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { monitor } = await api<{ monitor: Monitor }>('/api/monitors', { body: { reviewId, kind, label: label.trim() || undefined, clientId: clientId || null } });
      setMonitors((list) => [...list, monitor]);
      setLabel('');
      setReviewId(available.find((o) => o.id !== reviewId)?.id ?? '');
    } catch (err) { fail(err, 'Could not start monitoring this page.'); } finally { setBusy(false); }
  };
  const toggle = async (m: Monitor) => {
    try {
      const { monitor } = await api<{ monitor: Monitor }>(`/api/monitors/${m.id}`, { method: 'PATCH', body: { active: !m.active } });
      setMonitors((list) => list.map((x) => (x.id === m.id ? monitor : x)));
    } catch (err) { fail(err, 'Could not update the monitor.'); }
  };
  const remove = async (m: Monitor) => {
    if (!window.confirm(`Stop monitoring ${hostPath(m.url)}? Past checks stay in your history.`)) return;
    try {
      await api(`/api/monitors/${m.id}`, { method: 'DELETE' });
      setMonitors((list) => list.filter((x) => x.id !== m.id));
    } catch (err) { fail(err, 'Could not remove the monitor.'); }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Monitoring</h1>
          <p className="mt-1 text-[14px] leading-relaxed text-zinc-500">PageGrade re-checks these pages every week and emails you when something changes: the score drops, the page slows down, it stops loading, or a competitor changes their headline, main button or prices. Weekly checks do not use your reviews.</p>
        </div>
        {quota.limit > 0 && <p className="text-[13px] tabular-nums text-zinc-500">{monitors.length} of {quota.limit} page{quota.limit === 1 ? '' : 's'} monitored</p>}
      </header>

      {quota.limit === 0 ? (
        <div className="card p-6">
          <div className="flex items-start gap-3">
            <Activity className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
            <div>
              <p className="text-[15px] font-semibold text-ink">Weekly monitoring is part of the paid plans</p>
              <p className="mt-1 text-[14px] text-zinc-600">{PAID_PLANS.map((p) => `${p.name}: ${p.limits.monitors} page${p.limits.monitors === 1 ? '' : 's'}`).join(' · ')}</p>
              <ButtonLink href="/app/billing" size="sm" className="mt-4">See plans</ButtonLink>
            </div>
          </div>
        </div>
      ) : available.length === 0 && !full ? (
        <div className="card p-6">
          <p className="text-[15px] font-semibold text-ink">Review a page first</p>
          <p className="mt-1 text-[14px] text-zinc-600">Monitoring starts from a finished review, which becomes the starting point for the weekly comparison. To watch a competitor, review their page once, then add it here.</p>
          <ButtonLink href="/app/new" size="sm" className="mt-4">Review a page</ButtonLink>
        </div>
      ) : full ? (
        <Alert tone="info" title="You are monitoring as many pages as your plan allows" action={<ButtonLink href="/app/billing" size="sm" variant="secondary">Change plan</ButtonLink>}>Remove a page to add another, or move to a bigger plan.</Alert>
      ) : (
        <form onSubmit={add} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.4fr_auto] lg:items-end">
          <Field label="Page" htmlFor="mon-review" hint="From your finished reviews">
            <Select id="mon-review" value={reviewId} onChange={(e) => setReviewId(e.target.value)}>
              {available.map((o) => <option key={o.id} value={o.id}>{hostPath(o.url)}{o.score != null ? ` · ${o.score}/100` : ''} · {shortDate(o.at)}</option>)}
            </Select>
          </Field>
          <Field label="Whose page?" htmlFor="mon-kind">
            <Select id="mon-kind" value={kind} onChange={(e) => setKind(e.target.value === 'competitor' ? 'competitor' : 'own')}>
              <option value="own">Mine or a client's</option>
              <option value="competitor">A competitor's</option>
            </Select>
          </Field>
          <Field label="Name" htmlFor="mon-label" optional>
            <Input id="mon-label" value={label} maxLength={80} placeholder={kind === 'competitor' ? 'e.g. Acme pricing page' : 'e.g. Spring campaign page'} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          {clients.length > 0 && (
            <Field label="Client" htmlFor="mon-client" optional className="sm:col-span-2 lg:col-span-1 lg:col-start-1">
              <Select id="mon-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">No client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
          <Button type="submit" loading={busy} disabled={!reviewId}>Monitor weekly</Button>
        </form>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {monitors.length === 0 ? (
        quota.limit > 0 && <p className="text-[14px] text-zinc-500">No pages monitored yet.</p>
      ) : (
        <ul className="space-y-3">
          {monitors.map((m) => (
            <li key={m.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[15px] font-semibold text-ink">{m.label || hostPath(m.url)}</p>
                    <Badge tone={m.kind === 'competitor' ? 'blue' : 'brand'}>{m.kind === 'competitor' ? 'Competitor' : 'Your page'}</Badge>
                    {m.checking ? <Badge tone="amber" dot>Checking now</Badge>
                      : m.overLimit ? <Badge tone="red">Over your plan limit</Badge>
                      : m.failures >= 2 ? <Badge tone="red">Could not load</Badge>
                      : !m.active ? <Badge>Paused</Badge> : null}
                  </div>
                  {m.label && <p className="mt-0.5 truncate text-[13px] text-zinc-500">{hostPath(m.url)}</p>}
                  <p className="mt-1 text-[13px] text-zinc-500">
                    {m.lastCheckedAt ? `Last checked ${shortDate(m.lastCheckedAt)}` : `Started ${shortDate(m.createdAt)}`} · {m.active ? `next check ${shortDate(m.nextRunAt)}` : 'paused'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {m.lastScore != null && <span className={cn('mr-1 text-[24px] font-semibold tabular-nums', toneText[scoreTone(m.lastScore)])}>{m.lastScore}</span>}
                  <Button variant="secondary" size="sm" onClick={() => toggle(m)}>{m.active ? <><Pause className="size-3.5" aria-hidden />Pause</> : <><Play className="size-3.5" aria-hidden />Resume</>}</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(m)} aria-label={`Stop monitoring ${hostPath(m.url)}`}><Trash2 className="size-4" aria-hidden /></Button>
                </div>
              </div>
              {m.lastChanges.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
                  {m.lastChanges.map((c, i) => (
                    <li key={i} className="flex gap-2.5 text-[13.5px]">
                      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', c.severity === 'alert' ? 'bg-red-500' : 'bg-zinc-300')} aria-hidden />
                      <span><span className="font-medium text-ink">{c.title}.</span> <span className="text-zinc-600">{c.detail}</span></span>
                    </li>
                  ))}
                </ul>
              )}
              {m.lastCheckedAt && m.lastChanges.length === 0 && <p className="mt-3 text-[13px] text-zinc-500">No changes since the last check.</p>}
              {m.latestReviewId && <Link href={`/app/reviews/${m.latestReviewId}`} className="mt-3 inline-block text-[13px] font-medium text-brand-700 hover:text-brand-800">Latest report →</Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
