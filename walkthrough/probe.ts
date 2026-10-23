/**
 * READ-ONLY page probe for writing the walkthrough (local server only): signs in once (cached session), opens a
 * URL and prints its ARIA snapshot (roles, names, labels) — never clicks Save/Publish or submits anything.
 *   npx tsx walkthrough/probe.ts /admin/products/new [--click "role=button[name='Add section']"] [--phone]
 * Optional --click opens a dialog/menu before the snapshot (only UI toggles, never saves).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium, devices } from '@playwright/test';
import { readEnvFile } from './context';

const base = process.env.WALK_BASE_URL ?? 'http://localhost:3200';
const auth = '/tmp/walk-probe-auth.json';
const env = readEnvFile(path.resolve(__dirname, '../.env'));
const [url, ...rest] = process.argv.slice(2);
const clicks: string[] = [];
for (let i = 0; i < rest.length; i++) if (rest[i] === '--click') clicks.push(rest[++i]);
const phone = rest.includes('--phone');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ baseURL: base, ...(phone ? devices['Pixel 7'] : { viewport: { width: 1440, height: 900 } }), ...(existsSync(auth) ? { storageState: auth } : {}) });
  const page = await ctx.newPage();
  await page.goto('/admin');
  if (page.url().includes('/admin/login')) {
    await page.getByLabel(/email/i).fill(env.ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(env.ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/admin\/?$/);
    await ctx.storageState({ path: auth });
  }
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  for (const c of clicks) {
    await page.locator(c).first().click();
    await page.waitForTimeout(500);
  }
  console.log(`# ${page.url()}\n`);
  console.log(await page.locator('body').ariaSnapshot());
  await browser.close();
})();
