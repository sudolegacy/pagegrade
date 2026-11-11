'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { Button, buttonClass } from '@/components/ui/button';
import { SITE } from '@/lib/site';

/** Shown when a page fails to render. The error details stay in the server logs. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main id="content" className="container-page grid min-h-[70dvh] place-items-center py-20">
      <div className="max-w-md text-center">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-ink">This page did not load properly</h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-zinc-600">
          Please try again. If it keeps happening, email <a className="link" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>
          {error.digest ? <> and quote reference <code className="rounded bg-zinc-100 px-1 py-0.5 text-[13px]">{error.digest}</code></> : null}.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/" className={buttonClass('secondary')}>Go to the home page</Link>
        </div>
      </div>
    </main>
  );
}
