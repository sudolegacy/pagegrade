import { renderToStaticMarkup } from 'react-dom/server';
import { OnboardingCard } from '@/components/app/onboarding-card';
import type { OnboardingStep } from '@/lib/onboarding';

const steps: OnboardingStep[] = [
  { id: 'brand', title: 'Add your logo and name to reports', href: '/app/settings', hint: 'Shared reports and PDFs show your agency instead of PageGrade.', done: true },
  { id: 'client', title: 'Create a client folder', href: '/app/clients', hint: "Keep each client's reviews and weekly checks together.", done: false },
  { id: 'bulk', title: "Review a client's pages in bulk", href: '/app/bulk', hint: 'Paste up to 25 pages and get every report in one go.', done: false },
  { id: 'monitors', title: 'Re-check five client pages weekly', href: '/app/monitoring', hint: 'You get an email when one of them gets worse.', done: false, progress: '3 of 5' },
];
console.log(renderToStaticMarkup(<OnboardingCard steps={steps} />));
