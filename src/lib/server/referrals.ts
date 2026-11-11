import { randomBytes } from 'node:crypto';
import { db, now } from './db';
import { env } from './env';
import { addMonths } from './reviews';
import { findUserById, findUserByStripeCustomer, type User } from './users';

/**
 * Partner programme: anyone can share their link; when someone signs up
 * through it and pays, the partner earns REFERRAL_PERCENT of each payment for
 * REFERRAL_MONTHS from that customer's first payment. Commissions are held for
 * HOLD_DAYS (refunds, chargebacks) and paid out by hand from Admin.
 */
export const REFERRAL_COOKIE = 'pg_ref';
export const REFERRAL_COOKIE_MAX_AGE = 60 * 24 * 3600;
export const REFERRAL_CODE_RE = /^[a-z0-9]{6,12}$/;
export const HOLD_DAYS = 30;
const DAY = 24 * 3600_000;

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const randomCode = () => Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join('');

export function ensureReferralCode(user: User): string {
  if (user.referralCode) return user.referralCode;
  for (let i = 0; i < 5; i++) {
    try {
      db().prepare('UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL').run(randomCode(), user.id);
      const code = findUserById(user.id)?.referralCode;
      if (code) return code;
    } catch {
      // Code already taken by someone else: try another.
    }
  }
  throw new Error('could not allocate a referral code');
}

export function findReferrerByCode(code: string): string | null {
  if (!REFERRAL_CODE_RE.test(code)) return null;
  return (db().prepare('SELECT id FROM users WHERE referral_code = ?').get(code) as { id: string } | undefined)?.id ?? null;
}

/** On signup: remember who referred this account (first referrer wins, no self-referrals). */
export function attachReferral(userId: string, code: string | null | undefined): boolean {
  if (!code) return false;
  const referrer = findReferrerByCode(code.toLowerCase());
  if (!referrer || referrer === userId) return false;
  return db().prepare('UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL').run(referrer, userId).changes > 0;
}

/** Called for every paid invoice. Idempotent per invoice. */
export function recordCommission(invoice: { id: string; customerId: string; amountPence: number; currency: string; paidAt: number }): boolean {
  if (!(invoice.amountPence > 0) || env.referralPercent <= 0) return false;
  const user = findUserByStripeCustomer(invoice.customerId);
  if (!user?.referredBy) return false;
  const conn = db();
  if (!conn.prepare('SELECT 1 FROM users WHERE id = ?').get(user.referredBy)) return false;
  const first = (conn.prepare('SELECT MIN(created_at) AS t FROM referral_commissions WHERE referred_id = ?').get(user.id) as { t: number | null }).t;
  if (first && invoice.paidAt >= addMonths(first, env.referralMonths)) return false;
  const commission = Math.round((invoice.amountPence * env.referralPercent) / 100);
  return conn.prepare('INSERT OR IGNORE INTO referral_commissions (id, referrer_id, referred_id, amount_pence, commission_pence, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(invoice.id, user.referredBy, user.id, invoice.amountPence, commission, invoice.currency.toLowerCase(), invoice.paidAt).changes > 0;
}

export function referralStats(user: User) {
  const code = ensureReferralCode(user);
  const conn = db();
  const holdUntil = now() - HOLD_DAYS * DAY;
  const people = conn.prepare(`SELECT COUNT(*) AS signups,
      COALESCE(SUM(CASE WHEN plan != 'free' AND plan_status IN ('active', 'trialing', 'past_due') THEN 1 ELSE 0 END), 0) AS paying
    FROM users WHERE referred_by = ?`).get(user.id) as { signups: number; paying: number };
  const sums = conn.prepare(`SELECT
      COALESCE(SUM(CASE WHEN paid_out_at IS NULL AND created_at > ? THEN commission_pence END), 0) AS pending,
      COALESCE(SUM(CASE WHEN paid_out_at IS NULL AND created_at <= ? THEN commission_pence END), 0) AS payable,
      COALESCE(SUM(CASE WHEN paid_out_at IS NOT NULL THEN commission_pence END), 0) AS paid
    FROM referral_commissions WHERE referrer_id = ?`).get(holdUntil, holdUntil, user.id) as { pending: number; payable: number; paid: number };
  const recent = conn.prepare('SELECT amount_pence, commission_pence, currency, created_at, paid_out_at FROM referral_commissions WHERE referrer_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(user.id) as { amount_pence: number; commission_pence: number; currency: string; created_at: number; paid_out_at: number | null }[];
  return {
    code, url: `${env.appUrl}/?ref=${code}`, signups: people.signups, paying: people.paying,
    pendingPence: sums.pending, payablePence: sums.payable, paidPence: sums.paid,
    percent: env.referralPercent, months: env.referralMonths, payoutMinGbp: env.referralPayoutMinGbp, holdDays: HOLD_DAYS,
    recent: recent.map((r) => ({ amountPence: r.amount_pence, commissionPence: r.commission_pence, currency: r.currency, createdAt: r.created_at, paidOutAt: r.paid_out_at })),
  };
}

export type PartnerBalance = { id: string; email: string; code: string; signups: number; payablePence: number; pendingPence: number; paidPence: number };

export function referralBalances(): PartnerBalance[] {
  const holdUntil = now() - HOLD_DAYS * DAY;
  return db().prepare(`SELECT u.id, u.email, u.referral_code AS code,
      (SELECT COUNT(*) FROM users x WHERE x.referred_by = u.id) AS signups,
      COALESCE(SUM(CASE WHEN c.paid_out_at IS NULL AND c.created_at <= ? THEN c.commission_pence END), 0) AS payablePence,
      COALESCE(SUM(CASE WHEN c.paid_out_at IS NULL AND c.created_at > ? THEN c.commission_pence END), 0) AS pendingPence,
      COALESCE(SUM(CASE WHEN c.paid_out_at IS NOT NULL THEN c.commission_pence END), 0) AS paidPence
    FROM users u LEFT JOIN referral_commissions c ON c.referrer_id = u.id
    WHERE u.referral_code IS NOT NULL AND (c.id IS NOT NULL OR EXISTS (SELECT 1 FROM users x WHERE x.referred_by = u.id))
    GROUP BY u.id ORDER BY payablePence DESC, signups DESC LIMIT 50`).all(holdUntil, holdUntil) as PartnerBalance[];
}

/** Marks everything past the hold as paid for one partner. Returns the amount in pence. */
export function markReferralsPaid(referrerId: string): number {
  const conn = db();
  const t = now();
  const holdUntil = t - HOLD_DAYS * DAY;
  return conn.transaction(() => {
    const due = (conn.prepare('SELECT COALESCE(SUM(commission_pence), 0) AS s FROM referral_commissions WHERE referrer_id = ? AND paid_out_at IS NULL AND created_at <= ?').get(referrerId, holdUntil) as { s: number }).s;
    conn.prepare('UPDATE referral_commissions SET paid_out_at = ? WHERE referrer_id = ? AND paid_out_at IS NULL AND created_at <= ?').run(t, referrerId, holdUntil);
    return due;
  }).immediate();
}
