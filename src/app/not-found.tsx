import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <>
      <SiteHeader sticky={false} />
      <main id="content" className="container-page grid min-h-[60dvh] place-items-center py-20">
        <div className="max-w-md text-center">
          <p className="eyebrow">404</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-ink">We could not find that page</h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-zinc-600">The link may be out of date, or the page may have been removed. If someone shared a report with you, they may have turned sharing off.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/">Go to the home page</ButtonLink>
            <ButtonLink href="/app" variant="secondary">Open your reviews</ButtonLink>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
