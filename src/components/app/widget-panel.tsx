'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, Download, ExternalLink, Inbox, Magnet, Trash2 } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, Field, Input, Textarea } from '@/components/ui/field';
import { GradeChip, Meter } from '@/components/ui/score';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { LeadStatus, Widget, WidgetLead, WidgetUsage } from '@/lib/server/widget';

type WidgetText = { headline: string; intro: string; buttonLabel: string; ctaLabel: string };

const STATUS_LABELS: Record<LeadStatus, string> = { new: 'New', contacted: 'Contacted', won: 'Won', lost: 'Lost' };
const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
const time = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const hostOf = (url: string) => { try { const u = new URL(url); return u.hostname.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname); } catch { return url; } };

function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the code can still be selected */ }
  };
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="font-mono text-[11.5px] uppercase tracking-wider text-zinc-400">HTML</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-medium text-zinc-200 hover:bg-zinc-800">
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}{copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre aria-label={label} className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-zinc-100"><code>{code}</code></pre>
    </div>
  );
}

function Install({ widgetId, appUrl }: { widgetId: string; appUrl: string }) {
  const [mode, setMode] = useState<'script' | 'iframe'>('script');
  const script = `<div data-pagegrade-widget="${widgetId}"></div>\n<script async src="${appUrl}/embed.js"></script>`;
  const iframe = `<iframe src="${appUrl}/embed/${widgetId}" title="Free website check" loading="lazy"\n  style="width:100%;max-width:640px;height:860px;border:0"></iframe>`;
  return (
    <section className="card p-6">
      <h2 className="text-[16px] font-semibold text-ink">Add it to your website</h2>
      <p className="mt-1 text-[14px] text-zinc-600">Paste this where the check should appear, for example on your homepage or a &ldquo;Free website audit&rdquo; page.</p>
      <div className="mt-4 inline-flex rounded-lg bg-zinc-100 p-1 text-[13px] font-medium" role="tablist" aria-label="Snippet type">
        {(['script', 'iframe'] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={cn('rounded-md px-3 py-1.5 transition-colors', mode === m ? 'bg-white text-ink shadow-card' : 'text-zinc-600 hover:text-ink')}>
            {m === 'script' ? 'Script (recommended)' : 'iframe only'}
          </button>
        ))}
      </div>
      <div className="mt-3"><CopyBlock code={mode === 'script' ? script : iframe} label="Install code" /></div>
      <p className="mt-3 text-[13px] leading-relaxed text-zinc-500">
        {mode === 'script'
          ? 'The script sizes the check to fit its content. WordPress: a Custom HTML block. Webflow and Framer: an Embed element. Squarespace: a Code block. Wix: Embed code → Embed HTML.'
          : 'For site builders that strip scripts. The height is fixed, so leave enough room for the results.'}
      </p>
    </section>
  );
}

function Settings({ widget, defaults, maxLengths, onSaved }: { widget: Widget; defaults: WidgetText; maxLengths: Record<keyof WidgetText, number>; onSaved: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    active: widget.active, notify: widget.notify, headline: widget.headline, intro: widget.intro, buttonLabel: widget.buttonLabel,
    ctaLabel: widget.ctaLabel, ctaUrl: widget.ctaUrl, privacyUrl: widget.privacyUrl, allowedHosts: widget.allowedHosts.join('\n'),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const fieldError = (f: string) => (error?.field === f ? error.message : null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { widget: saved } = await api<{ widget: Widget }>('/api/widget', { method: 'PATCH', body: form });
      setForm((f) => ({ ...f, ctaUrl: saved.ctaUrl, privacyUrl: saved.privacyUrl, allowedHosts: saved.allowedHosts.join('\n') }));
      toast('Widget saved');
      onSaved();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError((err as Error).message, 0));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-6">
      <h2 className="text-[16px] font-semibold text-ink">Settings</h2>
      <form onSubmit={save} className="mt-4 space-y-5" noValidate>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          <span>
            <span className="block text-[14px] font-medium text-ink">Widget is live</span>
            <span className="block text-[13px] text-zinc-500">Switch it off and visitors see a short &ldquo;not available right now&rdquo; note instead.</span>
          </span>
        </label>
        <Field label="Headline" htmlFor="w-headline" optional error={fieldError('headline')}>
          <Input id="w-headline" value={form.headline} maxLength={maxLengths.headline} placeholder={defaults.headline} onChange={(e) => set('headline', e.target.value)} />
        </Field>
        <Field label="Introduction" htmlFor="w-intro" optional error={fieldError('intro')}>
          <Textarea id="w-intro" value={form.intro} maxLength={maxLengths.intro} placeholder={defaults.intro} rows={2} onChange={(e) => set('intro', e.target.value)} />
        </Field>
        <Field label="Button" htmlFor="w-button" optional error={fieldError('buttonLabel')}>
          <Input id="w-button" value={form.buttonLabel} maxLength={maxLengths.buttonLabel} placeholder={defaults.buttonLabel} onChange={(e) => set('buttonLabel', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Next step after the score" htmlFor="w-cta-label" optional error={fieldError('ctaLabel')}>
            <Input id="w-cta-label" value={form.ctaLabel} maxLength={maxLengths.ctaLabel} placeholder={defaults.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} />
          </Field>
          <Field label="Its link" htmlFor="w-cta-url" optional error={fieldError('ctaUrl')} hint="A booking page, contact page or mailto: address.">
            <Input id="w-cta-url" value={form.ctaUrl} maxLength={500} placeholder="youragency.co.uk/contact" onChange={(e) => set('ctaUrl', e.target.value)} invalid={!!fieldError('ctaUrl')} />
          </Field>
        </div>
        <Field label="Your privacy policy" htmlFor="w-privacy" optional error={fieldError('privacyUrl')} hint="Linked under the form. You decide what happens to your leads' details, so your policy should cover them.">
          <Input id="w-privacy" value={form.privacyUrl} maxLength={500} placeholder="youragency.co.uk/privacy" onChange={(e) => set('privacyUrl', e.target.value)} invalid={!!fieldError('privacyUrl')} />
        </Field>
        <Field label="Websites that may show the widget" htmlFor="w-hosts" optional error={fieldError('allowedHosts')}
          hint="One per line, like youragency.co.uk (the www. version is added for you). Leave empty to allow any site, which lets others use your monthly checks.">
          <Textarea id="w-hosts" value={form.allowedHosts} rows={2} placeholder="youragency.co.uk" onChange={(e) => set('allowedHosts', e.target.value)} invalid={!!fieldError('allowedHosts')} className="font-mono text-[14px]" />
        </Field>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={form.notify} onChange={(e) => set('notify', e.target.checked)} />
          <span>
            <span className="block text-[14px] font-medium text-ink">Email me each lead</span>
            <span className="block text-[13px] text-zinc-500">One email per lead, with their score and a link to the full report.</span>
          </span>
        </label>
        {error && !error.field && <Alert tone="error">{error.message}</Alert>}
        <Button type="submit" loading={busy}>Save widget</Button>
      </form>
    </section>
  );
}

function Preview({ widgetId, version, active }: { widgetId: string; version: number; active: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(620);
  // The widget may have reported its height before this page hydrated, so ask once listening, and on every load.
  const measure = () => frame.current?.contentWindow?.postMessage({ type: 'pagegrade:measure' }, window.location.origin);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const data = e.data as { type?: string; height?: number } | null;
      if (data?.type === 'pagegrade:resize' && typeof data.height === 'number') setHeight(Math.max(200, Math.min(2400, data.height)));
    };
    window.addEventListener('message', onMessage);
    measure();
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return (
    <section className="card self-start p-4 sm:p-6 lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-ink">Preview</h2>
        <a href={`/embed/${widgetId}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">Open on its own<ExternalLink className="size-3.5" aria-hidden /></a>
      </div>
      <p className="mt-1 text-[13px] text-zinc-500">{active ? 'This is the live widget: a check you run here is real and counts towards your month.' : 'Switched off: this is what visitors see now.'}</p>
      <div className="mt-4 rounded-xl bg-zinc-100/80 p-3 sm:p-5">
        <iframe ref={frame} key={version} src={`/embed/${widgetId}`} title="Lead widget preview" onLoad={measure} className="block w-full border-0" style={{ height }} />
      </div>
    </section>
  );
}

export function LeadsTable({ initial }: { initial: WidgetLead[] }) {
  const toast = useToast();
  const [leads, setLeads] = useState(initial);
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => setLeads(initial), [initial]);

  const setStatus = async (id: string, status: LeadStatus) => {
    const before = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    try { await api(`/api/widget/leads/${id}`, { method: 'PATCH', body: { status } }); toast(`Marked as ${STATUS_LABELS[status].toLowerCase()}`); }
    catch (err) { setLeads(before); toast((err as Error).message, 'error'); }
  };
  const remove = async (id: string) => {
    try { await api(`/api/widget/leads/${id}`, { method: 'DELETE' }); setLeads((ls) => ls.filter((l) => l.id !== id)); toast('Lead and report deleted'); }
    catch (err) { toast((err as Error).message, 'error'); } finally { setConfirming(null); }
  };

  return (
    <section id="leads" className="card scroll-mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-6 py-4">
        <div>
          <h2 className="text-[16px] font-semibold text-ink">Leads</h2>
          <p className="text-[13px] text-zinc-500">Everyone who ran a check through your widget. Their page&apos;s full report opens from here.</p>
        </div>
        {leads.length > 0 && <a href="/api/widget/leads" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:text-brand-800"><Download className="size-4" aria-hidden />Export CSV</a>}
      </div>
      {leads.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <Inbox className="mx-auto size-6 text-zinc-300" aria-hidden />
          <p className="mt-2 text-[14px] font-medium text-ink">No leads yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-zinc-500">Once the widget is on your site, every check appears here, and we email you each one.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead className="bg-zinc-50/80 text-[12px] font-medium uppercase tracking-wide text-zinc-500">
              <tr><th className="px-6 py-2.5 font-medium">When</th><th className="px-3 py-2.5 font-medium">Who</th><th className="px-3 py-2.5 font-medium">Page</th><th className="px-3 py-2.5 font-medium">Score</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-6 py-2.5"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {leads.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="whitespace-nowrap px-6 py-3 text-zinc-600">{day(l.createdAt)}<span className="block text-[12px] text-zinc-400">{time(l.createdAt)}</span></td>
                  <td className="max-w-[220px] px-3 py-3">
                    {l.name && <span className="block truncate font-medium text-ink">{l.name}</span>}
                    <a href={`mailto:${l.email}`} className={cn('block truncate hover:text-brand-700', l.name ? 'text-zinc-600' : 'font-medium text-ink')}>{l.email}</a>
                  </td>
                  <td className="max-w-[240px] px-3 py-3">
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="block truncate text-ink hover:text-brand-700">{hostOf(l.url)}</a>
                    {l.source && <span className="block truncate text-[12px] text-zinc-400">via {hostOf(l.source)}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {l.score != null && l.grade ? <span className="inline-flex items-center gap-2"><GradeChip grade={l.grade} score={l.score} /><span className="tabular-nums text-zinc-600">{l.score}/100</span></span>
                      : l.reviewStatus === 'failed' ? <span className="text-zinc-500">Could not check</span>
                      : l.reviewStatus === 'queued' || l.reviewStatus === 'running' ? <span className="text-zinc-500">Checking…</span>
                      : <span className="text-zinc-400">Report deleted</span>}
                  </td>
                  <td className="px-3 py-3">
                    <select aria-label={`Status for ${l.email}`} value={l.status} onChange={(e) => setStatus(l.id, e.target.value as LeadStatus)}
                      className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-[13px] text-ink focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/15">
                      {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-6 py-3 text-right">
                    {confirming === l.id ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[12.5px] text-zinc-600">Delete lead and report?</span>
                        <Button variant="danger" size="sm" onClick={() => remove(l.id)}>Delete</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>Keep</Button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {l.reportAvailable && <ButtonLink href={`/app/reviews/${l.reviewId}`} variant="secondary" size="sm">Full report</ButtonLink>}
                        <Button variant="ghost" size="sm" onClick={() => setConfirming(l.id)} aria-label={`Delete the lead from ${l.email}`}><Trash2 className="size-4" aria-hidden /></Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function WidgetPanel({ widget, usage, counts, leads, appUrl, branded, defaults, maxLengths }: {
  widget: Widget; usage: WidgetUsage; counts: { total: number; week: number; fresh: number }; leads: WidgetLead[];
  appUrl: string; branded: boolean; defaults: WidgetText; maxLengths: Record<keyof WidgetText, number>;
}) {
  const [version, setVersion] = useState(0);
  const pct = usage.limit ? (usage.used / usage.limit) * 100 : 100;
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-[26px] font-semibold text-ink">Lead widget <Badge tone={widget.active ? 'brand' : 'neutral'} dot>{widget.active ? 'Live' : 'Switched off'}</Badge></h1>
          <p className="mt-1 max-w-2xl text-[14.5px] text-zinc-600">A free website check on your own site. Visitors get their score in about a minute; you get their name, email and the full report, ready for a follow-up that opens with evidence.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-[12.5px] text-zinc-500">New leads</p><p className="mt-1 text-[24px] font-semibold tabular-nums text-ink">{counts.fresh}</p><p className="text-[12.5px] text-zinc-500">{counts.week} in the last 7 days · {counts.total} in total</p></div>
        <div className="card p-4 sm:col-span-2">
          <div className="flex items-baseline justify-between"><p className="text-[12.5px] text-zinc-500">Checks this month</p><p className="text-[13px] tabular-nums text-zinc-600">{usage.used} of {usage.limit}</p></div>
          <Meter value={pct} tone={pct >= 100 ? 'bad' : pct >= 80 ? 'ok' : 'good'} className="mt-3" />
          <p className="mt-2 text-[12.5px] text-zinc-500">
            {usage.remaining === 0 ? 'The widget is paused until your allowance resets; visitors are asked to get in touch instead.' : `${usage.remaining} left`}
            {usage.resetsAt ? ` · resets ${day(usage.resetsAt)}` : ''}. Widget checks never use your review allowance, and failed checks are free.
          </p>
        </div>
      </div>

      {!branded && (
        <Alert tone="warning" className="mt-6" title="Make it look like your site" action={<ButtonLink href="/app/settings" size="sm" variant="secondary">Add your branding</ButtonLink>}>
          Add your logo, name and colour in Settings → Branded reports. Until then the widget uses PageGrade&apos;s green and says &ldquo;the owner of this website&rdquo;.
        </Alert>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Install widgetId={widget.id} appUrl={appUrl} />
          <Settings widget={widget} defaults={defaults} maxLengths={maxLengths} onSaved={() => setVersion((v) => v + 1)} />
        </div>
        <Preview widgetId={widget.id} version={version} active={widget.active} />
      </div>

      <div className="mt-6"><LeadsTable initial={leads} /></div>
    </div>
  );
}

export function WidgetUpsell() {
  return (
    <section className="card overflow-hidden">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_300px]">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-brand-700"><Magnet className="size-4" aria-hidden />Agency plan</p>
          <h1 className="mt-2 text-[26px] font-semibold leading-tight text-ink">Turn your website into a source of new clients</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-600">Put a free website check on your own site. Visitors enter their page and email, see their score and biggest problems in your colours, and you get the lead with the full report, ready for a follow-up that opens with evidence.</p>
          <ul className="mt-5 space-y-2 text-[14.5px] text-zinc-700">
            {['Two lines of code: WordPress, Webflow, Framer, Squarespace, Wix', 'Your logo, colours and call to action; PageGrade’s name can be hidden', 'Every lead emailed to you, with their score and the full report', 'Checks through the widget never use your review allowance'].map((t) => (
              <li key={t} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />{t}</li>
            ))}
          </ul>
          <ButtonLink href="/app/billing?plan=agency" className="mt-6">See the Agency plan</ButtonLink>
          <p className="mt-3 text-[13px] text-zinc-500"><Link href="/agencies" className="underline underline-offset-2 hover:text-ink">How agencies use PageGrade</Link></p>
        </div>
        <div aria-hidden className="hidden rounded-xl bg-zinc-100 p-4 lg:block">
          <div className="rounded-lg bg-white p-4 shadow-card">
            <div className="h-3 w-24 rounded bg-brand-600/80" />
            <div className="mt-3 h-4 w-48 rounded bg-zinc-800/80" />
            <div className="mt-2 h-3 w-40 rounded bg-zinc-300" />
            <div className="mt-4 h-9 rounded-md border border-zinc-200" />
            <div className="mt-2 h-9 rounded-md border border-zinc-200" />
            <div className="mt-3 h-10 rounded-md bg-brand-600" />
          </div>
        </div>
      </div>
    </section>
  );
}
