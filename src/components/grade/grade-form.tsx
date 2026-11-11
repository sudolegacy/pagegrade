'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, Field, Select } from '@/components/ui/field';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

export type GradeOption = { id: string; label: string };

/** The free grader form: no account needed. */
export function GradeForm({ pageTypes, goals, initialUrl = '', perDay = 3, className }: { pageTypes: GradeOption[]; goals: GradeOption[]; initialUrl?: string; perDay?: number; className?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [pageType, setPageType] = useState(pageTypes[0]?.id ?? '');
  const [goal, setGoal] = useState(goals[0]?.id ?? '');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>('/api/grade', { body: { url, pageType, goal, website } });
      router.push(`/grade/${id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'grade_in_progress' && typeof err.data?.id === 'string') { router.push(`/grade/${err.data.id}`); return; }
      setError({ message: err instanceof Error ? err.message : 'Something went wrong. Please try again.', field: err instanceof ApiError ? err.field : undefined });
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className={cn('card relative space-y-4 p-5 sm:p-6', className)}>
      <Field label="Page address" htmlFor="grade-url" error={error?.field === 'url' ? error.message : null}>
        <div className="relative">
          <Globe className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input id="grade-url" inputMode="url" autoComplete="url" placeholder="yourcompany.com/landing-page" value={url} onChange={(e) => setUrl(e.target.value)} required
            aria-invalid={error?.field === 'url' || undefined} aria-describedby={error?.field === 'url' ? 'grade-url-error' : undefined}
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white pl-10 pr-3 text-[15px] text-ink shadow-[0_1px_2px_rgb(16_24_20/0.05)] placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/15" />
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What kind of page is it?" htmlFor="grade-type">
          <Select id="grade-type" value={pageType} onChange={(e) => setPageType(e.target.value)}>
            {pageTypes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="What should visitors do?" htmlFor="grade-goal">
          <Select id="grade-goal" value={goal} onChange={(e) => setGoal(e.target.value)}>
            {goals.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Select>
        </Field>
      </div>
      <div className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="grade-website">Leave this empty</label>
        <input id="grade-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {error && error.field !== 'url' && <Alert tone="error">{error.message}</Alert>}
      <Button type="submit" size="lg" loading={busy} className="w-full">Grade my page free<ArrowRight className="size-4" aria-hidden /></Button>
      <p className="text-center text-[12.5px] text-zinc-500">No account needed · about a minute · {perDay} free grade{perDay === 1 ? '' : 's'} a day</p>
    </form>
  );
}
