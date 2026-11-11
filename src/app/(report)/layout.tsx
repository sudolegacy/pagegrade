/**
 * Public report pages pick their own frame: the sample and normal shared reports show the PageGrade site
 * header and footer (see sample/layout.tsx and r/[shareId]/layout.tsx); white-label shared reports do not.
 */
export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
