'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

/** Admin: record that a partner's payable commission has been paid by bank transfer. */
export function MarkPaidButton({ referrerId, label }: { referrerId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!window.confirm(`Mark ${label} as paid? Do this after you have sent the bank transfer.`)) return;
    setBusy(true);
    try { await api('/api/admin/referrals', { body: { referrerId } }); router.refresh(); }
    catch (err) { window.alert((err as Error).message); }
    finally { setBusy(false); }
  };
  return <Button size="sm" variant="secondary" loading={busy} onClick={run}>Mark paid</Button>;
}
