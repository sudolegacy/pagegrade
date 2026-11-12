'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ONBOARDING_COOKIE, ONBOARDING_COOKIE_MAX_AGE, type OnboardingStep } from '@/lib/onboarding';

/** Week-one checklist for Agency accounts. Hide sets a cookie that the overview page reads, so the card stays gone. */
export function OnboardingCard({ steps }: { steps: OnboardingStep[] }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const done = steps.filter((s) => s.done).length;
  const hide = () => {
    document.cookie = `${ONBOARDING_COOKIE}=1; Max-Age=${ONBOARDING_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    setHidden(true);
  };
  return (
    <section aria-labelledby="onboarding-title" className="card overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 id="onboarding-title" className="text-[15px] font-semibold text-ink">Set up your agency in week one</h2>
          <p className="mt-0.5 text-[13.5px] text-zinc-600">{done} of {steps.length} done</p>
        </div>
        <button type="button" onClick={hide} aria-label="Hide the setup checklist" className="shrink-0 text-[13px] text-zinc-400 hover:text-zinc-600">Hide</button>
      </div>
      <div role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}
        className="mx-5 mt-3.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-2 divide-y divide-zinc-100 border-t border-zinc-100">
        {steps.map((step, i) => (
          <li key={step.id}>
            <Link href={step.href} className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-zinc-50">
              <span aria-hidden className={cn('grid size-6 shrink-0 place-items-center rounded-full text-[11.5px] font-semibold', step.done ? 'bg-brand-600 text-white' : 'border border-zinc-300 text-zinc-500')}>
                {step.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-[14px] font-medium leading-snug', step.done ? 'text-zinc-500' : 'text-ink')}>
                  <span className="sr-only">{step.done ? 'Done: ' : 'To do: '}</span>{step.title}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-zinc-500">{step.progress ? `${step.progress} so far. ${step.hint}` : step.hint}</span>
              </span>
              {step.done
                ? <span className="shrink-0 text-[13px] text-zinc-400">View</span>
                : <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand-700">{step.progress ? 'Continue' : 'Start'}<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
