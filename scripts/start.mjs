#!/usr/bin/env node
/**
 * Production entrypoint: runs the Next.js server and the review worker as two
 * child processes. The worker is restarted with backoff if it exits; if the web
 * server exits, the container exits so the platform restarts it.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const port = process.env.PORT || '3000';
const children = new Set();
let stopping = false;

function run(name, cmd, args) {
  const child = spawn(cmd, args, { stdio: 'inherit', env: process.env });
  children.add(child);
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (stopping) return;
    console.log(`[start] ${name} exited (${signal || code})`);
    if (name === 'web') shutdown('web exited', 1);
    else scheduleWorker();
  });
  return child;
}

let failures = 0;
let lastStart = 0;
function startWorker() {
  lastStart = Date.now();
  run('worker', process.execPath, ['dist/worker.mjs']);
}
function scheduleWorker() {
  failures = Date.now() - lastStart > 60_000 ? 1 : failures + 1;
  const delay = Math.min(30_000, 1000 * 2 ** (failures - 1));
  console.log(`[start] restarting worker in ${delay}ms`);
  setTimeout(() => { if (!stopping) startWorker(); }, delay);
}

function shutdown(reason, code = 0) {
  if (stopping) return;
  stopping = true;
  console.log(`[start] shutting down: ${reason}`);
  for (const c of children) c.kill('SIGTERM');
  const force = setTimeout(() => { for (const c of children) c.kill('SIGKILL'); process.exit(code); }, 30_000);
  const check = setInterval(() => { if (children.size === 0) { clearInterval(check); clearTimeout(force); process.exit(code); } }, 200);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (!existsSync('.next/BUILD_ID') || !existsSync('dist/worker.mjs')) {
  console.error('[start] build output missing: run `npm run build` first');
  process.exit(1);
}
run('web', process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', port, '-H', '0.0.0.0']);
if (process.env.RUN_WORKER !== 'false') startWorker();
