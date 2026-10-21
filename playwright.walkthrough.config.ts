import { defineConfig } from '@playwright/test';

/** Generates docs/walkthrough/README.md + screenshots. Needs a fresh DB (admin only) on :3100. */
export default defineConfig({
  testDir: './e2e/walkthrough',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'e2e-results/walkthrough',
  expect: { timeout: 10_000 },
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 30_000 },
});
