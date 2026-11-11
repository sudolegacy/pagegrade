import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { GradeForm } from '@/components/grade/grade-form';
import { PAGE_TYPES, GOALS } from '@/lib/engine/intake';
import { env } from '@/lib/server/env';

export const metadata: Metadata = {
  title: 'Free landing page grader: get a score in a minute',
  description: 'Paste a URL and get a free score out of 100 for your landing page, with its three biggest problems. Real browser, desktop and phone. No signup needed.',
  alternates: { canonical: '/grade' },
};

const POINTS = [
  'A score out of 100, by area: clarity, trust, the call to action, mobile and speed',
  'The three problems costing you the most enquiries or sales',
  'An AI search readiness check: can ChatGPT, Perplexity and Google reach and read the page?',
  'A link you can share with your team or your client',
];

export default async function GradePage({ searchParams }: { searchParams: Promise<{ url?: string | string[] }> }) {
  const { url } = await searchParams;
  const pageTypes = Object.entries(PAGE_TYPES).map(([id, v]) => ({ id, label: v }));
  const goals = Object.entries(GOALS).map(([id, v]) => ({ id, label: v.label }));
  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_460px]">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wider text-brand-700">Free page grader</p>
          <h1 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[46px]">How good is your landing page?</h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-zinc-600">
            Paste a URL. PageGrade opens the page in a real browser on desktop and on a phone, runs the same checks as a full review, and scores it out of 100. No account needed.
          </p>
          <ul className="mt-6 space-y-2.5 text-[14.5px] text-zinc-700">
            {POINTS.map((p) => <li key={p} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />{p}</li>)}
          </ul>
          <p className="mt-6 max-w-xl text-[13.5px] leading-relaxed text-zinc-500">
            Want the fixes too? A free account unlocks the full report for this page: every issue with a step-by-step fix, rewritten headlines and buttons, and annotated screenshots.
          </p>
        </div>
        <GradeForm pageTypes={pageTypes} goals={goals} initialUrl={typeof url === 'string' ? url : ''} perDay={env.graderPerIp} />
      </div>
    </div>
  );
}
