import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app/shell';
import { AdminNav } from '@/components/app/admin-nav';
import { currentUser, isAdmin } from '@/lib/server/session';
import { accountView } from '@/lib/server/account';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login?next=/admin');
  // Non-admins get a plain 404 so the page's existence is not advertised.
  if (!isAdmin(user)) notFound();
  return <AppShell account={accountView(user)}><AdminNav />{children}</AppShell>;
}
