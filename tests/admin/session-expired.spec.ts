import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { adminCredentials } from '../helpers/env';
import { LayoutTestData, copyFromList, rowsOf, section } from '../helpers/layouts';

/**
 * Signed out while an editor is open (12-hour session ran out / password changed elsewhere): Save must not
 * crash the page or navigate away. It asks to sign in again and keeps everything typed. The test never signs in
 * again, so the held save is never sent and nothing is written.
 */
test('Save after the session ended asks to sign in and keeps the edits', async ({ page, context }) => {
  await page.goto('/admin/pages');
  const href = await page.locator('a[href^="/admin/pages/"]').filter({ hasText: /^Payment$/ }).first().getAttribute('href');
  expect(href).toMatch(/^\/admin\/pages\/\d+$/);
  await page.goto(href!);

  const editor = page.locator('[contenteditable=true]').first();
  await editor.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' E2E unsaved sentence.');

  await context.clearCookies();
  await page.getByRole('button', { name: /^Save/ }).last().click();

  const dialog = page.getByTestId('session-expired-dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(editor).toContainText('E2E unsaved sentence.');
  await expect(page.getByText('Application error')).toHaveCount(0);

  await dialog.locator('input[type=password]').fill('not-the-password');
  await dialog.getByRole('button', { name: 'Sign in and save' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Invalid email or password');
  await expect(editor).toContainText('E2E unsaved sentence.');
});

test('an ended session on a page load returns to that page after signing in', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fsettings$/);
});

test('layout editor: signed out while editing keeps the draft and saves after signing in again', async ({ page, context }) => {
  test.setTimeout(120_000);
  const prisma = new PrismaClient();
  const data = new LayoutTestData(prisma);
  try {
    const id = await copyFromList(page, data, 'Simple');
    await page.getByRole('button', { name: 'Add section' }).click();
    await page.getByTestId('add-section-dialog').locator('button[data-kind=testimonials]').click();
    const t = section(page, 'testimonials');
    const heading = `E2E session heading ${data.stamp}`;
    await t.getByLabel('Heading', { exact: true }).fill(heading);
    await t.getByTestId('quote-item').first().getByLabel('Quote', { exact: true }).fill('Lovely sofa.');
    await t.getByTestId('quote-item').first().getByLabel('Customer name').fill('E2E');

    await context.clearCookies();
    await page.getByTestId('save-bar').getByRole('button', { name: 'Save layout' }).click();
    const dialog = page.getByTestId('session-expired-dialog');
    await expect(dialog).toBeVisible();
    await expect(t.getByLabel('Heading', { exact: true })).toHaveValue(heading);
    expect((await rowsOf(prisma, id)).map((r) => r.kind)).toEqual(['recommendations']);

    const { email, password } = adminCredentials();
    await dialog.locator('input[type=email]').fill(email);
    await dialog.locator('input[type=password]').fill(password);
    await dialog.getByRole('button', { name: 'Sign in and save' }).click();
    await expect(page.getByText(/^Saved\./).first()).toBeVisible({ timeout: 30_000 });
    const rows = await rowsOf(prisma, id);
    expect(rows.map((r) => r.kind)).toEqual(['recommendations', 'testimonials']);
    expect(JSON.parse(rows[1].data).heading).toBe(heading);
  } finally {
    await data.cleanup();
    await prisma.$disconnect();
  }
});
