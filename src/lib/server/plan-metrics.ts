import { db, kv, now } from './db';
import { env } from './env';
import { leadStats } from './leads';
import { PLANS, monthlyValue, planById, type BillingInterval, type PlanId } from '../plans';
import { MRR_CHECKPOINTS, TARGETS, type MrrCheckpoint } from '@/content/business-plan';

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const usd = (n: number) => `$${n.toFixed(2)}`;
const count = (sql: string, ...params: unknown[]) => (db().prepare(sql).get(...params) as { n: number }).n;

const parse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
};

/** A launch check. `required` items block taking payments; `advised` ones are worth doing but do not. */
export type ChecklistItem = { id: string; label: string; ok: boolean; severity: 'required' | 'advised'; detail: string };
export type CheckpointStatus = 'ahead' | 'on_track' | 'behind';
export type CheckpointProgress = MrrCheckpoint & {
  passed: boolean;
  /** Whole days until the checkpoint, or since it passed. */
  days: number;
  status: CheckpointStatus;
  aboveBase: boolean;
  aboveFast: boolean;
  gapToBase: number;
};

function progressFor(c: MrrCheckpoint, mrr: number, at: number): CheckpointProgress {
  const passed = c.at <= at;
  return {
    ...c,
    passed,
    days: passed ? Math.floor((at - c.at) / DAY) : Math.ceil((c.at - at) / DAY),
    status: mrr >= c.fastMrr ? 'ahead' : mrr >= c.baseMrr ? 'on_track' : 'behind',
    aboveBase: mrr >= c.baseMrr,
    aboveFast: mrr >= c.fastMrr,
    gapToBase: Math.max(0, round2(c.baseMrr - mrr)),
  };
}

/** The plan's cap: $1 until someone pays, then $3 plus about $0.30 a day for each Agency customer. */
const recommendedCapUsd = (paying: number, agencies: number) =>
  paying === 0 ? TARGETS.aiCapUsdStart : round2(TARGETS.aiCapUsdOnceTrading + TARGETS.aiCapUsdPerAgency * agencies);

function appUrlState(raw: string): 'ok' | 'not_https' | 'local' {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host) || host.endsWith('.localhost') || host.endsWith('.local')) return 'local';
    return url.protocol === 'https:' ? 'ok' : 'not_https';
  } catch {
    return 'not_https';
  }
}

/** Configuration presence only. Values (keys, passwords, addresses) never go into a detail string. */
function launchChecklist(input: { at: number; paying: number; capUsd: number; recommendedCap: number }): ChecklistItem[] {
  const { at, paying, capUsd, recommendedCap } = input;
  const tight = paying < TARGETS.smallBusinessCustomers;
  const stripeKey = env.stripeSecretKey;
  const stripeLive = /^(sk|rk)_live_/.test(stripeKey);
  const missingStripe = [!stripeKey && 'STRIPE_SECRET_KEY', !env.stripeWebhookSecret && 'STRIPE_WEBHOOK_SECRET'].filter(Boolean).join(' and ');
  const alertsFromEnv = !!process.env.FOUNDER_ALERT_EMAIL?.trim();
  const url = appUrlState(env.appUrl);
  const companyNumber = (process.env.COMPANY_NUMBER || process.env.NEXT_PUBLIC_COMPANY_NUMBER || '').trim();
  const companyAddress = (process.env.COMPANY_ADDRESS || process.env.NEXT_PUBLIC_COMPANY_ADDRESS || '').trim();
  const missingCompany = [!companyNumber && 'COMPANY_NUMBER', !companyAddress && 'COMPANY_ADDRESS'].filter(Boolean).join(' and ');
  const graderLimit = env.graderDailyLimit;
  const worker = parse<{ at: number }>(kv.get('worker:heartbeat'));
  const workerSeconds = worker?.at ? Math.max(0, (at - worker.at) / 1000) : null;
  const workerAge = workerSeconds == null ? null : Math.round(workerSeconds);
  const backup = parse<{ at: number }>(kv.get('backup:last'));
  const backupAgeHours = backup?.at ? Math.max(0, (at - backup.at) / HOUR) : null;
  const backupHours = backupAgeHours == null ? null : Math.round(backupAgeHours);
  const admins = env.adminEmails.length;

  const capOk = !tight || capUsd <= recommendedCap + 1e-9;
  const graderOk = !tight || graderLimit <= TARGETS.graderDailyLimit;

  return [
    { id: 'openai', label: 'OpenAI API key', severity: 'required', ok: !!process.env.OPENAI_API_KEY?.trim(),
      detail: process.env.OPENAI_API_KEY?.trim() ? 'OPENAI_API_KEY is set.' : 'OPENAI_API_KEY is missing. No review can run without it.' },
    { id: 'stripe-keys', label: 'Stripe keys', severity: 'required', ok: !missingStripe,
      detail: missingStripe ? `Missing: ${missingStripe}. See DEPLOY.md and run npm run stripe:setup.` : 'STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set.' },
    { id: 'stripe-live', label: 'Stripe is in live mode', severity: 'required', ok: stripeLive,
      detail: stripeLive ? 'A live Stripe key is in use.' : stripeKey ? 'A test key is in use. Run a full checkout in test mode, then switch to live keys before taking real payments.' : 'No Stripe key is set.' },
    { id: 'smtp', label: 'Outgoing email (SMTP)', severity: 'required', ok: !!env.smtp,
      detail: env.smtp ? 'SMTP is configured, so verification, password resets, alerts and lifecycle emails can send.' : 'SMTP_HOST is not set. Nothing can be emailed: no verification, resets, sign-up alerts or lifecycle emails.' },
    { id: 'admin-emails', label: 'Admin emails', severity: 'required', ok: admins > 0,
      detail: admins === 0 ? 'ADMIN_EMAILS is empty, so nobody can open the admin area.' : admins === 1 ? 'One admin address. Add the demo account you use for prospect packs.' : `${admins} admin addresses: your account and the demo account for packs.` },
    { id: 'founder-name', label: 'Founder name', severity: 'advised', ok: !!env.founderName,
      detail: env.founderName ? 'FOUNDER_NAME is set, so emails are signed by a person.' : 'FOUNDER_NAME is empty. Set it so emails come from a person.' },
    { id: 'founder-alerts', label: 'Founder alert email', severity: 'advised', ok: !!env.founderAlertEmail,
      detail: !env.founderAlertEmail ? 'No address for sign-up alerts, pack requests and the weekly digest. Set FOUNDER_ALERT_EMAIL or ADMIN_EMAILS.'
        : alertsFromEnv ? 'Alerts go to FOUNDER_ALERT_EMAIL.' : 'Alerts go to the first ADMIN_EMAILS address. Set FOUNDER_ALERT_EMAIL to choose another.' },
    { id: 'app-url', label: 'Public https address', severity: 'required', ok: url === 'ok',
      detail: url === 'ok' ? 'APP_URL is a public https address.' : url === 'local' ? 'APP_URL points at localhost. Set the real https address before the build.' : 'APP_URL is not an https address. Set it before the build.' },
    { id: 'company', label: 'Company number and registered office', severity: 'required', ok: !missingCompany,
      detail: missingCompany ? `Missing: ${missingCompany}. UK business emails and the site footer must show them; set them as build variables.` : 'Both are set, so the footer, legal pages and outreach emails can show them.' },
    { id: 'booking', label: 'Booking link', severity: 'advised', ok: !!env.bookingUrl,
      detail: env.bookingUrl ? 'A booking link is set for the 15-minute call.' : 'NEXT_PUBLIC_BOOKING_URL is empty. Set a free Cal.com link for the 15-minute call (it needs a rebuild).' },
    { id: 'ai-cap', label: 'AI daily budget', severity: 'required', ok: capOk,
      detail: !tight ? `${paying} paying customers: raise the cap as customers grow, about $0.30 a day for each Agency customer. It is ${usd(capUsd)} now.`
        : capOk ? `${usd(capUsd)} a day, within the plan's ${usd(recommendedCap)} for now. Reaching it pauses every review, paying customers' too.`
          : `${usd(capUsd)} a day is above the plan's ${usd(recommendedCap)} while you have fewer than ${TARGETS.smallBusinessCustomers} paying customers. Set AI_DAILY_BUDGET_USD to ${recommendedCap}.` },
    { id: 'grader-cap', label: 'Free grader daily limit', severity: 'required', ok: graderOk,
      detail: !tight ? `${graderLimit} free grades a day. Raise it as paying customers arrive.`
        : graderOk ? `${graderLimit} free grades a day, about ${round2(graderLimit * 1.5)}p of AI at most.`
          : `${graderLimit} free grades a day is above the plan's ${TARGETS.graderDailyLimit} (about 30p a day). Set FREE_GRADER_DAILY_LIMIT to ${TARGETS.graderDailyLimit}.` },
    { id: 'worker', label: 'Review worker', severity: 'required', ok: workerSeconds != null && workerSeconds <= 120,
      detail: workerAge == null || workerSeconds == null ? 'The worker has never reported. Reviews will not run.' : workerSeconds <= 120 ? `The worker reported ${workerAge}s ago.` : `The worker last reported ${Math.round(workerSeconds / 60)} minutes ago. Reviews are not running.` },
    { id: 'backup', label: 'Database backup', severity: 'required', ok: backupAgeHours != null && backupAgeHours <= 30,
      detail: backupHours == null || backupAgeHours == null ? 'No backup yet. See DEPLOY.md.' : backupAgeHours <= 30 ? `The last backup was ${backupHours} hours ago.` : `The last backup was ${backupHours} hours ago. Check the worker and DEPLOY.md.` },
    { id: 'verification', label: 'Email verification', severity: 'advised', ok: env.requireVerification,
      detail: env.requireVerification ? 'Reviews require a verified email address.' : 'Email verification is off. Set REQUIRE_EMAIL_VERIFICATION=true once SMTP works so throwaway addresses cannot use up AI spend.' },
  ];
}

/**
 * Live numbers for the business plan page, read-only. Every window is measured from `at` (default: now)
 * so the same call can be replayed in tests.
 */
export function planMetrics(at: number = now()) {
  const conn = db();

  const paidRows = conn.prepare(`SELECT plan, billing_interval AS interval, plan_status AS status, COUNT(*) AS n FROM users
    WHERE plan != 'free' AND plan_status IN ('active', 'trialing', 'past_due') AND id != 'guest' GROUP BY plan, billing_interval, plan_status`).all() as
    { plan: string; interval: BillingInterval; status: string; n: number }[];
  const perPlan: Partial<Record<PlanId, number>> = {};
  let mrrSum = 0;
  let payingCustomers = 0;
  let pastDue = 0;
  for (const row of paidRows) {
    const plan = planById(row.plan);
    if (!plan) continue;
    mrrSum += monthlyValue(plan, row.interval === 'year' ? 'year' : 'month') * row.n;
    payingCustomers += row.n;
    if (row.status === 'past_due') pastDue += row.n;
    perPlan[plan.id] = (perPlan[plan.id] ?? 0) + row.n;
  }
  const mrr = round2(mrrSum);
  const agencyCount = perPlan.agency ?? 0;
  const byPlan = (['starter', 'pro', 'agency'] as const).map((id) => ({ plan: id, name: PLANS[id].name, count: perPlan[id] ?? 0 }));

  const checkpoints = MRR_CHECKPOINTS.map((c) => progressFor(c, mrr, at));
  const nextCheckpoint = checkpoints.find((c) => !c.passed) ?? null;
  const lastCheckpoint = [...checkpoints].reverse().find((c) => c.passed) ?? null;

  // Subscriptions that end are reset to the Free plan by billing sync, so the signals are Stripe's
  // "subscription deleted" events and any account marked canceled. Take the larger to avoid double counting.
  const since30 = at - 30 * DAY;
  const cancelledByStatus = count("SELECT COUNT(*) AS n FROM users WHERE plan_status = 'canceled' AND updated_at >= ? AND id != 'guest'", since30);
  const cancelledByEvent = count("SELECT COUNT(*) AS n FROM stripe_events WHERE type = 'customer.subscription.deleted' AND received_at >= ?", since30);
  const cancelled30 = Math.max(cancelledByStatus, cancelledByEvent);
  const reasons30 = count("SELECT COUNT(*) AS n FROM feedback WHERE kind = 'cancel' AND created_at >= ?", since30);
  const scheduled = count("SELECT COUNT(*) AS n FROM users WHERE cancel_at_period_end = 1 AND plan != 'free' AND plan_status IN ('active', 'trialing', 'past_due')");
  const churnBase = payingCustomers + cancelled30;

  // Sign-ups old enough to have had 60 days to pay. Your own accounts (admin and demo) are left out.
  const admins = env.adminEmails;
  const notAdmin = admins.length ? `AND email NOT IN (${admins.map(() => '?').join(', ')})` : '';
  const cohort = conn.prepare(`SELECT COUNT(*) AS cohort, COALESCE(SUM(CASE WHEN plan != 'free' THEN 1 ELSE 0 END), 0) AS paid
    FROM users WHERE id != 'guest' AND created_at < ? ${notAdmin}`).get(at - 60 * DAY, ...admins) as { cohort: number; paid: number };
  const maturing = (conn.prepare(`SELECT COUNT(*) AS n FROM users WHERE id != 'guest' AND created_at >= ? ${notAdmin}`).get(at - 60 * DAY, ...admins) as { n: number }).n;

  const grader = conn.prepare(`SELECT
      COALESCE(SUM(CASE WHEN origin = 'guest' THEN 1 ELSE 0 END), 0) AS grades,
      COALESCE(SUM(CASE WHEN origin = 'guest' AND user_id != 'guest' THEN 1 ELSE 0 END), 0) AS claimed
    FROM reviews WHERE created_at >= ?`).get(at - 7 * DAY) as { grades: number; claimed: number };

  const dayStart = new Date(at);
  dayStart.setUTCHours(0, 0, 0, 0);
  const spendTodayUsd = (conn.prepare('SELECT COALESCE(SUM(cost_usd), 0) AS s FROM reviews WHERE finished_at >= ?').get(dayStart.getTime()) as { s: number }).s;
  const capUsd = env.aiDailyBudgetUsd;
  const recommendedCap = recommendedCapUsd(payingCustomers, agencyCount);
  const tight = payingCustomers < TARGETS.smallBusinessCustomers;

  const week = leadStats(at - 7 * DAY);
  const month = leadStats(at - 30 * DAY);
  // "Not now" leads are left out: the pipeline does not record whether they were sent a pack.
  const packs = conn.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status IN ('pack_sent', 'won') THEN 1 ELSE 0 END), 0) AS sent,
      COALESCE(SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END), 0) AS won
    FROM leads WHERE kind = 'pack'`).get() as { sent: number; won: number };

  const items = launchChecklist({ at, paying: payingCustomers, capUsd, recommendedCap });

  return {
    at,
    mrr,
    payingCustomers,
    pastDue,
    byPlan,
    agencies: {
      count: agencyCount,
      priceRiseAt: TARGETS.agenciesBeforePriceRise,
      untilPriceRise: Math.max(0, TARGETS.agenciesBeforePriceRise - agencyCount),
    },
    progress: {
      targetMrr: TARGETS.mrr,
      pct: round1((mrr / TARGETS.mrr) * 100),
      remaining: Math.max(0, round2(TARGETS.mrr - mrr)),
    },
    checkpoints,
    nextCheckpoint,
    lastCheckpoint,
    churn: {
      cancelled30,
      reasons30,
      scheduled,
      /** Cancellations in 30 days as a share of the customers there were at the start (approximately: paying now plus cancelled). */
      monthlyPct: churnBase > 0 ? round1((cancelled30 / churnBase) * 100) : null,
      targetPct: TARGETS.churnPct,
    },
    signupToPaid: {
      cohort: cohort.cohort,
      paid: cohort.paid,
      pct: cohort.cohort > 0 ? round1((cohort.paid / cohort.cohort) * 100) : null,
      maturing,
      targetPct: TARGETS.signupToPaidPct,
    },
    grader: { grades7: grader.grades, claimed7: grader.claimed },
    ai: {
      spendTodayUsd,
      capUsd,
      recommendedCapUsd: recommendedCap,
      capTooHigh: tight && capUsd > recommendedCap + 1e-9,
      graderDailyLimit: env.graderDailyLimit,
      graderLimitTooHigh: tight && env.graderDailyLimit > TARGETS.graderDailyLimit,
    },
    leads: {
      open: week.open,
      total: week.total,
      won: week.won,
      packs7: week.packsSince,
      packs30: month.packsSince,
      wonLast30: month.wonSince,
      packsSent: packs.sent,
      packsWon: packs.won,
      packToCustomerPct: packs.sent > 0 ? round1((packs.won / packs.sent) * 100) : null,
    },
    launch: {
      items,
      ready: items.filter((i) => i.ok).length,
      blocking: items.filter((i) => !i.ok && i.severity === 'required').length,
    },
  };
}
export type PlanMetrics = ReturnType<typeof planMetrics>;
