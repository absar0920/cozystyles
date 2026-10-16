import { expect, test } from '@playwright/test';

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
