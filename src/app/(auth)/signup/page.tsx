import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignupForm } from '@/components/app/auth-forms';
import { currentUser } from '@/lib/server/session';
import { safeNext } from '@/lib/server/auth-flows';

export const metadata: Metadata = { title: 'Create your free account', description: 'Create a PageGrade account and get 3 full landing page reviews free.' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; url?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const url = typeof sp.url === 'string' ? sp.url.slice(0, 2048) : undefined;
  if (await currentUser()) redirect(url ? `/app/new?url=${encodeURIComponent(url)}` : next);
  return <SignupForm next={next} url={url} />;
}
