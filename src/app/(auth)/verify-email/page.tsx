import type { Metadata } from 'next';
import Link from 'next/link';
import { MailWarning } from 'lucide-react';

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false } };
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const invalid = (await searchParams).status === 'invalid';
  return (
    <div>
      <div className="mb-5 grid size-11 place-items-center rounded-full bg-amber-50 text-amber-700"><MailWarning className="size-5" /></div>
      <h1 className="text-[26px] font-semibold leading-tight text-ink">{invalid ? 'That link has expired' : 'Confirm your email'}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
        {invalid ? 'Confirmation links work once and expire after 24 hours. Log in and we can send you a fresh one.' : 'We sent a confirmation link to your inbox. Open it to start reviewing pages.'}
      </p>
      <Link href="/app" className="link mt-6 inline-block text-[14px]">Go to PageGrade</Link>
    </div>
  );
}
