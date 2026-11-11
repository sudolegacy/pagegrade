import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SITE } from '@/lib/site';

export type Crumb = { name: string; href: string };

/** Visible breadcrumb trail plus matching BreadcrumbList structured data. The last crumb is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE.url}${c.href}` })),
  };
  return (
    <nav aria-label="Breadcrumb">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-zinc-500">
        {items.map((c, i) => (
          <li key={c.href} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-zinc-300" aria-hidden />}
            {i === items.length - 1
              ? <span aria-current="page" className="truncate text-zinc-700">{c.name}</span>
              : <Link href={c.href} className="hover:text-ink">{c.name}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
