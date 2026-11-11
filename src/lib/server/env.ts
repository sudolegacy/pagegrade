import path from 'node:path';

/** Central, typed access to configuration. Only required values throw, and only when used. */
const str = (name: string, fallback = '') => (process.env[name] ?? fallback).trim();
const num = (name: string, fallback: number) => { const v = str(name); const n = Number(v); return v && Number.isFinite(n) ? n : fallback; };

export const env = {
  get appUrl() { return str('APP_URL', 'http://localhost:3000').replace(/\/$/, ''); },
  get isProduction() { return process.env.NODE_ENV === 'production'; },
  get dataDir() { return path.resolve(str('DATA_DIR', path.join(process.cwd(), '.data'))); },
  get dbPath() { return path.join(env.dataDir, 'pagegrade.db'); },
  get reviewsDir() { return path.join(env.dataDir, 'reviews'); },
  get backupsDir() { return path.join(env.dataDir, 'backups'); },
  get brandsDir() { return path.join(env.dataDir, 'brands'); },
  get stripeSecretKey() { return str('STRIPE_SECRET_KEY'); },
  get stripeWebhookSecret() { return str('STRIPE_WEBHOOK_SECRET'); },
  get smtp() {
    const host = str('SMTP_HOST');
    return host ? { host, port: Number(str('SMTP_PORT', '587')), user: str('SMTP_USER'), pass: str('SMTP_PASS'), secure: str('SMTP_SECURE') === 'true' || str('SMTP_PORT') === '465' } : null;
  },
  get emailFrom() { return str('EMAIL_FROM', 'PageGrade <pagegrade1@gmail.com>'); },
  get supportEmail() { return str('SUPPORT_EMAIL', 'pagegrade1@gmail.com'); },
  get adminEmails() { return str('ADMIN_EMAILS').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean); },
  /** Reviews require a verified email when outgoing email is configured. */
  get requireVerification() { const v = str('REQUIRE_EMAIL_VERIFICATION'); return v ? v === 'true' : !!env.smtp; },
  get workerConcurrency() { return Math.max(1, Math.min(4, Number(str('WORKER_CONCURRENCY', '1')))); },
  /** Free grader: grades per visitor (IP) per day, and in total per day (the AI cost guard). */
  get graderPerIp() { return Math.max(1, num('FREE_GRADER_PER_IP', 3)); },
  get graderDailyLimit() { return Math.max(0, num('FREE_GRADER_DAILY_LIMIT', 150)); },
  /** Partner programme: commission share, how many months it is paid for, and the minimum payout. */
  get referralPercent() { return Math.max(0, Math.min(100, num('REFERRAL_PERCENT', 30))); },
  get referralMonths() { return Math.max(1, num('REFERRAL_MONTHS', 12)); },
  get referralPayoutMinGbp() { return Math.max(0, num('REFERRAL_PAYOUT_MIN_GBP', 50)); },
  /** Where the app can reach itself from inside the container (PDF rendering). */
  get internalUrl() { return (str('INTERNAL_APP_URL') || `http://127.0.0.1:${str('PORT', '3000')}`).replace(/\/$/, ''); },
  /** Signs the welcome email. */
  get founderName() { return str('FOUNDER_NAME'); },
};
