import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { env } from './env';

/**
 * SQLite in WAL mode on the data volume. The web server and the worker each
 * open their own connection; WAL allows concurrent readers with one writer and
 * busy_timeout makes brief write contention wait instead of failing.
 */
const MIGRATIONS: string[] = [
  `CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    email_verified_at INTEGER,
    plan TEXT NOT NULL DEFAULT 'free',
    plan_status TEXT NOT NULL DEFAULT 'active',
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    period_start INTEGER,
    period_end INTEGER,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    notify_on_complete INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    user_agent TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE TABLE tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('verify', 'reset')),
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX tokens_user ON tokens(user_id, kind);
  CREATE TABLE reviews (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    final_url TEXT,
    page_type TEXT NOT NULL,
    goal TEXT NOT NULL,
    audience TEXT NOT NULL,
    context TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'complete', 'failed')),
    stage TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    score INTEGER,
    grade TEXT,
    verdict TEXT,
    error_code TEXT,
    error_message TEXT,
    report_json TEXT,
    share_id TEXT UNIQUE,
    charged INTEGER NOT NULL DEFAULT 0,
    charged_at INTEGER,
    cost_usd REAL,
    duration_ms INTEGER,
    locked_by TEXT,
    lease_until INTEGER,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    finished_at INTEGER,
    deleted_at INTEGER
  );
  CREATE INDEX reviews_user ON reviews(user_id, created_at DESC);
  CREATE INDEX reviews_usage ON reviews(user_id, charged, charged_at);
  CREATE INDEX reviews_queue ON reviews(status, created_at);
  CREATE TABLE stripe_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    processed_at INTEGER,
    error TEXT
  );
  CREATE TABLE rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
  );
  CREATE TABLE analysis_cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  // 2.1: free grader, monitoring, agency features, referrals and feedback.
  `ALTER TABLE users ADD COLUMN billing_interval TEXT NOT NULL DEFAULT 'month';
  ALTER TABLE users ADD COLUMN notify_monitor INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN brand_name TEXT NOT NULL DEFAULT '';
  ALTER TABLE users ADD COLUMN brand_color TEXT NOT NULL DEFAULT '';
  ALTER TABLE users ADD COLUMN brand_website TEXT NOT NULL DEFAULT '';
  ALTER TABLE users ADD COLUMN brand_logo TEXT;
  ALTER TABLE users ADD COLUMN white_label INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN referral_code TEXT;
  ALTER TABLE users ADD COLUMN referred_by TEXT;
  CREATE UNIQUE INDEX users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;
  CREATE INDEX users_referred_by ON users(referred_by);
  ALTER TABLE reviews ADD COLUMN origin TEXT NOT NULL DEFAULT 'app';
  ALTER TABLE reviews ADD COLUMN guest_key TEXT;
  ALTER TABLE reviews ADD COLUMN client_id TEXT;
  ALTER TABLE reviews ADD COLUMN monitor_id TEXT;
  ALTER TABLE reviews ADD COLUMN batch_id TEXT;
  CREATE INDEX reviews_guest ON reviews(guest_key) WHERE guest_key IS NOT NULL;
  CREATE INDEX reviews_client ON reviews(user_id, client_id);
  CREATE INDEX reviews_monitor ON reviews(monitor_id, created_at);
  CREATE INDEX reviews_origin ON reviews(origin, created_at);
  CREATE INDEX reviews_batch ON reviews(user_id, batch_id) WHERE batch_id IS NOT NULL;
  CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    website TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX clients_user ON clients(user_id, name);
  CREATE TABLE monitors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id TEXT,
    url TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'own' CHECK (kind IN ('own', 'competitor')),
    label TEXT NOT NULL DEFAULT '',
    page_type TEXT NOT NULL,
    goal TEXT NOT NULL,
    audience TEXT NOT NULL DEFAULT '',
    context TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    baseline_review_id TEXT,
    last_score INTEGER,
    last_checked_at INTEGER,
    last_changes TEXT,
    last_alert_at INTEGER,
    failures INTEGER NOT NULL DEFAULT 0,
    next_run_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX monitors_due ON monitors(active, next_run_at);
  CREATE INDEX monitors_user ON monitors(user_id, created_at);
  CREATE TABLE referral_commissions (
    id TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id TEXT NOT NULL,
    amount_pence INTEGER NOT NULL,
    commission_pence INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'gbp',
    created_at INTEGER NOT NULL,
    paid_out_at INTEGER
  );
  CREATE INDEX referral_commissions_referrer ON referral_commissions(referrer_id, paid_out_at);
  CREATE TABLE feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    answer TEXT NOT NULL DEFAULT '',
    comment TEXT NOT NULL DEFAULT '',
    ref TEXT UNIQUE,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX feedback_created ON feedback(created_at);
  CREATE TABLE print_tokens (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  INSERT OR IGNORE INTO users (id, email, name, password_hash, notify_on_complete, notify_monitor, created_at, updated_at)
    VALUES ('guest', 'guest@pagegrade.invalid', 'Free grader', '!', 0, 0, 0, 0);`,
  // 2.2: agency prospect-pack requests (the plan's main sales channel) and lifecycle email tracking.
  `CREATE TABLE leads (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('pack', 'call', 'partner', 'other')),
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    prospects TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'pack_sent', 'won', 'lost')),
    note TEXT NOT NULL DEFAULT '',
    user_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX leads_status ON leads(status, created_at DESC);
  CREATE INDEX leads_email ON leads(email);
  CREATE TABLE lifecycle_emails (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    sent_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, kind)
  );`,
  // 2.2 (second part): prospect packs built from leads, client-folder branding, weekly outreach numbers and metric history.
  `ALTER TABLE clients ADD COLUMN brand_name TEXT NOT NULL DEFAULT '';
  ALTER TABLE clients ADD COLUMN brand_color TEXT NOT NULL DEFAULT '';
  ALTER TABLE clients ADD COLUMN brand_logo TEXT;
  ALTER TABLE leads ADD COLUMN client_id TEXT;
  ALTER TABLE leads ADD COLUMN batch_id TEXT;
  CREATE TABLE outreach_weeks (
    week_start INTEGER PRIMARY KEY,
    prospects_emailed INTEGER NOT NULL DEFAULT 0,
    replies INTEGER NOT NULL DEFAULT 0,
    pack_requests INTEGER NOT NULL DEFAULT 0,
    opt_outs INTEGER NOT NULL DEFAULT 0,
    bounces INTEGER NOT NULL DEFAULT 0,
    calls INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE metric_snapshots (
    week_start INTEGER PRIMARY KEY,
    mrr_gbp REAL NOT NULL DEFAULT 0,
    paying INTEGER NOT NULL DEFAULT 0,
    agencies INTEGER NOT NULL DEFAULT 0,
    users INTEGER NOT NULL DEFAULT 0,
    new_users INTEGER NOT NULL DEFAULT 0,
    grades INTEGER NOT NULL DEFAULT 0,
    pack_requests INTEGER NOT NULL DEFAULT 0,
    open_leads INTEGER NOT NULL DEFAULT 0,
    cancellations INTEGER NOT NULL DEFAULT 0,
    spend_usd REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );`,
  // 2.3: the lead widget agencies embed on their own site, and the leads it captures.
  // Widget audits are reviews with origin 'widget', owned by the agency.
  `CREATE TABLE widgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    active INTEGER NOT NULL DEFAULT 1,
    headline TEXT NOT NULL DEFAULT '',
    intro TEXT NOT NULL DEFAULT '',
    button_label TEXT NOT NULL DEFAULT '',
    cta_label TEXT NOT NULL DEFAULT '',
    cta_url TEXT NOT NULL DEFAULT '',
    privacy_url TEXT NOT NULL DEFAULT '',
    allowed_hosts TEXT NOT NULL DEFAULT '',
    notify INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE widget_leads (
    id TEXT PRIMARY KEY,
    widget_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    review_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    key_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'won', 'lost')),
    notified_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX widget_leads_user ON widget_leads(user_id, created_at DESC);
  CREATE INDEX widget_leads_review ON widget_leads(review_id);`,
];

let instance: Database.Database | null = null;

export function db(): Database.Database {
  if (instance) return instance;
  mkdirSync(path.dirname(env.dbPath), { recursive: true });
  const conn = new Database(env.dbPath);
  conn.pragma('journal_mode = WAL');
  conn.pragma('synchronous = NORMAL');
  conn.pragma('foreign_keys = ON');
  conn.pragma('busy_timeout = 5000');
  migrate(conn);
  instance = conn;
  return conn;
}

function migrate(conn: Database.Database) {
  conn.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const apply = conn.transaction(() => {
    const done = new Set((conn.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version));
    MIGRATIONS.forEach((sql, i) => {
      const version = i + 1;
      if (done.has(version)) return;
      conn.exec(sql);
      conn.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, Date.now());
    });
  });
  apply.immediate();
}

/** For tests: close and forget the connection. */
export function closeDb() {
  instance?.close();
  instance = null;
}

export const now = () => Date.now();

/** Tiny key/value store for operational state (worker heartbeat, last backup...). */
export const kv = {
  get(key: string): string | null {
    const row = db().prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  },
  set(key: string, value: string) {
    db().prepare('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(key, value, Date.now());
  },
};
