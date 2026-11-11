'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, MoreHorizontal, RotateCcw, Share2, Trash2 } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/menu';
import { Alert, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';

export function ReviewActions({ id, status, shareId: initialShare, appUrl }: { id: string; status: string; shareId: string | null; appUrl: string }) {
  const router = useRouter();
  const toast = useToast();
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareId, setShareId] = useState(initialShare);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shareUrl = shareId ? `${appUrl}/r/${shareId}` : '';

  const setSharing = async (enabled: boolean) => {
    setBusy(true); setError(null);
    try { const r = await api<{ shareId: string | null }>(`/api/reviews/${id}/share`, { body: { enabled } }); setShareId(r.shareId); toast(enabled ? 'Share link created' : 'Share link turned off'); }
    catch (e) { setError((e as Error).message); }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true); setError(null);
    try { await api(`/api/reviews/${id}`, { method: 'DELETE' }); toast('Review deleted'); router.replace('/app/reviews'); router.refresh(); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  };

  return (
    <div className="flex items-center gap-2">
      {status === 'complete' && <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)}><Share2 className="size-3.5" aria-hidden />Share</Button>}
      {(status === 'complete' || status === 'failed') && <ButtonLink href={`/app/new?from=${id}`} variant="secondary" size="sm"><RotateCcw className="size-3.5" aria-hidden />Review again</ButtonLink>}
      <Menu trigger={<button className="grid size-8 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-600 shadow-card hover:bg-zinc-50" aria-label="More actions"><MoreHorizontal className="size-4" /></button>}>
        {status === 'complete' && <MenuItem icon={<Link2 />} onSelect={() => setShareOpen(true)}>Share link…</MenuItem>}
        {status === 'complete' && <MenuSeparator />}
        <MenuItem danger icon={<Trash2 />} onSelect={() => setDeleteOpen(true)}>Delete review</MenuItem>
      </Menu>

      <Dialog open={shareOpen} onOpenChange={setShareOpen} title="Share this report" description="Anyone with the link can view the report and its screenshots. They cannot see your other reviews or your account.">
        {error && <Alert tone="error" className="mb-4">{error}</Alert>}
        {shareId ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
              <Button onClick={async () => { await navigator.clipboard.writeText(shareUrl).catch(() => undefined); toast('Link copied'); }}>Copy</Button>
            </div>
            <button className="text-[13px] font-medium text-red-600 hover:text-red-700" onClick={() => setSharing(false)} disabled={busy}>Turn off link</button>
          </div>
        ) : (
          <Button onClick={() => setSharing(true)} loading={busy}><Link2 className="size-4" aria-hidden />Create share link</Button>
        )}
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete this review?" description="The report, screenshots and any share link are removed permanently. This does not give the review back to your allowance.">
        {error && <Alert tone="error" className="mb-4">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={remove} loading={busy}>Delete review</Button>
        </div>
      </Dialog>
    </div>
  );
}
