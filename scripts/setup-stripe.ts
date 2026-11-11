/**
 * One-time (idempotent) Stripe setup: products + monthly GBP prices with lookup
 * keys, the customer portal configuration and, optionally, the webhook endpoint.
 *
 *   npm run stripe:setup                  # products, prices, portal
 *   npm run stripe:setup -- --webhook     # also create the webhook endpoint for APP_URL
 */
import Stripe from 'stripe';
import { PAID_PLANS } from '../src/lib/plans';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error('STRIPE_SECRET_KEY is not set'); process.exit(1); }
const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const stripe = new Stripe(key);
const live = key.startsWith('sk_live_') || key.startsWith('rk_live_');
console.log(`Stripe ${live ? 'LIVE' : 'test'} mode · APP_URL ${appUrl}`);

const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed', 'invoice.paid', 'invoice.payment_failed',
];

const portalProducts: { product: string; prices: string[] }[] = [];
for (const plan of PAID_PLANS) {
  let productId: string | null = null;
  const prices: string[] = [];
  // A monthly and a yearly price per plan. Changed prices get a new Stripe price; existing subscribers keep theirs.
  for (const interval of ['month', 'year'] as const) {
    const lookup = interval === 'year' ? plan.yearlyLookupKey! : plan.lookupKey!;
    const gbp = interval === 'year' ? plan.yearlyPriceGbp! : plan.priceGbp;
    const amount = gbp * 100;
    const existing = (await stripe.prices.list({ lookup_keys: [lookup], active: true, expand: ['data.product'] })).data[0];
    if (existing) productId ??= (existing.product as Stripe.Product).id;
    if (existing && existing.unit_amount === amount && existing.currency === 'gbp' && existing.recurring?.interval === interval) {
      console.log(`✓ ${plan.name}: ${lookup} → ${existing.id} (£${gbp}/${interval}) exists`);
      prices.push(existing.id);
      continue;
    }
    productId ??= (await stripe.products.create({
      name: `PageGrade ${plan.name}`,
      description: `${plan.reviews} landing page reviews per month`,
      metadata: { plan: plan.id },
    })).id;
    const price = await stripe.prices.create({
      product: productId, currency: 'gbp', unit_amount: amount, recurring: { interval },
      lookup_key: lookup, transfer_lookup_key: true, tax_behavior: 'inclusive',
      nickname: `${plan.name} ${interval === 'year' ? 'yearly' : 'monthly'}`, metadata: { plan: plan.id, interval },
    });
    console.log(`+ ${plan.name}: created ${price.id} (£${gbp}/${interval}, lookup key ${lookup})`);
    prices.push(price.id);
  }
  portalProducts.push({ product: productId!, prices });
}

const https = appUrl.startsWith('https://');
const features: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
  customer_update: { enabled: true, allowed_updates: ['email', 'name', 'address'] },
  invoice_history: { enabled: true },
  payment_method_update: { enabled: true },
  subscription_cancel: {
    enabled: true, mode: 'at_period_end', proration_behavior: 'none',
    cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'] },
  },
  subscription_update: { enabled: true, default_allowed_updates: ['price'], proration_behavior: 'create_prorations', products: portalProducts },
};
const business_profile = https ? { headline: 'PageGrade LTD', privacy_policy_url: `${appUrl}/privacy`, terms_of_service_url: `${appUrl}/terms` } : { headline: 'PageGrade LTD' };
const current = (await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 })).data[0];
if (current) {
  await stripe.billingPortal.configurations.update(current.id, { features, business_profile, default_return_url: `${appUrl}/app/billing` });
  console.log(`✓ Customer portal: updated default configuration ${current.id}`);
} else {
  const created = await stripe.billingPortal.configurations.create({ features, business_profile, default_return_url: `${appUrl}/app/billing` });
  console.log(`+ Customer portal: created configuration ${created.id}`);
}

if (process.argv.includes('--webhook')) {
  if (!https) { console.error('--webhook needs an https APP_URL (use `stripe listen` for local development).'); process.exit(1); }
  const url = `${appUrl}/api/stripe/webhook`;
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const found = endpoints.data.find((e) => e.url === url);
  if (found) {
    await stripe.webhookEndpoints.update(found.id, { enabled_events: WEBHOOK_EVENTS });
    console.log(`✓ Webhook endpoint exists: ${found.id} → ${url} (events updated). Its signing secret is shown in the Stripe dashboard.`);
  } else {
    const ep = await stripe.webhookEndpoints.create({ url, enabled_events: WEBHOOK_EVENTS, description: 'PageGrade subscriptions' });
    console.log(`+ Webhook endpoint created: ${ep.id} → ${url}`);
    console.log(`  Set STRIPE_WEBHOOK_SECRET=${ep.secret}`);
  }
}
console.log('Done.');
