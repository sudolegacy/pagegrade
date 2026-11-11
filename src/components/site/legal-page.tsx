import type { ReactNode } from 'react';
import Link from 'next/link';

const DOCS = [
  { href: '/terms', label: 'Terms of service' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/cookies', label: 'Cookie policy' },
];

export function LegalPage({ title, updated, current, intro, children }: { title: string; updated: string; current: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="py-12 sm:py-16">
      <div className="container-page grid gap-10 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Legal documents" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-2 text-[14px] lg:flex-col lg:gap-1">
            {DOCS.map((d) => (
              <li key={d.href}>
                <Link href={d.href} aria-current={d.href === current ? 'page' : undefined}
                  className={d.href === current ? 'block rounded-md bg-white px-3 py-1.5 font-medium text-ink shadow-card ring-1 ring-zinc-200/80' : 'block rounded-md px-3 py-1.5 text-zinc-600 hover:text-ink'}>{d.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="max-w-[720px]">
          <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[40px]">{title}</h1>
          <p className="mt-3 text-[13.5px] text-zinc-500">Last updated {updated}</p>
          {intro && <div className="mt-6 text-[16.5px] leading-relaxed text-zinc-700">{intro}</div>}
          <div className="prose-pg mt-8">{children}</div>
        </article>
      </div>
    </div>
  );
}
