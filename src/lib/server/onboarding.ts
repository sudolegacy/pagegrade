import { db } from './db';
import { entitledPlan } from './reviews';
import type { User } from './users';
import { BULK_MAX } from '../plans';
import type { OnboardingStep } from '../onboarding';

/** Week one of the agency playbook: weekly checks on five client pages. Keep the monitors step title in step with it. */
export const ONBOARDING_MONITORS = 5;

export type AgencyOnboarding = { steps: OnboardingStep[]; done: number; complete: boolean };

/**
 * The four-step setup checklist for Agency accounts (and admins, who pass
 * `admin`); null for everyone else. Each step is done from what the account
 * has actually done, so there is nothing to tick.
 */
export function agencyOnboarding(user: User, opts: { admin?: boolean } = {}): AgencyOnboarding | null {
  if (!opts.admin && entitledPlan(user).id !== 'agency') return null;
  const conn = db();
  const exists = (sql: string) => !!conn.prepare(sql).get(user.id);
  const monitors = (conn.prepare('SELECT COUNT(*) AS n FROM monitors WHERE user_id = ? AND active = 1').get(user.id) as { n: number }).n;

  const steps: OnboardingStep[] = [
    {
      id: 'brand', title: 'Add your logo and name to reports', href: '/app/settings',
      hint: 'Shared reports and PDFs show your agency instead of PageGrade.',
      done: !!(user.brand.name.trim() || user.brand.logo),
    },
    {
      id: 'client', title: 'Create a client folder', href: '/app/clients',
      hint: "Keep each client's reviews and weekly checks together.",
      done: exists('SELECT 1 FROM clients WHERE user_id = ? LIMIT 1'),
    },
    {
      id: 'bulk', title: "Review a client's pages in bulk", href: '/app/bulk',
      hint: `Paste up to ${BULK_MAX} pages and get every report in one go.`,
      done: exists("SELECT 1 FROM reviews WHERE user_id = ? AND origin = 'bulk' LIMIT 1"),
    },
    {
      id: 'monitors', title: 'Re-check five client pages weekly', href: '/app/monitoring',
      hint: 'You get an email when one of them gets worse.',
      done: monitors >= ONBOARDING_MONITORS,
      ...(monitors > 0 && monitors < ONBOARDING_MONITORS ? { progress: `${monitors} of ${ONBOARDING_MONITORS}` } : {}),
    },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, complete: done === steps.length };
}
