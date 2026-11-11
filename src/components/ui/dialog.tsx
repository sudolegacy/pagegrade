'use client';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Dialog({ open, onOpenChange, title, description, children, className, trigger }: { open?: boolean; onOpenChange?: (o: boolean) => void; title: ReactNode; description?: ReactNode; children?: ReactNode; className?: string; trigger?: ReactNode }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <D.Content className={cn('fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-pop focus:outline-none data-[state=open]:animate-slide-up', className)}>
          <D.Title className="pr-8 text-[17px] font-semibold text-ink">{title}</D.Title>
          {description ? <D.Description className="mt-1.5 text-[14px] leading-relaxed text-zinc-600">{description}</D.Description> : <D.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</D.Description>}
          <div className="mt-5">{children}</div>
          <D.Close className="absolute right-4 top-4 rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700" aria-label="Close"><X className="size-4" /></D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
export const DialogClose = D.Close;
