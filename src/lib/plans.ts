/** Plan catalogue (client-safe). Prices are in GBP; paid plans bill monthly or yearly via Stripe. */
export type PlanId = 'free' | 'starter' | 'pro' | 'agency';
export type BillingInterval = 'month' | 'year';

/** What a plan unlocks on top of its review allowance. */
export type PlanLimits = {
  /** Pages re-checked automatically every week, with email alerts. */
  monitors: number;
  /** Reviews that can be queued or running at the same time. */
  inflight: number;
  /** Download reports as PDF. */
  pdf: boolean;
  /** Your logo and name on shared reports and PDFs instead of PageGrade's. */
  branding: boolean;
  /** Organise reviews and monitored pages into client folders. */
  clients: boolean;
  /** Review up to BULK_MAX pages in one go. */
  bulk: boolean;
};

export type Plan = {
  id: PlanId;
  name: string;
  priceGbp: number;
  /** Price for a year, billed once (null for Free). Two months free compared with monthly. */
  yearlyPriceGbp: number | null;
  reviews: number;
  /** 'lifetime' allowances never reset; 'month' allowances reset every month, on yearly billing too. */
  period: 'lifetime' | 'month';
  lookupKey: string | null;
  yearlyLookupKey: string | null;
  blurb: string;
  features: string[];
  limits: PlanLimits;
  highlight?: boolean;
};

export const BULK_MAX = 25;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free', name: 'Free', priceGbp: 0, yearlyPriceGbp: null, reviews: 3, period: 'lifetime', lookupKey: null, yearlyLookupKey: null,
    blurb: 'Try PageGrade on your own pages.',
    features: ['3 reviews in total', 'The full report: score, fixes and evidence', 'Headline and button rewrites', 'Desktop and mobile screenshots', 'Shareable report links'],
    limits: { monitors: 0, inflight: 1, pdf: false, branding: false, clients: false, bulk: false },
  },
  starter: {
    id: 'starter', name: 'Starter', priceGbp: 9, yearlyPriceGbp: 90, reviews: 10, period: 'month',
    lookupKey: 'pagegrade_starter_monthly', yearlyLookupKey: 'pagegrade_starter_yearly',
    blurb: 'For founders improving one product.',
    features: ['10 reviews a month', 'Everything in Free', '1 page re-checked every week, with alerts', 'Cancel anytime'],
    limits: { monitors: 1, inflight: 1, pdf: false, branding: false, clients: false, bulk: false },
  },
  pro: {
    id: 'pro', name: 'Pro', priceGbp: 29, yearlyPriceGbp: 290, reviews: 40, period: 'month',
    lookupKey: 'pagegrade_pro_monthly', yearlyLookupKey: 'pagegrade_pro_yearly', highlight: true,
    blurb: 'For marketers running campaigns.',
    features: ['40 reviews a month', 'Everything in Starter', '5 pages re-checked weekly, competitors included', 'PDF reports', 'Priority in the review queue'],
    limits: { monitors: 5, inflight: 3, pdf: true, branding: false, clients: false, bulk: false },
  },
  agency: {
    id: 'agency', name: 'Agency', priceGbp: 99, yearlyPriceGbp: 990, reviews: 200, period: 'month',
    lookupKey: 'pagegrade_agency_monthly', yearlyLookupKey: 'pagegrade_agency_yearly',
    blurb: 'For agencies and freelancers with clients.',
    features: ['200 reviews a month', 'Everything in Pro', 'Reports and PDFs with your logo, not ours', 'Client folders', `Bulk reviews: up to ${BULK_MAX} pages at once`, '50 pages re-checked weekly'],
    limits: { monitors: 50, inflight: BULK_MAX, pdf: true, branding: true, clients: true, bulk: true },
  },
};

export const PAID_PLANS = [PLANS.starter, PLANS.pro, PLANS.agency];
/** Every Stripe price lookup key we sell (monthly and yearly). */
export const ALL_LOOKUP_KEYS = PAID_PLANS.flatMap((p) => [p.lookupKey!, p.yearlyLookupKey!]);

export const planByLookupKey = (key: string | null | undefined): Plan | null =>
  (key ? Object.values(PLANS).find((p) => p.lookupKey === key || p.yearlyLookupKey === key) : null) ?? null;
export const intervalForLookupKey = (key: string | null | undefined): BillingInterval | null => {
  const plan = planByLookupKey(key);
  return !plan ? null : plan.yearlyLookupKey === key ? 'year' : 'month';
};
export const lookupKeyFor = (plan: Plan, interval: BillingInterval) => (interval === 'year' ? plan.yearlyLookupKey : plan.lookupKey);
export const priceFor = (plan: Plan, interval: BillingInterval) => (interval === 'year' ? plan.yearlyPriceGbp ?? 0 : plan.priceGbp);
/** Monthly equivalent of what a subscriber pays, for MRR. */
export const monthlyValue = (plan: Plan, interval: BillingInterval) => (interval === 'year' ? (plan.yearlyPriceGbp ?? 0) / 12 : plan.priceGbp);
/** How much a year costs less than twelve monthly payments. */
export const yearlySaving = (plan: Plan) => (plan.yearlyPriceGbp == null ? 0 : plan.priceGbp * 12 - plan.yearlyPriceGbp);
/** Looks up a plan from an untyped id (database rows), or null if unknown. */
export const planById = (id: string | null | undefined): Plan | null => (id && Object.hasOwn(PLANS, id) ? PLANS[id as PlanId] : null);
