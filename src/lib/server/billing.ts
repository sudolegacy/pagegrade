import Stripe from 'stripe';
import { db, now } from './db';
import { env } from './env';
import { HttpError } from './errors';
import { ALL_LOOKUP_KEYS, PLANS, intervalForLookupKey, lookupKeyFor, planById, planByLookupKey, type BillingInterval, type PlanId } from '../plans';
import { findUserById, findUserByStripeCustomer, updateUser, type User } from './users';
import { addFeedback } from './feedback';
import { recordCommission } from './referrals';

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!env.stripeSecretKey) throw new HttpError(503, 'Billing is not configured yet. Please contact support.', 'billing_unconfigured');
  client ??= new Stripe(env.stripeSecretKey, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: 'PageGrade' } });
  return client;
}
export const billingConfigured = () => !!env.stripeSecretKey;

// Prices are resolved by lookup key so the same code works in test and live mode.
let priceCache: { at: number; byKey: Map<string, string> } | null = null;
async function priceIdFor(planId: PlanId, interval: BillingInterval = 'month'): Promise<string> {
  const plan = PLANS[planId];
  const key = plan ? lookupKeyFor(plan, interval) : null;
  if (!key) throw new HttpError(400, 'Unknown plan.', 'unknown_plan');
  if (!priceCache || now() - priceCache.at > 10 * 60_000) {
    const prices = await stripe().prices.list({ lookup_keys: [...ALL_LOOKUP_KEYS], active: true, limit: 20 });
    priceCache = { at: now(), byKey: new Map(prices.data.map((p) => [p.lookup_key!, p.id])) };
  }
  const id = priceCache.byKey.get(key);
  if (!id) throw new HttpError(503, 'This plan is not available right now. Please contact support.', 'price_missing');
  return id;
}

async function ensureCustomer(user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe().customers.create({ email: user.email, name: user.name || undefined, metadata: { userId: user.id } }, { idempotencyKey: `customer-${user.id}` });
  updateUser(user.id, { stripe_customer_id: customer.id });
  return customer.id;
}

const ACTIVE = new Set(['active', 'trialing', 'past_due']);

export async function createCheckout(user: User, planId: PlanId, interval: BillingInterval = 'month'): Promise<string> {
  const plan = PLANS[planId];
  if (!plan || plan.id === 'free') throw new HttpError(400, 'Choose a paid plan.', 'unknown_plan');
  if (user.stripeSubscriptionId && ACTIVE.has(user.planStatus) && user.plan !== 'free') {
    // Existing subscribers change plan in the billing portal (prorated), never via a second subscription.
    return createPortal(user, { flow: 'update' });
  }
  const [customer, price] = await Promise.all([ensureCustomer(user), priceIdFor(planId, interval)]);
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    // Charge everyone in GBP as advertised, rather than Stripe's converted local-currency prices.
    adaptive_pricing: { enabled: false },
    billing_address_collection: 'auto',
    customer_update: { address: 'auto', name: 'auto' },
    subscription_data: { metadata: { userId: user.id } },
    metadata: { userId: user.id, plan: planId, interval },
    success_url: `${env.appUrl}/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.appUrl}/app/billing?checkout=cancelled`,
  });
  if (!session.url) throw new HttpError(502, 'Could not start checkout. Please try again.', 'checkout_failed');
  return session.url;
}

export async function createPortal(user: User, opts: { flow?: 'update' } = {}): Promise<string> {
  const customer = await ensureCustomer(user);
  const params: Stripe.BillingPortal.SessionCreateParams = { customer, return_url: `${env.appUrl}/app/billing?portal=return` };
  if (opts.flow === 'update' && user.stripeSubscriptionId) {
    params.flow_data = { type: 'subscription_update', subscription_update: { subscription: user.stripeSubscriptionId }, after_completion: { type: 'redirect', redirect: { return_url: `${env.appUrl}/app/billing?portal=updated` } } };
  }
  try {
    const session = await stripe().billingPortal.sessions.create(params);
    return session.url;
  } catch (error) {
    // Plan switching may be disabled in the portal configuration; fall back to the portal home.
    if (params.flow_data) return createPortal(user);
    throw error;
  }
}

/**
 * Pulls the customer's current subscription state from Stripe and stores it.
 * Webhooks, the checkout return page and the periodic reconcile all call this,
 * so the result is the same whichever arrives first, and missed events heal.
 */
export async function syncCustomer(customerId: string): Promise<User | null> {
  const user = findUserByStripeCustomer(customerId);
  if (!user) return null;
  const subs = await stripe().subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
  const ranked = subs.data
    .filter((s) => s.status !== 'incomplete_expired')
    .sort((a, b) => Number(ACTIVE.has(b.status)) - Number(ACTIVE.has(a.status)) || b.created - a.created);
  const sub = ranked[0];
  const item = sub?.items.data[0];
  const plan = item ? (planByLookupKey(item.price.lookup_key) ?? planById(String(item.price.metadata?.plan ?? '')) ?? null) : null;
  // Reasons people give in the billing portal when they cancel (Admin > What users say).
  for (const s of subs.data) {
    const cd = s.cancellation_details;
    if (cd && (cd.feedback || cd.comment)) addFeedback({ userId: user.id, kind: 'cancel', answer: cd.feedback ?? '', comment: cd.comment ?? '', ref: `cancel:${s.id}` });
  }
  if (sub && plan && ACTIVE.has(sub.status)) {
    updateUser(user.id, {
      plan: plan.id, plan_status: sub.status === 'trialing' ? 'active' : sub.status,
      billing_interval: intervalForLookupKey(item?.price.lookup_key) ?? (item?.price.recurring?.interval === 'year' ? 'year' : 'month'),
      stripe_subscription_id: sub.id,
      period_start: (item?.current_period_start ?? 0) * 1000 || null,
      period_end: (item?.current_period_end ?? 0) * 1000 || null,
      cancel_at_period_end: sub.cancel_at_period_end || sub.cancel_at ? 1 : 0,
    });
  } else {
    updateUser(user.id, {
      plan: 'free', plan_status: sub && sub.status === 'incomplete' ? 'incomplete' : 'active',
      stripe_subscription_id: null, period_start: null, period_end: null, cancel_at_period_end: 0,
    });
  }
  return findUserById(user.id);
}

/** Verifies and processes a webhook. Each event id is processed at most once. */
export async function handleWebhook(rawBody: string, signature: string | null): Promise<{ status: number; body: string }> {
  if (!env.stripeWebhookSecret) return { status: 503, body: 'webhook secret not configured' };
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature ?? '', env.stripeWebhookSecret);
  } catch {
    return { status: 400, body: 'invalid signature' };
  }
  const conn = db();
  const existing = conn.prepare('SELECT processed_at FROM stripe_events WHERE id = ?').get(event.id) as { processed_at: number | null } | undefined;
  if (existing?.processed_at) return { status: 200, body: 'duplicate' };
  conn.prepare('INSERT INTO stripe_events (id, type, received_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING').run(event.id, event.type, now());
  try {
    const customerId = customerOf(event);
    if (customerId) await syncCustomer(customerId);
    if (customerId && event.type === 'invoice.paid') {
      const inv = event.data.object as Stripe.Invoice;
      recordCommission({
        id: inv.id ?? event.id, customerId, amountPence: inv.total_excluding_tax ?? inv.amount_paid ?? 0,
        currency: inv.currency ?? 'gbp', paidAt: (inv.status_transitions?.paid_at ?? inv.created) * 1000,
      });
    }
    conn.prepare('UPDATE stripe_events SET processed_at = ?, error = NULL WHERE id = ?').run(now(), event.id);
    return { status: 200, body: 'ok' };
  } catch (error) {
    conn.prepare('UPDATE stripe_events SET error = ? WHERE id = ?').run(String((error as Error).message ?? error).slice(0, 500), event.id);
    console.error('[stripe] webhook processing failed', event.type, event.id, error);
    return { status: 500, body: 'processing failed' }; // Stripe retries with backoff
  }
}

const RELEVANT = new Set([
  'checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed', 'invoice.paid', 'invoice.payment_failed',
]);
function customerOf(event: Stripe.Event): string | null {
  if (!RELEVANT.has(event.type)) return null;
  const obj = event.data.object as { customer?: string | { id: string } | null };
  const c = obj.customer;
  return typeof c === 'string' ? c : c?.id ?? null;
}

/** Called on return from Checkout so the plan updates immediately even before the webhook lands. */
export async function syncAfterCheckout(user: User, sessionId: string | null): Promise<User> {
  if (sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (customer && session.client_reference_id === user.id) {
      if (!user.stripeCustomerId) updateUser(user.id, { stripe_customer_id: customer });
      return (await syncCustomer(customer)) ?? user;
    }
  }
  if (user.stripeCustomerId) return (await syncCustomer(user.stripeCustomerId)) ?? user;
  return user;
}

/** Periodic safety net: re-sync every customer whose period looks stale. */
export async function reconcileSubscriptions(): Promise<number> {
  if (!billingConfigured()) return 0;
  const rows = db().prepare("SELECT stripe_customer_id AS c FROM users WHERE stripe_customer_id IS NOT NULL AND (plan != 'free' OR plan_status != 'active') AND (period_end IS NULL OR period_end < ?)").all(now() + 3600_000) as { c: string }[];
  let n = 0;
  for (const r of rows) {
    try { await syncCustomer(r.c); n++; } catch (error) { console.error('[stripe] reconcile failed for', r.c, (error as Error).message); }
  }
  return n;
}

/** Account deletion: stop billing immediately, keep invoices in Stripe. */
export async function cancelForDeletion(user: User) {
  if (!user.stripeCustomerId || !billingConfigured()) return;
  const subs = await stripe().subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 10 });
  for (const s of subs.data) if (!['canceled', 'incomplete_expired'].includes(s.status)) await stripe().subscriptions.cancel(s.id);
}
