import { defineConfig } from '@playwright/test';

/** Browser-only walkthrough that writes walkthrough-output/<target>/ (see walkthrough/walkthrough.spec.ts). */
export default defineConfig({
  testDir: 'walkthrough',
  testMatch: /walkthrough\.spec\.ts$/,
  workers: 1,
  retries: 0,
  timeout: 30 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'walkthrough-output/test-results',
  use: { channel: 'chrome', actionTimeout: 30_000, navigationTimeout: 60_000, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
