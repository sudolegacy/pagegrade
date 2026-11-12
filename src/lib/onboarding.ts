/** Agency onboarding checklist: shared by the server helper and the card (a client component), so nothing server-only lives here. */
export type OnboardingStep = {
  id: 'brand' | 'client' | 'bulk' | 'monitors';
  title: string;
  hint: string;
  href: string;
  done: boolean;
  /** Set while a step is part-way done, for example "3 of 5". */
  progress?: string;
};

/** Pressing Hide sets this for a year; the overview page reads it so the card stays gone. */
export const ONBOARDING_COOKIE = 'pg_onboarding_hidden';
export const ONBOARDING_COOKIE_MAX_AGE = 365 * 24 * 3600;
