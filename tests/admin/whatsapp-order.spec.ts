import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import {
  GENERAL_QUESTION_TEXT,
  WHATSAPP_DEFAULTS,
  buildProductMessage,
  normalizeWhatsAppNumber,
  waLink,
  type WhatsAppConfig,
} from '../../src/lib/whatsapp';

/**
 * WhatsApp ordering — only the WhatsApp workstream's own behaviour (SPEC §8.2 #5). The end-to-end product-page
 * scenarios (needs the product page) and the Settings scenarios live in tests/integration/whatsapp-e2e.spec.ts.
 */

const NUMBER = '923092050463';
const CONFIG: WhatsAppConfig = { number: NUMBER, ...WHATSAPP_DEFAULTS };

const prisma = new PrismaClient();
let firstInquiryId = 0;
test.beforeAll(async () => {
  firstInquiryId = ((await prisma.whatsAppInquiry.aggregate({ _max: { id: true } }))._max.id ?? 0) + 1;
});
test.afterAll(async () => {
  // inquiries logged by this spec are test data: remove them so the inquiry stats stay real
  await prisma.whatsAppInquiry.deleteMany({ where: { id: { gte: firstInquiryId } } });
  await prisma.$disconnect();
});

test.describe('message template', () => {
  test('ORDER message matches the spec example line by line', () => {
    const text = buildProductMessage(
      {
        kind: 'ORDER',
        title: 'Alexa Sofa Chair',
        options: [{ name: 'Color', value: 'Grey' }],
        quantity: 2,
        price: 45000,
        compareAtPrice: 60000,
        url: 'http://localhost:3100/products/alexa-sofa-chair?variant=123',
      },
      CONFIG,
    );
    expect(text.split('\n')).toEqual([
      "Hello Cozy Furnitures! I'd like to order this product:",
      '*Alexa Sofa Chair*',
      'Color: Grey',
      'Quantity: 2',
      'Price: Rs.45,000 each (was Rs.60,000)',
      'http://localhost:3100/products/alexa-sofa-chair?variant=123',
      'Please confirm availability and delivery to my city: ',
    ]);
    // the closing line keeps its trailing space
    expect(text.endsWith('my city: ')).toBe(true);
  });

  test('AVAILABILITY message for a pre-order variant with no price', () => {
    const text = buildProductMessage(
      {
        kind: 'AVAILABILITY',
        title: 'Noble Sofa',
        options: [],
        quantity: 1,
        price: 0,
        compareAtPrice: null,
        url: 'http://localhost:3100/products/noble-sofa?variant=9',
        statusLabel: 'Pre-order',
      },
      CONFIG,
    );
    expect(text.split('\n')).toEqual([
      "Hello Cozy Furnitures! I'd like to ask about the availability of this product:",
      '*Noble Sofa*',
      'Quantity: 1',
      'Price: on request',
      'Status: Pre-order',
      'http://localhost:3100/products/noble-sofa?variant=9',
      'Please confirm availability and delivery to my city: ',
    ]);
  });

  test('normalizeWhatsAppNumber accepts Pakistani mobiles only', () => {
    for (const input of ['+92 309 2050463', '0309-2050463', '923092050463', '3092050463']) {
      expect(normalizeWhatsAppNumber(input), input).toBe(NUMBER);
    }
    expect(normalizeWhatsAppNumber('042 111 111 111')).toBeNull();
    expect(normalizeWhatsAppNumber('')).toBeNull();
  });
});

test.describe('cart and checkout are gone', () => {
  test('/cart and /checkout land on the home page', async ({ page }) => {
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/$/);
  });

  test('/track redirects to WhatsApp; a prefetch is not logged', async ({ request }) => {
    const res = await request.get('/track', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toMatch(new RegExp(`^https://wa\\.me/${NUMBER}\\?text=`));

    const before = await prisma.whatsAppInquiry.count({ where: { kind: 'TRACK' } });
    const prefetch = await request.get('/track', { maxRedirects: 0, headers: { 'Next-Router-Prefetch': '1' } });
    expect(prefetch.status()).toBe(302);
    expect(await prisma.whatsAppInquiry.count({ where: { kind: 'TRACK' } })).toBe(before);
  });

  test('the header has no cart icon', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header.header')).toBeVisible();
    await expect(page.locator('a[href="/cart"]')).toHaveCount(0);
  });
});

test.describe('click logging', () => {
  test('a logged ORDER click shows on the inquiries page and the dashboard', async ({ page, request }) => {
    const product = await prisma.product.findUniqueOrThrow({
      where: { handle: 'alexa-sofa-chair' },
      select: {
        id: true,
        productOptions: { orderBy: { position: 'asc' }, select: { name: true } },
        variants: { orderBy: { position: 'asc' }, take: 2, select: { id: true, option1: true, price: true } },
      },
    });
    const variant = product.variants[product.variants.length - 1];
    const res = await request.post('/api/whatsapp-click', {
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      data: JSON.stringify({ kind: 'ORDER', productId: product.id, variantId: variant.id, quantity: 2, path: '/products/alexa-sofa-chair' }),
    });
    expect(res.status()).toBe(204);

    await page.goto('/admin/inquiries?q=Alexa%20Sofa%20Chair');
    const row = page.locator('table [data-testid=inquiry-row]').first();
    await expect(row).toContainText('Alexa Sofa Chair');
    await expect(row).toContainText(`${product.productOptions[0].name}: ${variant.option1}`);
    await expect(row.locator('td').nth(4)).toHaveText('2');
    await expect(row).toContainText('Product page');
    await expect(row).toContainText('Order');

    await page.goto('/admin');
    await expect(page.getByTestId('top-products')).toContainText('Alexa Sofa Chair');
  });

  test('malformed clicks are rejected', async ({ request }) => {
    const post = (body: string) => request.post('/api/whatsapp-click', { headers: { 'Content-Type': 'text/plain' }, data: body });
    expect((await post('not json')).status()).toBe(400);
    expect((await post(JSON.stringify({ kind: 'REFUND', path: '/' }))).status()).toBe(400);
    expect((await post(JSON.stringify({ kind: 'GENERAL', path: 'https://evil.example' }))).status()).toBe(400);
    expect((await post(JSON.stringify({ kind: 'ORDER', quantity: 500, path: '/' }))).status()).toBe(400);
    expect((await post(JSON.stringify({ kind: 'GENERAL', path: `/${'a'.repeat(5000)}` }))).status()).toBe(413);
  });

  test('the floating chat bubble sends a general question', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Chat on WhatsApp')).toHaveAttribute('href', waLink(NUMBER, GENERAL_QUESTION_TEXT));
  });
});
