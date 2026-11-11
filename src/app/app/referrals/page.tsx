import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/session';
import { referralStats } from '@/lib/server/referrals';
import { CopyField } from '@/components/app/copy-field';
import { shortDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Refer and earn' };
export const dynamic = 'force-dynamic';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export default async function ReferralsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const s = referralStats(user);
  const stats = [
    { label: 'Sign-ups from your link', value: String(s.signups) },
    { label: 'Paying customers', value: String(s.paying) },
    { label: 'Waiting (30-day hold)', value: gbp(s.pendingPence) },
    { label: 'Ready to pay out', value: gbp(s.payablePence) },
    { label: 'Paid to you', value: gbp(s.paidPence) },
  ];
  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Refer and earn</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-zinc-500">
          Earn {s.percent}% of everything a customer you refer pays for their first {s.months} months. Each commission becomes payable {s.holdDays} days after the payment, and we pay by bank transfer once you have £{s.payoutMinGbp} or more.{' '}
          <Link href="/partners" className="font-medium text-brand-700 hover:text-brand-800">Programme terms</Link>
        </p>
      </header>
      <section className="card p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold text-ink">Your link</h2>
        <p className="mb-3 mt-1 text-[13.5px] text-zinc-500">Anyone who signs up within 60 days of clicking it counts as your referral. Add it to your proposals, newsletter or the reports you send clients.</p>
        <CopyField value={s.url} label="Your referral link" />
      </section>
      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((x) => (
          <div key={x.label} className="card p-4">
            <p className="text-[12.5px] text-zinc-500">{x.label}</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums text-ink">{x.value}</p>
          </div>
        ))}
      </section>
      <section className="card overflow-hidden">
        <h2 className="border-b border-zinc-100 px-5 py-4 text-[15px] font-semibold text-ink">Recent commissions</h2>
        {s.recent.length === 0 ? <p className="px-5 py-4 text-[14px] text-zinc-500">None yet. Commissions appear here when someone you referred pays.</p> : (
          <table className="w-full text-left text-[13.5px]">
            <thead className="bg-zinc-50 text-[12px] text-zinc-500"><tr><th className="px-5 py-2 font-medium">Date</th><th className="px-5 py-2 font-medium">Payment</th><th className="px-5 py-2 font-medium">Your commission</th><th className="px-5 py-2 font-medium">Status</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {s.recent.map((r, i) => (
                <tr key={i}>
                  <td className="px-5 py-2.5 text-zinc-600">{shortDate(r.createdAt)}</td>
                  <td className="px-5 py-2.5 tabular-nums">{gbp(r.amountPence)}</td>
                  <td className="px-5 py-2.5 font-medium tabular-nums text-ink">{gbp(r.commissionPence)}</td>
                  <td className="px-5 py-2.5 text-zinc-600">{r.paidOutAt ? `Paid ${shortDate(r.paidOutAt)}` : r.createdAt > Date.now() - s.holdDays * 86_400_000 ? 'On hold' : 'Ready'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="text-[13px] text-zinc-500">Ready to be paid? Email us your bank details from the address on your account and we will send the transfer.</p>
    </div>
  );
}
