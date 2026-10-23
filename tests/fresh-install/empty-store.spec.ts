import { expect, test, type Page } from '@playwright/test';
import { saveBar, uploadInto } from '../helpers/admin';
import { fixture } from '../helpers/fixtures';
import { adminCredentials, envValue } from '../helpers/env';

/**
 * A brand-new deployment: the database has only its tables (no seed), as on Hostinger before the owner starts.
 * Runs only with E2E_FRESH_URL pointing at such a server (see README → Tests). It checks that the store and every
 * admin screen work with no data, that the first sign-in creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD, and
 * that the owner can publish a first product with a photo and turn on WhatsApp ordering. Also what every shop has
 * without any data: the built-in Contact us page (its form and the footer sign-up land in Admin → Messages), the
 * shop's own Page not found, no customer accounts, and a home page that shows only what the owner has filled in.
 */

const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = adminCredentials();
const TITLE = 'Fresh Install Sofa';
const SHOP = envValue('NEXT_PUBLIC_SITE_NAME')?.trim() || 'Cozy Furnitures';
const CONTACT_NAME = 'Fresh Install Customer';
const SIGNUP_EMAIL = 'fresh-signup@example.com';
const STRIP = 'Free delivery in Lahore';

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
  // No reviews, no borrowed certifications and no card logos (orders go through WhatsApp).
  await page.goto('/');
  await expect(page.getByText('Our customer speaks for us')).toHaveCount(0);
  await expect(page.locator('footer').getByText('Certified by')).toHaveCount(0);
  await expect(page.locator('footer svg title').filter({ hasText: /visa|mastercard|american express/i })).toHaveCount(0);
  // The home page shows only what the owner has filled in: no strip, rows or text block yet; its h1 is the shop name.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(SHOP);
  await expect(page.getByTestId('home-strip')).toHaveCount(0);
  await expect(page.getByTestId('home-text-block')).toHaveCount(0);
  await expect(page.getByText('The Same Experience & Quality You Trust Online')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Shop by Category' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Hot Selling Products' })).toHaveCount(0);
  const description = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
  expect(description).not.toMatch(/largest|manufacturer|checkout|credit card|debit card|track your order|augmented reality/i);

  // No customer accounts: no account icon or link, and old /account addresses open the home page.
  await expect(page.locator('a[href^="/account"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /my account|log ?in/i })).toHaveCount(0);
  await page.goto('/account/login');
  await expect(page).toHaveURL(/\/$/);

  // A mistyped address shows the shop's own Page not found, inside the store header and footer.
  expect((await page.goto('/sofa-sale'))?.status()).toBe(404);
  await expect(page.locator('main h1')).toHaveText('Page not found');
  await expect(page.locator('header.header')).toHaveCount(1);
  await expect(page.locator('footer.footer')).toHaveCount(1);

  // The built-in Contact us page works with no page in Admin → Pages and no contact details in Settings.
  expect((await page.goto('/pages/contact'))?.status()).toBe(200);
  const main = page.locator('main');
  await expect(main.getByRole('heading', { level: 1, name: 'Contact Us' })).toBeVisible();
  await expect(main.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0);
  await main.getByRole('textbox', { name: 'Name' }).fill(CONTACT_NAME);
  await main.getByRole('textbox', { name: 'Email' }).fill('fresh-customer@example.com');
  await main.getByRole('textbox', { name: 'Phone number' }).fill('0300 1234567');
  await main.getByRole('textbox', { name: 'Comment' }).fill('Do you deliver to Multan?');
  await main.getByRole('button', { name: 'Send Message' }).click();
  await expect(main.getByRole('status')).toContainText('Thanks for contacting us');

  // The footer sign-up is collected for Admin → Messages.
  await page.locator('#newsletter-email').fill(SIGNUP_EMAIL);
  await page.getByRole('button', { name: 'Enter your mail address' }).click();
  await expect(page.getByText('Thanks for subscribing!')).toBeVisible();

  // First sign-in creates the admin.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  // WhatsApp number not set yet: the admin says so.
  await expect(page.getByText('WhatsApp ordering is off')).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Reviews' })).toHaveCount(0);

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

  // The contact message and the sign-up are in Messages; the sign-ups tab says there is no mailing list.
  await page.goto('/admin/messages?type=messages');
  await expect(page.locator('main')).toContainText(CONTACT_NAME);
  await expect(page.locator('main')).not.toContainText(SIGNUP_EMAIL);
  await page.goto('/admin/messages?type=newsletter');
  await expect(page.getByText('There is no mailing list')).toBeVisible();
  await expect(page.locator('main')).toContainText(SIGNUP_EMAIL);
  await expect(page.locator('main')).not.toContainText(CONTACT_NAME);

  // The link picker offers the built-in Contact us page; it goes in the footer under "Customer Support".
  await page.goto('/admin/menus?tab=support');
  await page.getByRole('button', { name: '+ Add link' }).click();
  await page.getByRole('button', { name: 'Choose link' }).click();
  await page.getByRole('searchbox', { name: 'Search collections, products, pages' }).fill('contact');
  const contactResult = page.getByTestId('link-result').filter({ hasText: 'Contact us' });
  await expect(contactResult).toContainText('Built-in');
  await contactResult.click();
  await saveBar(page).getByRole('button', { name: 'Save menu' }).click();
  await expect(page.getByText('Saved. The store is updated.')).toBeVisible({ timeout: 30_000 });
  await page.goto('/');
  const support = page.locator('footer nav[aria-label="Customer Support"]');
  await expect(support.getByRole('heading')).toHaveText('Customer Support');
  await expect(support.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/pages/contact');

  // First product: title, price, one photo, best seller, publish.
  await page.goto('/admin/products/new');
  await page.locator('#product-title').fill(TITLE);
  await page.getByLabel('Regular price', { exact: true }).fill('45000');
  await uploadInto(page.getByTestId('image-gallery'), fixture('sofa-grey.jpg'));
  await expect(page.getByTestId('image-gallery').locator('img[src^="/uploads/"]').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('checkbox', { name: /^Best seller/ }).check();
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
  await expect(page.getByText(/write a review/i)).toHaveCount(0);

  // A published best seller makes the home page's Hot Selling Products row.
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Hot Selling Products' }).locator(`a[href="${product}"]`).first()).toBeVisible();

  // Turn on WhatsApp ordering and write a strip message in Settings (no Store rating card: the shop has no reviews).
  await page.goto('/admin/settings');
  await expect(page.getByText('Store rating')).toHaveCount(0);
  await page.getByLabel('WhatsApp number').fill('0309 2050463');
  await page.getByLabel('Scrolling strip').fill(STRIP);
  await saveBar(page).getByRole('button', { name: /^Save/ }).click();
  await expect(page.getByText('Saved. The store is updated.')).toBeVisible({ timeout: 30_000 });
  await page.goto(product);
  await expect(page.getByText(/order on whatsapp/i).first()).toBeVisible();
  await page.goto('/');
  await expect(page.getByTestId('home-strip')).toContainText(STRIP);
  await expect(page.getByTestId('home-text-block')).toHaveCount(0);

  expect(problems).toEqual([]);
});
