import type { Metadata } from 'next';
import { FlaskConical } from 'lucide-react';
import { ReportView } from '@/components/report/report-view';
import { ReportHeader } from '@/components/report/report-header';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SAMPLE_ASSETS, SAMPLE_REPORT } from '@/content/sample';

export const metadata: Metadata = {
  title: 'Sample report',
  description: 'See a complete PageGrade report: the score, prioritised fixes with highlighted evidence, rewrites, page map, all checks and speed results, for a demo agency page.',
  alternates: { canonical: '/sample' },
};

export default function SamplePage() {
  const r = SAMPLE_REPORT;
  const header = (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2.5 text-[14px] leading-snug text-sky-950">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-sky-700" aria-hidden />
          <span><strong className="font-semibold">This is a real PageGrade report on a fictional page.</strong> We built the Brightline Digital page to test the engine; the business, its clients and its form are not real. Everything below is the engine&rsquo;s unedited output.</span>
        </p>
        <ButtonLink href="/signup" size="sm" className="shrink-0">Review your own page</ButtonLink>
      </div>
      <ReportHeader url={r.finalUrl} pageType={r.intake.pageType} goal={r.intake.goal} createdAt={Date.parse(r.createdAt)}
        eyebrow={<Badge tone="blue" className="mb-2">Sample report</Badge>} />
    </div>
  );
  return <ReportView report={r} assets={SAMPLE_ASSETS} header={header} nav="page" />;
}
