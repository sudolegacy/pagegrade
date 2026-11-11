import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { SITE } from '@/lib/site';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-page flex h-16 items-center">
        <Link href="/" aria-label="PageGrade home"><Logo /></Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-[6vh] sm:pt-[9vh]">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
      <footer className="container-page flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pb-8 text-[13px] text-zinc-500">
        <Link href="/terms" className="hover:text-zinc-800">Terms</Link>
        <Link href="/privacy" className="hover:text-zinc-800">Privacy</Link>
        <a href={`mailto:${SITE.supportEmail}`} className="hover:text-zinc-800">Support</a>
      </footer>
    </div>
  );
}
