import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { SITE } from '@/lib/site';
import { POSTS } from '@/content/blog';

export function SiteFooter() {
  const year = new Date().getFullYear();
  const columns = [
    { title: 'Product', links: [{ href: '/#how-it-works', label: 'How it works' }, { href: '/grade', label: 'Free page grader' }, { href: '/sample', label: 'Sample report' }, { href: '/pricing', label: 'Pricing' }, { href: '/signup', label: 'Create an account' }, { href: '/login', label: 'Log in' }] },
    { title: 'Guides', links: [...POSTS.slice(0, 4).map((p) => ({ href: `/blog/${p.slug}`, label: p.shortTitle })), { href: '/blog', label: 'All guides' }] },
    { title: 'Company', links: [{ href: `mailto:${SITE.supportEmail}`, label: 'Contact support' }, { href: '/partners', label: 'Partner programme' }, { href: '/terms', label: 'Terms of service' }, { href: '/privacy', label: 'Privacy policy' }, { href: '/cookies', label: 'Cookie policy' }] },
  ];
  const legal = [SITE.company, SITE.companyNumber && `Company number ${SITE.companyNumber}`, SITE.companyAddress && `Registered office: ${SITE.companyAddress}`].filter(Boolean).join(' · ');
  return (
    <footer className="border-t border-zinc-200/80 bg-white">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-14 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div className="col-span-2 max-w-xs md:col-span-1">
          <Logo />
          <p className="mt-3 text-[14px] leading-relaxed text-zinc-600">Evidence-based landing page reviews: what to fix first, why it matters and how to fix it.</p>
          <p className="mt-4 text-[13.5px] text-zinc-500">Questions? <a className="link" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a></p>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <h2 className="text-[13px] font-semibold text-ink">{c.title}</h2>
            <ul className="mt-3 space-y-2.5 text-[14px] text-zinc-600">
              {c.links.map((l) => <li key={l.href}>{l.href.startsWith('mailto:') ? <a href={l.href} className="hover:text-ink">{l.label}</a> : <Link href={l.href} className="hover:text-ink">{l.label}</Link>}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-100">
        <div className="container-page flex flex-col gap-2 py-6 text-[12.5px] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {legal}</p>
          <p>Prices are in pounds sterling (GBP).</p>
        </div>
      </div>
    </footer>
  );
}
