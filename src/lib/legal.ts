import { SITE } from '@/lib/site';

/** "PageGrade LTD, a company registered in the UK (company number …), registered office …" with only the parts that are configured. */
export function companyLine() {
  const parts = [`${SITE.company}`];
  if (SITE.companyNumber) parts.push(`company number ${SITE.companyNumber}`);
  if (SITE.companyAddress) parts.push(`registered office ${SITE.companyAddress}`);
  return parts.join(', ');
}

export const LEGAL_UPDATED = '6 November 2026';
export const LEGAL_UPDATED_ISO = '2026-11-06';
