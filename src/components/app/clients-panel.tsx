'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { FolderOpen, Trash2, Users } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Alert, Field, Input } from '@/components/ui/field';
import { scoreTone, toneText } from '@/components/ui/score';
import { api, ApiError } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Client } from '@/lib/server/clients';

export function ClientsPanel({ initial, allowed }: { initial: Client[]; allowed: boolean }) {
  const [clients, setClients] = useState(initial);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { client } = await api<{ client: Client }>('/api/clients', { body: { name, website } });
      setClients((list) => [client, ...list]);
      setName('');
      setWebsite('');
    } catch (err) { setError(err instanceof ApiError ? err : new ApiError((err as Error).message, 0)); } finally { setBusy(false); }
  };
  const remove = async (c: Client) => {
    if (!window.confirm(`Delete the ${c.name} folder? Its reviews and monitored pages stay in your account, just unfiled.`)) return;
    try { await api(`/api/clients/${c.id}`, { method: 'DELETE' }); setClients((list) => list.filter((x) => x.id !== c.id)); }
    catch (err) { setError(err instanceof ApiError ? err : new ApiError((err as Error).message, 0)); }
  };

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Clients</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-zinc-500">Keep each client's reviews and monitored pages together. File a review from its report, or start a bulk review for a client.</p>
      </header>
      {!allowed ? (
        <div className="card flex items-start gap-3 p-6">
          <Users className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
          <div>
            <p className="text-[15px] font-semibold text-ink">Client folders are part of the Agency plan</p>
            <p className="mt-1 text-[14px] text-zinc-600">With bulk reviews, branded PDF reports and weekly monitoring for up to 50 pages.</p>
            <ButtonLink href="/app/billing?plan=agency" size="sm" className="mt-4">See the Agency plan</ButtonLink>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={add} className="card grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Client name" htmlFor="client-name" error={error?.field === 'name' ? error.message : null}>
              <Input id="client-name" value={name} maxLength={80} placeholder="Harbour Dental" onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Website" htmlFor="client-website" optional error={error?.field === 'website' ? error.message : null}>
              <Input id="client-website" value={website} maxLength={200} placeholder="harbourdental.co.uk" onChange={(e) => setWebsite(e.target.value)} />
            </Field>
            <Button type="submit" loading={busy} disabled={!name.trim()}>Add client</Button>
          </form>
          {error && error.field !== 'name' && error.field !== 'website' && <Alert tone="error">{error.message}</Alert>}
          {clients.length === 0 ? <p className="text-[14px] text-zinc-500">No clients yet. Add your first one above.</p> : (
            <ul className="grid gap-3 md:grid-cols-2">
              {clients.map((c) => (
                <li key={c.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-ink">{c.name}</p>
                      {c.website && <p className="truncate text-[13px] text-zinc-500">{c.website.replace(/^https?:\/\//, '')}</p>}
                    </div>
                    {c.latestScore != null && <span className={cn('text-[22px] font-semibold tabular-nums', toneText[scoreTone(c.latestScore)])}>{c.latestScore}</span>}
                  </div>
                  <p className="mt-2 text-[13px] text-zinc-500">{c.reviews} review{c.reviews === 1 ? '' : 's'} · {c.monitors} monitored{c.lastReviewAt ? ` · last ${shortDate(c.lastReviewAt)}` : ''}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <ButtonLink href={`/app/reviews?client=${c.id}`} variant="secondary" size="sm"><FolderOpen className="size-3.5" aria-hidden />Reviews</ButtonLink>
                    <Link href={`/app/bulk?client=${c.id}`} className="text-[13px] font-medium text-brand-700 hover:text-brand-800">Bulk review →</Link>
                    {c.reviews > 0 && <a href={`/api/reviews/export?client=${encodeURIComponent(c.id)}`} className="text-[13px] font-medium text-brand-700 hover:text-brand-800">Download CSV</a>}
                    <Button variant="ghost" size="sm" className="ml-auto" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}><Trash2 className="size-4" aria-hidden /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
