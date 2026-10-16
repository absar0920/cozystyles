import { expect, test as setup } from '@playwright/test';
import { AUTH_FILE, adminCredentials } from '../helpers/env';

setup('log in as admin', async ({ page }) => {
  const { email, password } = adminCredentials();
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  // the dev server may compile /admin on first hit: allow it time
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 60_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
