'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export type SearchItem = { slug: string; title: string; excerpt: string; category: string; keywords: string };

/**
 * Progressive enhancement: every article is already server-rendered and linked on the page,
 * so search engines and no-JS visitors lose nothing. This only filters a small in-page index.
 */
export function BlogSearch({ items }: { items: SearchItem[] }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return items
      .map((i) => { const hay = `${i.title} ${i.excerpt} ${i.category} ${i.keywords}`.toLowerCase(); return { i, s: terms.filter((t) => hay.includes(t)).length }; })
      .filter((x) => x.s === terms.length)
      .map((x) => x.i)
      .slice(0, 8);
  }, [q, items]);
  return (
    <div className="relative w-full max-w-md" role="search">
      <Search className="pointer-events-none absolute left-3.5 top-[22px] size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
      <label htmlFor="blog-q" className="sr-only">Search the guides</label>
      <input id="blog-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guides, e.g. ChatGPT, Bing Places, dentists" autoComplete="off"
        className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-[15px] text-ink shadow-card outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
      {q.trim() && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-pop" aria-live="polite">
          {results.length === 0 ? <p className="px-4 py-3 text-[14px] text-zinc-500">No guides match “{q.trim()}”.</p> : (
            <ul className="divide-y divide-zinc-100">
              {results.map((r) => (
                <li key={r.slug}><Link href={`/blog/${r.slug}`} className="block px-4 py-3 hover:bg-zinc-50">
                  <span className="block text-[12px] font-medium text-brand-700">{r.category}</span>
                  <span className="block text-[14.5px] font-medium leading-snug text-ink">{r.title}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
