import { cn } from '@/lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0f7a45" />
      <path d="M16 7.5a8.5 8.5 0 1 1-8.5 8.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M12.2 16.3l2.6 2.6 5.2-5.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, mark = true }: { className?: string; mark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em] text-ink', className)}>
      {mark && <LogoMark />}
      PageGrade
    </span>
  );
}
