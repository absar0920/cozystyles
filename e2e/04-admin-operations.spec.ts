import { test, expect, type Page } from '@playwright/test';
import { adminNav, loginAsAdmin, newContext, shot, submit, watchErrors } from './helpers';

// Admin follow-up on what shoppers did in 03-storefront, then edits/deletes and their storefront effect.
test.describe.configure({ mode: 'default' });

let page: Page;
let shopper: Page;
let errors: string[];

test.beforeAll(async ({ browser }) => {
  page = await loginAsAdmin(await newContext(browser));
  shopper = await (await newContext(browser)).newPage();
  errors = watchErrors(page);
});

test.afterEach(() => {
  expect(errors, 'no uncaught page errors or 5xx responses').toEqual([]);
});

test('dashboard reflects the new orders and messages', async () => {
  await adminNav(page, 'Dashboard');
  await expect(page.getByRole('link', { name: /Total Orders 2/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Pending Orders 2/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /New Messages 1/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Ayesha Khan/ })).toBeVisible();
  await shot(page, '40-dashboard-with-orders');
});

test('orders: confirm an order and the customer sees the new status', async () => {
  await adminNav(page, 'Orders');
  await page.getByRole('row', { name: /Ayesha Khan/ }).getByRole('link').first().click();
  await expect(page.getByRole('heading', { level: 1, name: /IW-\d{6}/ })).toBeVisible();
  const orderNumber = (await page.getByRole('heading', { level: 1 }).innerText()).trim();

  await expect(page.getByText('Alexa Sofa Chair')).toBeVisible();
  await expect(page.getByText('Rs. 45,000 × 2')).toBeVisible();
  await expect(page.getByText('Please call before delivery.')).toBeVisible();

  await page.getByLabel('Order status').selectOption({ label: 'Shipped' });
  await page.getByLabel('Admin notes').fill('Dispatched with TCS, confirmed on WhatsApp.');
  await submit(page, 'Save changes');
  await page.reload();
  await expect(page.getByLabel('Order status')).toHaveValue('SHIPPED');
  // The app appends a timestamped status-change line to the internal notes.
  await expect(page.getByLabel('Admin notes')).toHaveValue(/^Dispatched with TCS, confirmed on WhatsApp\.\n\[.+\] status PENDING → SHIPPED$/);
  await shot(page, '41-order-shipped');

  await shopper.goto('/track');
  await shopper.getByLabel('Order Number').fill(orderNumber);
  await shopper.getByLabel('Phone Number').fill('0300 1234567');
  await shopper.getByRole('button', { name: 'Track Order' }).click();
  await expect(shopper.getByText(/shipped/i).first()).toBeVisible();
  await expect(shopper.getByText('Dispatched with TCS')).toHaveCount(0); // admin notes stay internal
  await shot(shopper, '42-track-shipped');
});

test('orders: the delivery fee charged matches what checkout showed', async () => {
  await adminNav(page, 'Orders');
  await page.getByRole('row', { name: /Bilal Ahmed/ }).getByRole('link').first().click();
  await expect(page.getByText('Bank Transfer').first()).toBeVisible();
  // Subtotal 36,000 < 100,000 threshold → admin-configured Rs. 2,500 delivery.
  await expect(page.getByText('Rs. 2,500')).toBeVisible();
  await expect(page.getByText('Rs. 38,500').first()).toBeVisible();
});

test('orders: filter by status', async () => {
  await adminNav(page, 'Orders');
  await page.goto('/admin/orders?status=SHIPPED');
  await expect(page.getByRole('row', { name: /Ayesha Khan/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Bilal Ahmed/ })).toHaveCount(0);
});

test('messages: read the contact form submission and close it', async () => {
  await adminNav(page, 'Messages');
  const row = page.getByRole('row', { name: /Hamza Ali/ });
  await expect(row).toContainText('Sales');
  await row.getByRole('link', { name: 'Expand message' }).click();
  await expect(page.getByText('Do you make wardrobes in custom sizes? I need a 7ft one.')).toBeVisible();
  await page.getByRole('button', { name: 'Mark as Read' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Mark as Closed' }).first().click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('link', { name: /Closed 1/ })).toBeVisible();
  await shot(page, '43-messages');
});

test('reviews: a shopper writes a review, the admin approves it, it appears on the product', async () => {
  await shopper.goto('/products/alexa-sofa-chair');
  await expect(shopper.getByText('No reviews yet').first()).toBeVisible();
  await shopper.getByRole('button', { name: 'Write a Review' }).click();
  await shopper.getByRole('button', { name: '4 stars' }).click();
  await shopper.getByLabel(/Your name/).fill('Sana Malik');
  await shopper.getByLabel('Title').fill('Comfy and well made');
  await shopper.getByLabel(/Your review/).fill('Very comfortable chair, the velvet feels premium and delivery was quick.');
  await shopper.getByRole('button', { name: 'Submit Review' }).click();
  await expect(shopper.getByText(/will appear once it.s approved/)).toBeVisible();
  // Not visible until approved.
  await shopper.reload();
  await expect(shopper.getByText('Comfy and well made')).toHaveCount(0);

  await adminNav(page, 'Reviews');
  const row = page.getByRole('row', { name: /Sana Malik/ });
  await expect(row).toContainText('Alexa Sofa Chair');
  await row.getByRole('button', { name: /pending/i }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('row', { name: /Sana Malik/ }).getByRole('button', { name: /approved/i })).toBeVisible();
  await shot(page, '44-reviews-approved');

  await shopper.reload();
  const reviews = shopper.getByRole('region', { name: 'Customer Reviews' });
  await expect(reviews.getByText('Comfy and well made')).toBeVisible();
  await expect(reviews.getByText('4.0')).toBeVisible();
  await expect(reviews.getByText(/Based on\s*1\s*review/)).toBeVisible();
  await shot(shopper, '45-product-with-review');
});

test('products: hiding a product (draft) removes it from the storefront', async () => {
  await adminNav(page, 'Products');
  await page.getByRole('row', { name: /Alexa Sofa Chair/ }).getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Status').selectOption({ label: 'Draft' });
  await submit(page, 'Save product');
  await expect(page.getByText('Product saved successfully.')).toBeVisible();

  const res = await shopper.goto('/products/alexa-sofa-chair');
  expect(res?.status()).toBe(404);
  await shopper.goto('/collections/sofas');
  await expect(shopper.getByRole('link', { name: 'Alexa Sofa Chair', exact: true })).toHaveCount(0);

  // Put it back.
  await page.getByLabel('Status').selectOption({ label: 'Active (visible in store)' });
  await submit(page, 'Save product');
  await shopper.goto('/collections/sofas');
  await expect(shopper.getByRole('link', { name: 'Alexa Sofa Chair', exact: true })).toBeVisible();
});

test('products: delete a product after confirming', async () => {
  await adminNav(page, 'Products');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('row', { name: /Secret Prototype Table/ }).getByRole('button', { name: /delete/i }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('row', { name: /Secret Prototype Table/ })).toHaveCount(0);
  await expect(page.getByText('4 products in the catalog')).toBeVisible();
});

test('collections: edit a collection title and the storefront follows', async () => {
  await adminNav(page, 'Collections');
  await page.getByRole('row', { name: /^Office Chairs/ }).getByRole('link', { name: /edit/i }).first().click();
  await page.getByLabel('Title').fill('Office Seating');
  await submit(page, /save collection/i);
  await expect(page.getByText('Collection saved successfully.')).toBeVisible();
  await shopper.goto('/collections/office-chairs');
  await expect(shopper.getByRole('heading', { level: 1, name: 'Office Seating' })).toBeVisible();
});

test('menus: disable a menu item and it disappears from the header', async () => {
  await adminNav(page, 'Menus');
  await page.locator('summary').filter({ hasText: '/collections/all' }).click();
  const item = page.locator('details[open]');
  await item.getByLabel(/^Enabled/).uncheck();
  await item.getByRole('button', { name: 'Save item' }).click();
  await page.waitForLoadState('networkidle');
  await shopper.goto('/');
  await expect(shopper.locator('header').getByRole('link', { name: 'All Products', exact: true })).toHaveCount(0);
});

test('banners: deactivate a hero banner', async () => {
  await adminNav(page, 'Banners');
  await page.getByRole('button', { name: 'Deactivate' }).nth(1).click();
  await page.waitForLoadState('networkidle');
  await shopper.goto('/');
  const hero = shopper.getByRole('region', { name: 'Featured promotions' });
  await expect(hero.getByRole('heading', { name: 'Winter Living Sale' })).toBeVisible();
  await expect(hero.getByText('Sleep Like Royalty')).toHaveCount(0);
});

test('pages: unpublish and delete pages', async () => {
  await adminNav(page, 'Pages');
  await page.getByRole('row', { name: /About Us/ }).getByRole('button', { name: 'Unpublish' }).click();
  await page.waitForLoadState('networkidle');
  expect((await shopper.goto('/pages/about-us'))?.status()).toBe(404);

  await page.getByRole('row', { name: /Shipping Policy/ }).getByRole('link', { name: 'Edit' }).click();
  await page.getByText('Delete this page').click();
  await page.getByRole('button', { name: 'Yes, delete permanently' }).click();
  await page.waitForURL(/\/admin\/pages(\?|$)/);
  await adminNav(page, 'Pages');
  await expect(page.getByRole('row', { name: /Shipping Policy/ })).toHaveCount(0);
});

test('admin signs out and the panel is locked again', async () => {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto('/admin/orders');
  await expect(page).toHaveURL(/\/admin\/login/);
});
