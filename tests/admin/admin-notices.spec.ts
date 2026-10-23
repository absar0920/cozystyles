import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { saveBar, uniqueName } from '../helpers/admin';

/** What the admin tells the owner after a save, and filters that show what the list shows. */

const prisma = new PrismaClient();
const title = uniqueName('Draft notice');

test.afterAll(async () => {
  // the throwaway draft product (never published, so the store never showed it)
  await prisma.product.deleteMany({ where: { title } });
  await prisma.$disconnect();
});

test('saving a draft product says it is not on the store', async ({ page }) => {
  await page.goto('/admin/products/new');
  await page.locator('#product-title').fill(title);
  await saveBar(page).getByRole('button', { name: 'Save as draft' }).click();
  await page.waitForURL(/\/admin\/products\/\d+\?saved=1$/, { timeout: 60_000 });
  await expect(page.getByTestId('product-status')).toHaveText('Draft');
  await expect(page.getByText('Saved as a draft. It is not on the store.')).toBeVisible();
  await expect(page.getByText('Saved. The store is updated.')).toHaveCount(0);

  // saved again in place (no new page), still a draft
  await page.locator('#product-delivery').fill('Delivered in 20 to 30 working days');
  await expect(page.getByText('Saved as a draft. It is not on the store.')).toHaveCount(0);
  await saveBar(page).getByRole('button', { name: 'Save as draft' }).click();
  await expect(page.getByText('Saved as a draft. It is not on the store.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Saved. The store is updated.')).toHaveCount(0);
});

test('WhatsApp inquiries: Clear and the menu link reset the filter boxes', async ({ page }) => {
  await page.goto('/admin/inquiries?range=1&kind=ORDER&q=zz-none');
  await expect(page.locator('select[name=range]')).toHaveValue('1');
  await expect(page.locator('select[name=kind]')).toHaveValue('ORDER');
  await page.getByRole('link', { name: 'Clear', exact: true }).click();
  await page.waitForURL(/\/admin\/inquiries$/);
  await expect(page.locator('select[name=range]')).toHaveValue('30');
  await expect(page.locator('select[name=kind]')).toHaveValue('all');
  await expect(page.locator('input[name=q]')).toHaveValue('');

  await page.goto('/admin/inquiries?range=7&kind=ORDER');
  await page.locator('nav a[href="/admin/inquiries"]').first().click();
  await page.waitForURL(/\/admin\/inquiries$/);
  await expect(page.locator('select[name=range]')).toHaveValue('30');
  await expect(page.locator('select[name=kind]')).toHaveValue('all');
});
