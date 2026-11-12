'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FolderOpen, ImageUp, Palette, Trash2, Users } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Alert, Field, Input } from '@/components/ui/field';
import { scoreTone, toneText } from '@/components/ui/score';
import { useToast } from '@/components/ui/toast';
import { BrandBar } from '@/components/report/brand-bar';
import { api, ApiError } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Client } from '@/lib/server/clients';

/** Per-folder branding: the name, colour and logo that reports filed in this folder carry instead of the account's. */
function ClientBranding({ client, onChange }: { client: Client; onChange: (next: Client) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(client.brand.name);
  const [color, setColor] = useState(client.brand.color);
  const [busy, setBusy] = useState<'save' | 'logo' | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const logoUrl = client.brand.logoUrl;
  const own = !!(client.brand.name || logoUrl);
  const fieldError = (f: string) => (error?.field === f ? error.message : null);

  // The pipeline links here (see PackActions) so the logo can be added straight away.
  useEffect(() => { if (window.location.hash === `#client-${client.id}`) setOpen(true); }, [client.id]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('save');
    setError(null);
    try {
      const { client: next } = await api<{ client: Client }>(`/api/clients/${client.id}`, { method: 'PATCH', body: { brandName: name, brandColor: color } });
      onChange(next);
      setName(next.brand.name);
      setColor(next.brand.color);
      toast('Branding saved');
    } catch (err) { setError(err instanceof ApiError ? err : new ApiError((err as Error).message, 0)); } finally { setBusy(null); }
  };
  const upload = async (f: File) => {
    setBusy('logo');
    try {
      const body = new FormData();
      body.set('logo', f);
      const res = await fetch(`/api/clients/${client.id}/logo`, { method: 'POST', body, credentials: 'same-origin' });
      const data = (await res.json().catch(() => ({}))) as { error?: string; logo?: string; logoUrl?: string };
      if (!res.ok || !data.logo || !data.logoUrl) throw new Error(data.error ?? 'Could not upload the logo.');
      onChange({ ...client, brand: { ...client.brand, logo: data.logo, logoUrl: data.logoUrl } });
      toast('Logo uploaded');
    } catch (err) { toast((err as Error).message, 'error'); } finally {
      setBusy(null);
      if (file.current) file.current.value = '';
    }
  };
  const removeLogo = async () => {
    setBusy('logo');
    try {
      await api(`/api/clients/${client.id}/logo`, { method: 'DELETE' });
      onChange({ ...client, brand: { ...client.brand, logo: null, logoUrl: null } });
      toast('Logo removed');
    } catch (err) { toast((err as Error).message, 'error'); } finally { setBusy(null); }
  };

  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="mt-4 border-t border-zinc-100 pt-3">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 text-[13px] font-medium text-zinc-700 marker:text-zinc-400">
        <span className="inline-flex items-center gap-1.5"><Palette className="size-3.5" aria-hidden />Branding</span>
        <span className="text-[12.5px] font-normal text-zinc-500">{own ? 'Own branding on reports' : 'Uses your account branding'}</span>
      </summary>
      <form onSubmit={save} className="mt-3 space-y-4">
        <p className="text-[13px] leading-relaxed text-zinc-500">Reports and PDFs filed in this folder carry this name, colour and logo instead of your account's. Leave the name and logo empty to use your account branding.</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-14 w-36 place-items-center overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoUrl ? <img src={logoUrl} alt={`${client.name} logo`} className="max-h-12 max-w-[8rem] object-contain" /> : <span className="text-[12px] text-zinc-400">No logo yet</span>}
          </div>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label={`Logo file for ${client.name}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
          <Button type="button" variant="secondary" size="sm" loading={busy === 'logo'} onClick={() => file.current?.click()}><ImageUp className="size-4" aria-hidden />{logoUrl ? 'Replace logo' : 'Upload logo'}</Button>
          {logoUrl && <Button type="button" variant="ghost" size="sm" disabled={busy === 'logo'} onClick={removeLogo} aria-label={`Remove logo for ${client.name}`}><Trash2 className="size-4" aria-hidden /></Button>}
          <p className="w-full text-[12.5px] text-zinc-500">PNG, JPEG or WebP, up to 2 MB.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name on reports" htmlFor={`brand-name-${client.id}`} optional error={fieldError('brandName')}>
            <Input id={`brand-name-${client.id}`} value={name} maxLength={60} placeholder={client.name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Colour" htmlFor={`brand-color-${client.id}`} optional error={fieldError('brandColor')}>
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Pick a colour" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#15803d'} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded-md border border-zinc-300 bg-white p-1" />
              <Input id={`brand-color-${client.id}`} value={color} maxLength={7} placeholder="#15803d" onChange={(e) => setColor(e.target.value)} className="font-mono" />
            </div>
          </Field>
        </div>
        {(name.trim() || logoUrl) && (
          <div className="space-y-1.5">
            <p className="text-[12.5px] font-medium text-zinc-600">Preview</p>
            <BrandBar brand={{ name: name.trim(), color: /^#[0-9a-f]{6}$/i.test(color) ? color : '', website: client.website, logo: client.brand.logo, logoUrl, whiteLabel: false }} note="Landing page review" />
          </div>
        )}
        {error && !error.field && <Alert tone="error">{error.message}</Alert>}
        <Button type="submit" size="sm" loading={busy === 'save'}>Save branding</Button>
      </form>
    </details>
  );
}

export function ClientsPanel({ initial, allowed, branding = allowed }: { initial: Client[]; allowed: boolean; branding?: boolean }) {
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
                <li key={c.id} id={`client-${c.id}`} className="card scroll-mt-20 p-5">
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
                  {branding && <ClientBranding client={c} onChange={(next) => setClients((list) => list.map((x) => (x.id === next.id ? next : x)))} />}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
