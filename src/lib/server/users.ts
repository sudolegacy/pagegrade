import { db, now } from './db';
import { randomId, sha256 } from './ids';
import type { BillingInterval, PlanId } from '../plans';

/** Owns free-grader results until someone claims them. It can never sign in. */
export const GUEST_USER_ID = 'guest';

/** Agency branding for shared reports and PDFs. */
export type Brand = { name: string; color: string; website: string; logo: string | null; whiteLabel: boolean };

export type User = {
  id: string; email: string; name: string; emailVerifiedAt: number | null;
  plan: PlanId; planStatus: 'active' | 'past_due' | 'canceled' | 'incomplete'; billingInterval: BillingInterval;
  stripeCustomerId: string | null; stripeSubscriptionId: string | null;
  periodStart: number | null; periodEnd: number | null; cancelAtPeriodEnd: boolean;
  notifyOnComplete: boolean; notifyMonitor: boolean; brand: Brand;
  referralCode: string | null; referredBy: string | null; createdAt: number;
};

type Row = {
  id: string; email: string; name: string; email_verified_at: number | null; plan: string; plan_status: string; billing_interval: string | null;
  stripe_customer_id: string | null; stripe_subscription_id: string | null; period_start: number | null; period_end: number | null;
  cancel_at_period_end: number; notify_on_complete: number; notify_monitor: number | null; created_at: number; password_hash: string;
  brand_name: string | null; brand_color: string | null; brand_website: string | null; brand_logo: string | null; white_label: number | null;
  referral_code: string | null; referred_by: string | null;
};

export const toUser = (r: Row): User => ({
  id: r.id, email: r.email, name: r.name, emailVerifiedAt: r.email_verified_at, plan: r.plan as PlanId, planStatus: r.plan_status as User['planStatus'],
  billingInterval: r.billing_interval === 'year' ? 'year' : 'month',
  stripeCustomerId: r.stripe_customer_id, stripeSubscriptionId: r.stripe_subscription_id, periodStart: r.period_start, periodEnd: r.period_end,
  cancelAtPeriodEnd: !!r.cancel_at_period_end, notifyOnComplete: !!r.notify_on_complete, notifyMonitor: r.notify_monitor == null ? true : !!r.notify_monitor,
  brand: { name: r.brand_name ?? '', color: r.brand_color ?? '', website: r.brand_website ?? '', logo: r.brand_logo ?? null, whiteLabel: !!r.white_label },
  referralCode: r.referral_code ?? null, referredBy: r.referred_by ?? null, createdAt: r.created_at,
});

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export function findUserByEmail(email: string): (User & { passwordHash: string }) | null {
  const r = db().prepare('SELECT * FROM users WHERE email = ?').get(normaliseEmail(email)) as Row | undefined;
  return r && r.id !== GUEST_USER_ID ? { ...toUser(r), passwordHash: r.password_hash } : null;
}
export function findUserById(id: string): User | null {
  const r = db().prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined;
  return r ? toUser(r) : null;
}
export function findUserByStripeCustomer(customerId: string): User | null {
  const r = db().prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get(customerId) as Row | undefined;
  return r ? toUser(r) : null;
}
export function passwordHashFor(id: string): string | null {
  return (db().prepare('SELECT password_hash FROM users WHERE id = ?').get(id) as { password_hash: string } | undefined)?.password_hash ?? null;
}

export function createUser(input: { email: string; name: string; passwordHash: string }): User {
  const id = randomId(12);
  const t = now();
  db().prepare('INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, normaliseEmail(input.email), input.name.trim().slice(0, 80), input.passwordHash, t, t);
  return findUserById(id)!;
}

export type UserFields = Partial<{
  name: string; password_hash: string; email_verified_at: number; notify_on_complete: number; notify_monitor: number;
  plan: string; plan_status: string; billing_interval: BillingInterval;
  stripe_customer_id: string | null; stripe_subscription_id: string | null; period_start: number | null; period_end: number | null; cancel_at_period_end: number;
  brand_name: string; brand_color: string; brand_website: string; brand_logo: string | null; white_label: number;
  referral_code: string | null; referred_by: string | null;
}>;

export function updateUser(id: string, fields: UserFields) {
  const keys = Object.keys(fields) as (keyof UserFields)[];
  if (!keys.length) return;
  db().prepare(`UPDATE users SET ${keys.map((k) => `${k} = @${k}`).join(', ')}, updated_at = @updated_at WHERE id = @id`).run({ ...fields, updated_at: now(), id });
}

export function deleteUser(id: string) {
  if (id === GUEST_USER_ID) throw new Error('the free-grader owner cannot be deleted');
  db().prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ---------- Single-use tokens (email verification, password reset) ----------
export function createToken(userId: string, kind: 'verify' | 'reset', ttlMs: number): string {
  const raw = randomId(32);
  const conn = db();
  conn.transaction(() => {
    conn.prepare('DELETE FROM tokens WHERE user_id = ? AND kind = ?').run(userId, kind);
    conn.prepare('INSERT INTO tokens (id, user_id, kind, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').run(sha256(raw), userId, kind, now() + ttlMs, now());
  })();
  return raw;
}

export function consumeToken(raw: string, kind: 'verify' | 'reset'): string | null {
  if (!raw || raw.length > 100) return null;
  const conn = db();
  return conn.transaction(() => {
    const row = conn.prepare('SELECT user_id, expires_at, used_at FROM tokens WHERE id = ? AND kind = ?').get(sha256(raw), kind) as { user_id: string; expires_at: number; used_at: number | null } | undefined;
    if (!row || row.used_at || row.expires_at < now()) return null;
    conn.prepare('UPDATE tokens SET used_at = ? WHERE id = ?').run(now(), sha256(raw));
    return row.user_id;
  }).immediate();
}
