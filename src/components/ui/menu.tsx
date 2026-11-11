'use client';
import * as M from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Menu({ trigger, children, align = 'end', className }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
  return (
    <M.Root modal={false}>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content align={align} sideOffset={6} className={cn('z-50 min-w-52 rounded-lg border border-zinc-200 bg-white p-1 shadow-pop data-[state=open]:animate-fade-in', className)}>
          {children}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
export function MenuItem({ children, onSelect, danger, icon }: { children: ReactNode; onSelect?: () => void; danger?: boolean; icon?: ReactNode }) {
  return (
    <M.Item onSelect={onSelect} className={cn('flex cursor-default select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] outline-none data-[highlighted]:bg-zinc-100', danger ? 'text-red-600 data-[highlighted]:bg-red-50' : 'text-zinc-700')}>
      {icon && <span className="text-zinc-400 [&>svg]:size-4" aria-hidden>{icon}</span>}
      {children}
    </M.Item>
  );
}
export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-zinc-100" />;
export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2.5 py-1.5 text-xs text-zinc-500">{children}</M.Label>;
}
