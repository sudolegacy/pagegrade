'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Copies a block of text (for example an email template) to the clipboard. `name` tells screen readers which one. */
export function CopyButton({ value, label = 'Copy', name, className }: { value: string; label?: string; name?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the text is selectable */ }
  };
  return (
    <>
      <Button size="sm" variant="secondary" className={className} onClick={copy} aria-label={name ? `${label} ${name}` : undefined}>
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? 'Copied' : label}
      </Button>
      <span role="status" className="sr-only">{copied ? 'Copied to the clipboard' : ''}</span>
    </>
  );
}
