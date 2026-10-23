import { existsSync, readFileSync } from 'node:fs';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { gotoPage, type Guide } from './guide';

/** What every section receives. Sections share data only through the names in data.ts. */
export type Ctx = {
  guide: Guide;
  browser: Browser;
  baseURL: string;
  /** "local" (dry run on a fresh local database) or "staging". */
  target: string;
  /** Signed-in admin tab (desktop 1440×900). */
  admin: Page;
  /** A separate shopper browser (desktop 1440×900, not signed in). */
  shopper: Page;
  creds: { email: string; password: string };
  /** New browser context with the walkthrough defaults (e.g. a phone: pass devices['Pixel 7']). */
  newContext: (opts?: Parameters<Browser['newContext']>[0]) => Promise<BrowserContext>;
};

export type Section = { id: string; title: string; intro?: string; run: (ctx: Ctx) => Promise<void> };

/** KEY=value file reader (quotes optional). */
export function readEnvFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

/** Sign the admin tab in if it is on the login page (used when a run resumes from a later section). */
export async function ensureSignedIn(page: Page, creds: { email: string; password: string }) {
  await gotoPage(page, '/admin');
  if (/\/admin\/login/.test(page.url())) {
    await page.getByLabel(/email/i).fill(creds.email);
    await page.getByLabel(/password/i).fill(creds.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible({ timeout: 30_000 });
  }
}
