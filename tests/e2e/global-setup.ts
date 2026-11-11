import { request, type FullConfig } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { PASSWORD, uniqueEmail } from './helpers';

/**
 * Creates one account for the tests that just need to be signed in, so a run
 * stays well under the sign-up rate limit (6 per IP per hour).
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: new URL(baseURL).origin } });
  const email = uniqueEmail('shared');
  const res = await ctx.post('/api/auth/signup', { data: { name: 'E2E Shared', email, password: PASSWORD } });
  if (!res.ok()) throw new Error(`could not create the shared test account: ${res.status()} ${await res.text()}`);
  await mkdir('test-results', { recursive: true });
  await ctx.storageState({ path: 'test-results/.auth-user.json' });
  await writeFile('test-results/.auth-email', email);
  await ctx.dispose();
}
