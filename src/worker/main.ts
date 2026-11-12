/**
 * Review worker: claims queued reviews from SQLite, runs the engine and stores
 * the report. Runs as a separate process next to the web server (see
 * scripts/start.mjs), so a crashing browser can never take the website down.
 */
import { hostname } from 'node:os';
import { mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { db, kv } from '../lib/server/db';
import { env } from '../lib/server/env';
import { mailer } from '../lib/server/mail';
import {
  capacityMode, claimNextReview, completeReview, failReview, heartbeat, releaseReview, reviewDir, reviewOwner, MAX_ATTEMPTS, type CapacityMode, type ClaimedReview,
} from '../lib/server/reviews';
import { analysisCache, backupDatabase, cleanReviewWorkFiles, pruneExpired } from '../lib/server/maintenance';
import { reconcileSubscriptions } from '../lib/server/billing';
import { monitorCheckFailed, monitorCheckFinished, scheduleDueMonitors, type MonitorOutcome } from '../lib/server/monitors';
import { pruneGuestGrades } from '../lib/server/grader';
import { notifyWidgetLead } from '../lib/server/widget';
import { runLifecycle } from '../lib/server/lifecycle';
import { nextDigestAt, sendFounderDigest } from '../lib/server/digest';
import { engineConfigFromEnv, ReviewError, runPipeline } from '../lib/engine/pipeline';
import { intakeSchema } from '../lib/engine/intake';

const WORKER_ID = `${hostname()}-${process.pid}-${randomBytes(3).toString('hex')}`;

/** Email the owner when a weekly check finds alert-level changes (score drop, slower page, page down, competitor change). */
async function notifyMonitor(outcome: MonitorOutcome | null, owner?: { email: string; notify_monitor: number } | null) {
  if (!outcome?.alert) return;
  const wants = owner ? !!owner.notify_monitor : outcome.user.notifyMonitor;
  if (!wants) return;
  const changes = outcome.changes.filter((c) => c.severity === 'alert');
  await mailer.monitorAlert(owner?.email ?? outcome.user.email, {
    url: `${env.appUrl}/app/monitoring`, pageUrl: outcome.monitor.url, label: outcome.monitor.label,
    competitor: outcome.monitor.kind === 'competitor', changes,
  }).catch((e) => log('monitor email failed', (e as Error).message));
}
const LEASE_MS = 90_000;
const HEARTBEAT_MS = 15_000;
const HARD_TIMEOUT_MS = Number(process.env.REVIEW_TIMEOUT_MS || 9 * 60_000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...args: unknown[]) => console.log(new Date().toISOString(), '[worker]', ...args);
/** A lead-widget audit finished or failed: the agency gets one email about the lead either way. */
const notifyLead = (id: string) => notifyWidgetLead(id).catch((e) => log('lead email failed', (e as Error).message));

let stopping = false;
const active = new Map<string, Promise<void>>();

async function processReview(job: ClaimedReview) {
  const started = Date.now();
  const dir = reviewDir(job.id);
  await mkdir(dir, { recursive: true });
  let stage = 'starting';
  const beat = setInterval(() => {
    if (!heartbeat(job.id, WORKER_ID, LEASE_MS)) log(`lost lease on ${job.id}`);
  }, HEARTBEAT_MS);
  log(`start ${job.id} attempt ${job.attempts} ${job.url}`);
  try {
    const intake = intakeSchema.parse({ url: job.url, pageType: job.page_type, goal: job.goal, audience: job.audience, context: job.context });
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ReviewError('timeout', 'The review took too long to finish. The page may be very large or slow to respond.')), HARD_TIMEOUT_MS); });
    const report = await Promise.race([
      runPipeline({
        url: job.url, intake, dir, config: engineConfigFromEnv(), cache: analysisCache,
        onStage: (s) => { stage = s; heartbeat(job.id, WORKER_ID, LEASE_MS, s); },
      }),
      timeout,
    ]).finally(() => clearTimeout(timer));
    if (!completeReview(job.id, WORKER_ID, report, Date.now() - started)) { log(`could not store ${job.id} (lease lost)`); return; }
    log(`done ${job.id} score ${report.score} cost $${report.meta.usage.costUsd.toFixed(4)} in ${Math.round((Date.now() - started) / 1000)}s`);
    await cleanReviewWorkFiles(dir);
    const owner = reviewOwner(job.id);
    if (job.origin === 'monitor') {
      await notifyMonitor(monitorCheckFinished(job.id, report), owner);
    } else if (job.origin === 'widget') {
      await notifyLead(job.id);
    } else if (owner?.notify_on_complete) {
      await mailer.reviewComplete(owner.email, { url: `${env.appUrl}/app/reviews/${job.id}`, score: report.score, grade: report.grade, pageUrl: report.finalUrl })
        .catch((e) => log('email failed', (e as Error).message));
    }
  } catch (error) {
    const timedOut = error instanceof ReviewError && error.code === 'timeout';
    if (error instanceof ReviewError) {
      log(`failed ${job.id} at ${stage}: ${error.code} ${error.detail ?? ''}`);
      failReview(job.id, WORKER_ID, error.code, error.message);
      const owner = reviewOwner(job.id);
      if (job.origin === 'monitor') {
        await notifyMonitor(monitorCheckFailed(job.id, error.message), owner);
      } else if (job.origin === 'widget') {
        await notifyLead(job.id);
      } else if (owner?.notify_on_complete) {
        await mailer.reviewFailed(owner.email, { url: `${env.appUrl}/app/new`, pageUrl: job.url, reason: error.message })
          .catch((e) => log('email failed', (e as Error).message));
      }
    } else if (job.attempts < MAX_ATTEMPTS) {
      log(`error on ${job.id} at ${stage} (attempt ${job.attempts}), will retry:`, error);
      releaseReview(job.id, WORKER_ID, { countAttempt: true });
    } else {
      log(`giving up on ${job.id} at ${stage}:`, error);
      failReview(job.id, WORKER_ID, 'internal', 'Something went wrong on our side while reviewing this page. You have not been charged; please try again.');
      if (job.origin === 'monitor') await notifyMonitor(monitorCheckFailed(job.id, 'Something went wrong on our side during the check.'), reviewOwner(job.id));
      if (job.origin === 'widget') await notifyLead(job.id);
    }
    // A hung browser may still hold resources after a timeout: restart cleanly.
    if (timedOut) { log('restarting worker after timeout'); clearInterval(beat); await sleep(500); process.exit(1); }
  } finally {
    clearInterval(beat);
  }
}

let lastMode: CapacityMode = 'open';
async function loop(slot: number) {
  while (!stopping) {
    const mode = capacityMode();
    if (mode !== lastMode) {
      lastMode = mode;
      if (mode === 'closed') log(`hard daily AI cap of $${env.aiDailyHardCapUsd} reached; pausing every review until midnight UTC`);
      else if (mode === 'paid_only') log(`daily AI budget of $${env.aiDailyBudgetUsd} reached; only paying customers' reviews continue until midnight UTC`);
      else log('daily AI spend is under budget again; taking every review');
    }
    if (mode === 'closed') { await sleep(60_000); continue; }
    const { claimed, abandoned } = claimNextReview(WORKER_ID, LEASE_MS, { paidOnly: mode === 'paid_only' });
    if (abandoned.length) {
      log(`gave up on abandoned reviews: ${abandoned.join(', ')}`);
      for (const id of abandoned) await notifyLead(id);
    }
    if (!claimed) { await sleep(1500 + slot * 250); continue; }
    const task = processReview(claimed);
    active.set(claimed.id, task);
    await task.catch((e) => log('unexpected', e));
    active.delete(claimed.id);
  }
}

const every = (ms: number, name: string, fn: () => Promise<unknown> | unknown) => {
  const run = async () => {
    const last = Number(kv.get(`task:${name}`) || 0);
    if (Date.now() - last < ms) return;
    kv.set(`task:${name}`, String(Date.now()));
    try { await fn(); } catch (e) { log(`${name} failed:`, e); }
  };
  void run();
  return setInterval(run, Math.min(ms, 10 * 60_000)).unref();
};

async function main() {
  db(); // run migrations before anything else
  log(`started ${WORKER_ID} · concurrency ${env.workerConcurrency} · data ${env.dataDir}`);
  const pulse = () => kv.set('worker:heartbeat', JSON.stringify({ at: Date.now(), id: WORKER_ID, active: active.size }));
  pulse();
  setInterval(pulse, HEARTBEAT_MS).unref();
  every(24 * 3600_000, 'backup', async () => log('backup written', await backupDatabase()));
  every(3600_000, 'prune', async () => { pruneExpired(); const n = await pruneGuestGrades(); if (n) log(`removed ${n} unclaimed free grades`); });
  every(10 * 60_000, 'monitors', () => { const ids = scheduleDueMonitors(); if (ids.length) log(`queued ${ids.length} weekly checks`); });
  every(6 * 3600_000, 'reconcile', async () => { const n = await reconcileSubscriptions(); if (n) log(`reconciled ${n} subscriptions`); });
  every(24 * 3600_000, 'lifecycle', async () => {
    const { sent, failed, byKind } = await runLifecycle();
    if (sent || failed) log(`lifecycle emails: ${sent} sent, ${failed} failed`, byKind);
  });
  // The first digest waits for Monday morning instead of going out on first start; after that it repeats every seven days.
  if (!kv.get('task:digest')) kv.set('task:digest', String(nextDigestAt() - 7 * 24 * 3600_000));
  every(7 * 24 * 3600_000, 'digest', async () => { if ((await sendFounderDigest()).sent) log('founder digest sent'); });

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log(`${signal}: finishing ${active.size} active review(s)`);
    const deadline = sleep(Number(process.env.SHUTDOWN_GRACE_MS || 25_000)).then(() => 'timeout');
    const result = await Promise.race([Promise.all(active.values()).then(() => 'done'), deadline]);
    if (result === 'timeout') for (const id of active.keys()) { releaseReview(id, WORKER_ID); log(`released ${id} back to the queue`); }
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  await Promise.all(Array.from({ length: env.workerConcurrency }, (_, i) => loop(i)));
}

main().catch((e) => { console.error('[worker] fatal', e); process.exit(1); });
