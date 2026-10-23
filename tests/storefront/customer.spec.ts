import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { cardPrice } from '@/lib/queries';
import { localPhone, preOrderHelpLine } from '@/components/product/PreOrderModal';

/**
 * What customers can do besides browsing (WhatsApp ordering, no accounts): the header without account links or
 * a highlighted first menu item, the built-in Contact us page, honest card prices and the pre-order help line.
 * Read-only except the one contact message it sends, which it deletes again.
 */

const prisma = new PrismaClient();
test.afterAll(async () => {
  await prisma.$disconnect();
});

const setting = async (key: string) => (await prisma.siteSetting.findUnique({ where: { key } }))?.value?.trim() ?? '';

test('no customer accounts: no account icon or Login link, and /account addresses go to the home page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const header = page.locator('header.header');
  await expect(header.getByRole('link', { name: /my account|log ?in|sign ?in/i })).toHaveCount(0);
  await expect(page.locator('a[href^="/account"]')).toHaveCount(0);

  await page.setViewportSize({ width: 412, height: 900 });
  await page.getByRole('button', { name: 'Open menu' }).click();
  const mobile = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(mobile).toBeVisible();
  await expect(header.getByText('Login', { exact: true })).toHaveCount(0);

  for (const path of ['/account', '/account/login', '/account/register', '/account/orders/123']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/$/);
  }
});

test('main menu: the first item looks like every other item (computer and phone)', async ({ page }) => {
  const look = (el: Element) => {
    const s = getComputedStyle(el);
    return `${s.backgroundColor} ${s.color}`;
  };

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const desktop = page.getByRole('navigation', { name: 'Main navigation' }).locator(':scope > ul > li > :first-child');
  expect(await desktop.count()).toBeGreaterThan(1);
  expect(await desktop.nth(0).evaluate(look)).toBe(await desktop.nth(1).evaluate(look));

  await page.setViewportSize({ width: 412, height: 900 });
  await page.getByRole('button', { name: 'Open menu' }).click();
  const rows = page.getByRole('navigation', { name: 'Mobile navigation' }).locator(':scope > ul > li > div > :first-child');
  await expect(rows.first()).toBeVisible();
  expect(await rows.nth(0).evaluate(look)).toBe(await rows.nth(1).evaluate(look));
});

test('Contact us page shows the contact details from Settings and its form lands in Messages', async ({ page }) => {
  const [phone, email, complaints, address] = await Promise.all([setting('phone'), setting('email'), setting('complaintsEmail'), setting('address')]);
  const res = await page.goto('/pages/contact');
  expect(res?.status()).toBe(200);
  const main = page.locator('main');
  await expect(main.getByRole('heading', { level: 1, name: 'Contact Us' })).toBeVisible();
  // nothing from the old shop's hard-coded details
  await expect(main).not.toContainText('021-111-203-203');
  await expect(main).not.toContainText('Babar Block');
  if (phone) await expect(main.getByRole('link', { name: phone })).toHaveAttribute('href', `tel:${phone.replace(/[^\d+]/g, '')}`);
  if (email || complaints) await expect(main.getByRole('link', { name: email || complaints })).toHaveAttribute('href', `mailto:${email || complaints}`);
  for (const line of address.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) await expect(main).toContainText(line);
  // no map pinned at the old shop's location
  await expect(main.locator('iframe')).toHaveCount(0);

  const name = `E2E Contact ${Date.now()}`;
  try {
    await main.getByRole('textbox', { name: 'Name' }).fill(name);
    await main.getByRole('textbox', { name: 'Email' }).fill('e2e-contact@example.com');
    await main.getByRole('textbox', { name: 'Phone number' }).fill('0300 1234567');
    await main.getByRole('textbox', { name: 'Comment' }).fill('Is the Alexa Sofa Chair available in blue?');
    await main.getByRole('button', { name: 'Send Message' }).click();
    await expect(main.getByRole('status')).toContainText('Thanks for contacting us');
    const row = await prisma.contactSubmission.findFirst({ where: { name } });
    expect(row).toMatchObject({ subject: 'General', email: 'e2e-contact@example.com', status: 'NEW' });
  } finally {
    await prisma.contactSubmission.deleteMany({ where: { name } });
  }
});

test('card price, struck price and sale circle all come from one variant', async ({ page }) => {
  // 2 Seater Rs.145,000 (no old price) + 3 Seater Rs.165,000 (was Rs.185,000): no deal at Rs.145,000
  expect(cardPrice([{ price: 145_000, compareAtPrice: null }, { price: 165_000, compareAtPrice: 185_000 }])).toEqual({
    price: 145_000,
    priceOnRequest: false,
    compareAtPrice: null,
    salePercent: null,
  });
  expect(cardPrice([{ price: 46_200, compareAtPrice: 66_000 }, { price: 68_950, compareAtPrice: 98_500 }])).toMatchObject({
    price: 46_200,
    compareAtPrice: 66_000,
    salePercent: 30,
  });
  expect(cardPrice([{ price: 0, compareAtPrice: 10 }])).toMatchObject({ price: 0, priceOnRequest: true, compareAtPrice: null });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/collections/sofas-all');
  const cards = await page.locator('#product-grid .product-card').evaluateAll((els) =>
    els.map((el) => ({
      handle: (el.querySelector('a[href^="/products/"]')?.getAttribute('href') ?? '').replace('/products/', ''),
      price: el.querySelector('.price ins')?.textContent ?? null,
      was: el.querySelector('.price del')?.textContent ?? null,
      badge: el.querySelector('figure > span.rounded-full')?.textContent?.replace(/\s+/g, '') ?? null,
    })),
  );
  expect(cards.length).toBeGreaterThan(0);
  const rows = await prisma.product.findMany({
    where: { handle: { in: cards.map((c) => c.handle) } },
    select: { handle: true, variants: { select: { price: true, compareAtPrice: true } } },
  });
  const rs = (n: number) => `Rs.${n.toLocaleString('en-US')}`;
  for (const card of cards) {
    const variants = rows.find((r) => r.handle === card.handle)!.variants;
    const expected = cardPrice(variants);
    if (expected.priceOnRequest) continue;
    expect(card.price, card.handle).toBe(rs(expected.price));
    expect(card.was, card.handle).toBe(expected.compareAtPrice ? rs(expected.compareAtPrice) : null);
    expect(card.badge, card.handle).toBe(expected.salePercent ? `${expected.salePercent}%off` : null);
    // the shown pair is a real option
    if (card.was) expect(variants.some((v) => rs(v.price) === card.price && v.compareAtPrice != null && rs(v.compareAtPrice) === card.was), card.handle).toBe(true);
  }
});

test('pre-order popup: the help line uses the phone from Settings and leaves out what is not set up', () => {
  expect(localPhone('+92-42-111-269-926')).toBe('042 111 269 926');
  expect(localPhone(' 0300-1234567 ')).toBe('0300-1234567');
  expect(preOrderHelpLine('+92-42-111-269-926', true)).toBe('For any help, message us on WhatsApp or call 042 111 269 926.');
  expect(preOrderHelpLine('0300-1234567', false)).toBe('For any help, call 0300-1234567.');
  expect(preOrderHelpLine('', true)).toBe('For any help, message us on WhatsApp.');
  expect(preOrderHelpLine(null, false)).toBeNull();
});
