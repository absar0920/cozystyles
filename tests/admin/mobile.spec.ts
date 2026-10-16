import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { adminRoutes } from '../helpers/admin-routes';

/**
 * SPEC §8.2 #8 / §0.8: the admin works on a phone. Runs in the "admin-mobile" (Pixel 7, 412px) and
 * "admin-mobile-360" (360×740) projects. Nothing here saves, so no store data changes.
 */

const prisma = new PrismaClient();
test.afterAll(async () => {
  await prisma.$disconnect();
});

const overflow = (page: Page) =>
  page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));

function inViewport(box: { x: number; y: number; width: number; height: number } | null, vp: { width: number; height: number }) {
  return !!box && box.x >= -1 && box.y >= -1 && box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1;
}

test('no admin screen scrolls sideways', async ({ page }) => {
  test.setTimeout(240_000);
  const wide: string[] = [];
  for (const r of await adminRoutes(prisma)) {
    const res = await page.goto(r.path);
    expect(res?.status(), r.name).toBe(200);
    await page.waitForLoadState('networkidle');
    if (r.prepare) await r.prepare(page);
    const { scrollWidth, innerWidth } = await overflow(page);
    if (scrollWidth > innerWidth + 1) wide.push(`${r.name} (${r.path}): ${scrollWidth}px wide in a ${innerWidth}px screen`);
  }
  expect(wide).toEqual([]);
});

test('the product editor save bar stays on screen', async ({ page }) => {
  const product = await prisma.product.findUniqueOrThrow({ where: { handle: 'alexa-sofa-chair' }, select: { id: true } });
  await page.goto(`/admin/products/${product.id}`);
  const bar = page.getByTestId('save-bar');
  await expect(bar).toBeVisible();
  const vp = page.viewportSize()!;
  expect(inViewport(await bar.boundingBox(), vp)).toBe(true);
  // still there after scrolling to the bottom of the long editor
  await page.mouse.wheel(0, 20_000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(bar).toBeInViewport();
  expect(inViewport(await bar.boundingBox(), vp)).toBe(true);
  await expect(bar.getByRole('button').first()).toBeVisible();
});

test('banners reorder with the arrow buttons', async ({ page }) => {
  await page.goto('/admin/banners');
  const cards = page.getByTestId('banner-card');
  test.skip((await cards.count()) < 2, 'needs two banners');
  const ids = () => cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-banner-id') ?? ''));
  const before = await ids();
  const second = page.locator(`[data-banner-id="${before[1]}"]`);
  const up = second.getByRole('button', { name: 'Move up' });
  await expect(up).toBeVisible();
  const box = await up.boundingBox();
  expect(box && box.width >= 40 && box.height >= 40, 'tap target at least 40px').toBe(true);
  await up.click();
  expect(await ids()).toEqual([before[1], before[0], ...before.slice(2)]);
  await expect(page.getByTestId('save-bar').getByRole('button', { name: /Save( order)?/ })).toBeVisible();
  // put it back (nothing is saved)
  await page.locator(`[data-banner-id="${before[1]}"]`).getByRole('button', { name: 'Move down' }).click();
  expect(await ids()).toEqual(before);
});

test('the link picker opens as a bottom sheet', async ({ page }) => {
  await page.goto('/admin/banners');
  await page.getByRole('button', { name: '+ Add banner' }).click();
  const form = page.getByTestId('banner-form');
  await form.getByTestId('link-picker').getByRole('button', { name: 'Choose link' }).click();
  // the test id sits on the portal wrapper (no box of its own); the sheet is its dialog
  const sheet = page.getByTestId('link-picker-popover').last().getByRole('dialog', { name: 'Choose a link' });
  await expect(sheet).toBeVisible();
  const vp = page.viewportSize()!;
  const box = await sheet.boundingBox();
  expect(inViewport(box, vp), 'sheet fits the screen').toBe(true);
  expect(box!.width).toBeGreaterThanOrEqual(vp.width - 2);
  await sheet.getByRole('searchbox').fill('Sofas');
  await expect(sheet.getByTestId('link-result').first()).toBeVisible();
  const { scrollWidth, innerWidth } = await overflow(page);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
});
