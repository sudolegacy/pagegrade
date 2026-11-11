import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a running PageGrade (default http://localhost:3000).
 *   npm run build && npm start      # in one terminal (or let webServer start it)
 *   npm run test:e2e                # smoke tests: no AI spend, no Stripe calls
 *   E2E_FULL=1 npm run test:e2e     # + full journey: a real review (~$0.02 of AI) and Stripe test checkout
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'npm start', url: `${baseURL}/api/health`, reuseExistingServer: true, timeout: 120_000 },
});
