import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (SPEC docs/admin-easy-mode §8). They run against a running server: BASE_URL (or E2E_BASE_URL)
 * when set, else the dev server on http://localhost:3100 — started by Playwright only if nothing answers there.
 * One auth file per agent (E2E_AGENT) so parallel agents never write the same storage state.
 */
const authFile = `tests/.auth/admin-${process.env.E2E_AGENT ?? 'default'}.json`;
const externalBaseURL = process.env.BASE_URL ?? process.env.E2E_BASE_URL;
const baseURL = externalBaseURL ?? 'http://localhost:3100';
// helpers read E2E_BASE_URL (e.g. for the upload Origin header); keep the two in sync
process.env.E2E_BASE_URL = baseURL;

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Never start a server when BASE_URL points elsewhere; otherwise reuse the dev server if it is already up.
  webServer: externalBaseURL
    ? undefined
    : { command: 'npx next dev -p 3100', url: 'http://localhost:3100/admin/login', reuseExistingServer: true, timeout: 180_000 },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'admin', testMatch: /(admin|integration)\/(?!mobile).*\.spec\.ts/, dependencies: ['setup'], use: { storageState: authFile } },
    {
      name: 'admin-mobile',
      testMatch: /admin\/mobile\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Pixel 7'], channel: 'chrome', storageState: authFile },
    },
    {
      name: 'admin-mobile-360',
      testMatch: /admin\/mobile\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 740 }, channel: 'chrome', storageState: authFile },
    },
    { name: 'storefront', testMatch: /storefront\/.*\.spec\.ts/ },
  ],
});
