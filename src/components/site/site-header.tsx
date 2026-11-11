'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import * as D from '@radix-ui/react-dialog';
import { Menu as MenuIcon, X } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { ButtonLink, buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/grade', label: 'Free grader' },
  { href: '/sample', label: 'Sample report' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/agencies', label: 'For agencies' },
  { href: '/blog', label: 'Guides' },
];

export function SiteHeader({ sticky = true }: { sticky?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => !href.includes('#') && (path === href || path.startsWith(`${href}/`));
  return (
    <header className={cn('z-40 border-b border-zinc-200/70 bg-canvas/85 backdrop-blur-md', sticky && 'sticky top-0')}>
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="PageGrade home" className="shrink-0"><Logo /></Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1 text-[14px] font-medium text-zinc-600">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-current={active(l.href) ? 'page' : undefined}
                  className={cn('rounded-md px-3 py-2 transition-colors hover:text-ink', active(l.href) && 'text-ink')}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden rounded-md px-3 py-2 text-[14px] font-medium text-zinc-600 hover:text-ink sm:block">Log in</Link>
          <ButtonLink href="/signup" size="sm" className="h-9 px-3.5">Start free</ButtonLink>
          <D.Root open={open} onOpenChange={setOpen}>
            <D.Trigger className={buttonClass('ghost', 'sm', 'size-9 px-0 lg:hidden')} aria-label="Open menu"><MenuIcon className="size-5" aria-hidden /></D.Trigger>
            <D.Portal>
              <D.Overlay className="fixed inset-0 z-50 bg-zinc-950/30 data-[state=open]:animate-fade-in" />
              <D.Content className="fixed inset-x-0 top-0 z-50 rounded-b-2xl border-b border-zinc-200 bg-canvas p-5 shadow-pop data-[state=open]:animate-fade-in">
                <div className="flex items-center justify-between">
                  <D.Title className="sr-only">Menu</D.Title>
                  <Logo />
                  <D.Close className={buttonClass('ghost', 'sm', 'size-9 px-0')} aria-label="Close menu"><X className="size-5" aria-hidden /></D.Close>
                </div>
                <D.Description className="sr-only">Site navigation</D.Description>
                <ul className="mt-5 space-y-1 text-[16px] font-medium text-ink">
                  {LINKS.map((l) => <li key={l.href}><Link href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 hover:bg-zinc-100">{l.label}</Link></li>)}
                  <li><Link href="/login" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 hover:bg-zinc-100">Log in</Link></li>
                </ul>
                <ButtonLink href="/signup" onClick={() => setOpen(false)} className="mt-4 w-full" size="lg">Start free — 3 reviews included</ButtonLink>
              </D.Content>
            </D.Portal>
          </D.Root>
        </div>
      </div>
    </header>
  );
}
