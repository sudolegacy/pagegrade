import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';

/** The sample report. The site header scrolls away so the report's section bar can stick. */
export default function SampleLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader sticky={false} />
      <main className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-8 sm:py-10">{children}</main>
      <SiteFooter />
    </>
  );
}
