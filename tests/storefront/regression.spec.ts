import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

/**
 * SPEC §8.2 #9 — storefront regression after the admin rework: the data now read from the database (swatches,
 * statuses, the collections index, blog fields, footer settings) still renders as before. Read-only.
 */

const prisma = new PrismaClient();
test.afterAll(async () => {
  await prisma.$disconnect();
});

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

test('home: slider, Hot Selling Products and Shop by Category', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('[aria-roledescription="slide"]').count()).toBeGreaterThanOrEqual(1);
  await expect(page.getByText('Hot Selling Products', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Shop by Category', { exact: true }).first()).toBeAttached();
});

test('collections index follows the saved order', async ({ page }) => {
  const rows = await prisma.collectionIndexCard.findMany({
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { systemHandle: true, collection: { select: { handle: true } } },
  });
  const shown = rows.filter((r) => r.collection?.handle ?? r.systemHandle).length;
  await page.goto('/collections');
  const titles = page.locator('main a h2');
  await expect(titles).toHaveCount(shown);
  await expect(titles.nth(0)).toHaveText('Home page');
  await expect(titles.nth(1)).toHaveText('Furniture');
});

test('sofas collection: 4-column grid with only the allowed status bars', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/collections/sofas-all');
  const grid = page.locator('#product-grid');
  await expect(grid).toBeVisible();
  const columns = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(4);
  const labels = await page.locator('.product-card figure span.bg-accent').allInnerTexts();
  expect(labels.length).toBeGreaterThan(0);
  for (const l of new Set(labels.map((x) => x.trim().toUpperCase()))) expect(['READY TO SHIP', 'PRE-ORDER', 'SOLD OUT']).toContain(l);
});

test('Alexa Sofa Chair: swatches, SKU and price', async ({ page }) => {
  const values = await prisma.productOptionValue.findMany({
    where: { option: { product: { handle: 'alexa-sofa-chair' } } },
    orderBy: { position: 'asc' },
    select: { value: true },
  });
  const variant = await prisma.variant.findFirstOrThrow({
    where: { product: { handle: 'alexa-sofa-chair' } },
    orderBy: { position: 'asc' },
    select: { sku: true, price: true },
  });
  await page.goto('/products/alexa-sofa-chair');
  await expect(page.locator('h1')).toHaveText('Alexa Sofa Chair');
  for (const v of values) await expect(page.getByRole('button', { name: v.value, exact: true })).toBeVisible();
  if (variant.sku) await expect(page.getByText(`SKU:${variant.sku}`)).toBeVisible();
  await expect(page.locator('ins').first()).toHaveText(`Rs.${variant.price.toLocaleString('en-US')}`);
});

test('blog post keeps date, author, featured image and YouTube video', async ({ page }) => {
  const post = await prisma.page.findFirstOrThrow({
    where: { handle: { endsWith: 'local-ingenuity-global-standards' } },
    select: { author: true, featuredImage: true },
  });
  await page.goto('/blogs/news/local-ingenuity-global-standards');
  await expect(page.locator('main time').first()).toHaveText('Jul 13, 2023');
  await expect(page.locator('main').getByText(post.author).first()).toBeVisible();
  if (post.featuredImage) await expect(page.locator(`main img[src="${post.featuredImage}"]`).first()).toBeAttached();
  await expect(page.locator('main iframe[src*="youtube-nocookie.com/embed/"]').first()).toBeAttached();
});

for (const path of ['/pages/privacy-policy', '/pages/review']) {
  test(`${path} has the store chrome exactly once`, async ({ page }) => {
    const announcement = (await prisma.siteSetting.findUnique({ where: { key: 'announcement' } }))?.value ?? '';
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    expect(await page.evaluate(() => document.querySelectorAll('title:not(svg title)').length)).toBe(1);
    await expect(page.locator('header.header')).toHaveCount(1);
    await expect(page.locator('footer.footer')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
    if (announcement) await expect(page.locator('p', { hasText: announcement })).toHaveCount(1);
    expect(await page.locator('main').innerHTML()).not.toMatch(/<html|<!doctype/i);
  });
}

test('home Hot Selling card swatches use the colours saved in the admin', async ({ page }) => {
  const values = await prisma.productOptionValue.findMany({
    where: { option: { product: { handle: 'alexa-sofa-chair' } }, swatchColor: { not: null } },
    orderBy: { position: 'asc' },
    select: { value: true, swatchColor: true },
  });
  expect(values.length).toBeGreaterThan(0);
  await page.goto('/');
  const card = page.locator('.product-card', { hasText: 'Alexa Sofa Chair' }).first();
  await card.scrollIntoViewIfNeeded();
  const swatches = await card.locator('[aria-label="Colours"] > span').evaluateAll((els) =>
    els.map((e) => ({ name: e.getAttribute('title') ?? '', color: getComputedStyle(e.firstElementChild as Element).backgroundColor })),
  );
  for (const v of values) {
    const s = swatches.find((x) => x.name === v.value);
    expect(s, `card swatch for ${v.value}`).toBeTruthy();
    expect(s!.color).toBe(hexToRgb(v.swatchColor!));
  }
});

test('about-us keeps its custom design', async ({ page }) => {
  await page.goto('/pages/about-us');
  await expect(page.locator('main .sf-bg-video')).toHaveCount(1);
});

test('footer shows the address and only real social links', async ({ page }) => {
  const address = (await prisma.siteSetting.findUnique({ where: { key: 'address' } }))?.value ?? '';
  await page.goto('/');
  const footer = page.locator('footer.footer');
  for (const line of address.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) await expect(footer).toContainText(line);
  await expect(footer.locator('a[href="#"]')).toHaveCount(0);
  for (const href of await footer.locator('a[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))) {
    expect(href).not.toBe('');
  }
});

test('/pages/track-your-order ends at WhatsApp', async ({ request }) => {
  let res = await request.get('/pages/track-your-order', { maxRedirects: 0 });
  for (let hops = 0; hops < 5 && res.status() >= 300 && res.status() < 400; hops++) {
    const location = res.headers()['location'] ?? '';
    if (location.startsWith('https://wa.me/')) break;
    res = await request.get(location, { maxRedirects: 0, headers: { 'Next-Router-Prefetch': '1' } });
  }
  expect(res.headers()['location']).toMatch(/^https:\/\/wa\.me\/923\d{9}\?text=/);
});

test('payment page: "Online Bank Transfer (view details)" opens the bank details', async ({ page }) => {
  await page.goto('/pages/payment');
  await page.locator('li', { hasText: /^Online Bank Transfer/ }).getByText('(view details)').click();
  const dialog = page.getByRole('dialog', { name: 'Bank transfer details' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('IBAN');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);
});

test('product page: an emptied quantity box takes the newly typed number', async ({ page }) => {
  const variant = await prisma.variant.findFirst({
    where: { price: { gt: 0 }, status: { not: 'SOLD_OUT' }, product: { status: 'ACTIVE' } },
    select: { product: { select: { handle: true } } },
  });
  test.skip(!variant, 'no orderable product');
  await page.goto(`/products/${variant!.product.handle}`);
  const qty = page.getByRole('spinbutton', { name: 'Quantity' });
  await qty.click();
  await qty.press('End');
  await qty.press('Backspace');
  await expect(qty).toHaveValue('');
  await qty.pressSequentially('5');
  await expect(qty).toHaveValue('5');
});
