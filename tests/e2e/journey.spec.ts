import { test, expect } from '@playwright/test';
import { SIGNED_IN, watchConsole } from './helpers';

/**
 * The paying-customer journey against real services: a real review (OpenAI) of
 * a public page, sharing, and Stripe Checkout in test mode. Opt in with E2E_FULL=1.
 */
test.skip(!process.env.E2E_FULL, 'set E2E_FULL=1 to run the full journey');
test.describe.configure({ mode: 'serial' });
test.use({ storageState: SIGNED_IN });

const TARGET = process.env.E2E_REVIEW_URL || 'https://basecamp.com/';

test('review a page, read the report and share it', async ({ page, browser }) => {
  test.setTimeout(6 * 60_000);
  const errors = watchConsole(page);
  await page.goto(`/app/new?url=${encodeURIComponent(TARGET)}`);
  await expect(page.getByLabel('Page URL')).toHaveValue(TARGET);
  await page.getByLabel('What kind of page is it?').selectOption('saas');
  await page.getByLabel('Who is the page for?').fill('Owners of small businesses who manage projects with a team');
  await page.getByRole('button', { name: 'Start review' }).click();
  await expect(page).toHaveURL(/\/app\/reviews\/[\w-]+$/);

  // Progress screen, then the finished report (polling swaps it in without a reload).
  await expect(page.getByRole('img', { name: /Score \d+ out of 100/ }).first()).toBeVisible({ timeout: 5 * 60_000 });
  for (const section of ['Rewrites to test', 'What is already working', 'Page map', 'About this review']) {
    await expect(page.getByRole('heading', { name: section })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('button', { name: 'Create share link' }).click();
  const shareUrl = await page.getByLabel('Share link').inputValue();
  expect(shareUrl).toMatch(/\/r\/[\w-]+$/);

  const visitor = await browser.newContext();
  const shared = await visitor.newPage();
  const res = await shared.goto(shareUrl.replace(/^https?:\/\/[^/]+/, ''));
  expect(res?.status()).toBe(200);
  await expect(shared.getByRole('img', { name: /Score \d+ out of 100/ }).first()).toBeVisible();
  expect(res?.headers()['x-robots-tag'] ?? (await shared.locator('meta[name="robots"]').getAttribute('content'))).toContain('noindex');
  await visitor.close();
  expect(errors).toEqual([]);
});

test('upgrade through Stripe Checkout (test mode)', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await page.goto('/app/billing?plan=pro');
  await page.getByRole('button', { name: /Continue to checkout/ }).click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  await expect(page.getByText(/£29\.00/).first()).toBeVisible({ timeout: 30_000 });

  // Stripe's hosted page: pay with the standard test card. When several payment
  // methods are offered, the card form sits behind a "Pay with card" toggle.
  const cardNumber = page.getByRole('textbox', { name: 'Card number' });
  await expect(page.getByRole('heading', { name: 'Payment method' })).toBeVisible({ timeout: 30_000 });
  // Stripe's accordion toggle is a transparent overlay, so send the click to it directly.
  if (!(await cardNumber.isVisible())) await page.getByTestId('card-accordion-item-button').dispatchEvent('click');
  await expect(cardNumber).toBeVisible({ timeout: 15_000 });
  await cardNumber.fill('4242 4242 4242 4242');
  await page.getByRole('textbox', { name: 'Expiration' }).fill('12 / 34');
  await page.getByRole('textbox', { name: /CVC/ }).fill('123');
  await page.getByRole('textbox', { name: 'Cardholder name' }).fill('E2E Tester');
  await page.getByRole('combobox', { name: 'Country or region' }).selectOption({ label: 'United Kingdom' });
  const postcode = page.getByRole('textbox', { name: /postal code|postcode|zip/i });
  if (await postcode.isVisible().catch(() => false)) await postcode.fill('SW1A 1AA');
  const link = page.getByRole('checkbox', { name: /Save my information/i });
  if (await link.isChecked().catch(() => false)) await link.uncheck();
  await page.getByRole('button', { name: 'Subscribe' }).click();

  await page.waitForURL(/\/app\/billing/, { timeout: 90_000 });
  await expect(page.getByText(/Pro plan/).first()).toBeVisible({ timeout: 30_000 });
});
