import type { Metadata } from 'next';
import { ResetForm } from '@/components/app/auth-forms';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false }, referrer: 'no-referrer' };
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token;
  return <ResetForm token={typeof token === 'string' ? token : ''} />;
}
