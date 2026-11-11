import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app/shell';
import { currentUser } from '@/lib/server/session';
import { accountView } from '@/lib/server/account';

export const metadata: Metadata = { title: { default: 'PageGrade', template: '%s · PageGrade' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  return <AppShell account={accountView(user)}>{children}</AppShell>;
}
