'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, Field, Input, Textarea } from '@/components/ui/field';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

const PROSPECTS = 3;
const INLINE_FIELDS = ['name', 'email', 'company', 'website', 'message'];

type Values = { name: string; email: string; company: string; website: string; prospects: string[]; message: string; hp: string };
type Problem = { message: string; field?: string; problems?: { index: number; message: string }[] };

const empty = (): Values => ({ name: '', email: '', company: '', website: '', prospects: Array.from({ length: PROSPECTS }, () => ''), message: '', hp: '' });

const isProspectProblem = (p: unknown): p is { index: number; message: string } =>
  typeof p === 'object' && p !== null && typeof (p as { index?: unknown }).index === 'number' && typeof (p as { message?: unknown }).message === 'string';

/** Quick checks for the required fields, so a typo does not use up one of the few requests allowed per hour. */
function check(v: Values): Problem | null {
  if (!v.name.trim()) return { field: 'name', message: 'Tell us your name.' };
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) return { field: 'email', message: 'Enter a valid work email address.' };
  if (!v.company.trim()) return { field: 'company', message: 'Enter your agency name.' };
  if (!v.website.trim()) return { field: 'website', message: 'Enter your agency website, so we can use your logo and colours.' };
  return null;
}

/** Turns an API error into something the form can show next to the right input. */
function fromApi(err: unknown): Problem {
  if (!(err instanceof ApiError)) return { message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' };
  const raw: unknown = err.data?.problems;
  const problems = Array.isArray(raw) ? (raw as unknown[]).filter(isProspectProblem) : [];
  if (err.field === 'prospects' && problems.length) return { message: err.message, field: 'prospects', problems };
  const at = /^prospects\.(\d+)$/.exec(err.field ?? '');
  if (at) return { message: err.message, field: 'prospects', problems: [{ index: Number(at[1]), message: err.message }] };
  return { message: err.message, field: err.field };
}

const inputId = (problem: Problem) => {
  if (problem.problems?.length) return `pack-prospect-${problem.problems[0].index}`;
  return problem.field && INLINE_FIELDS.includes(problem.field) ? `pack-${problem.field}` : null;
};

export function PackRequestForm({ bookingUrl = '', supportEmail, className }: { bookingUrl?: string; supportEmail: string; className?: string }) {
  const [values, setValues] = useState<Values>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Problem | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const done = useRef<HTMLDivElement>(null);

  useEffect(() => { if (sentTo) done.current?.focus(); }, [sentTo]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setError((e) => (e?.field === key ? null : e));
  };
  const setProspect = (i: number, value: string) => {
    setValues((v) => ({ ...v, prospects: v.prospects.map((p, n) => (n === i ? value : p)) }));
    setError((e) => {
      if (!e?.problems?.some((p) => p.index === i)) return e;
      const rest = e.problems.filter((p) => p.index !== i);
      return rest.length ? { ...e, problems: rest } : null;
    });
  };
  const fail = (problem: Problem) => {
    setError(problem);
    const id = inputId(problem);
    if (id) document.getElementById(id)?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const invalid = check(values);
    if (invalid) { fail(invalid); return; }
    setBusy(true);
    setError(null);
    try {
      // Blank prospect boxes are sent as they are so the server can report errors against the right box.
      await api('/api/leads', { body: { kind: 'pack', name: values.name, email: values.email, company: values.company, website: values.website, prospects: values.prospects.map((p) => p.trim()), message: values.message, hp: values.hp } });
      setSentTo(values.email.trim().toLowerCase());
    } catch (err) {
      fail(fromApi(err));
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    const steps = [
      <>We build your three audits, with your agency’s name and logo on them.</>,
      <>We email the PDFs to <strong className="font-semibold text-ink">{sentTo}</strong>. If nothing has arrived by tomorrow, check your spam folder, then write to <a className="link" href={`mailto:${supportEmail}`}>{supportEmail}</a>.</>,
      <>You send them to your prospects with a note of your own. If you would like to talk it through first, {bookingUrl
        ? <a className="link" href={bookingUrl} target="_blank" rel="noopener noreferrer">book a 15-minute call<span className="sr-only"> (opens in a new tab)</span></a>
        : <a className="link" href={`mailto:${supportEmail}`}>email us</a>}.</>,
    ];
    return (
      <div ref={done} tabIndex={-1} role="status" className={cn('card p-6 outline-none sm:p-8', className)}>
        <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200/70"><CircleCheck className="size-5" aria-hidden /></span>
        <h3 className="mt-4 text-[22px] font-semibold leading-snug text-ink">Got it — expect your pack within one working day</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">Here is what happens next.</p>
        <ol className="mt-5 space-y-3.5 text-[14.5px] leading-relaxed text-zinc-700">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-semibold text-white" aria-hidden>{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const fieldError = (field: string) => (error?.field === field ? error.message : null);
  const prospectError = (i: number) => error?.problems?.find((p) => p.index === i)?.message ?? null;
  const alertMessage = error && !(error.field && INLINE_FIELDS.includes(error.field)) && !error.problems?.length ? error.message : null;

  return (
    <form onSubmit={submit} method="post" noValidate aria-label="Request your free prospect pack" className={cn('card relative space-y-5 p-5 sm:p-7', className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="pack-name" error={fieldError('name')}>
          <Input id="pack-name" name="name" autoComplete="name" required maxLength={80} value={values.name} onChange={(e) => set('name', e.target.value)}
            invalid={!!fieldError('name')} aria-describedby={fieldError('name') ? 'pack-name-error' : undefined} />
        </Field>
        <Field label="Work email" htmlFor="pack-email" error={fieldError('email')}>
          <Input id="pack-email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} value={values.email} onChange={(e) => set('email', e.target.value)}
            invalid={!!fieldError('email')} aria-describedby={fieldError('email') ? 'pack-email-error' : undefined} />
        </Field>
        <Field label="Agency name" htmlFor="pack-company" error={fieldError('company')}>
          <Input id="pack-company" name="organization" autoComplete="organization" required maxLength={120} value={values.company} onChange={(e) => set('company', e.target.value)}
            invalid={!!fieldError('company')} aria-describedby={fieldError('company') ? 'pack-company-error' : undefined} />
        </Field>
        <Field label="Agency website" htmlFor="pack-website" error={fieldError('website')} hint="We take your logo and colours from here.">
          <Input id="pack-website" name="url" inputMode="url" autoComplete="url" placeholder="youragency.com" required maxLength={300} value={values.website} onChange={(e) => set('website', e.target.value)}
            invalid={!!fieldError('website')} aria-describedby={fieldError('website') ? 'pack-website-error' : 'pack-website-hint'} />
        </Field>
      </div>

      <fieldset className="space-y-2.5">
        <legend className="text-[13.5px] font-medium text-zinc-800">Businesses you would like to win <span className="font-normal text-zinc-400">(optional)</span></legend>
        <p id="pack-prospects-hint" className="text-[13px] leading-relaxed text-zinc-500">Paste the page you want audited, usually the homepage or a service page. Leave these blank and we will choose three in your niche and city. Tell us both in the box below.</p>
        {values.prospects.map((value, i) => {
          const err = prospectError(i);
          return (
            <div key={i}>
              <div className="flex items-center gap-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-[12px] font-semibold text-zinc-600" aria-hidden>{i + 1}</span>
                <Input id={`pack-prospect-${i}`} name={`prospect${i + 1}`} inputMode="url" autoComplete="off" placeholder="example.com/services" maxLength={2048}
                  aria-label={`Business ${i + 1}: page address`} value={value} onChange={(e) => setProspect(i, e.target.value)}
                  invalid={!!err} aria-describedby={err ? `pack-prospect-${i}-error` : 'pack-prospects-hint'} />
              </div>
              {err && <p id={`pack-prospect-${i}-error`} className="mt-1 pl-[34px] text-[13px] text-red-600">{err}</p>}
            </div>
          );
        })}
      </fieldset>

      <Field label="Anything else we should know?" htmlFor="pack-message" optional error={fieldError('message')} hint="For example your niche and city, or what you would like us to look at.">
        <Textarea id="pack-message" name="message" rows={3} maxLength={2000} value={values.message} onChange={(e) => set('message', e.target.value)}
          invalid={!!fieldError('message')} aria-describedby={fieldError('message') ? 'pack-message-error' : 'pack-message-hint'} />
      </Field>

      <div className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="pack-hp">Leave this field empty</label>
        <input id="pack-hp" name="hp" tabIndex={-1} autoComplete="off" value={values.hp} onChange={(e) => set('hp', e.target.value)} />
      </div>

      {alertMessage && <Alert tone="error">{alertMessage}</Alert>}
      <Button type="submit" size="lg" loading={busy} className="w-full">Send me my free pack<ArrowRight className="size-4" aria-hidden /></Button>
      <p className="text-center text-[12.5px] leading-relaxed text-zinc-500">We use your details to make your pack and to follow up about it. See our <Link href="/privacy" className="link">privacy policy</Link>.</p>
    </form>
  );
}
