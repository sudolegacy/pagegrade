'use client';
import * as T from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <T.Provider delayDuration={250}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content side={side} sideOffset={6} className="z-50 max-w-64 rounded-md bg-ink px-2.5 py-1.5 text-[12.5px] leading-snug text-white shadow-pop data-[state=delayed-open]:animate-fade-in">
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
