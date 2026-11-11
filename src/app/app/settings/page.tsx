import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/session';
import { accountView } from '@/lib/server/account';
import { SettingsForms } from '@/components/app/settings-forms';
import { BrandSettings, MonitorEmailSetting } from '@/components/app/growth-settings';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const account = accountView(user);
  return (
    <div>
      <h1 className="text-[26px] font-semibold text-ink">Settings</h1>
      <p className="mb-8 mt-1 text-[14.5px] text-zinc-600">Manage your profile, notifications and security.</p>
      <div className="card p-6 sm:p-8"><SettingsForms account={account} /></div>
      <section className="card mt-6 p-6 sm:p-8">
        <h2 className="text-[16px] font-semibold text-ink">Monitoring alerts</h2>
        <div className="mt-4"><MonitorEmailSetting initial={account.notifyMonitor} /></div>
      </section>
      <section className="card mt-6 p-6 sm:p-8">
        <h2 className="text-[16px] font-semibold text-ink">Branded reports</h2>
        <p className="mt-1 text-[14px] text-zinc-600">Your logo, name and colour on PDF and shared reports.</p>
        <div className="mt-5"><BrandSettings account={account} /></div>
      </section>
    </div>
  );
}
