/**
 * The PageGrade business and marketing plan (version 2) as typed data for Admin → Business plan.
 * Client-safe: no server imports. Prices and limits come from plans.ts so the plan and the product cannot drift.
 */
import { BULK_MAX, PLANS, monthlyValue, type PlanId } from '@/lib/plans';

/** Whole pounds without decimals, anything else with pence (£82.50). */
export const gbp = (n: number) => `£${Number.isInteger(n) ? n.toLocaleString('en-GB') : n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const planDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
export const planWeekdayDate = (t: number) => `${new Date(t).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' })} ${planDate(t)}`;

const yearly = (id: PlanId) => PLANS[id].yearlyPriceGbp ?? 0;
/** Midnight UTC on a calendar date (month is 1-based). It falls on the same London date all year. */
const day = (year: number, month: number, date: number) => Date.UTC(year, month - 1, date);

export const PLAN_META = {
  title: 'PageGrade business plan',
  version: 'Version 2',
  date: '9 November 2026',
  disclaimer: 'This is a working plan, not a promise. Revenue depends on launching, selling and keeping customers, and code cannot do those for you. Every number is an estimate from the assumptions shown, and outside prices marked (check) can change.',
} as const;

/** Targets the live scoreboard and checklist compare against. */
export const TARGETS = {
  mrr: 10_000,
  churnPct: 4,
  churnAlarmPct: 5,
  signupToPaidPct: 5,
  packRequestPct: 5,
  packToCustomerPct: 20,
  packToCustomerFloorPct: 10,
  optOutPct: 2,
  bouncePct: 3,
  agenciesBeforePriceRise: 15,
  newAgencyPriceGbp: 149,
  /** Below this many paying customers the cost safeguards should stay tight. */
  smallBusinessCustomers: 5,
  aiCapUsdStart: 1,
  aiCapUsdOnceTrading: 3,
  aiCapUsdPerAgency: 0.3,
  graderDailyLimit: 20,
  graderPerIp: 3,
  emailsPerDayPerMailbox: 30,
  vatThresholdGbp: 90_000,
} as const;

export const FOUNDING_DEADLINE = 'Sunday 31 January 2027';

export const PLAN_SECTIONS = [
  { id: 'scoreboard', title: 'Scoreboard', group: 'Live numbers' },
  { id: 'launch', title: 'Launch checklist', group: 'Live numbers' },
  { id: 'pipeline', title: 'Pipeline', group: 'Live numbers' },
  { id: 'goal', title: 'Goal and timeline', group: 'The plan' },
  { id: 'positioning', title: 'Positioning', group: 'The plan' },
  { id: 'customers', title: 'Customers and offers', group: 'The plan' },
  { id: 'pricing', title: 'Pricing', group: 'The plan' },
  { id: 'budget', title: 'Budget and safeguards', group: 'The plan' },
  { id: 'economics', title: 'Unit economics', group: 'The plan' },
  { id: 'projections', title: 'MRR projections', group: 'The plan' },
  { id: 'checkpoints', title: 'Checkpoints', group: 'The plan' },
  { id: 'strategy', title: 'Ranked strategy', group: 'The plan' },
  { id: 'sales', title: 'Sales workflow', group: 'The plan' },
  { id: 'compliance', title: 'Prospecting and email rules', group: 'The plan' },
  { id: 'marketing', title: 'Marketing channels', group: 'The plan' },
  { id: 'templates', title: 'Email templates', group: 'The plan' },
  { id: 'retention', title: 'Keeping customers', group: 'The plan' },
  { id: 'roadmap', title: 'Product roadmap', group: 'The plan' },
  { id: 'metrics', title: 'Weekly metrics', group: 'The plan' },
  { id: 'routine', title: 'Daily and weekly routine', group: 'The plan' },
  { id: 'first-week', title: 'Your first seven days', group: 'The plan' },
  { id: 'risks', title: 'Risks and responses', group: 'The plan' },
  { id: 'avoid', title: 'Do not do', group: 'The plan' },
] as const;
export type PlanSectionId = (typeof PLAN_SECTIONS)[number]['id'];
export const sectionTitle = (id: PlanSectionId): string => PLAN_SECTIONS.find((s) => s.id === id)?.title ?? id;

// ─── Projections and checkpoints ─────────────────────────────────────────────

export type Projection = { month: number; endsIn: string; slow: number; base: number; fast: number };
export const PROJECTIONS: Projection[] = [
  { month: 1, endsIn: 'December 2026', slow: 43, base: 94, fast: 190 },
  { month: 2, endsIn: 'January 2027', slow: 130, base: 280, fast: 570 },
  { month: 3, endsIn: 'February 2027', slow: 250, base: 550, fast: 1470 },
  { month: 6, endsIn: 'May 2027', slow: 750, base: 2150, fast: 6270 },
  { month: 9, endsIn: 'August 2027', slow: 1390, base: 5040, fast: 12180 },
  { month: 12, endsIn: 'November 2027', slow: 2150, base: 8270, fast: 18230 },
  { month: 18, endsIn: 'May 2028', slow: 3970, base: 14900, fast: 30700 },
  { month: 24, endsIn: 'November 2028', slow: 6250, base: 21720, fast: 43590 },
];
export const PASSES_TARGET = { slow: 'After 2 years', base: 'Month 14', fast: 'Month 8' } as const;

export type Assumption = { label: string; slow: string; base: string; fast: string };
export const ASSUMPTIONS: Assumption[] = [
  { label: 'Agency prospects who ask for a pack', slow: '3%', base: '5%', fast: '7%' },
  { label: 'Packs that become paying agencies', slow: '15%', base: '20%', fast: '30%' },
  { label: 'Owners emailed who pay (about £20 a month)', slow: '1%', base: '2%', fast: '3%' },
  { label: 'Outreach mailboxes', slow: '1', base: '1, 2 from month 4, 3 from month 7', fast: '1, 2 from month 3, 3 from month 5' },
  { label: 'New MRR from partners, grader and posts', slow: '£50 from month 3, then +£25 a month', base: '£100 from month 3, then +£50 a month', fast: '£150 from month 3, then +£75 a month' },
  { label: 'Customers who cancel each month', slow: '5%', base: '4%', fast: '3%' },
];
export const PROJECTION_NOTES = [
  `In every case new agencies pay ${gbp(PLANS.agency.priceGbp)} until there are ${TARGETS.agenciesBeforePriceRise}, then ${gbp(TARGETS.newAgencyPriceGbp)}. Month 1 counts half (warm-up and time to decide).`,
  'Everyone is counted as paying monthly.',
  'Nobody knows these rates before the first 200 prospects. The checkpoints below tell you which case you are in.',
];

const projection = (month: number): Projection => {
  const p = PROJECTIONS.find((r) => r.month === month);
  if (!p) throw new Error(`No projection for month ${month}`);
  return p;
};

/** A dated Monday check against the base and fast cases. The slow case is the "below this, change something" line. */
export type MrrCheckpoint = {
  id: string; label: string; month: number; at: number;
  baseMrr: number; fastMrr: number; slowMrr: number; ifBehind: string; decision: boolean;
};
const checkpoint = (month: number, at: number, ifBehind: string, decision = false): MrrCheckpoint => {
  const p = projection(month);
  return { id: `month-${month}`, label: `Month ${month}`, month, at, baseMrr: p.base, fastMrr: p.fast, slowMrr: p.slow, ifBehind, decision };
};

export const MRR_CHECKPOINTS: MrrCheckpoint[] = [
  checkpoint(1, day(2026, 12, 14), `Below ${gbp(projection(1).slow)}: test a new subject and opening, and check you are targeting agencies with 1–20 people.`),
  checkpoint(2, day(2027, 1, 11), 'Packs not turning into customers: reply faster, offer a call, add the money-back promise.'),
  checkpoint(3, day(2027, 2, 15), `Decision point. Below ${gbp(projection(3).slow)}: change the audience (say, only Shopify or SEO agencies) or focus on owners. At or above the base case: add a mailbox.`, true),
  checkpoint(6, day(2027, 5, 10), 'Below the base case: get cancellations under 4%, then add partners and a mailbox.'),
  checkpoint(9, day(2027, 8, 9), "Raise the Agency price if you haven't; start paid tests from revenue."),
  checkpoint(12, day(2027, 11, 15), 'Below the base case: keep the channels that work and drop the rest.'),
];

export const WEEK_TWO_CHECK = {
  id: 'week-2', label: 'Week 2', at: day(2026, 11, 23),
  check: 'Bounces under 3%, opt-outs under 2% and some replies: then raise to 20 emails a day.',
  ifBehind: 'If not, fix the list or the email first.',
} as const;

/** Month N of the plan starts when month N−1's checkpoint falls (months 2 to 4 are the ones with start triggers). */
export const MONTH_STARTS: Record<2 | 3 | 4, number> = {
  2: MRR_CHECKPOINTS[0].at, 3: MRR_CHECKPOINTS[1].at, 4: MRR_CHECKPOINTS[2].at,
};

export const KEY_DATES: { at: number | null; when: string; what: string }[] = [
  { at: day(2026, 11, 10), when: planWeekdayDate(day(2026, 11, 10)), what: 'First week starts: launch checks, budget settings and OpenAI credit.' },
  { at: day(2026, 11, 13), when: planWeekdayDate(day(2026, 11, 13)), what: 'Autopilot starts at 10 emails a day.' },
  { at: WEEK_TWO_CHECK.at, when: planWeekdayDate(WEEK_TWO_CHECK.at), what: 'Week-2 check: raise to 20 a day if bounces are under 3% and opt-outs under 2%.' },
  ...MRR_CHECKPOINTS.slice(0, 2).map((c) => ({ at: c.at, when: planWeekdayDate(c.at), what: `${c.label} checkpoint.` })),
  { at: day(2027, 1, 31), when: planWeekdayDate(day(2027, 1, 31)), what: 'Founding prices end. Anyone who starts by today keeps their price for life.' },
  { at: MRR_CHECKPOINTS[2].at, when: planWeekdayDate(MRR_CHECKPOINTS[2].at), what: 'Month 3 checkpoint: the decision point.' },
  { at: MRR_CHECKPOINTS[3].at, when: planWeekdayDate(MRR_CHECKPOINTS[3].at), what: `${MRR_CHECKPOINTS[3].label} checkpoint.` },
  { at: null, when: 'July 2027 (month 8)', what: 'The fast case passes £10,000 MRR.' },
  ...MRR_CHECKPOINTS.slice(4).map((c) => ({ at: c.at, when: planWeekdayDate(c.at), what: `${c.label} checkpoint.` })),
  { at: null, when: 'January 2028 (month 14)', what: 'The base case passes £10,000 MRR.' },
  { at: null, when: 'About April 2028 (month 17)', what: `Base case: UK VAT registration, once taxable turnover passes ${gbp(TARGETS.vatThresholdGbp)} in 12 months.` },
];

// ─── Goal, positioning, customers ────────────────────────────────────────────

export const GOAL = {
  headline: `Reach ${gbp(TARGETS.mrr)} a month in recurring revenue (MRR) as fast as possible, starting with a budget of under £20.`,
  summary: `About 101 agencies on the ${gbp(PLANS.agency.priceGbp)} Agency plan make £10k on their own (67 at ${gbp(TARGETS.newAgencyPriceGbp)}), and business owners on Starter and Pro fill the gaps. The product is built but not live, and the plan assumes no customers today.`,
  timeline: [
    { scenario: 'Fast', passes: 'About month 8 (July 2027)', needs: '7% of agencies ask for a pack, 30% of packs become customers, 3% cancel a month, three mailboxes by month 5.' },
    { scenario: 'Base', passes: 'About month 14 (January 2028)', needs: '5% ask, 20% of packs convert, 4% cancel a month, two mailboxes from month 4 and three from month 7.' },
    { scenario: 'Slow', passes: 'More than two years', needs: '3% ask, 15% of packs convert, 5% cancel a month, one mailbox. The month-3 checkpoint (15 Feb 2027) decides what to change.' },
  ],
  atAGlance: [
    { label: 'Main customers', text: `Small agencies on the ${gbp(PLANS.agency.priceGbp)} Agency plan. About 101 agencies alone make £10k (67 at ${gbp(TARGETS.newAgencyPriceGbp)}).` },
    { label: 'Second customers', text: `Business owners on Starter (${gbp(PLANS.starter.priceGbp)}) and Pro (${gbp(PLANS.pro.priceGbp)}).` },
    { label: 'The engine', text: 'Autopilot emails offering a free prospect pack → pack → 15-minute call → Agency plan. Partners, the free grader and posts add sign-ups.' },
    { label: 'Budget', text: 'About £17–£21 to start (£13–£17 with $5 of AI credit). Extras, like more mailboxes, are paid from revenue.' },
    { label: 'Your time', text: 'About 1.5–2 hours a day, plus 3–4 hours a week for posts, calls and numbers.' },
  ],
  start: [
    { label: 'Product', text: `Version 2.1 is built. It reviews a landing page in about a minute for about 1.5p of AI cost. It includes a free grader with no sign-up, weekly monitoring with alerts, agency tools (client folders, bulk reviews of up to ${BULK_MAX} pages, your name, logo and colour on shared and PDF reports, and an optional white label that hides PageGrade's name), "Email the fixes" drafts, an AI search readiness check, yearly billing, a partner programme, feedback tracking, and an admin page with MRR, sign-ups and AI spend. This release adds the agencies page, founder emails, lifecycle emails, CSV export and this plan.` },
    { label: 'Status', text: 'Not live yet. Do the launch checks in DEPLOY.md before taking payments; the launch checklist above tracks the ones the app can see.' },
    { label: 'Main risk', text: 'People use it once and leave, or think ChatGPT does the same for free. So we sell to people who need reviews every month (agencies), and make weekly monitoring the reason to stay.' },
  ],
  changedInV2: [
    "Agencies' own websites are no longer reviewed. Agencies are offered a free pack of three audits of businesses they could win, with the agency's own name and logo on them. Only business owners get an audit of their own page.",
    'Most of the selling runs itself. The free Outreach Autopilot (a Google Sheet with a script) finds contact emails, sends, follows up, and stops when someone replies, opts out or bounces. You add names and websites, make packs and take calls.',
    'Every growth strategy is listed and ranked: do now, do later (with the trigger for starting it) or skip, with the reason.',
    'Checked against the code, with the maths redone. The AI cap pauses every review, paying customers\' too. The default caps allow far more AI spend than this budget. Because each prospect gets up to three emails, 30 emails a day reach about 10 new prospects, not 30.',
    'Three scenarios instead of one hopeful line, with every assumption shown.',
  ],
};

export const POSITIONING = {
  statement: "For small web, SEO and marketing agencies, PageGrade turns a landing page into a scored report in about a minute (about 1.5p of AI cost to us), with the agency's own name and logo on it. Agencies use it to win clients with an audit of the prospect's own page, and to keep them with weekly checks and alerts. Business owners get the same review of their own page: the fixes to make first, with the evidence behind them.",
  whyNoOwnSiteAudits: "Version 1 used each agency's own homepage as the free sample. Agencies pay for tools that help them win and keep clients, not to have their own site marked, and an audit they did not ask for can feel like criticism. Now they are offered audits of businesses they could win, with their own branding, so PageGrade looks like a sales tool, not a critique. It is also cheaper: AI is only spent on agencies that say yes.",
  aiSay: 'PageGrade checks whether AI tools (such as ChatGPT search) can reach and read a page.',
  aiDoNotSay: 'That it shows whether AI tools mention or recommend the business. It does not.',
  chatgpt: {
    question: '"ChatGPT does this for free."',
    answer: 'It comes up on calls. Do not argue: show what a general chat tool does not give you. PageGrade captures the real page (desktop and mobile), checks speed, scores it against a fixed set of conversion checks, re-checks it every week, reviews up to 25 pages in bulk and produces branded PDFs.',
  },
  claims: [
    'Say what the product does and show a real report. Never promise results like "double your conversions": you cannot prove it, and advertising rules require proof.',
    'Say "free" only where it is: three free reviews, the free grader, and the three-audit pack for agencies.',
    'Mention the founding price (until 31 January 2027) when it is true, and nothing else as urgency.',
  ],
};

export type Customer = { id: string; name: string; role: string; who: string; whyLabel: string; why: string; offer: string; path: string };
export const CUSTOMERS: Customer[] = [
  {
    id: 'agencies', name: 'Agencies', role: 'Main customers', whyLabel: 'Why they pay',
    who: 'Web design, development, SEO and marketing agencies with 1–20 people, and freelancers who build sites, in the UK and the US.',
    why: 'They win clients by showing prospects what is wrong with their site, and keep clients by showing progress. PageGrade does both in minutes, with the agency\'s name on every report.',
    offer: '"Three ready-to-send audits of businesses you\'d like to win, with your agency\'s name and logo on them. Free." They send three websites, or you pick three in their niche and city.',
    path: `Autopilot email → free prospect pack → 15-minute call → Agency plan (${gbp(PLANS.agency.priceGbp)} a month or ${gbp(yearly('agency'))} a year). It works because it is useful on day one, shows the product doing their job, and doing it every week needs the Agency plan.`,
  },
  {
    id: 'owners', name: 'Business owners', role: 'Second customers', whyLabel: 'Why they pay',
    who: 'Businesses whose page has to sell: SaaS, online shops and local services, especially those running ads (they pay for every visit).',
    why: 'Every visitor they pay for lands on a page that may be losing them. A specific fix is worth more to them than a generic pitch.',
    offer: 'Three specific fixes for their page in the email, and a link to the full free report.',
    path: `3 free reviews, then Starter (${gbp(PLANS.starter.priceGbp)}) or Pro (${gbp(PLANS.pro.priceGbp)}) to re-check after changes and get weekly checks.`,
  },
  {
    id: 'partners', name: 'Partners', role: 'Referrers', whyLabel: 'Why they join',
    who: 'Consultants, freelancers and agencies who advise businesses on their websites or marketing.',
    why: 'They earn 30% of what the customers they refer pay for 12 months (after a 30-day hold, minimum payout £50). It is built in: anyone can get a partner link.',
    offer: 'A partner link, and a look at the tool first if they want one.',
    path: 'Partner track in the Autopilot from month 2, once 3 customers are happy. Ask every happy customer to share their partner link too.',
  },
];

// ─── Pricing ─────────────────────────────────────────────────────────────────

export type PriceRow = { plan: string; monthly: string; yearly: string; includes: string };
const includes: Record<PlanId, string> = {
  free: `${PLANS.free.reviews} reviews in total`,
  starter: `${PLANS.starter.reviews} reviews a month, ${PLANS.starter.limits.monitors} weekly check`,
  pro: `${PLANS.pro.reviews} reviews a month, ${PLANS.pro.limits.monitors} weekly checks (competitors too), PDF reports, priority`,
  agency: `${PLANS.agency.reviews} reviews a month, ${PLANS.agency.limits.monitors} weekly checks, your branding and white label, client folders, bulk reviews of up to ${BULK_MAX} pages`,
};
export const PRICE_TABLE: PriceRow[] = (['free', 'starter', 'pro', 'agency'] as const).map((id) => ({
  plan: PLANS[id].name,
  monthly: gbp(PLANS[id].priceGbp),
  yearly: PLANS[id].yearlyPriceGbp == null ? '–' : gbp(yearly(id)),
  includes: includes[id],
}));

export const PRICING_RULES: { title: string; text: string }[] = [
  { title: 'Founding price', text: `Anyone who starts by ${FOUNDING_DEADLINE} keeps today's price for life. That is the only urgency you need.` },
  { title: 'Yearly plans', text: `Two months free (${gbp(yearly('agency'))} instead of ${gbp(PLANS.agency.priceGbp * 12)} for Agency). Good for cash. It counts as ${gbp(monthlyValue(PLANS.agency, 'year'))} a month of MRR.` },
  { title: 'Agency price rise', text: `Raise Agency to ${gbp(TARGETS.newAgencyPriceGbp)} for new customers after ${TARGETS.agenciesBeforePriceRise} happy agencies. Existing Stripe subscriptions keep their price.` },
  { title: 'Money-back promise', text: `Offer a 30-day money-back promise on Agency only if fewer than ${TARGETS.packToCustomerFloorPct}% of packs turn into customers, and only after /terms has been updated to say so.` },
  { title: 'No other discounts', text: 'The founding price is the only offer. No coupons, no lifetime deals.' },
];

export const PRICE_RISE_STEPS: string[] = [
  `In Stripe, create a new ${gbp(TARGETS.newAgencyPriceGbp)} monthly price for Agency, and a new yearly price if you want one (${gbp(TARGETS.newAgencyPriceGbp * 10)} keeps the two-months-free rule).`,
  `Move the lookup key ${PLANS.agency.lookupKey} to the new monthly price (and ${PLANS.agency.yearlyLookupKey} to the new yearly price).`,
  'Update the Agency price shown in src/lib/plans.ts and deploy.',
  `Heads up: MRR in the admin area uses list prices, so after the rise it will count existing ${gbp(PLANS.agency.priceGbp)} customers at ${gbp(TARGETS.newAgencyPriceGbp)}. Note how many founding agencies you have and subtract ${gbp(TARGETS.newAgencyPriceGbp - PLANS.agency.priceGbp)} for each until the app tracks price per subscriber.`,
];

// ─── Money ───────────────────────────────────────────────────────────────────

export const BUDGET_LINES: { item: string; cost: string; note: string }[] = [
  { item: 'Domain name', cost: '£5–£9', note: 'First year, .com or .co.uk (check)' },
  { item: 'Railway Hobby hosting', cost: 'About £4', note: '$5 a month, including $5 of usage (check)' },
  { item: 'OpenAI credit', cost: 'About £8', note: '$10 prepaid with auto-recharge off. $5 (about £4) also works (check the minimum)' },
  { item: 'Outreach Autopilot', cost: '£0', note: 'Google Sheets and Apps Script' },
  { item: 'Gmail', cost: '£0', note: 'A separate free account for outreach' },
  { item: 'Booking link, alerts, post scheduling', cost: '£0', note: "Cal.com, F5Bot and LinkedIn's own scheduler" },
];
export const BUDGET_TOTAL = { cost: '£17–£21', note: '£13–£17 with $5 of AI credit' } as const;
export const BUDGET_EXCLUDED: { item: string; note: string }[] = [
  { item: 'ICO data protection fee', note: '£52 a year for tier 1, £47 by direct debit (2025 rates, check). It is a legal cost of running PageGrade, not marketing.' },
  { item: 'Stripe fees', note: 'About 1.5% + 20p per UK card payment, plus 0.7% for subscriptions (check).' },
  { item: 'Later, from revenue', note: 'More outreach mailboxes (about £7–£8 a month each on Google Workspace, check) and an assistant.' },
];

export const SAFEGUARDS: { setting: string; value: string; usual: string; why: string }[] = [
  { setting: 'AI_DAILY_BUDGET_USD', value: '1', usual: 'Default 25', why: "About 50 reviews a day. When it is reached, every review pauses for the rest of the day, paying customers' too. Raise it to $3 once people pay, then add about $0.30 a day for each Agency customer. It is an estimate, not a hard stop." },
  { setting: 'FREE_GRADER_DAILY_LIMIT', value: String(TARGETS.graderDailyLimit), usual: 'Default 150, about $3 a day', why: 'About 30p a day at most.' },
  { setting: 'FREE_GRADER_PER_IP', value: String(TARGETS.graderPerIp), usual: 'Default 3', why: 'Keep it: free grades per visitor per day.' },
  { setting: 'OpenAI prepaid credit', value: 'Auto-recharge off', usual: '', why: 'The real spending limit. Set a budget alert too, and top up from revenue on Mondays.' },
  { setting: 'ADMIN_EMAILS', value: 'Two addresses', usual: '', why: 'Your account and the demo account you use for packs, separated by a comma.' },
];

export const COSTS: string[] = [
  'A review costs about $0.019 (1.5p). A weekly check costs the same.',
  `A heavy Agency customer (${PLANS.agency.reviews} reviews and ${PLANS.agency.limits.monitors} weekly checks, about 420 AI runs a month) costs about £6 a month in AI. After AI and Stripe fees, about 90% of the ${gbp(PLANS.agency.priceGbp)} is margin.`,
  'A prospect pack costs about 5p (3 reviews). Ten owner reviews a day cost about £4.50 a month.',
  `One Pro customer (${gbp(PLANS.pro.priceGbp)}) covers the basic running costs.`,
];
export const TAX: string[] = [
  `UK VAT: register once taxable turnover passes ${gbp(TARGETS.vatThresholdGbp)} in any 12 months in a row. In the base case that is around month 17 (April 2028).`,
  "EU consumers: VAT is due from the first sale (the EU's non-Union OSS scheme handles it). Ask an accountant before your first EU consumer sale.",
];

const mix = (lines: [PlanId, number][], agencyPrice = PLANS.agency.priceGbp) =>
  lines.reduce((sum, [id, n]) => sum + (id === 'agency' ? agencyPrice : PLANS[id].priceGbp) * n, 0);
export const MIXES: { label: string; customers: number; mrr: number }[] = [
  { label: `Agency only, at ${gbp(PLANS.agency.priceGbp)}`, customers: 101, mrr: mix([['agency', 101]]) },
  { label: `Agency only, at ${gbp(TARGETS.newAgencyPriceGbp)}`, customers: 67, mrr: mix([['agency', 67]], TARGETS.newAgencyPriceGbp) },
  { label: '70 Agency + 90 Pro + 60 Starter', customers: 220, mrr: mix([['agency', 70], ['pro', 90], ['starter', 60]]) },
];
export const CHURN_CEILING = `Cancellations set a ceiling. MRR stops growing when what you lose equals what you add. With ${TARGETS.churnPct}% of customers leaving each month, ${gbp(TARGETS.mrr * TARGETS.churnPct / 100)} of new MRR a month tops out at ${gbp(TARGETS.mrr)}, so you need well over ${gbp(TARGETS.mrr * TARGETS.churnPct / 100)} a month to get there quickly.`;

export const MAILBOX = {
  intro: 'Once warmed up, the Autopilot sends up to 30 emails a day from one mailbox, follow-ups included. Each prospect gets up to three emails, so that is about 50 new prospects a week: for example 40 agencies and 10 business owners.',
  rows: [
    { label: 'New agency prospects', slow: '172', base: '172', fast: '172' },
    { label: 'Ask for a free pack', slow: '3% → 5', base: '5% → 9', fast: '7% → 12' },
    { label: 'Become Agency customers', slow: '15% of packs → 0.8', base: '20% of packs → 1.7', fast: '30% of packs → 3.6' },
    { label: 'Owners who pay (of 43 emailed)', slow: '1% → 0.4', base: '2% → 0.9', fast: '3% → 1.3' },
    { label: 'New MRR from one mailbox', slow: '£85', base: '£190', fast: '£380' },
  ] satisfies Assumption[],
  newMrr: { slow: 85, base: 190, fast: 380 },
  churnPct: { slow: 5, base: 4, fast: 3 },
  note: `So one mailbox adds roughly £85–£380 of new MRR a month: less than the ${gbp(TARGETS.mrr * TARGETS.churnPct / 100)} a month that £10k needs when ${TARGETS.churnPct}% of customers cancel each month. That is why the plan adds mailboxes once the numbers are proven, and builds partners and inbound sign-ups from month 3.`,
};
/** Where one mailbox on its own levels off: new MRR a month divided by the monthly cancellation rate. */
export const mailboxCeiling = (scenario: 'slow' | 'base' | 'fast') => Math.round(MAILBOX.newMrr[scenario] / (MAILBOX.churnPct[scenario] / 100));

// ─── Strategy ────────────────────────────────────────────────────────────────

export const STRATEGY_NOW: { rank: number; strategy: string; why: string; automated: string }[] = [
  { rank: 1, strategy: 'Agency emails offering a free prospect pack', why: 'The main engine: agencies need audits every week.', automated: 'Autopilot finds emails, sends, follows up and stops on replies.' },
  { rank: 2, strategy: 'A prospect pack for every yes', why: 'Turns a reply into a trial of the real product.', automated: 'PageGrade bulk review with their branding: 10 minutes.' },
  { rank: 3, strategy: 'Owner emails with three real fixes', why: 'Second track; fills Starter and Pro.', automated: 'Bulk review and Email the fixes; the Autopilot sends.' },
  { rank: 4, strategy: 'Warm leads: people asking for website or landing page feedback', why: 'They asked for help, so replies convert well.', automated: 'F5Bot emails you matching posts from Reddit and Hacker News.' },
  { rank: 5, strategy: 'Free grader on the homepage', why: 'Turns visitors into sign-ups with no effort.', automated: 'Already built; daily caps protect the budget.' },
  { rank: 6, strategy: 'A personal note to every new sign-up', why: 'The cheapest way to get early users to pay.', automated: 'A sign-up alert emails you for every new account; template in Email templates.' },
  { rank: 7, strategy: 'Two public teardowns a week', why: 'Trust and inbound sign-ups; doubles as samples.', automated: "Write both in one sitting; LinkedIn's scheduler posts them." },
  { rank: 8, strategy: 'Ask every happy customer for one intro', why: 'Referrals close fastest.', automated: 'Template in Email templates; partner commission is tracked for you.' },
  { rank: 9, strategy: 'Swap the public sample report to a local business', why: "Today it reviews an agency's homepage, the hook we dropped.", automated: 'One-off change to public/demo/brightline-digital.html.' },
];

/**
 * A condition for starting a "do later" strategy. Conditions that need your judgement
 * (such as "revenue covers it") have no trigger and show as "your call".
 */
export type Trigger =
  | { kind: 'mrr'; atLeast: number }
  | { kind: 'customers'; atLeast: number }
  | { kind: 'agencies'; atLeast: number }
  | { kind: 'month'; month: 2 | 3 | 4 };
export type LaterItem = { strategy: string; startWhen: string; triggers: Trigger[] };

export const STRATEGY_LATER: LaterItem[] = [
  { strategy: 'Partner emails to consultants and freelancers (Partner track in the Autopilot)', startWhen: 'Month 2, once 3 customers are happy', triggers: [{ kind: 'month', month: 2 }, { kind: 'customers', atLeast: 3 }] },
  { strategy: 'More mailboxes: Google Workspace on a separate outreach domain (about £7–£8 a month each, check)', startWhen: '5%+ of 200 agency prospects ask for a pack, and revenue covers it', triggers: [] },
  { strategy: 'An assistant to find prospects (name and website)', startWhen: 'MRR over £1,500, or research takes over an hour a day', triggers: [{ kind: 'mrr', atLeast: 1500 }] },
  { strategy: 'Data study: review 100 sites in one niche and publish what you find (about $2 of AI)', startWhen: 'Month 2, then monthly', triggers: [{ kind: 'month', month: 2 }] },
  { strategy: 'An SEO article every two weeks, for example "landing page audit checklist"', startWhen: 'Month 2', triggers: [{ kind: 'month', month: 2 }] },
  { strategy: 'Personal LinkedIn messages, typed by hand, to agency founders who react to your posts (up to 10 a day)', startWhen: 'Month 2', triggers: [{ kind: 'month', month: 2 }] },
  { strategy: 'Teardown videos: the weekly teardown as a 2-minute screen recording for YouTube and LinkedIn', startWhen: 'Month 3', triggers: [{ kind: 'month', month: 3 }] },
  { strategy: 'Free launch sites: Uneed, Microlaunch, Peerlist, Fazier (free options, check)', startWhen: 'Month 2', triggers: [{ kind: 'month', month: 2 }] },
  { strategy: 'Free listings: G2, Capterra, SaaSHub, AlternativeTo', startWhen: 'After 5 paying customers who can leave reviews', triggers: [{ kind: 'customers', atLeast: 5 }] },
  { strategy: 'Product Hunt and Show HN', startWhen: 'After 10 paying customers and smooth onboarding', triggers: [{ kind: 'customers', atLeast: 10 }] },
  { strategy: `Raise Agency to ${gbp(TARGETS.newAgencyPriceGbp)} for new customers`, startWhen: `After ${TARGETS.agenciesBeforePriceRise} happy agencies`, triggers: [{ kind: 'agencies', atLeast: TARGETS.agenciesBeforePriceRise }] },
  { strategy: 'A bigger agency plan, for example 600 reviews and 150 weekly checks', startWhen: 'When 5+ agencies use most of their 200 reviews', triggers: [{ kind: 'agencies', atLeast: 5 }] },
  { strategy: 'Guest spots: agency podcasts, newsletters, communities, webinars', startWhen: 'Month 4', triggers: [{ kind: 'month', month: 4 }] },
  { strategy: 'Paid ads or sponsored newsletters, in £100 tests paid from revenue', startWhen: 'MRR over £3,000', triggers: [{ kind: 'mrr', atLeast: 3000 }] },
  { strategy: 'A Chrome extension (one-time $5 developer fee, check)', startWhen: 'MRR over £3,000', triggers: [{ kind: 'mrr', atLeast: 3000 }] },
  { strategy: 'Webflow, Shopify or WordPress apps', startWhen: 'MRR over £5,000', triggers: [{ kind: 'mrr', atLeast: 5000 }] },
];

export type LiveNumbers = { mrr: number; customers: number; agencies: number; at: number };
/** Whether a "do later" item's measurable conditions are met right now, and what is still missing. */
export function triggerStatus(triggers: Trigger[], live: LiveNumbers): { ready: boolean; label: string } {
  if (!triggers.length) return { ready: false, label: 'Your call' };
  const missing: string[] = [];
  for (const t of triggers) {
    if (t.kind === 'mrr' && live.mrr < t.atLeast) missing.push(`MRR ${gbp(live.mrr)} of ${gbp(t.atLeast)}`);
    if (t.kind === 'customers' && live.customers < t.atLeast) missing.push(`${live.customers} of ${t.atLeast} customers`);
    if (t.kind === 'agencies' && live.agencies < t.atLeast) missing.push(`${live.agencies} of ${t.atLeast} agencies`);
    if (t.kind === 'month' && live.at < MONTH_STARTS[t.month]) missing.push(`From ${planDate(MONTH_STARTS[t.month])}`);
  }
  return missing.length ? { ready: false, label: missing.join(' · ') } : { ready: true, label: 'Ready' };
}

export const STRATEGY_AVOID: { strategy: string; why: string }[] = [
  { strategy: "Review agencies' own websites", why: "Feels like criticism, and it isn't what they pay for." },
  { strategy: 'Buy lists or scrape social networks', why: 'Breaks UK rules or site terms; bad data bounces.' },
  { strategy: 'Send more than 30 emails a day per mailbox, or use throwaway accounts', why: 'Spam folder and suspended accounts.' },
  { strategy: 'Automate posts or messages in communities or on LinkedIn', why: 'Breaks their rules and gets you banned.' },
  { strategy: 'Lifetime deals', why: 'Caps MRR and brings heavy support.' },
  { strategy: 'Fiverr and Upwork', why: 'Their rules limit taking clients off the platform, and prices are low.' },
  { strategy: 'More discounts', why: 'The founding price is the only urgency you need.' },
  { strategy: 'Big new features before 25 paying customers ask for them', why: 'Selling is the bottleneck, not features.' },
  { strategy: 'Promise results like "double your conversions"', why: "You can't prove it, and advertising rules require proof." },
  { strategy: 'Cold email to the EU', why: 'Different consent rules in each country.' },
];

// ─── Sales ───────────────────────────────────────────────────────────────────

export const SALES_FLOW: string[] = [
  'You add 10–12 agencies a day per mailbox: company, website, city and niche (20–30 minutes).',
  'Autopilot finds a contact email on each website and notes any company number. You check each row and set OK to email to Yes (5 minutes).',
  'Autopilot sends the first email and up to two follow-ups, 4 days apart, inside your sending hours and daily limit.',
  'Autopilot marks replies (yellow), opt-outs (grey, added to Do not contact) and bounces (red), and stops emailing them.',
  'You make a prospect pack for every yes (10 minutes) and reply in the same thread. Pack requests from the agencies page land in the Pipeline above and in your inbox.',
  'You take a 15-minute call, or they sign up on their own.',
  "PageGrade keeps them: weekly checks and alerts for their clients' sites. You do one onboarding call.",
  'You ask happy customers for an intro and to share their partner link.',
];

export const WHO_DOES_WHAT: { job: string; doneBy: string; time: string }[] = [
  { job: 'Finding agencies (name and website)', doneBy: 'You, and an assistant later', time: '20–30 min a day' },
  { job: 'Contact emails and company numbers', doneBy: 'Autopilot (Find emails)', time: '5 min to check' },
  { job: 'Writing, sending and following up', doneBy: 'Autopilot, from your templates', time: 'None' },
  { job: 'Replies, opt-outs, bounces, dashboard', doneBy: 'Autopilot', time: 'None' },
  { job: 'Prospect packs', doneBy: 'PageGrade bulk review with their branding', time: '10 min each' },
  { job: 'Business-owner prospects', doneBy: 'PageGrade bulk review and Email the fixes', time: '15 min a day' },
  { job: 'Warm leads', doneBy: 'F5Bot emails you; you reply', time: '15 min a day' },
  { job: 'Welcome notes', doneBy: 'Sign-up alert emails and the Live admin page', time: '10 min a day' },
  { job: 'Teardown posts', doneBy: "LinkedIn's scheduler", time: '1–2 hours a week' },
];

export const CALL_AGENDA: { step: string; minutes: number }[] = [
  { step: 'What do you send prospects today, and how long does it take?', minutes: 2 },
  { step: 'Bulk-review five of their prospects live, into a new client folder.', minutes: 5 },
  { step: 'Show their branding on a report and PDF, and set up weekly checks for one client.', minutes: 4 },
  { step: 'Price, the founding deadline (31 January) and the yearly option.', minutes: 2 },
  { step: 'Send the checkout link while you are still on the call.', minutes: 2 },
];

export const PACK_STEPS: string[] = [
  'Use a second admin account just for packs, for example yourname+demo@gmail.com, added to ADMIN_EMAILS so it has every Agency feature for free.',
  'Set its branding to the agency (Settings → Branded reports): name, website, colour and logo (PNG or JPG, from their site). Turn on White label so only their brand shows.',
  'Bulk-review the three websites they sent (or three businesses in their niche and city) into a client folder named after the agency.',
  'Download the three PDFs from the finished reviews and read them.',
  'Reply in the same Gmail thread with the PDFs attached, using the pack reply in Email templates. Type "Pack sent" in the row\'s Status (the Autopilot leaves statuses you type alone), or set the lead to Pack sent in the Pipeline.',
  "Send PDFs, never share links, from the demo account. Its branding changes with every pack, so old links would show the next agency's logo.",
];
export const PACK_RULE = 'Make and send every pack within 24 hours of the yes. It takes about 10 minutes.';

export const OWNER_STEPS: string[] = [
  'Find pages that have to sell: businesses running ads (Google Ads Transparency Center, Meta Ad Library), new launches (Product Hunt, BetaList) and local services with a booking or quote page.',
  'In your main account (never the demo account), bulk-review 10 pages a day into a folder called Owner prospects.',
  'Open each review, click Email the fixes, and copy the top three fixes into Fixes and the share link into Report link. Set Track to Owner.',
  'Run Find emails, check the rows and set OK to email. The Autopilot does the rest.',
];

export const MORE_MAILBOXES = {
  when: 'At least 5% of your last 200 agency prospects asked for a pack, and revenue covers the cost.',
  how: [
    'Buy a second domain (for example getpagegrade.com, £5–£9), add a Google Workspace mailbox on it (about £7–£8 a month, check), set up SPF, DKIM and DMARC, and start at 10 a day for two weeks. A separate domain protects the main one that PageGrade\'s emails come from.',
    'Give each mailbox its own copy of the sheet with a different set of prospects (for example UK and US), and copy new opt-outs into every copy each Monday.',
    'Each mailbox needs 10–12 new rows a day. At three mailboxes, an assistant for the research pays for itself.',
  ],
};

export const AUTOPILOT = {
  intro: 'Everything is in the Outreach Autopilot kit (outreach/ in the repository: Code.gs, the sheet and SETUP.txt). It is free, runs in your own Google account and takes about 15 minutes to set up. It does not find agencies, choose who may be emailed or make packs.',
  setup: [
    'Use a separate Gmail account for outreach, under your real name. Not the account PageGrade sends its own emails from.',
    'Upload the sheet to Google Drive, open it with Google Sheets and use File > Save as Google Sheets. Then, in Extensions > Apps Script, replace the sample code with Code.gs and save.',
    'Recommended: in Apps Script, add the Gmail API service, so follow-ups stay in the same thread.',
    'Reload the sheet and use the Outreach menu. Google asks for permission once; because it is your own script, click Advanced, then Go to the project.',
    'Fill in the yellow Settings cells: your name, the company line (registered name, where it is registered and its number), the registered office address, and the sample and privacy links.',
    'Make the email templates sound like you. Add prospects, run Find emails, check each row and set OK to email to Yes. Preview the next email and send a test to yourself.',
    'Start the autopilot: it runs every hour on weekdays, 9:00 to 17:00, at up to 10 emails a day to start.',
  ],
  onItsOwn: [
    'Every hour in your sending hours it checks for replies, sends follow-ups that are due, then sends new emails up to your daily limit, spread across the day.',
    'Follow-ups: up to 2, 4 days apart. It stops as soon as someone replies (row turns yellow), opts out (grey, and they go on Do not contact) or bounces (red). Out-of-office replies are ignored.',
    'It never emails a row unless OK to email is Yes, never the same address twice, and only one person per company domain.',
    'If a row is missing something its template needs, the row waits and the Script note says what to fill in.',
    'It stops watching for replies 45 days after the last email: answer late replies in Gmail and add any opt-outs to Do not contact.',
  ],
  settings: [
    { setting: 'Daily limit', value: '10', note: 'Follow-ups included. Week 1: 10. Week 2: 20. Then up to 30. Never more than 30 from one mailbox.' },
    { setting: 'Days between emails', value: '4', note: 'How long to wait before each follow-up.' },
    { setting: 'Follow-ups', value: '2', note: '0, 1 or 2.' },
    { setting: 'Send from / until hour', value: '9 / 17', note: "24-hour clock, in the sheet's time zone." },
    { setting: 'Weekdays only', value: 'Yes', note: 'Yes or No.' },
    { setting: 'Paused', value: 'No', note: 'Set to Yes to stop sending without turning the autopilot off.' },
  ],
  statuses: 'Blank: not sent yet. Sent: waiting for a reply. Replied, Opted out, Bounced: stopped. No reply: no answer after the follow-ups. Skipped: duplicate or on Do not contact. Any other status you type (for example Pack sent or Customer) is left alone.',
  stuck: [
    'Nothing sends: check that OK to email is Yes, Paused is No, it is inside your sending hours, the daily limit is not used up, and read the row\'s Script note.',
    'Follow-ups arrive as separate emails: add the Gmail API service (step 3).',
    'Google emails you about a failed run: open Apps Script > Executions to see the message.',
    'To stop everything at once: Outreach > Stop autopilot.',
  ],
  limits: 'Free Gmail accounts can email about 100 people a day from scripts (Google Workspace: 1,500), so the Autopilot stays well inside them.',
};

// ─── Prospecting and email rules ─────────────────────────────────────────────

export const PROSPECT_SOURCES: { title: string; text: string }[] = [
  { title: 'Directories', text: "Clutch, DesignRush, Sortlist and GoodFirms (filter by city and team size), and partner directories: Webflow Experts, Shopify Partners, Framer Experts and HubSpot Solutions. Copy the name and website by hand; don't run scrapers on sites whose terms forbid it." },
  { title: 'Google Maps', text: 'Search, for example, "web design agency Leeds", and pick businesses with a website and a team page.' },
  { title: 'Companies House (free)', text: 'Confirm UK agencies are limited companies. Agency SIC codes include 62012, 73110 and 74100.' },
  { title: 'Good targets', text: 'Agencies with 1–20 people, client work in their portfolio and an email address on the site. Skip big agencies and anyone outside the UK or US.' },
];

export const QUALIFICATION: string[] = [
  'The right kind of business: an agency or freelancer that sells websites, SEO or marketing to clients.',
  'A UK limited company, LLP or public body, or a US business. Confirm it on Companies House.',
  "A real address published on the company's own site. Never guess an address or use one from a bought list.",
  'Not a UK sole trader or most partnerships (they need consent first), and not in the EU or anywhere you have not checked.',
  'Only then set OK to email to Yes. The Autopilot never sets it for you.',
];

export const EMAIL_RULES: string[] = [
  'Only email UK limited companies, LLPs and public bodies, or US businesses. UK sole traders and most partnerships need consent first. Skip the EU.',
  "Every email shows your name, the company's registered name, number and where it is registered, its registered office address, a privacy link and an easy opt-out (UK company law, PECR and UK GDPR; in the US, CAN-SPAM). The Autopilot adds them to every email.",
  'The privacy page needs a short outreach section: where you found the details (company websites and directories), why (legitimate interests), how long you keep them and how to object.',
  "Use addresses published on the company's own site. Honest subject lines, plain text, one link and no attachments in first emails.",
  "UK GDPR still applies to named people's work addresses. Read the ICO's guidance on business-to-business marketing before you start.",
  'Honour opt-outs at once (the Autopilot does), and never remove anyone from Do not contact.',
  'Never buy lists or scrape social networks.',
];

export const SEND_LIMITS: { rule: string; limit: string; action: string }[] = [
  { rule: 'Emails a day per mailbox', limit: `${TARGETS.emailsPerDayPerMailbox} at most, follow-ups included`, action: 'Start at 10 a day in week 1, 20 in week 2, then up to 30. New mailboxes start at 10 a day for two weeks.' },
  { rule: 'Bounces', limit: `Under ${TARGETS.bouncePct}%`, action: "Pause and fix your list. Use only addresses on the company's own site." },
  { rule: 'Opt-outs', limit: `Under ${TARGETS.optOutPct}%`, action: 'Pause, then narrow your targeting and soften the wording.' },
  { rule: 'Follow-ups', limit: '2, four days apart', action: 'Stops on a reply, an opt-out or a bounce. Never add a third.' },
  { rule: 'Mailbox', limit: 'Its own Gmail account', action: "Keep outreach away from the account PageGrade's own emails come from." },
];

// ─── Marketing ───────────────────────────────────────────────────────────────

export const CHANNELS: { channel: string; what: string; starts: string; time: string }[] = [
  { channel: 'Outreach Autopilot', what: 'Agency emails offering a free prospect pack; owner emails with three real fixes; partner emails from month 2.', starts: 'Now', time: '20–30 min a day to find prospects' },
  { channel: 'Free grader (/grade)', what: 'Turns visitors into sign-ups: they get a score, then sign up to see the fixes. Link it from every post and article. Daily caps protect the budget.', starts: 'Now (built)', time: 'None' },
  { channel: 'LinkedIn teardowns', what: 'Review a well-known page with PageGrade and post the three most useful fixes with a screenshot. Two a week, written in one sitting and scheduled with LinkedIn.', starts: 'Now', time: '1 hour to write, two posts' },
  { channel: 'Reddit and Hacker News', what: 'F5Bot (free) emails you when phrases like "landing page feedback", "roast my landing page" and "client audit tool" appear. Reply with useful advice; offer a free report only if it helps and the community allows it. No links unless asked.', starts: 'Now', time: '15 min a day' },
  { channel: 'Blog and data studies', what: 'An SEO article every other week (for example "landing page audit checklist"), each ending with a link to the free grader. A data study monthly: review 100 sites in one niche and publish what you find (about $2 of AI). Search traffic takes 6–12 months, so keep going when the numbers look small.', starts: 'Month 2', time: '1.5 hours every other week' },
  { channel: 'Personal LinkedIn messages', what: 'Typed by hand, to agency founders who react to your posts. Up to 10 a day. Never automated.', starts: 'Month 2', time: '15 min a day' },
  { channel: 'Free launch sites', what: 'Uneed, Microlaunch, Peerlist and Fazier (free options, check).', starts: 'Month 2', time: 'One sitting' },
  { channel: 'Referrals and partners', what: 'Ask every happy customer for one intro and to share their partner link (30% for 12 months). Partner emails to consultants and freelancers.', starts: 'Month 2, once 3 customers are happy', time: '30 min on Thursdays' },
  { channel: 'Product Hunt and Show HN', what: 'Launch the free grader, not the paid app. Around week 6 if the trigger is met (10 paying customers and smooth onboarding); otherwise wait. Prepare a 30-second demo video, 5 screenshots, a first comment explaining why you built it, and 20 people ready to try it on the day.', starts: 'After 10 paying customers', time: 'A few days of preparation' },
  { channel: 'Directories and listings', what: 'G2, Capterra, SaaSHub and AlternativeTo.', starts: 'After 5 paying customers who can leave reviews', time: 'One sitting' },
  { channel: 'Teardown videos', what: 'The weekly teardown as a 2-minute screen recording for YouTube and LinkedIn.', starts: 'Month 3', time: '30 min a week' },
  { channel: 'Guest spots', what: 'Agency podcasts, newsletters, communities and webinars.', starts: 'Month 4', time: 'Varies' },
  { channel: 'Paid ads and sponsored newsletters', what: 'In £100 tests, paid from revenue.', starts: 'MRR over £3,000', time: 'Varies' },
];

export const CONTENT_CALENDAR: { day: string; goesOut: string; where: string; time: string; starts: string }[] = [
  { day: 'Monday', goesOut: "Pick two well-known pages to tear down while you read last week's numbers.", where: 'Autopilot dashboard, admin', time: '30 min (with numbers)', starts: 'Week 1' },
  { day: 'Tuesday', goesOut: 'Teardown 1 goes out. You write both teardowns in one sitting and schedule them for Tuesday and Thursday.', where: 'LinkedIn', time: '1 hour', starts: 'Week 1' },
  { day: 'Wednesday', goesOut: 'Every other week: an SEO article or a data study.', where: 'Blog, then LinkedIn', time: '1.5 hours', starts: 'Month 2' },
  { day: 'Thursday', goesOut: 'Teardown 2 goes out. Partner emails and intros.', where: 'LinkedIn, email', time: '30 min', starts: 'Teardowns now; partner emails month 2' },
  { day: 'Friday', goesOut: 'Calls. Fix one thing customers asked for.', where: 'Calls, the product', time: '1 hour', starts: 'Week 1' },
  { day: 'Every weekday', goesOut: 'Helpful replies to F5Bot alerts. No links unless asked.', where: 'Reddit, Hacker News', time: '15 min at 14:00', starts: 'Week 1' },
];

// ─── Email templates (copied from the Outreach Autopilot's Settings sheet) ───

const SHEET = {
  footer: `{your_name}
{company_line}, {postal_address}
Privacy notice, including how I found your details: {privacy_link}
Not useful? Reply "no" and I won't email you again.`,
  agencySubject: `Free client audits for {company}`,
  agencyEmail: `Hi {first_name},

I run PageGrade, a UK tool that reviews a website's main page in about a minute: a score out of 100, the fixes that matter most, and a report you can share.

Agencies use it to start sales conversations. Instead of a generic pitch, they send a prospect a short audit of the prospect's own site.

Want to try it on real prospects? Reply with three websites you'd like to win as clients, or just reply "yes" and I'll pick three {niche} businesses in {city}. I'll send back ready-to-send reports with your agency's name on them. It's free and there's nothing to sign up for.

Here's what a report looks like: {sample_link}`,
  agencyFollowUp1: `Hi {first_name},

Just checking this reached you. The offer stands: three free, ready-to-send audits of businesses you could win, with your agency's name on them. A one-word "yes" is enough.`,
  agencyFollowUp2: `Hi {first_name},

Last note from me. If client audits aren't a priority right now, no problem. If they are later, the sample report is here: {sample_link}`,
  ownerSubject: `3 quick fixes for {website}`,
  ownerEmail: `Hi {first_name},

I ran {website} through PageGrade, the tool I run, which reviews a page the way a first-time visitor sees it. Three things stood out:

{fixes}

The full report, with screenshots and suggested rewrites, is here. It's free and needs no sign-up: {report_link}

If you change the page, you can re-check it with a free account.`,
  ownerFollowUp1: `Hi {first_name},

Did you get a chance to look at the report for {website}? The first fix on the list is usually the quickest win: {report_link}`,
  ownerFollowUp2: `Hi {first_name},

Last one from me. The report for {website} is still here if you want it later: {report_link}`,
  partnerSubject: `Partner idea for {company}`,
  partnerEmail: `Hi {first_name},

I run PageGrade, a UK tool that reviews a website's main page in about a minute and shows the fixes that matter most, with a report you can share.

I'm looking for a few partners who advise businesses on their websites or marketing. Partners earn 30% of every payment from the customers they refer, for 12 months, tracked automatically.

Would you like a partner link? I'm happy to show you the tool first.`,
  partnerFollowUp1: `Hi {first_name},

Just checking this reached you. If you advise clients on their websites, a partner link takes two minutes to set up.`,
  partnerFollowUp2: `Hi {first_name},

Last note from me. If it's ever useful, this sample report shows what your clients would get: {sample_link}`,
  placeholders: `Placeholders: {first_name} (empty = "there"), {company}, {website} (shown as the domain), {city} (empty = "your area"), {niche} (empty = "local"), {report_link}, {fixes}, {your_name}, {company_line}, {postal_address}, {sample_link}, {privacy_link}, {booking_link}. If a placeholder without a default is empty, that row waits and the Script note says what's missing.`,
} as const;

export type EmailTemplate = { id: string; label: string; when: string; body: string };
export type TemplateGroup = { id: string; track: string; note: string; subject: string; emails: EmailTemplate[] };

const NO_REPLY = "Sent if there's no reply.";
export const OUTREACH_TEMPLATES: TemplateGroup[] = [
  {
    id: 'agency', track: 'Agency', note: 'Track = Agency. Needs Company.', subject: SHEET.agencySubject,
    emails: [
      { id: 'agency-first', label: 'First email', when: 'Offer only: no audit of their own site.', body: SHEET.agencyEmail },
      { id: 'agency-follow-1', label: 'Follow-up 1', when: NO_REPLY, body: SHEET.agencyFollowUp1 },
      { id: 'agency-follow-2', label: 'Follow-up 2', when: 'Last email.', body: SHEET.agencyFollowUp2 },
    ],
  },
  {
    id: 'owner', track: 'Owner', note: 'Track = Owner. Needs Website, Report link and Fixes.', subject: SHEET.ownerSubject,
    emails: [
      { id: 'owner-first', label: 'First email', when: 'Paste the top 3 fixes and the share link from PageGrade\'s "Email the fixes".', body: SHEET.ownerEmail },
      { id: 'owner-follow-1', label: 'Follow-up 1', when: NO_REPLY, body: SHEET.ownerFollowUp1 },
      { id: 'owner-follow-2', label: 'Follow-up 2', when: 'Last email.', body: SHEET.ownerFollowUp2 },
    ],
  },
  {
    id: 'partner', track: 'Partner', note: 'Track = Partner. For consultants, freelancers and agencies that advise clients.', subject: SHEET.partnerSubject,
    emails: [
      { id: 'partner-first', label: 'First email', when: 'First email.', body: SHEET.partnerEmail },
      { id: 'partner-follow-1', label: 'Follow-up 1', when: NO_REPLY, body: SHEET.partnerFollowUp1 },
      { id: 'partner-follow-2', label: 'Follow-up 2', when: 'Last email.', body: SHEET.partnerFollowUp2 },
    ],
  },
];
export const OUTREACH_FOOTER: EmailTemplate = {
  id: 'footer', label: 'Footer', when: 'Added to every email. Keep your name, company, address, the privacy link and the opt-out line.', body: SHEET.footer,
};
export const PLACEHOLDERS = SHEET.placeholders;

/** What you send yourself after a reply, from Gmail. Change the words so they sound like you. */
export const REPLY_TEMPLATES: EmailTemplate[] = [
  {
    id: 'reply-pack', label: 'Reply with the pack', when: 'In the same Gmail thread, with the three PDFs attached.',
    body: `Hi [first name],

Here are the three audits, ready to send (attached). Each has your agency's name and logo, a score, the top fixes and suggested rewrites.

If you'd like to send audits like these every week, the Agency plan is ${gbp(PLANS.agency.priceGbp)} a month or ${gbp(yearly('agency'))} a year: ${PLANS.agency.reviews} reviews a month, your branding on every report and PDF, client folders, bulk reviews of up to ${BULK_MAX} pages, and weekly checks with alerts for your clients' sites. Start by 31 January and you keep that price for life.

Happy to show you how it works in 15 minutes: [booking link]`,
  },
  {
    id: 'reply-welcome', label: 'Welcome note to every new sign-up', when: 'When the sign-up alert arrives.',
    body: `Hi [first name], I'm [your name], I built PageGrade. Thanks for trying it. What page are you working on? Reply with the link and I'll tell you the first change I'd make.`,
  },
  {
    id: 'reply-used-up', label: 'When someone uses up the free reviews', when: 'The worker also sends a free-reviews-used note; send this one when you want it to be personal.',
    body: `Hi [first name], you've used your three free reviews. To re-check your page after changes, Starter is ${gbp(PLANS.starter.priceGbp)} a month for ${PLANS.starter.reviews} reviews and a weekly check. Pro is ${gbp(PLANS.pro.priceGbp)} for ${PLANS.pro.reviews} reviews, competitor checks and PDF reports. Any questions, just reply.`,
  },
  {
    id: 'reply-intro', label: 'Asking for an intro', when: 'Once a customer says it is working.',
    body: `Glad it's working for you. Do you know one other agency owner who'd find it useful? If you share your partner link, you get 30% of what they pay for 12 months.`,
  },
];

// ─── Keeping customers ───────────────────────────────────────────────────────

export const RETENTION: { title: string; text: string }[] = [
  { title: 'Onboarding call in week 1', text: "For every Agency customer (15 minutes): set up their branding, one client folder and weekly checks for their top five clients. Monitoring is the reason they stay." },
  { title: 'Check-ins on day 7 and day 25', text: "One question each: what's working, and what's missing? The worker sends Agency onboarding and check-in emails once per user; answer every reply yourself." },
  { title: 'Offer yearly billing in month 2 or 3', text: 'Two months free. It helps cash, and fewer yearly customers cancel.' },
  { title: 'Ask everyone who cancels one question', text: 'What made you cancel? Stripe\'s billing portal asks, and the answers show in the Live admin page under What users say. Fix the top reason each month.' },
  { title: 'Target', text: `Under ${TARGETS.churnPct}% of customers cancelling a month. Over ${TARGETS.churnAlarmPct}% is a problem: onboarding calls and client checks first, then ask why.` },
];
export const INTERVIEW_QUESTIONS: string[] = [
  'What were you trying to do when you found PageGrade?',
  'What did you do before? What did it cost you?',
  'What did you change after reading the report?',
  'What would make PageGrade something you would keep paying for, not just nice to have?',
  'Who else do you know with the same problem?',
];

// ─── Roadmap ─────────────────────────────────────────────────────────────────

export type RoadmapPhase = 'Now' | 'Week 2' | 'Month 1' | 'Months 2–3' | 'Later';
export type RoadmapItem = { phase: RoadmapPhase; item: string; why: string; size: string; shipped: boolean; note?: string };
export const ROADMAP: RoadmapItem[] = [
  { phase: 'Now', item: 'The business plan inside the admin area, with live numbers', why: 'One place for the plan, the numbers, the launch checklist and the pipeline.', size: 'Medium', shipped: true, note: 'This page.' },
  { phase: 'Now', item: 'Change the public sample report (public/demo/brightline-digital.html) to a local business', why: "It reviews an agency's homepage today; agencies should see the kind of report they would send.", size: 'Small', shipped: false },
  { phase: 'Week 2', item: 'Export a bulk batch as CSV (website, score, top three fixes, share link)', why: 'Paste owner prospects straight into the Autopilot sheet, with no copying from Email the fixes.', size: 'Small', shipped: true, note: 'CSV export of review results.' },
  { phase: 'Week 2', item: 'Sign-up alert and a weekly founder email', why: 'New sign-ups, MRR, cancellations and AI spend against the cap, without opening the admin page.', size: 'Small', shipped: true, note: 'A sign-up alert for every new account and a weekly digest (FOUNDER_ALERT_EMAIL).' },
  { phase: 'Month 1', item: 'Lifecycle emails: welcome, tips on day 2, free reviews used up, no review in 7 days', why: 'Replaces most of the manual notes in the reply templates.', size: 'Medium', shipped: true, note: 'First-review nudge, free-reviews-used note, and Agency onboarding with day 7 and day 25 check-ins, each sent once per user.' },
  { phase: 'Month 1', item: 'An agencies page with the pack offer, a sample pack and a booking link', why: 'Emails and posts can link to it, and it converts visitors on its own.', size: 'Small', shipped: true, note: 'The agencies page and pack request form. Requests become leads and email you.' },
  { phase: 'Months 2–3', item: 'Branding for each client folder', why: 'Packs without a demo account, and share links that are safe to send.', size: 'Medium', shipped: false },
  { phase: 'Later', item: 'A bigger agency plan (limits in plans.ts and new Stripe prices)', why: 'More revenue from the agencies that use PageGrade most.', size: 'Small, when 5+ agencies are near 200 reviews', shipped: false },
  { phase: 'Later', item: 'A grader widget agencies put on their own site, with their branding', why: 'Agencies capture their own leads with PageGrade, so they never cancel.', size: 'Large, when 3+ agencies ask', shipped: false },
];

// ─── Weekly numbers, routine, first week, risks ──────────────────────────────

export type MetricId = 'pack-requests' | 'opt-outs' | 'bounces' | 'pack-conversion' | 'signup-paid' | 'churn' | 'ai-spend';
export const WEEKLY_METRICS: { id: MetricId; measure: string; target: string; ifWorse: string; source: string }[] = [
  { id: 'pack-requests', measure: 'Agencies asking for a pack', target: `${TARGETS.packRequestPct}%+ of prospects (7%+ is great)`, ifWorse: 'New subject and opening, then new targets.', source: 'Autopilot dashboard; requests from the agencies page are in the Pipeline' },
  { id: 'opt-outs', measure: 'Opt-outs', target: `Under ${TARGETS.optOutPct}%`, ifWorse: 'Narrower targeting and softer wording.', source: 'Autopilot dashboard' },
  { id: 'bounces', measure: 'Bounces', target: `Under ${TARGETS.bouncePct}%`, ifWorse: "Use only addresses on the company's own site.", source: 'Autopilot dashboard' },
  { id: 'pack-conversion', measure: 'Packs that become customers', target: `${TARGETS.packToCustomerPct}%+`, ifWorse: 'Reply within 24 hours and offer a call.', source: 'Pipeline' },
  { id: 'signup-paid', measure: 'Sign-ups who pay in 60 days', target: `${TARGETS.signupToPaidPct}%+`, ifWorse: 'Welcome notes now, lifecycle emails later.', source: 'Database' },
  { id: 'churn', measure: 'Customers who cancel a month', target: `Under ${TARGETS.churnPct}%`, ifWorse: 'Onboarding calls and client checks; ask why.', source: 'Database' },
  { id: 'ai-spend', measure: 'AI spend', target: 'Under the cap', ifWorse: 'Raise the cap as customers grow.', source: 'Database' },
];

export const ROUTINE_DAILY: { when: string; what: string; time: string }[] = [
  { when: '09:00', what: 'Add 10–12 new prospects per mailbox, run Find emails, check the rows, set OK to email.', time: '30 min' },
  { when: '11:00', what: 'Answer the yellow rows (replies); make and send packs within 24 hours.', time: '30–45 min' },
  { when: '14:00', what: 'F5Bot alerts and community replies (helpful answers, no links unless asked).', time: '15 min' },
  { when: '16:00', what: 'Welcome notes to new sign-ups and support.', time: '15 min' },
];
export const ROUTINE_WEEKLY: { when: string; what: string; time: string }[] = [
  { when: 'Monday', what: 'Numbers: Autopilot dashboard and this page (MRR, sign-ups, AI spend). Top up AI credit. Copy opt-outs between sheets if you have more than one mailbox.', time: '30 min' },
  { when: 'Tuesday', what: 'Write two teardowns and schedule them.', time: '1 hour' },
  { when: 'Wednesday', what: 'Every other week: an article or a data study (from month 2).', time: '1.5 hours' },
  { when: 'Thursday', what: 'Partner emails and intros (from month 2).', time: '30 min' },
  { when: 'Friday', what: 'Calls; fix one thing customers asked for.', time: '1 hour' },
];
export const ROUTINE_NOTE = 'That is about 1.5–2 hours a day, plus 3–4 hours a week. Take one full day off a week.';

export const FIRST_WEEK: { day: string; text: string }[] = [
  { day: 'Tue 10 Nov', text: 'Launch checks in DEPLOY.md (new keys, domain, Railway, backups). Set AI_DAILY_BUDGET_USD=1, FREE_GRADER_DAILY_LIMIT=20 and ADMIN_EMAILS (your account and the demo account). Buy $10 of OpenAI credit with auto-recharge off.' },
  { day: 'Wed 11 Nov', text: "Stripe: run a full checkout in test mode, then go live. Pay the ICO fee. Add the outreach section to the privacy page. Check that the app's emails arrive." },
  { day: 'Thu 12 Nov', text: 'Create the outreach Gmail account and set up the Autopilot (15 minutes). Send a test to yourself. Set up F5Bot and a free Cal.com booking link. Sign up the demo account and make a practice pack.' },
  { day: 'Fri 13 Nov', text: 'Add 50 agencies and 10 owner pages. Run Find emails, check the rows, set OK to email, and start the Autopilot at 10 a day.' },
  { day: 'Sat 14 to Sun 15 Nov', text: 'Write two teardowns and schedule them for Tuesday and Thursday. Put the email templates into your own words.' },
  { day: 'Mon 16 Nov', text: 'First Monday numbers. Answer replies and send packs within 24 hours. On Mon 23 Nov 2026, raise to 20 a day if bounces are under 3% and opt-outs under 2%.' },
];

export const RISKS: { risk: string; sign: string; response: string }[] = [
  { risk: 'Emails land in spam', sign: 'Replies drop to almost none; bounces rise.', response: 'Slow down; plain text and one link; check the list. New mailboxes start at 10 a day.' },
  { risk: 'Google limits or suspends the outreach account', sign: 'Sending errors or a warning from Google.', response: '30 a day or less, honour opt-outs, and keep outreach on its own account.' },
  { risk: "The AI cap pauses paying customers' reviews", sign: 'Paused or failed reviews on the Live admin page.', response: 'Raise AI_DAILY_BUDGET_USD as customers grow: about $0.30 a day per Agency customer.' },
  { risk: 'AI credit runs out', sign: 'Balance under $3.', response: 'Auto-recharge off; top up from revenue on Mondays.' },
  { risk: "Agencies don't ask for packs", sign: 'Under 2% after 200 prospects.', response: 'New subject and opening; a narrower niche (for example Shopify or SEO agencies); more owner emails.' },
  { risk: "Packs don't convert", sign: 'Under 10% of packs.', response: 'Faster replies, a call and the money-back promise.' },
  { risk: '"ChatGPT does this for free"', sign: 'Comes up on calls.', response: "Show what it can't do: real page capture, speed checks, weekly monitoring, bulk reviews and branded PDFs." },
  { risk: 'Customers cancel', sign: 'Over 5% a month.', response: 'Onboarding calls and client checks; ask why.' },
  { risk: 'Breaking email rules', sign: 'A complaint.', response: 'Companies only, full footer, Do not contact list.' },
  { risk: 'Losing data', sign: '–', response: 'Follow the backup steps in DEPLOY.md every week.' },
  { risk: 'Burning out', sign: '–', response: 'Keep the fixed routine and take one full day off a week.' },
];

export const DO_NOT: { rule: string; why: string }[] = [
  { rule: 'Take payments before the launch checks in DEPLOY.md are done.', why: 'The product is built but not live: keys, domain, Stripe live mode and backups come first.' },
  { rule: 'Email anyone you have not qualified.', why: 'Only UK limited companies, LLPs, public bodies or US businesses, with an address from their own site. You set OK to email by hand.' },
  { rule: 'Remove anyone from Do not contact.', why: 'Opt-outs are permanent. Copy them into every mailbox sheet each Monday.' },
  { rule: 'Share report links from the demo account.', why: "Its branding changes with every pack, so an old link would show the next agency's logo. Send PDFs." },
  { rule: 'Say the AI readiness check shows whether AI tools mention or recommend a business.', why: 'It checks only whether AI tools can reach and read the page.' },
  { rule: 'Leave the AI cap at its default.', why: 'The default is $25 a day. Set AI_DAILY_BUDGET_USD=1 before launch and raise it on purpose.' },
  { rule: 'Let the OpenAI balance run dry or turn on auto-recharge.', why: 'Prepaid credit is the real spending limit. Top it up from revenue on Mondays.' },
  { rule: 'Run outreach from the account PageGrade sends its own emails from.', why: "A problem with outreach must not stop the app's emails." },
  { rule: 'Let a pack request wait more than a day.', why: 'Answer the yellow rows and the Pipeline, and send packs within 24 hours.' },
  { rule: 'Skip the weekly backup check or the day off.', why: 'Losing data and burning out are both on the risk list.' },
];
