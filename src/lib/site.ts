import { CHECK_COUNT } from '@/lib/engine/catalog';
/** Public site constants (safe for client and server). */
export const SITE = {
  name: 'PageGrade',
  company: 'PageGrade LTD',
  url: (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'pagegrade1@gmail.com',
  description: `PageGrade reviews your landing page against ${CHECK_COUNT} conversion checks across clarity, calls to action, trust, design, persuasion, mobile and speed, with the evidence behind every finding and the fixes to make first.`,
  /** Optional legal details for the footer and legal pages (UK companies must show these once known). */
  companyNumber: process.env.NEXT_PUBLIC_COMPANY_NUMBER || '',
  companyAddress: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || '',
};
