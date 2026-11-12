'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import * as D from '@radix-ui/react-dialog';
import { CreditCard, GitCompareArrows, History as HistoryIcon, LayoutGrid, ChartLine, LogOut, Menu as MenuIcon, Plus, Settings, Shield, X, ChevronsUpDown, LifeBuoy, BookOpen, Activity, Users, Layers, Gift, Magnet } from 'lucide-react';
import { Logo, LogoMark } from '@/components/ui/logo';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu';
import { buttonClass } from '@/components/ui/button';
import { Meter } from '@/components/ui/score';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { AccountView } from '@/lib/server/account';
import { SITE } from '@/lib/site';

const NAV = [
  { href: '/app', label: 'Overview', icon: LayoutGrid, exact: true },
  { href: '/app/reviews', label: 'History', icon: HistoryIcon },
  { href: '/app/pages', label: 'Pages', icon: ChartLine },
  { href: '/app/compare', label: 'Compare', icon: GitCompareArrows },
  { href: '/app/monitoring', label: 'Monitoring', icon: Activity },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

/** Agency plan: client folders, bulk reviews and the lead widget, shown just above Settings. */
const AGENCY_NAV = [
  { href: '/app/clients', label: 'Clients', icon: Users },
  { href: '/app/bulk', label: 'Bulk review', icon: Layers },
  { href: '/app/widget', label: 'Lead widget', icon: Magnet },
];

function NavLinks({ admin, agency, onNavigate }: { admin: boolean; agency?: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  const base = agency ? [...NAV.slice(0, -1), ...AGENCY_NAV, NAV[NAV.length - 1]] : NAV;
  const items = admin ? [...base, { href: '/admin', label: 'Admin', icon: Shield }] : base;
  return (
    <nav className="space-y-0.5" aria-label="Main">
      {items.map(({ href, label, icon: Icon, ...rest }) => {
        const active = 'exact' in rest && rest.exact ? path === href : path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} onClick={onNavigate} prefetch aria-current={active ? 'page' : undefined}
            className={cn('group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] font-medium transition-colors', active ? 'bg-white text-ink shadow-card ring-1 ring-zinc-200/80' : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-ink')}>
            <Icon className={cn('size-[17px]', active ? 'text-brand-600' : 'text-zinc-400 group-hover:text-zinc-600')} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function UsageCard({ account }: { account: AccountView }) {
  const { usage, plan } = account;
  if (usage.unlimited) return <div className="rounded-lg border border-zinc-200/80 bg-white px-3 py-2.5 text-[12.5px] text-zinc-600">Admin account · unlimited reviews</div>;
  const pct = usage.limit ? (usage.used / usage.limit) * 100 : 100;
  return (
    <div className="rounded-lg border border-zinc-200/80 bg-white p-3 shadow-card">
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="font-medium text-ink">{plan.name} plan</span>
        <span className="tabular-nums text-zinc-500">{usage.used}/{usage.limit}</span>
      </div>
      <Meter value={pct} tone={pct >= 100 ? 'bad' : pct >= 80 ? 'ok' : 'good'} className="mt-2" />
      <p className="mt-2 text-[12px] leading-snug text-zinc-500">
        {usage.remaining === 0 ? 'No reviews left' : `${usage.remaining} review${usage.remaining === 1 ? '' : 's'} left`}
        {usage.period === 'lifetime' ? ' on Free' : usage.resetsAt ? ` · resets ${new Date(usage.resetsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })}` : ''}
      </p>
      {plan.id !== 'agency' && <Link href="/app/billing" className="mt-2 inline-block text-[12.5px] font-medium text-brand-700 hover:text-brand-800">{plan.id === 'free' ? 'Upgrade' : 'Change plan'} →</Link>}
    </div>
  );
}

function UserMenu({ account, compact }: { account: AccountView; compact?: boolean }) {
  const router = useRouter();
  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined); router.replace('/login'); router.refresh(); };
  const initial = (account.name || account.email).trim().charAt(0).toUpperCase();
  return (
    <Menu align={compact ? 'end' : 'start'} trigger={
      <button className={cn('flex items-center gap-2.5 rounded-lg text-left transition hover:bg-zinc-200/50', compact ? 'p-1' : 'w-full px-2 py-2')} aria-label="Account menu">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[12px] font-semibold text-white">{initial}</span>
        {!compact && <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-ink">{account.name || 'Your account'}</span><span className="block truncate text-[12px] text-zinc-500">{account.email}</span></span>}
        {!compact && <ChevronsUpDown className="size-4 text-zinc-400" aria-hidden />}
      </button>
    }>
      <MenuLabel>{account.email}</MenuLabel>
      <MenuSeparator />
      <MenuItem icon={<Settings />} onSelect={() => router.push('/app/settings')}>Settings</MenuItem>
      <MenuItem icon={<CreditCard />} onSelect={() => router.push('/app/billing')}>Plan & billing</MenuItem>
      <MenuItem icon={<BookOpen />} onSelect={() => router.push('/blog')}>Guides</MenuItem>
      <MenuItem icon={<Gift />} onSelect={() => router.push('/app/referrals')}>Refer and earn</MenuItem>
      <MenuItem icon={<LifeBuoy />} onSelect={() => { window.location.href = `mailto:${SITE.supportEmail}`; }}>Contact support</MenuItem>
      <MenuSeparator />
      <MenuItem icon={<LogOut />} onSelect={logout}>Log out</MenuItem>
    </Menu>
  );
}

export function AppShell({ account, children }: { account: AccountView; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  const newReview = (
    <Link href="/app/new" className={buttonClass('primary', 'md', 'w-full')}><Plus className="size-4" aria-hidden />New review</Link>
  );
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-zinc-200/80 bg-zinc-100/60 px-3 py-4 lg:flex">
        <Link href="/app" className="mb-5 px-2" aria-label="PageGrade overview"><Logo /></Link>
        <div className="mb-4">{newReview}</div>
        <NavLinks admin={account.admin} agency={account.features.clients} />
        <div className="mt-auto space-y-3">
          <UsageCard account={account} />
          <UserMenu account={account} />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-200/80 bg-canvas/90 px-4 backdrop-blur lg:hidden">
        <Link href="/app" aria-label="PageGrade overview"><Logo /></Link>
        <div className="flex items-center gap-1">
          <Link href="/app/new" className={buttonClass('primary', 'sm')}><Plus className="size-4" aria-hidden />New</Link>
          <D.Root open={open} onOpenChange={setOpen}>
            <D.Trigger className="grid size-9 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100" aria-label="Open menu"><MenuIcon className="size-5" /></D.Trigger>
            <D.Portal>
              <D.Overlay className="fixed inset-0 z-50 bg-zinc-950/30 data-[state=open]:animate-fade-in" />
              <D.Content className="fixed inset-y-0 right-0 z-50 flex w-[300px] max-w-[85vw] flex-col bg-canvas p-4 shadow-pop data-[state=open]:animate-fade-in">
                <D.Title className="sr-only">Menu</D.Title>
                <D.Description className="sr-only">Navigate PageGrade</D.Description>
                <div className="mb-5 flex items-center justify-between"><LogoMark /><D.Close className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100" aria-label="Close menu"><X className="size-5" /></D.Close></div>
                <NavLinks admin={account.admin} agency={account.features.clients} onNavigate={() => setOpen(false)} />
                <div className="mt-auto space-y-3"><UsageCard account={account} /><UserMenu account={account} /></div>
              </D.Content>
            </D.Portal>
          </D.Root>
        </div>
      </header>

      <div className="min-w-0">
        {account.verificationRequired && <VerifyBanner email={account.email} />}
        <main className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-8 sm:py-9">{children}</main>
      </div>
    </div>
  );
}

function VerifyBanner({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const resend = async () => {
    setState('sending');
    try { await api('/api/auth/verify', { method: 'POST' }); setState('sent'); } catch (e) { setMsg((e as Error).message); setState('error'); }
  };
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[13.5px] text-amber-900 sm:px-8">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-3 gap-y-1">
        <span>Confirm your email to start reviewing. We sent a link to <strong className="font-medium">{email}</strong>.</span>
        {state === 'sent' ? <span className="font-medium">New link sent.</span> : state === 'error' ? <span className="font-medium">{msg}</span> : (
          <button onClick={resend} disabled={state === 'sending'} className="font-medium underline underline-offset-2 hover:text-amber-950">{state === 'sending' ? 'Sending…' : 'Resend email'}</button>
        )}
      </div>
    </div>
  );
}
