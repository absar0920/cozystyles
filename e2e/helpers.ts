import path from 'node:path';
import { expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@cozyfurnitures.pk';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'CozyAdmin@2026';

/** Full-page screenshot under e2e/shots/ for eyeballing the UI after a run. */
export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/shots/${name}.png`, fullPage: true });
}

/** Collect uncaught page errors and failed same-origin requests so every test can assert none happened. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    const url = new URL(r.url());
    if (r.status() >= 500 && url.host === new URL(page.url() || 'http://x').host) errors.push(`${r.status()} ${url.pathname}`);
  });
  return errors;
}

export async function newContext(browser: Browser, opts: Parameters<Browser['newContext']>[0] = {}) {
  return browser.newContext({ baseURL: 'http://localhost:3100', viewport: { width: 1440, height: 900 }, ...opts });
}

export async function loginAsAdmin(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  return page;
}

/** Click the admin sidebar link, the way an admin moves between sections. */
export async function adminNav(page: Page, label: string) {
  const link = page.getByRole('navigation').getByRole('link', { name: new RegExp(`^${label}\\b`) }).first();
  const href = (await link.getAttribute('href'))!;
  await link.click();
  await page.waitForURL((u) => u.pathname === href);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Submit a form via its button and wait for the server action round-trip to settle. */
export async function submit(page: Page, name: string | RegExp) {
  const done = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname.startsWith('/admin'));
  await page.getByRole('button', { name }).click();
  await done;
  await page.waitForLoadState('networkidle');
}

/** Path on disk for a sample image, given its site path (e.g. /images/products/x.jpg → public/images/products/x.jpg). */
export const sample = (sitePath: string) => path.join('public', sitePath);

/** Click an upload control and pick files in the OS file dialog, like a user would. */
export async function chooseFiles(page: Page, trigger: Locator, files: string | string[]) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), trigger.click()]);
  await chooser.setFiles(files);
}

/** An uploaded image URL: /uploads/<folder>/<yyyy>/<mm>/<name>-<hash>.webp */
export const uploaded = (folder: string) => new RegExp(`^/uploads/${folder}/\\d{4}/\\d{2}/[a-z0-9-]+-[0-9a-f]{12}\\.webp$`);

/** Every <img> matching the selector has actually loaded (non-zero natural size). */
export async function expectImagesLoaded(page: Page, selector: string) {
  await page.waitForLoadState('networkidle');
  const sizes = await page.locator(selector).evaluateAll((imgs) =>
    Promise.all(
      (imgs as HTMLImageElement[]).map(async (img) => {
        img.loading = 'eager';
        await img.decode().catch(() => {});
        return img.naturalWidth;
      }),
    ),
  );
  expect(sizes.length, `images matching ${selector}`).toBeGreaterThan(0);
  for (const w of sizes) expect(w).toBeGreaterThan(0);
}

/** Click a control that runs a server action (toggle, approve, …) and wait for that round-trip to finish. */
export async function clickAction(page: Page, control: Locator) {
  const done = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname.startsWith('/admin'));
  await control.click();
  await done;
  await page.waitForLoadState('networkidle');
}
