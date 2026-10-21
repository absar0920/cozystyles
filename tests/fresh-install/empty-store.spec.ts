import { expect, test, type Page } from '@playwright/test';
import { saveBar, uploadInto } from '../helpers/admin';
import { fixture } from '../helpers/fixtures';
import { adminCredentials } from '../helpers/env';

/**
 * A brand-new deployment: the database has only its tables (no seed), as on Hostinger before the owner starts.
 * Runs only with E2E_FRESH_URL pointing at such a server (see README → Tests). It checks that the store and every
 * admin screen work with no data, that the first sign-in creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD, and
 * that the owner can publish a first product with a photo and turn on WhatsApp ordering.
 */

const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = adminCredentials();
const TITLE = 'Fresh Install Sofa';

test.describe.configure({ mode: 'serial' });

function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 500) problems.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  return problems;
}

test('an empty store works and the owner can set it up from the browser', async ({ page }) => {
  test.setTimeout(240_000);
  const problems = watch(page);

  // Storefront with no products, collections, menus, banners or pages.
  for (const path of ['/', '/collections', '/search?q=sofa', '/blogs']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
  expect((await page.goto('/products/nothing-here'))?.status()).toBe(404);
  // No reviews yet, so no "customer speaks for us" rating block on the home page.
  await page.goto('/');
  await expect(page.getByText('Our customer speaks for us')).toHaveCount(0);

  // First sign-in creates the admin.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  // WhatsApp number not set yet: the admin says so.
  await expect(page.getByText('WhatsApp ordering is off')).toBeVisible();

  // Every admin screen opens with no data.
  for (const path of [
    '/admin/inquiries',
    '/admin/products',
    '/admin/products/new',
    '/admin/product-layouts',
    '/admin/collections',
    '/admin/collections/new',
    '/admin/collections/arrange',
    '/admin/banners',
    '/admin/menus',
    '/admin/pages',
    '/admin/blog',
    '/admin/blog/new',
    '/admin/reviews',
    '/admin/messages',
    '/admin/settings',
    '/admin/account/password',
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    await expect(page.getByRole('heading', { level: 1 }).first(), path).toBeVisible();
  }

  // The built-in standard layout exists, so products can be saved.
  await page.goto('/admin/product-layouts');
  await expect(page.getByText('General furniture (standard)').first()).toBeVisible();

  // First product: title, price, one photo, publish.
  await page.goto('/admin/products/new');
  await page.locator('#product-title').fill(TITLE);
  await page.getByLabel('Regular price', { exact: true }).fill('45000');
  await uploadInto(page.getByTestId('image-gallery'), fixture('sofa-grey.jpg'));
  await expect(page.getByTestId('image-gallery').locator('img[src^="/uploads/"]').first()).toBeVisible({ timeout: 30_000 });
  await saveBar(page).getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Saved. The store is updated.')).toBeVisible({ timeout: 30_000 });

  // It is on the store, with its uploaded photo; no WhatsApp button while no number is set.
  const product = '/products/fresh-install-sofa';
  expect((await page.goto(product))?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  const photo = page.locator('main img[src^="/uploads/"]').first();
  await expect(photo).toBeVisible();
  expect(await photo.evaluate((img: HTMLImageElement) => img.decode().then(() => img.naturalWidth))).toBeGreaterThan(0);
  await expect(page.getByText(/order on whatsapp/i)).toHaveCount(0);

  // Turn on WhatsApp ordering in Settings; the product page shows the button.
  await page.goto('/admin/settings');
  await page.getByLabel('WhatsApp number').fill('0309 2050463');
  await saveBar(page).getByRole('button', { name: /^Save/ }).click();
  await expect(page.getByText('Saved. The store is updated.')).toBeVisible({ timeout: 30_000 });
  await page.goto(product);
  await expect(page.getByText(/order on whatsapp/i).first()).toBeVisible();

  expect(problems).toEqual([]);
});
