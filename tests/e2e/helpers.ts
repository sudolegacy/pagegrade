import { expect, type Page } from '@playwright/test';

export const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;
export const PASSWORD = 'correct-horse-battery-staple';

/** Fails the test on uncaught page errors and console errors (CSP violations, hydration errors...). */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 40[134]/.test(m.text())) errors.push(m.text()); });
  return errors;
}

export async function signUp(page: Page, email: string, opts: { next?: string } = {}) {
  await page.goto(`/signup${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ''}`);
  await page.getByLabel('Name').fill('E2E Tester');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(opts.next ? new RegExp(opts.next.replace(/[?]/g, '\\?')) : /\/app$/);
}

export async function logIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/app/);
}

/** Signed-in state created by global-setup.ts. */
export const SIGNED_IN = 'test-results/.auth-user.json';
