import { isAdmin } from './session';
import { entitledPlan, usageFor } from './reviews';
import { env } from './env';
import { PLANS } from '../plans';
import type { User } from './users';

/** The signed-in user's account as sent to the browser. */
export function accountView(user: User) {
  const admin = isAdmin(user);
  const usage = usageFor(user, { admin });
  const limits = entitledPlan(user).limits;
  return {
    id: user.id, email: user.email, name: user.name,
    emailVerified: !!user.emailVerifiedAt, verificationRequired: env.requireVerification && !user.emailVerifiedAt,
    notifyOnComplete: user.notifyOnComplete, notifyMonitor: user.notifyMonitor, admin,
    billingInterval: user.billingInterval,
    /** What the plan includes (admins can use everything). */
    features: admin ? { ...limits, pdf: true, branding: true, clients: true, bulk: true, widget: Math.max(limits.widget, PLANS.agency.limits.widget) } : limits,
    brand: { ...user.brand, logoUrl: user.brand.logo ? `/api/brand/logo/${user.brand.logo}` : null },
    plan: { id: usage.plan.id, name: usage.plan.name, status: user.planStatus, cancelAtPeriodEnd: user.cancelAtPeriodEnd, periodEnd: user.periodEnd },
    usage: { used: usage.used, limit: usage.limit, remaining: usage.unlimited ? null : usage.remaining, unlimited: usage.unlimited, period: usage.period, resetsAt: usage.resetsAt },
    hasBillingAccount: !!user.stripeCustomerId,
  };
}
export type AccountView = ReturnType<typeof accountView>;
