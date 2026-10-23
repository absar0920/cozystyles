import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { saveBar } from '../helpers/admin';

/**
 * Admin → Settings → Home page: the yellow scrolling strip and the text block at the bottom of the home page are
 * the owner's text, each hidden while empty; there is no Store rating card (the shop has no reviews). Changes
 * store-wide settings, so it runs only with E2E_EXCLUSIVE=1; the three settings are put back afterwards.
 */

const KEYS = ['homeStrip', 'homeTextHeading', 'homeText'] as const;
const prisma = new PrismaClient();

test.describe('home page texts in Settings', () => {
  test.skip(!process.env.E2E_EXCLUSIVE, 'store-wide setting: runs in F2 only');

  let before: { key: string; value: string }[] = [];
  test.beforeAll(async () => {
    before = await prisma.siteSetting.findMany({ where: { key: { in: [...KEYS] } } });
  });
  test.afterAll(async () => {
    await prisma.siteSetting.deleteMany({ where: { key: { in: [...KEYS] } } });
    if (before.length) await prisma.siteSetting.createMany({ data: before });
    await prisma.$disconnect();
  });

  async function save(page: Page) {
    await saveBar(page).getByRole('button', { name: /^Save( settings)?$/ }).click();
    await expect(page.getByText('Saved. The store is updated.')).toBeVisible();
  }

  test('the owner writes the strip and the text block, then empties them to hide both', async ({ page }) => {
    const first = 'E2E first paragraph. '.repeat(30).trim();
    const second = 'E2E second paragraph, only after Show more.';

    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: 'Store rating' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Home page' })).toBeVisible();
    await page.getByLabel('Scrolling strip').fill('E2E strip one\n\n  E2E strip two  ');
    await page.getByLabel('Text block heading').fill('E2E home heading');
    await page.getByLabel('Text block', { exact: true }).fill(`${first}\n\n${second}`);
    await save(page);
    // stored one message per line, blank lines dropped
    await expect(page.getByLabel('Scrolling strip')).toHaveValue('E2E strip one\nE2E strip two');

    await page.goto('/');
    const strip = page.getByTestId('home-strip');
    await expect(strip.getByText('E2E strip one').first()).toBeVisible();
    await expect(strip.getByText('E2E strip two').first()).toBeAttached();
    const block = page.getByTestId('home-text-block');
    await expect(block.getByRole('heading', { name: 'E2E home heading' })).toBeVisible();
    await expect(block.getByText(second)).toHaveCount(0);
    await block.getByRole('switch', { name: 'Show more' }).click();
    await expect(block.getByText(second)).toBeVisible();
    // a blank line starts a new paragraph
    await expect(block.locator('p')).toHaveCount(2);

    await page.goto('/admin/settings');
    await page.getByLabel('Scrolling strip').fill('');
    await page.getByLabel('Text block heading').fill('');
    await page.getByLabel('Text block', { exact: true }).fill('');
    await expect(page.getByText('The strip is hidden.')).toBeVisible();
    await save(page);

    await page.goto('/');
    await expect(page.locator('h1')).toBeAttached();
    await expect(page.getByTestId('home-strip')).toHaveCount(0);
    await expect(page.getByTestId('home-text-block')).toHaveCount(0);
  });

  test('a message longer than 120 characters is refused', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.getByLabel('Scrolling strip').fill('x'.repeat(121));
    await saveBar(page).getByRole('button', { name: /^Save( settings)?$/ }).click();
    await expect(page.getByText('Keep each message under 120 characters.')).toBeVisible();
  });
});
