'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/** URL box that hands off to the full review form (or sign-up when signed out). */
export function StartForm({ target = '/app/new', cta = 'Review my page', size = 'lg', className, dark }: { target?: string; cta?: string; size?: 'md' | 'lg'; className?: string; dark?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); router.push(`${target}${url.trim() ? `?url=${encodeURIComponent(url.trim())}` : ''}`); };
  return (
    <form onSubmit={submit} className={cn('flex w-full flex-col gap-2 sm:flex-row', className)}>
      <label htmlFor="start-url" className="sr-only">Your landing page URL</label>
      <div className="relative flex-1">
        <Globe className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
        <input id="start-url" inputMode="url" autoComplete="url" placeholder="yourcompany.com/landing-page" value={url} onChange={(e) => setUrl(e.target.value)}
          className={cn('w-full rounded-lg border bg-white pl-10 pr-3 text-[15px] text-ink shadow-[0_1px_2px_rgb(16_24_20/0.05)] placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/15', size === 'lg' ? 'h-12' : 'h-10', dark ? 'border-white/10' : 'border-zinc-300')} />
      </div>
      <Button type="submit" size={size}>{cta}<ArrowRight className="size-4" aria-hidden /></Button>
    </form>
  );
}
