import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

const control = 'w-full rounded-lg border border-zinc-300/90 bg-white text-[15px] text-ink shadow-[0_1px_1px_rgb(16_24_20/0.04)] transition-[border-color,box-shadow] placeholder:text-zinc-400 hover:border-zinc-400/80 focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-zinc-50 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-500/15';

export function Field({ label, htmlFor, hint, error, children, optional, className }: { label: ReactNode; htmlFor: string; hint?: ReactNode; error?: string | null; children: ReactNode; optional?: boolean; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between text-[13.5px] font-medium text-zinc-800">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-zinc-400">Optional</span>}
      </label>
      {children}
      {error ? <p id={`${htmlFor}-error`} className="text-[13px] text-red-600">{error}</p> : hint ? <p id={`${htmlFor}-hint`} className="text-[13px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...props }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, 'h-10 px-3', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...props }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(control, 'min-h-24 px-3 py-2.5 leading-relaxed', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} aria-invalid={invalid || undefined} className={cn(control, 'h-10 appearance-none pl-3 pr-9', className)} {...props}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
    </div>
  );
});

export function Alert({ tone = 'info', title, children, className, action }: { tone?: 'info' | 'error' | 'success' | 'warning'; title?: ReactNode; children?: ReactNode; className?: string; action?: ReactNode }) {
  const tones = {
    info: 'border-zinc-200 bg-zinc-50 text-zinc-700',
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-brand-200 bg-brand-50 text-brand-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex flex-col gap-3 rounded-lg border px-4 py-3 text-[14px] leading-relaxed sm:flex-row sm:items-center', tones[tone], className)}>
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5 opacity-90')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
