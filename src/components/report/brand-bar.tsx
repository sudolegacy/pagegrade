import type { ReportBrand } from '@/lib/server/brand';

/** The agency's own branding at the top of a shared or printed report. Server-safe. */
export function BrandBar({ brand, note }: { brand: ReportBrand; note?: string }) {
  const site = brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4" style={{ borderTop: `4px solid ${brand.color || '#15803d'}` }}>
      <div className="flex min-w-0 items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {brand.logoUrl && <img src={brand.logoUrl} alt={brand.name || 'Logo'} className="h-10 w-auto max-w-[220px] object-contain" />}
        <div className="min-w-0">
          {brand.name && <p className="truncate text-[15px] font-semibold text-ink">{brand.name}</p>}
          {note && <p className="text-[12.5px] text-zinc-500">{note}</p>}
        </div>
      </div>
      {site && (brand.website.startsWith('http') ? <a href={brand.website} className="text-[13px] text-zinc-500 hover:text-ink" rel="noopener noreferrer" target="_blank">{site}</a> : <span className="text-[13px] text-zinc-500">{site}</span>)}
    </div>
  );
}
