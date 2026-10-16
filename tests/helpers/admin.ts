import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

/** "E2E <prefix> <timestamp>" — every test row is created with one of these and removed afterwards. */
export function uniqueName(prefix: string): string {
  return `E2E ${prefix} ${Date.now()}`;
}

/** Opens a LinkPicker, searches, and picks the result whose text matches. */
export async function pickLink(page: Page, picker: Locator, search: string, resultText: string | RegExp) {
  await picker.getByRole('button', { name: 'Choose link' }).click();
  const pop = page.getByTestId('link-picker-popover').last();
  await pop.getByRole('searchbox').fill(search);
  await pop.getByTestId('link-result').filter({ hasText: resultText }).first().click();
  await expect(pop).toBeHidden();
}

/** Sets a file on the first file input inside `locator` (ImageUpload / ImageGallery root). */
export async function uploadInto(locator: Locator, file: string | string[]) {
  await locator.locator('input[type=file]').first().setInputFiles(file);
}

/** The sticky save bar. */
export function saveBar(page: Page): Locator {
  return page.getByTestId('save-bar');
}

/** POST /api/admin/uploads with the Origin header (Playwright's request context sends none; the CSRF check needs it). */
export async function apiUpload(request: APIRequestContext, file: string, purpose = 'product', baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3100') {
  return request.post('/api/admin/uploads', {
    headers: { Origin: baseURL },
    multipart: {
      file: { name: path.basename(file), mimeType: 'application/octet-stream', buffer: readFileSync(file) },
      purpose,
    },
  });
}

/**
 * Safety net for afterAll/finally: deletes every banner card whose name is `title` (a uniqueName), reloading
 * the list first, so a test that failed before it learned the banner id still leaves no slide on the store.
 */
export async function deleteBannersByTitle(page: Page, title: string) {
  await page.goto('/admin/banners');
  const cards = page.getByTestId('banner-card').filter({ hasText: title });
  for (let n = await cards.count(); n > 0; n--) {
    const card = cards.first();
    await card.getByTestId('confirm-delete').click();
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete permanently' }).click();
    await expect(cards).toHaveCount(n - 1);
  }
}
