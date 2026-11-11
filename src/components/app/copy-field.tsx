'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the field is selectable */ }
  };
  return (
    <div className="flex gap-2">
      <input readOnly aria-label={label} value={value} onFocus={(e) => e.currentTarget.select()}
        className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 font-mono text-[13.5px] text-ink" />
      <Button variant="secondary" onClick={copy}>{copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}{copied ? 'Copied' : 'Copy'}</Button>
    </div>
  );
}
