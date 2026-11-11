'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Layers } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/field';
import { api, ApiError } from '@/lib/api';

type Option = { id: string; label: string };
type LineError = { line: number; url: string; error: string };

export function BulkForm({ allowed, pageTypes, goals, clients, initialClient, max, remaining }: {
  allowed: boolean; pageTypes: Option[]; goals: Option[]; clients: { id: string; name: string }[]; initialClient?: string; max: number; remaining: number | null;
}) {
  const router = useRouter();
  const [urls, setUrls] = useState('');
  const [pageType, setPageType] = useState(pageTypes[0]?.id ?? '');
  const [goal, setGoal] = useState(goals[0]?.id ?? '');
  const [audience, setAudience] = useState('');
  const [context, setContext] = useState('');
  const [clientId, setClientId] = useState(initialClient && clients.some((c) => c.id === initialClient) ? initialClient : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const lines = [...new Set(urls.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];
  const lineErrors = (error?.data?.errors as LineError[] | undefined) ?? [];

  if (!allowed) {
    return (
      <div className="card flex items-start gap-3 p-6">
        <Layers className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
        <div>
          <p className="text-[15px] font-semibold text-ink">Bulk reviews are part of the Agency plan</p>
          <p className="mt-1 text-[14px] text-zinc-600">Review up to {max} pages in one go, for example every landing page of a new client, and file them in a client folder.</p>
          <ButtonLink href="/app/billing?plan=agency" size="sm" className="mt-4">See the Agency plan</ButtonLink>
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { batchId } = await api<{ ids: string[]; batchId: string }>('/api/reviews/bulk', { body: { urls: lines, pageType, goal, audience, context, clientId: clientId || null } });
      router.push(`/app/reviews?batch=${encodeURIComponent(batchId)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError((err as Error).message, 0));
      setBusy(false);
    }
  };
  const fieldError = (f: string) => (error?.field === f && !lineErrors.length ? error.message : null);

  return (
    <form onSubmit={submit} className="card space-y-5 p-5 sm:p-6" noValidate>
      <Field label="Pages to review" htmlFor="bulk-urls" hint={`One address per line, up to ${max}. ${lines.length} page${lines.length === 1 ? '' : 's'} added.`} error={fieldError('urls')}>
        <Textarea id="bulk-urls" rows={8} value={urls} onChange={(e) => setUrls(e.target.value)} className="font-mono text-[13px]" placeholder={'client.co.uk/\nclient.co.uk/services/implants\nclient.co.uk/offers/free-consultation'} />
      </Field>
      {lineErrors.length > 0 && (
        <Alert tone="error" title={error?.message}>
          <ul className="mt-1 space-y-1">{lineErrors.map((l) => <li key={`${l.line}-${l.url}`}><span className="font-mono">{l.url}</span>: {l.error}</li>)}</ul>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Page type" htmlFor="bulk-type">
          <Select id="bulk-type" value={pageType} onChange={(e) => setPageType(e.target.value)}>{pageTypes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>
        </Field>
        <Field label="What should visitors do?" htmlFor="bulk-goal">
          <Select id="bulk-goal" value={goal} onChange={(e) => setGoal(e.target.value)}>{goals.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>
        </Field>
      </div>
      <Field label="Who are the pages for?" htmlFor="bulk-audience" hint="The same audience is used for every page in the batch." error={fieldError('audience')}>
        <Input id="bulk-audience" value={audience} maxLength={240} placeholder="Adults in Bristol looking for a private dentist" onChange={(e) => setAudience(e.target.value)} />
      </Field>
      <Field label="Anything else we should know?" htmlFor="bulk-context" optional error={fieldError('context')}>
        <Textarea id="bulk-context" rows={2} maxLength={1000} value={context} onChange={(e) => setContext(e.target.value)} />
      </Field>
      {clients.length > 0 && (
        <Field label="Client folder" htmlFor="bulk-client" optional>
          <Select id="bulk-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">No client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      )}
      {remaining != null && lines.length > remaining && <Alert tone="warning">You have {remaining} review{remaining === 1 ? '' : 's'} left this month, so this batch is too big. Remove some pages or change plan.</Alert>}
      {error && !error.field && !lineErrors.length && <Alert tone="error">{error.message}</Alert>}
      <Button type="submit" loading={busy} disabled={!lines.length || lines.length > max}>Review {lines.length || ''} page{lines.length === 1 ? '' : 's'}</Button>
    </form>
  );
}
