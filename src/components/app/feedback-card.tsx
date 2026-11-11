'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Field, Textarea } from '@/components/ui/field';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

/** One question for new users: why they signed up and what would make it worth paying for. */
export function FeedbackCard({ reasons }: { reasons: ReadonlyArray<{ id: string; label: string }> }) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'open' | 'sending' | 'done' | 'hidden'>('open');
  const send = async (value: string) => {
    setState('sending');
    try { await api('/api/feedback', { body: { kind: 'signup', answer: value, comment: value === 'dismissed' ? '' : comment } }); } catch { /* not worth interrupting the user */ }
    setState(value === 'dismissed' ? 'hidden' : 'done');
  };
  if (state === 'hidden') return null;
  if (state === 'done') return <Alert tone="success" title="Thank you">We read every answer. If you would like to tell us more, reply to any PageGrade email.</Alert>;
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">One quick question</h2>
          <p className="mt-0.5 text-[13.5px] text-zinc-600">What did you sign up to do? It helps us build the right things.</p>
        </div>
        <button type="button" onClick={() => send('dismissed')} className="shrink-0 text-[13px] text-zinc-400 hover:text-zinc-600">Not now</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {reasons.map((r) => (
          <button key={r.id} type="button" aria-pressed={answer === r.id} onClick={() => setAnswer(r.id)}
            className={cn('rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors', answer === r.id ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-zinc-200 text-zinc-700 hover:border-zinc-300')}>{r.label}</button>
        ))}
      </div>
      {answer && (
        <div className="mt-4 space-y-3">
          <Field label="What would make PageGrade worth paying for?" htmlFor="fb-comment" optional>
            <Textarea id="fb-comment" rows={2} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
          <Button size="sm" loading={state === 'sending'} onClick={() => send(answer)}>Send</Button>
        </div>
      )}
    </section>
  );
}
