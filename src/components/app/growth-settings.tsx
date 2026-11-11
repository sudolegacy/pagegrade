'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { ImageUp, Trash2 } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Alert, Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import type { AccountView } from '@/lib/server/account';

export function MonitorEmailSetting({ initial }: { initial: boolean }) {
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const toggle = async (value: boolean) => {
    setOn(value);
    try { await api('/api/account', { method: 'PATCH', body: { notifyMonitor: value } }); toast(value ? 'Monitoring alerts on' : 'Monitoring alerts off'); }
    catch (err) { setOn(!value); toast((err as Error).message, 'error'); }
  };
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={on} onChange={(e) => toggle(e.target.checked)} />
      <span>
        <span className="block text-[14px] font-medium text-ink">Email me when a monitored page changes</span>
        <span className="block text-[13px] text-zinc-500">Score drops, slower loading, the page going down, or a competitor changing their headline, main button or prices.</span>
      </span>
    </label>
  );
}

export function BrandSettings({ account }: { account: AccountView }) {
  const router = useRouter();
  const toast = useToast();
  const b = account.brand;
  const [name, setName] = useState(b.name);
  const [website, setWebsite] = useState(b.website);
  const [color, setColor] = useState(b.color || '#15803d');
  const [whiteLabel, setWhiteLabel] = useState(b.whiteLabel);
  const [logoUrl, setLogoUrl] = useState(b.logoUrl);
  const [busy, setBusy] = useState<'save' | 'logo' | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const file = useRef<HTMLInputElement>(null);

  if (!account.features.branding) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
        <p className="text-[14px] text-zinc-700">Put your own logo, name and colour on PDF and shared reports, and hide PageGrade's name if you like. Branded reports are part of the Agency plan, with client folders and bulk reviews.</p>
        <ButtonLink href="/app/billing?plan=agency" size="sm" className="mt-3">See the Agency plan</ButtonLink>
      </div>
    );
  }

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('save');
    setError(null);
    try {
      await api('/api/account', { method: 'PATCH', body: { brandName: name, brandWebsite: website, brandColor: color, whiteLabel } });
      toast('Branding saved');
      router.refresh();
    } catch (err) { setError(err instanceof ApiError ? err : new ApiError((err as Error).message, 0)); } finally { setBusy(null); }
  };
  const upload = async (f: File) => {
    setBusy('logo');
    try {
      const body = new FormData();
      body.set('logo', f);
      const res = await fetch('/api/account/brand/logo', { method: 'POST', body, credentials: 'same-origin' });
      const data = (await res.json().catch(() => ({}))) as { error?: string; logoUrl?: string };
      if (!res.ok || !data.logoUrl) throw new Error(data.error ?? 'Could not upload the logo.');
      setLogoUrl(data.logoUrl);
      toast('Logo uploaded');
    } catch (err) { toast((err as Error).message, 'error'); } finally {
      setBusy(null);
      if (file.current) file.current.value = '';
    }
  };
  const removeLogo = async () => {
    setBusy('logo');
    try { await api('/api/account/brand/logo', { method: 'DELETE' }); setLogoUrl(null); toast('Logo removed'); }
    catch (err) { toast((err as Error).message, 'error'); } finally { setBusy(null); }
  };
  const fieldError = (f: string) => (error?.field === f ? error.message : null);

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-40 place-items-center overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl ? <img src={logoUrl} alt="Your logo" className="max-h-14 max-w-[9rem] object-contain" /> : <span className="text-[12px] text-zinc-400">No logo yet</span>}
        </div>
        <div className="flex gap-2">
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
          <Button type="button" variant="secondary" size="sm" loading={busy === 'logo'} onClick={() => file.current?.click()}><ImageUp className="size-4" aria-hidden />{logoUrl ? 'Replace logo' : 'Upload logo'}</Button>
          {logoUrl && <Button type="button" variant="ghost" size="sm" onClick={removeLogo} aria-label="Remove logo"><Trash2 className="size-4" aria-hidden /></Button>}
        </div>
        <p className="w-full text-[12.5px] text-zinc-500">PNG, JPEG or WebP, up to 2 MB. A wide logo on a transparent background works best.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Agency or business name" htmlFor="brand-name" error={fieldError('brandName')}>
          <Input id="brand-name" value={name} maxLength={60} placeholder="Northside Digital" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Website" htmlFor="brand-website" optional error={fieldError('brandWebsite')}>
          <Input id="brand-website" value={website} maxLength={200} placeholder="northside.co.uk" onChange={(e) => setWebsite(e.target.value)} />
        </Field>
        <Field label="Brand colour" htmlFor="brand-color" error={fieldError('brandColor')}>
          <div className="flex items-center gap-2">
            <input type="color" aria-label="Pick a colour" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#15803d'} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded-md border border-zinc-300 bg-white p-1" />
            <Input id="brand-color" value={color} maxLength={7} onChange={(e) => setColor(e.target.value)} className="font-mono" />
          </div>
        </Field>
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={whiteLabel} onChange={(e) => setWhiteLabel(e.target.checked)} />
        <span>
          <span className="block text-[14px] font-medium text-ink">White label</span>
          <span className="block text-[13px] text-zinc-500">Hide PageGrade's name and site menus on your shared and PDF reports, so clients only see your brand.</span>
        </span>
      </label>
      {error && !error.field && <Alert tone="error">{error.message}</Alert>}
      <Button type="submit" loading={busy === 'save'}>Save branding</Button>
    </form>
  );
}
