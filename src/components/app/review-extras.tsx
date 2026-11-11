'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Activity, Download, Mail } from 'lucide-react';
import { Button, ButtonLink, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';

type Issue = { title: string; recommendation: string };
type Props = {
  id: string; host: string; score: number; issues: Issue[]; shareId: string | null; appUrl: string; signature: string;
  pdf: boolean; monitored: boolean; canMonitor: boolean; clients: { id: string; name: string }[]; clientId: string | null;
};

/** The outreach email: the page's biggest problems and a link to the full report. Edited before sending. */
function draft(host: string, score: number, issues: Issue[], link: string, signature: string) {
  const list = issues.map((i, n) => `${n + 1}. ${i.title}\n   ${i.recommendation}`).join('\n\n');
  const intro = issues.length === 1 ? 'This is the change most likely' : `These are the ${issues.length} changes most likely`;
  return [
    'Hi,',
    `I ran ${host} through a landing page review and it scored ${score}/100. ${intro} to bring in more enquiries:`,
    list,
    link ? `The full report, with screenshots, is here:\n${link}` : '',
    "Happy to talk it through if it's useful.",
    signature,
  ].filter(Boolean).join('\n\n');
}

/** Growth actions on a finished review: PDF, weekly monitoring, client folder and the outreach email. */
export function ReviewExtras(p: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState(p.shareId ? `${p.appUrl}/r/${p.shareId}` : '');
  const [subject, setSubject] = useState(`${p.issues.length > 1 ? `${p.issues.length} quick fixes` : 'A quick fix'} for ${p.host}`);
  const [body, setBody] = useState('');
  const [client, setClient] = useState(p.clientId ?? '');

  const openOutreach = async () => {
    setBusy('outreach');
    try {
      let url = link;
      if (!url) {
        const res = await api<{ shareId: string | null; url: string | null }>(`/api/reviews/${p.id}/share`, { body: { enabled: true } });
        url = res.url ?? '';
        setLink(url);
      }
      setBody(draft(p.host, p.score, p.issues, url, p.signature));
      setOpen(true);
    } catch (err) { toast((err as Error).message, 'error'); } finally { setBusy(null); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); toast('Email copied'); }
    catch { toast('Could not copy. Select the text and copy it instead.', 'error'); }
  };
  const downloadPdf = async () => {
    setBusy('pdf');
    try {
      const res = await fetch(`/api/reviews/${p.id}/pdf`, { credentials: 'same-origin' });
      if (!res.ok) { const data = (await res.json().catch(() => ({}))) as { error?: string }; throw new Error(data.error ?? 'Could not create the PDF. Please try again.'); }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'review.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) { toast((err as Error).message, 'error'); } finally { setBusy(null); }
  };
  const monitor = async () => {
    setBusy('monitor');
    try { await api('/api/monitors', { body: { reviewId: p.id } }); toast('This page is now checked every week'); router.push('/app/monitoring'); }
    catch (err) { toast((err as Error).message, 'error'); setBusy(null); }
  };
  const fileUnder = async (value: string) => {
    const previous = client;
    setClient(value);
    try { await api(`/api/reviews/${p.id}/client`, { method: 'PUT', body: { clientId: value || null } }); toast(value ? 'Filed in the client folder' : 'Removed from the client folder'); router.refresh(); }
    catch (err) { setClient(previous); toast((err as Error).message, 'error'); }
  };

  return (
    <>
      {p.clients.length > 0 && (
        <select aria-label="Client folder" value={client} onChange={(e) => fileUnder(e.target.value)} className="h-8 max-w-[11rem] rounded-lg border border-zinc-200 bg-white px-2 text-[13px] text-zinc-700 shadow-card">
          <option value="">No client</option>
          {p.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {p.pdf
        ? <Button variant="secondary" size="sm" loading={busy === 'pdf'} onClick={downloadPdf}><Download className="size-3.5" aria-hidden />PDF</Button>
        : <ButtonLink href="/app/billing?plan=pro" variant="secondary" size="sm" title="PDF reports are part of the Pro and Agency plans"><Download className="size-3.5" aria-hidden />PDF</ButtonLink>}
      {p.monitored
        ? <ButtonLink href="/app/monitoring" variant="secondary" size="sm"><Activity className="size-3.5" aria-hidden />Monitored</ButtonLink>
        : p.canMonitor ? <Button variant="secondary" size="sm" loading={busy === 'monitor'} onClick={monitor}><Activity className="size-3.5" aria-hidden />Monitor weekly</Button> : null}
      <Button variant="secondary" size="sm" loading={busy === 'outreach'} onClick={openOutreach}><Mail className="size-3.5" aria-hidden />Email the fixes</Button>
      <Dialog open={open} onOpenChange={setOpen} title="Email the top fixes" description="A ready-to-send email with the biggest problems and a link to the full report. Edit it before you send it.">
        <div className="space-y-4">
          <Field label="Subject" htmlFor="out-subject"><Input id="out-subject" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field label="Email" htmlFor="out-body"><Textarea id="out-body" rows={14} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-[13px]" /></Field>
          <div className="flex flex-wrap justify-end gap-2">
            <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`} className={buttonClass('secondary', 'md')}>Open in email app</a>
            <Button onClick={copy}>Copy email</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
