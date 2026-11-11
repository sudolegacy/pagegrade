'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type Option = { id: string; label: string };

/** Admin: move a lead through the pipeline. Remount with a new `key` when the saved status changes. */
export function LeadStatusSelect({ id, status, statuses }: { id: string; status: string; statuses: Option[] }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);
  const change = async (next: string) => {
    const previous = value;
    setValue(next);
    setBusy(true);
    try { await api('/api/admin/leads', { body: { id, status: next } }); router.refresh(); }
    catch (err) { setValue(previous); window.alert((err as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <select aria-label="Lead status" value={value} disabled={busy} onChange={(e) => change(e.target.value)}
      className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-[13px] text-ink shadow-[0_1px_1px_rgb(16_24_20/0.04)] hover:border-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/15 disabled:opacity-60">
      {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  );
}

/** Admin: a short note on a lead. Remount with a new `key` when the saved note changes. */
export function LeadNote({ id, note }: { id: string; note: string }) {
  const router = useRouter();
  const [value, setValue] = useState(note);
  const [busy, setBusy] = useState(false);
  const dirty = value.trim() !== note.trim();
  const save = async () => {
    setBusy(true);
    try { await api('/api/admin/leads', { body: { id, note: value } }); router.refresh(); }
    catch (err) { window.alert((err as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (dirty && !busy) void save(); }}>
      <input aria-label="Lead note" value={value} maxLength={2000} placeholder="Add a note" onChange={(e) => setValue(e.target.value)}
        className="h-8 w-44 min-w-0 rounded-md border border-zinc-300 bg-white px-2 text-[13px] text-ink placeholder:text-zinc-400 hover:border-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/15" />
      {dirty && <Button type="submit" size="sm" variant="secondary" loading={busy}>Save</Button>}
    </form>
  );
}
