import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { saveBar } from '../helpers/admin';

/**
 * SPEC §8.2 #5b — WhatsApp ordering end to end: the product page builds the exact message from what the customer
 * picked, every click is logged, and the Settings number / social links drive the storefront.
 * The two Settings scenarios change store-wide state, so they only run with E2E_EXCLUSIVE=1.
 */

const NUMBER = '923092050463';
const prisma = new PrismaClient();
let firstInquiryId = 0;

test.beforeAll(async () => {
  firstInquiryId = ((await prisma.whatsAppInquiry.aggregate({ _max: { id: true } }))._max.id ?? 0) + 1;
});

test.afterAll(async () => {
  // the clicks this spec made are test data: remove them so the inquiry stats stay real
  await prisma.whatsAppInquiry.deleteMany({ where: { id: { gte: firstInquiryId } } });
  await prisma.$disconnect();
});

async function messageSettings() {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: ['whatsappGreeting', 'whatsappAvailabilityGreeting', 'whatsappClosing'] } } });
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    greeting: s.whatsappGreeting || "Hello Cozy Furnitures! I'd like to order this product:",
    availabilityGreeting: s.whatsappAvailabilityGreeting || "Hello Cozy Furnitures! I'd like to ask about the availability of this product:",
    closing: s.whatsappClosing || 'Please confirm availability and delivery to my city: ',
  };
}

/** Clicks the buy button and returns the wa.me URL it opened (the navigation itself is aborted). */
async function clickAndCaptureWhatsApp(context: BrowserContext, page: Page): Promise<URL> {
  await context.route('https://wa.me/**', (r) => r.abort());
  const req = context.waitForEvent('request', (r) => r.url().startsWith('https://wa.me/'));
  await page.getByTestId('order-on-whatsapp').click();
  return new URL((await req).url());
}

test.describe('order on WhatsApp from the product page', () => {
  test('the message matches the chosen colour, quantity and price exactly; the click is logged', async ({ page, context }) => {
    const product = await prisma.product.findUniqueOrThrow({
      where: { handle: 'alexa-sofa-chair' },
      select: { id: true, title: true, variants: { orderBy: { position: 'asc' }, select: { id: true, option1: true, price: true, compareAtPrice: true, status: true } } },
    });
    // a colour other than the default one, that can be ordered (not sold out / pre-order)
    const ready = product.variants.filter((v) => v.status === 'READY_TO_SHIP' || v.status === 'MADE_TO_ORDER');
    expect(ready.length, 'Alexa Sofa Chair needs two orderable colours').toBeGreaterThan(1);
    const pick = ready[ready.length - 1];
    const cfg = await messageSettings();

    await page.goto('/products/alexa-sofa-chair');
    await expect(page.locator('[data-testid=order-on-whatsapp][data-ready=true]')).toBeVisible();
    await page.getByRole('button', { name: pick.option1 ?? '', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]variant=${pick.id}\\b`));
    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(page.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('2');
    await expect(page.getByTestId('order-on-whatsapp')).toHaveText(/order on whatsapp/i);

    const variantFromUrl = new URL(page.url()).searchParams.get('variant');
    const origin = new URL(page.url()).origin;
    const url = await clickAndCaptureWhatsApp(context, page);
    expect(`${url.origin}${url.pathname}`).toBe(`https://wa.me/${NUMBER}`);

    const price = `Rs.${pick.price.toLocaleString('en-US')}`;
    const was = pick.compareAtPrice != null && pick.compareAtPrice > pick.price ? ` (was Rs.${pick.compareAtPrice.toLocaleString('en-US')})` : '';
    expect(url.searchParams.get('text')?.split('\n')).toEqual([
      cfg.greeting,
      `*${product.title}*`,
      `Color: ${pick.option1}`,
      'Quantity: 2',
      `Price: ${price} each${was}`,
      `${origin}/products/alexa-sofa-chair?variant=${variantFromUrl}`,
      cfg.closing,
    ]);
    expect(url.searchParams.get('text')?.endsWith('my city: ')).toBe(true);

    // logged: one ORDER inquiry for this variant with quantity 2, shown in the admin
    await expect
      .poll(() => prisma.whatsAppInquiry.count({ where: { id: { gte: firstInquiryId }, kind: 'ORDER', variantId: pick.id, quantity: 2 } }))
      .toBe(1);
    await page.goto('/admin/inquiries?q=Alexa%20Sofa%20Chair');
    const row = page.locator('table [data-testid=inquiry-row]').first();
    await expect(row).toContainText(product.title);
    await expect(row).toContainText(`${pick.option1}`);
    await expect(row.locator('td').nth(4)).toHaveText('2');
  });

  test('a pre-order variant asks about availability with its own greeting', async ({ page, context }) => {
    const variant = await prisma.variant.findFirstOrThrow({
      where: { status: 'PRE_ORDER', price: { gt: 0 }, product: { status: 'ACTIVE' } },
      orderBy: { id: 'asc' },
      select: { id: true, product: { select: { handle: true, title: true } } },
    });
    const cfg = await messageSettings();
    await page.goto(`/products/${variant.product.handle}?variant=${variant.id}`);
    const button = page.locator('[data-testid=order-on-whatsapp][data-ready=true]');
    await expect(button).toBeVisible();
    await expect(button).toHaveText(/ask about availability/i);

    const url = await clickAndCaptureWhatsApp(context, page);
    const lines = url.searchParams.get('text')?.split('\n') ?? [];
    const origin = new URL(page.url()).origin;
    expect(lines[0]).toBe(cfg.availabilityGreeting);
    expect(lines[1]).toBe(`*${variant.product.title}*`);
    expect(lines).toContain('Quantity: 1');
    expect(lines).toContain('Status: Pre-order');
    expect(lines.at(-2)).toBe(`${origin}/products/${variant.product.handle}?variant=${variant.id}`);
    expect(lines.at(-1)).toBe(cfg.closing);
    await expect
      .poll(() => prisma.whatsAppInquiry.count({ where: { id: { gte: firstInquiryId }, kind: 'AVAILABILITY', variantId: variant.id } }))
      .toBe(1);
  });
});

test.describe('store-wide WhatsApp and social settings', () => {
  test.skip(!process.env.E2E_EXCLUSIVE, 'store-wide setting: runs in F2 only');
  test.describe.configure({ mode: 'serial' });

  async function saveSettings(page: Page) {
    await saveBar(page).getByRole('button', { name: /^Save( settings)?$/ }).click();
    await expect(page.getByText('Saved. The store is updated.')).toBeVisible();
  }

  test('no number: the store hides the buttons and the admin warns', async ({ page }) => {
    try {
      await page.goto('/admin/settings');
      await page.getByLabel('WhatsApp number').fill('');
      await saveSettings(page);
      await page.goto('/admin');
      await expect(page.getByText('Add your WhatsApp number in Settings')).toBeVisible();
      await page.goto('/products/alexa-sofa-chair');
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.getByTestId('order-on-whatsapp')).toHaveCount(0);
      await expect(page.getByTestId('whatsapp-bubble')).toHaveCount(0);
    } finally {
      await page.goto('/admin/settings');
      await page.getByLabel('WhatsApp number').fill('0309 2050463');
      await saveSettings(page);
    }
    const stored = await prisma.siteSetting.findUnique({ where: { key: 'whatsapp' } });
    expect(stored?.value).toBe(NUMBER);
    await page.goto('/products/alexa-sofa-chair');
    await expect(page.getByTestId('order-on-whatsapp')).toBeVisible();
    await expect(page.getByTestId('whatsapp-bubble')).toBeVisible();
  });

  test('a Facebook link set in Settings shows once in the footer', async ({ page }) => {
    const before = (await prisma.siteSetting.findUnique({ where: { key: 'facebook' } }))?.value ?? '';
    const href = 'https://www.facebook.com/e2e-test';
    try {
      await page.goto('/admin/settings');
      await page.getByLabel('Facebook', { exact: true }).fill(href);
      await saveSettings(page);
      await page.goto('/');
      await expect(page.locator('footer a[aria-label=Facebook]')).toHaveCount(1);
      await expect(page.locator('footer a[aria-label=Facebook]')).toHaveAttribute('href', href);
    } finally {
      await page.goto('/admin/settings');
      await page.getByLabel('Facebook', { exact: true }).fill(before);
      await saveSettings(page);
    }
    expect((await prisma.siteSetting.findUnique({ where: { key: 'facebook' } }))?.value ?? '').toBe(before);
  });
});
