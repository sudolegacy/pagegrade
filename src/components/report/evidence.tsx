'use client';
import { useId } from 'react';
import type { Box } from '@/lib/engine/types';

import type { ProfileAsset } from './assets';

export type { ProfileAsset };

/** Crops the full-page screenshot to the area around a finding and outlines it. */
export function EvidenceCrop({ asset, box, profile, label }: { asset: ProfileAsset; box: Box; profile: 'desktop' | 'mobile'; label: string }) {
  const maskId = `hole${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (box.y > asset.height || box.w < 2 || box.h < 2) return null;
  const vw = asset.width;
  const pad = profile === 'desktop' ? 88 : 28;
  const w = profile === 'desktop' ? Math.min(vw, Math.max(760, box.w + pad * 2)) : vw;
  const x = Math.max(0, Math.min(vw - w, box.x + box.w / 2 - w / 2));
  let h = Math.max(w * (profile === 'desktop' ? 0.4 : 0.9), Math.min(box.h + pad * 2, profile === 'desktop' ? 760 : 640));
  h = Math.min(h, asset.height);
  let y = box.h + pad * 2 > h ? box.y - pad : box.y + box.h / 2 - h / 2;
  y = Math.max(0, Math.min(asset.height - h, y));
  return (
    <figure className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      <svg viewBox={`${x} ${y} ${w} ${h}`} className="block h-auto w-full" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        <image href={asset.src} x={0} y={0} width={asset.width} height={asset.height} preserveAspectRatio="none" />
        <rect x={0} y={0} width={asset.width} height={asset.height} fill="rgb(255 255 255 / 0.28)" mask={`url(#${maskId})`} />
        <mask id={maskId}>
          <rect x={0} y={0} width={asset.width} height={asset.height} fill="white" />
          <rect x={box.x - 4} y={box.y - 4} width={box.w + 8} height={box.h + 8} rx={8} fill="black" />
        </mask>
        <rect x={box.x - 4} y={box.y - 4} width={box.w + 8} height={box.h + 8} rx={8} fill="none" stroke="#0f7a45" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="flex items-center justify-between border-t border-zinc-200 bg-white px-3 py-1.5 text-[12px] text-zinc-500">
        <span>{profile === 'desktop' ? 'Desktop' : 'Mobile'} · {Math.round(box.y)}px from the top</span>
      </figcaption>
    </figure>
  );
}

/** Full-page screenshot with numbered markers for each located finding. */
export function PageMap({ asset, markers, onSelect }: { asset: ProfileAsset; markers: { n: number; box: Box; title: string }[]; onSelect?: (n: number) => void }) {
  const r = Math.max(14, asset.width / 52);
  return (
    <svg viewBox={`0 0 ${asset.width} ${asset.height}`} className="block h-auto w-full" role="img" aria-label="Full page screenshot with numbered findings">
      <image href={asset.src} x={0} y={0} width={asset.width} height={asset.height} preserveAspectRatio="none" />
      {markers.filter((m) => m.box.y < asset.height).map((m) => (
        <g key={m.n} className="cursor-pointer" onClick={() => onSelect?.(m.n)}>
          <title>{`${m.n}. ${m.title}`}</title>
          <rect x={m.box.x - 3} y={m.box.y - 3} width={m.box.w + 6} height={m.box.h + 6} rx={6} fill="rgb(15 122 69 / 0.07)" stroke="#0f7a45" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <circle cx={Math.max(r, m.box.x)} cy={Math.max(r, m.box.y)} r={r} fill="#0f7a45" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <text x={Math.max(r, m.box.x)} y={Math.max(r, m.box.y)} textAnchor="middle" dominantBaseline="central" fontSize={r * 1.05} fontWeight={600} fill="#fff" fontFamily="var(--font-geist-sans), system-ui">{m.n}</text>
        </g>
      ))}
    </svg>
  );
}
