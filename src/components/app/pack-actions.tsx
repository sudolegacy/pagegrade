'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FileDown, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradeChip } from '@/components/ui/score';
import { useToast } from '@/components/ui/toast';
import { CopyButton } from '@/components/app/copy-button';
import { api } from '@/lib/api';
import { hostPath } from '@/lib/format';
import type { PackView } from '@/lib/server/packs';

const REFRESH_MS = 6000;

/**
 * Admin, in the pipeline: builds a pack from a pack request, then shows how its reviews are getting on, with a
 * link to each review and PDF and the reply to copy. The pack comes from the server; the only request made here
 * is the one that builds it.
 */
export function PackActions({ leadId, company, prospects, pack }: { leadId: string; company: string; prospects: number; pack: PackView | null }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const status = pack?.status ?? null;
  const running = status?.running ?? 0;

  // While reviews are running, read the page again now and then so the progress moves on its own.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [running, router]);

  const canBuild = prospects > 0 && (!status || status.running + status.complete === 0);
  const retry = !!status && status.total > 0 && status.failed === status.total;
  const ready = !!pack && !!status && status.running === 0 && status.complete > 0 && !!pack.reply;

  const build = async () => {
    const pages = `${prospects} review${prospects === 1 ? '' : 's'}`;
    if (!window.confirm(`Build a pack for ${company}? This makes a client folder named after them and queues ${pages}.`)) return;
    setBusy(true);
    try {
      const res = await api<{ queued: number }>(`/api/admin/leads/${leadId}/pack`, { method: 'POST' });
      toast(res.queued ? `Pack started: ${pages} queued` : 'This pack is already built');
      router.refresh();
    } catch (err) { toast((err as Error).message, 'error'); } finally { setBusy(false); }
  };

  const progress = status && status.total > 0
    ? [`${status.complete} of ${status.total} complete`, status.running ? `${status.running} running` : '', status.failed ? `${status.failed} failed` : ''].filter(Boolean).join(' · ')
    : '';
  const folderHref = pack?.clientId ? `/app/clients#client-${pack.clientId}` : null;
  if (!canBuild && !progress) return null;

  return (
    <div className="mt-2 space-y-2 first:mt-0">
      {status && status.total > 0 && (
        <>
          <p className="text-[12.5px] font-medium text-zinc-700" aria-live="polite">{progress}</p>
          <ul className="space-y-1.5">
            {status.reviews.map((r) => (
              <li key={r.id} className="text-[12.5px]">
                <div className="flex items-center gap-2">
                  <Link href={`/app/reviews/${r.id}`} className="link min-w-0 max-w-[150px] truncate" title={r.url}>{hostPath(r.url)}</Link>
                  {r.status === 'complete' && r.score != null ? (
                    <>
                      <span className="font-medium tabular-nums text-ink">{r.score}</span>
                      {r.grade && <GradeChip grade={r.grade} score={r.score} className="h-5 min-w-6 text-[12px]" />}
                      <a href={r.pdfUrl} download className="link inline-flex items-center gap-1" aria-label={`Download the PDF for ${hostPath(r.url)}`}><FileDown className="size-3.5" aria-hidden />PDF</a>
                    </>
                  ) : r.status === 'failed' ? <span className="font-medium text-red-700">Failed</span>
                    : <span className="text-zinc-500">{r.status === 'queued' ? 'Queued' : 'Running'}</span>}
                </div>
                {r.status === 'failed' && r.error && <p className="mt-0.5 line-clamp-2 max-w-[260px] break-words text-[12px] leading-snug text-red-700" title={r.error}>{r.error}</p>}
              </li>
            ))}
          </ul>
          {status.folder && !status.folder.hasLogo && folderHref && status.complete + status.running > 0 && (
            <p className="max-w-[260px] text-[12px] leading-snug text-amber-800">
              No logo yet. <Link href={folderHref} className="link">Add theirs</Link> before you download the PDFs.
            </p>
          )}
        </>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {canBuild && (
          <Button size="sm" variant={retry ? 'secondary' : 'primary'} loading={busy} onClick={build} aria-label={`${retry ? 'Build again' : 'Build pack'} for ${company}`}>
            <PackagePlus className="size-4" aria-hidden />{retry ? 'Build again' : 'Build pack'}
          </Button>
        )}
        {ready && pack && <CopyButton value={pack.reply} label="Copy reply" name={`for ${company}`} />}
        {status && status.total > 0 && folderHref && status.folder && <Link href={folderHref} className="link text-[12.5px]">Folder</Link>}
        {pack && status && status.total > 0 && <Link href={`/app/reviews?batch=${encodeURIComponent(pack.batchId)}`} className="link text-[12.5px]">All reviews</Link>}
      </div>
      {ready && status && status.failed > 0 && <p className="max-w-[260px] text-[12px] leading-snug text-zinc-500">{status.failed} page{status.failed === 1 ? '' : 's'} failed, so the reply covers the {status.complete} that finished.</p>}
    </div>
  );
}
