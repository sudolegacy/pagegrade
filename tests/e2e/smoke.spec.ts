import { test, expect } from '@playwright/test';
import { POSTS } from '../../src/content/blog';
import { SIGNED_IN, logIn, signUp, uniqueEmail, watchConsole } from './helpers';

const PUBLIC_PAGES: [string, RegExp][] = [
  ['/', /landing page/i],
  ['/pricing', /pricing|plan/i],
  ['/sample', /./],
  ['/blog', /guides|landing page/i],
  ...POSTS.map((p) => [`/blog/${p.slug}`, new RegExp(p.title.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')] as [string, RegExp]),
  ['/privacy', /privacy/i],
  ['/terms', /terms/i],
  ['/cookies', /cookie/i],
];

test.describe('public site', () => {
  for (const [path, heading] of PUBLIC_PAGES) {
    test(`${path} renders without errors`, async ({ page }) => {
      const errors = watchConsole(page);
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('h1').first()).toHaveText(heading);
      await expect(page.locator('footer')).toContainText('PageGrade LTD');
      expect(errors).toEqual([]);
    });
  }

  test('unknown pages return a helpful 404', async ({ page }) => {
    const res = await page.goto('/this-page-does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('We could not find that page');
  });

  test('SEO plumbing is in place', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /app');
    expect(robots).toContain('Sitemap:');
    const sitemap = await (await request.get('/sitemap.xml')).text();
    for (const p of POSTS) expect(sitemap).toContain(`/blog/${p.slug}`);
    const og = await request.get('/opengraph-image');
    expect(og.headers()['content-type']).toContain('image/png');
    const health = await (await request.get('/api/health')).json();
    expect(health.ok).toBe(true);
  });

  test('security headers are sent', async ({ request }) => {
    const res = await request.get('/');
    expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['x-powered-by']).toBeUndefined();
  });
});

test.describe('accounts', () => {
  test('signed-out visitors are sent to log in', async ({ page, request }) => {
    await page.goto('/app/reviews');
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Freviews/);
    const api = await request.get('/api/reviews');
    expect(api.status()).toBe(401);
  });

  test('sign up, log out and log back in', async ({ page }) => {
    const errors = watchConsole(page);
    const email = uniqueEmail('auth');
    await signUp(page, email);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Review your first landing page');
    await page.getByRole('button', { name: 'Account menu' }).first().click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login/);
    await logIn(page, email);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Review your first landing page');
    expect(errors).toEqual([]);
  });

  test('wrong passwords and duplicate sign-ups are rejected', async ({ page }) => {
    const email = (await import('node:fs')).readFileSync('test-results/.auth-email', 'utf8');
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('not-the-right-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/signup');
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('another-long-password');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText(/already/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test.describe('signed in', () => {
    test.use({ storageState: SIGNED_IN });

    test('private addresses cannot be reviewed', async ({ page }) => {
      await page.goto('/app/new?url=http%3A%2F%2F127.0.0.1%2Fadmin');
      await page.getByLabel('Who is the page for?').fill('Anyone');
      await page.getByRole('button', { name: 'Start review' }).click();
      await expect(page.getByText(/private|internal|not publicly|cannot be reviewed/i).first()).toBeVisible();
      await expect(page).toHaveURL(/\/app\/new/);
    });

    test('the admin area is hidden from normal users', async ({ page }) => {
      const res = await page.goto('/admin');
      expect(res?.status()).toBe(404);
    });

    test('billing shows every plan', async ({ page }) => {
      await page.goto('/app/billing');
      await expect(page.getByRole('heading', { name: 'Free plan' })).toBeVisible();
      for (const plan of ['Starter', 'Pro', 'Agency']) {
        await expect(page.getByRole('heading', { name: plan, exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: `Choose ${plan}` })).toBeEnabled();
      }
    });
  });
});
