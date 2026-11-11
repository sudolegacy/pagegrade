'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/admin', label: 'Live', exact: true },
  { href: '/admin/plan', label: 'Business plan', exact: false },
];

/** Sub-navigation shared by the admin pages. */
export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin sections" className="mb-6 flex gap-1 border-b border-zinc-200">
      {LINKS.map(({ href, label, exact }) => {
        const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={cn('-mb-px border-b-2 px-3 pb-2.5 pt-1 text-[14px] font-medium transition-colors', active ? 'border-brand-600 text-ink' : 'border-transparent text-zinc-500 hover:text-ink')}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
