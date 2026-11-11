import type { Report } from '@/lib/engine/report';

/** Screenshot locations for a report (server-safe: no client code). */
export type ProfileAsset = { src: string; width: number; height: number };
export type ReportAssets = { desktop: ProfileAsset | null; mobile: ProfileAsset | null };

export function assetsFor(report: Report, src: (file: string) => string): ReportAssets {
  const make = (p: Report['capture']['desktop']): ProfileAsset | null => (p ? { src: src(p.files.full), width: p.viewport.width, height: p.capturedHeight } : null);
  return { desktop: make(report.capture.desktop), mobile: make(report.capture.mobile) };
}
