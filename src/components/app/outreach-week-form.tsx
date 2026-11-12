'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Field, Input, Select } from '@/components/ui/field';
import { api, ApiError } from '@/lib/api';

export type OutreachWeekValues = {
  weekStart: number; prospectsEmailed: number; replies: number; packRequests: number; optOuts: number; bounces: number; calls: number; note: string;
};

const FIELDS = [
  { key: 'prospectsEmailed', label: 'Prospects emailed', hint: 'Dashboard: Prospects contacted', required: true },
  { key: 'replies', label: 'Replies', hint: 'Dashboard: Replied', required: true },
  { key: 'packRequests', label: 'Pack requests', hint: 'Replies asking for a pack, plus requests from the agencies page', required: true },
  { key: 'optOuts', label: 'Opt-outs', hint: 'Dashboard: Opted out', required: true },
  { key: 'bounces', label: 'Bounces', hint: 'Dashboard: Bounced', required: true },
  { key: 'calls', label: 'Calls', hint: '15-minute calls held or booked', required: false },
] as const;
type CountKey = (typeof FIELDS)[number]['key'];
type Values = Record<CountKey, string> & { note: string };
type Errors = Partial<Record<CountKey | 'note' | 'weekStart', string>>;

const BLANK: Values = { prospectsEmailed: '', replies: '', packRequests: '', optOuts: '', bounces: '', calls: '', note: '' };

const valuesFor = (weeks: OutreachWeekValues[], week: number): Values => {
  const saved = weeks.find((w) => w.weekStart === week);
  if (!saved) return BLANK;
  return {
    prospectsEmailed: String(saved.prospectsEmailed), replies: String(saved.replies), packRequests: String(saved.packRequests),
    optOuts: String(saved.optOuts), bounces: String(saved.bounces), calls: String(saved.calls), note: saved.note,
  };
};

/**
 * Admin: the week's outreach numbers from the Autopilot sheet, which the app cannot see. `options` are the Mondays on offer, newest
 * (the current week) first; labels are formatted on the server so every browser shows the same dates.
 */
export function OutreachWeekForm({ weeks, options }: { weeks: OutreachWeekValues[]; options: { weekStart: number; label: string }[] }) {
  const router = useRouter();
  const [week, setWeek] = useState(options[0]?.weekStart ?? 0);
  const [values, setValues] = useState<Values>(() => valuesFor(weeks, options[0]?.weekStart ?? 0));
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const saved = new Set(weeks.map((w) => w.weekStart));
  const chosen = options.find((o) => o.weekStart === week);

  const choose = (next: number) => {
    setWeek(next);
    setValues(valuesFor(weeks, next));
    setErrors({});
    setNotice(null);
  };
  const edit = (key: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setNotice(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const found: Errors = {};
    const counts = {} as Record<CountKey, number>;
    for (const f of FIELDS) {
      const text = values[f.key].trim();
      if (!text) { if (f.required) found[f.key] = 'Enter a number, or 0 if there were none.'; else counts[f.key] = 0; continue; }
      if (!/^\d+$/.test(text)) found[f.key] = 'Use a whole number, like 12.';
      else counts[f.key] = Number(text);
    }
    setErrors(found);
    if (Object.keys(found).length) { setNotice({ tone: 'error', text: 'Fix the highlighted numbers and try again.' }); return; }

    setBusy(true);
    setNotice(null);
    try {
      await api('/api/admin/outreach', { body: { weekStart: week, ...counts, note: values.note } });
      setNotice({ tone: 'success', text: `Saved the week to ${chosen?.label ?? 'that Monday'}.` });
      router.refresh();
    } catch (err) {
      const field = err instanceof ApiError ? err.field : undefined;
      if (field && (field === 'note' || field === 'weekStart' || FIELDS.some((f) => f.key === field))) setErrors({ [field]: (err as Error).message });
      setNotice({ tone: 'error', text: field ? 'Fix the highlighted field and try again.' : (err as Error).message });
    } finally { setBusy(false); }
  };

  const describe = (id: string, error?: string) => `${id}-${error ? 'error' : 'hint'}`;

  return (
    <form onSubmit={submit} noValidate className="card p-4 sm:p-5">
      <p className="max-w-3xl text-[13.5px] leading-relaxed text-zinc-600">
        Copy these from the Autopilot sheet&apos;s Dashboard tab on Monday. The Dashboard shows running totals, so enter what changed since last Monday.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Week" htmlFor="outreach-week" hint="The seven days up to that Monday." error={errors.weekStart} className="sm:col-span-2 lg:col-span-1">
          <Select id="outreach-week" value={week} invalid={!!errors.weekStart} aria-describedby={describe('outreach-week', errors.weekStart)} onChange={(e) => choose(Number(e.target.value))}>
            {options.map((o) => <option key={o.weekStart} value={o.weekStart}>Week to {o.label}{saved.has(o.weekStart) ? ' · saved' : ''}</option>)}
          </Select>
        </Field>
        {FIELDS.map((f) => {
          const id = `outreach-${f.key}`;
          return (
            <Field key={f.key} label={f.label} htmlFor={id} hint={f.hint} error={errors[f.key]} optional={!f.required}>
              <Input id={id} type="number" inputMode="numeric" min={0} step={1} value={values[f.key]} invalid={!!errors[f.key]}
                aria-describedby={describe(id, errors[f.key])} onChange={(e) => edit(f.key, e.target.value)} />
            </Field>
          );
        })}
        <Field label="Note" htmlFor="outreach-note" optional error={errors.note} className="sm:col-span-2" hint="For example, a new subject line you tried.">
          <Input id="outreach-note" value={values.note} maxLength={500} invalid={!!errors.note} aria-describedby={describe('outreach-note', errors.note)}
            onChange={(e) => edit('note', e.target.value)} />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy}>{saved.has(week) ? 'Update this week' : 'Save this week'}</Button>
        {saved.has(week) && <span className="text-[13px] text-zinc-500">Already saved. Saving again replaces it.</span>}
      </div>
      <div aria-live="polite">{notice && <Alert tone={notice.tone} className="mt-3">{notice.text}</Alert>}</div>
    </form>
  );
}
