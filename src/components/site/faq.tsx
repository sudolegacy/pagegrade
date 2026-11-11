import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export type FaqItem = { q: string; a: ReactNode };

/** Accessible FAQ built on <details>, so it works without JavaScript. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="card divide-y divide-zinc-100">
      {items.map((it) => (
        <details key={it.q} className="group px-5 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4.5 text-[15px] font-medium text-ink marker:hidden [&::-webkit-details-marker]:hidden">
            {it.q}
            <ChevronDown className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="-mt-1 pb-5 text-[14.5px] leading-relaxed text-zinc-600">{it.a}</div>
        </details>
      ))}
    </div>
  );
}

/** JSON-LD for FAQ rich results (plain-text answers only). */
export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  };
}
