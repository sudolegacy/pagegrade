import { Mail } from 'lucide-react';

/** Plain share links: no third-party scripts, no tracking, no JavaScript. */
export function ShareLinks({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url), t = encodeURIComponent(title);
  const links = [
    { label: 'LinkedIn', aria: 'Share on LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { label: 'X', aria: 'Share on X', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { label: 'Facebook', aria: 'Share on Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: 'Email', aria: 'Share by email', href: `mailto:?subject=${t}&body=${u}` },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] font-medium text-zinc-500">Share</span>
      {links.map((l) => (
        <a key={l.label} href={l.href} target={l.href.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer" aria-label={l.aria}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[12.5px] font-medium text-zinc-600 shadow-card hover:border-zinc-300 hover:text-ink">
          {l.label === 'Email' && <Mail className="size-3.5" aria-hidden />}{l.label}
        </a>
      ))}
    </div>
  );
}
