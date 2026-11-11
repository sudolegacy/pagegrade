'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, Field, Input } from '@/components/ui/field';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { api, type ApiError } from '@/lib/api';
import type { AccountView } from '@/lib/server/account';

function Section({ title, description, children, danger }: { title: string; description: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className="grid gap-4 border-t border-zinc-200/80 py-8 first:border-t-0 first:pt-0 md:grid-cols-[260px_1fr] md:gap-10">
      <div><h2 className={danger ? 'text-[15px] font-semibold text-red-700' : 'text-[15px] font-semibold text-ink'}>{title}</h2><p className="mt-1 text-[13.5px] leading-relaxed text-zinc-500">{description}</p></div>
      <div className="max-w-lg">{children}</div>
    </section>
  );
}

export function SettingsForms({ account }: { account: AccountView }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(account.name);
  const [notify, setNotify] = useState(account.notifyOnComplete);
  const [saving, setSaving] = useState<string | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwError, setPwError] = useState<ApiError | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault(); setSaving('profile');
    try { await api('/api/account', { method: 'PATCH', body: { name } }); toast('Profile saved'); router.refresh(); } catch (err) { toast((err as Error).message, 'error'); }
    setSaving(null);
  };
  const toggleNotify = async (value: boolean) => {
    setNotify(value);
    try { await api('/api/account', { method: 'PATCH', body: { notifyOnComplete: value } }); toast(value ? 'Email notifications on' : 'Email notifications off'); } catch (err) { setNotify(!value); toast((err as Error).message, 'error'); }
  };
  const changePassword = async (e: FormEvent) => {
    e.preventDefault(); setSaving('password'); setPwError(null);
    try { await api('/api/account/password', { body: { current, next } }); setCurrent(''); setNext(''); toast('Password changed. Other devices were signed out.'); } catch (err) { setPwError(err as ApiError); }
    setSaving(null);
  };
  const deleteAccount = async (e: FormEvent) => {
    e.preventDefault(); setSaving('delete'); setDeleteError(null);
    try { await api('/api/account', { method: 'DELETE', body: { password: deletePw } }); window.location.assign('/?deleted=1'); } catch (err) { setDeleteError((err as Error).message); setSaving(null); }
  };

  return (
    <div>
      <Section title="Profile" description="Your name appears in emails we send you.">
        <form onSubmit={saveProfile} className="space-y-4">
          <Field label="Name" htmlFor="name"><Input id="name" autoComplete="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email" htmlFor="email" hint={<>To change your email address, contact <a className="link" href="mailto:pagegrade1@gmail.com">support</a>.</>}><Input id="email" value={account.email} readOnly disabled /></Field>
          <Button type="submit" loading={saving === 'profile'} disabled={name === account.name}>Save</Button>
        </form>
      </Section>

      <Section title="Notifications" description="We only email you about your own reviews and account.">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-card">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={notify} onChange={(e) => toggleNotify(e.target.checked)} />
          <span><span className="block text-[14px] font-medium text-ink">Email me when a review finishes</span><span className="mt-0.5 block text-[13px] text-zinc-500">Includes the score and a link to the report, or why it could not be completed.</span></span>
        </label>
      </Section>

      <Section title="Password" description="Changing your password signs you out on other devices.">
        <form onSubmit={changePassword} className="space-y-4" noValidate>
          {pwError && !pwError.field && <Alert tone="error">{pwError.message}</Alert>}
          <Field label="Current password" htmlFor="current" error={pwError?.field === 'current' ? pwError.message : null}><Input id="current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} invalid={pwError?.field === 'current'} /></Field>
          <Field label="New password" htmlFor="next" hint="At least 10 characters." error={pwError?.field === 'next' ? pwError.message : null}><Input id="next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} invalid={pwError?.field === 'next'} /></Field>
          <Button type="submit" loading={saving === 'password'} disabled={!current || !next}>Change password</Button>
        </form>
      </Section>

      <Section title="Delete account" description="Permanently delete your account, reviews and screenshots. Any subscription is cancelled immediately." danger>
        <Button variant="secondary" className="text-red-600 hover:text-red-700" onClick={() => setDeleteOpen(true)}>Delete my account</Button>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete your account?" description="This cannot be undone. Your reviews, screenshots and share links are deleted, and any paid plan is cancelled straight away without a refund for the current period.">
          <form onSubmit={deleteAccount} className="space-y-4">
            {deleteError && <Alert tone="error">{deleteError}</Alert>}
            <Field label="Enter your password to confirm" htmlFor="delete-password"><Input id="delete-password" type="password" autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} /></Field>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button type="submit" variant="danger" loading={saving === 'delete'} disabled={!deletePw}>Delete account</Button></div>
          </form>
        </Dialog>
      </Section>
    </div>
  );
}
