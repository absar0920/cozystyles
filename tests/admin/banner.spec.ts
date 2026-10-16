import { expect, test, type Page } from '@playwright/test';
import { deleteBannersByTitle, pickLink, saveBar, uniqueName, uploadInto } from '../helpers/admin';
import { fixture } from '../helpers/fixtures';
import { releaseTestUploads } from '../helpers/uploads';

/** SPEC §8.2 #3 — home banners: uploads, link picker, unsaved-changes guard, order, delete. */

async function bannerIds(page: Page): Promise<string[]> {
  return page.getByTestId('banner-card').evaluateAll((els) => els.map((e) => e.getAttribute('data-banner-id') ?? ''));
}

async function saveOrder(page: Page, ids: string[]) {
  // move each banner to its target place with the arrow buttons (phone-friendly path)
  for (let target = 0; target < ids.length; target++) {
    let current = await bannerIds(page);
    let at = current.indexOf(ids[target]);
    while (at > target) {
      await page.locator(`[data-banner-id="${ids[target]}"]`).getByRole('button', { name: 'Move up' }).click();
      current = await bannerIds(page);
      at = current.indexOf(ids[target]);
    }
  }
  if (await saveBar(page).getByRole('button', { name: 'Save order' }).isVisible()) {
    await saveBar(page).getByRole('button', { name: 'Save order' }).click();
    await expect(page.getByText('Order saved. The home page is updated.')).toBeVisible();
  }
}

test.describe.serial('home banners', () => {
  const title = uniqueName('Banner');
  const since = new Date(Date.now() - 1000);
  let bannerId = '';
  let original: string[] = [];
  let firstDesktop = '';
  let mobileUrl = '';

  test.afterAll(async ({ browser, baseURL }) => {
    // safety net: delete the test banner if a step failed before the delete step (by name, so a banner whose
    // id was never read from the list is removed too)
    const page = await browser.newPage({ baseURL, storageState: `tests/.auth/admin-${process.env.E2E_AGENT ?? 'default'}.json` });
    await deleteBannersByTitle(page, title);
    await page.close();
    // a photo uploaded by a step that failed before the banner was saved is never released by the app
    await releaseTestUploads({ since, originalNames: ['banner-desktop.jpg', 'banner-desktop-2.jpg', 'banner-mobile.jpg'] });
  });

  test('create a banner with two photos and a picked link', async ({ page }) => {
    const desktop = fixture('banner-desktop.jpg');
    const mobile = fixture('banner-mobile.jpg');
    await page.goto('/admin/banners');
    original = await bannerIds(page);

    await page.getByRole('button', { name: '+ Add banner' }).click();
    const form = page.getByTestId('banner-form');
    const uploads = form.getByTestId('image-upload');
    await uploadInto(uploads.nth(0), desktop);
    await expect(uploads.nth(0).locator('img')).toHaveAttribute('src', /^\/uploads\//);
    await uploadInto(uploads.nth(1), mobile);
    await expect(uploads.nth(1).locator('img')).toHaveAttribute('src', /^\/uploads\//);
    firstDesktop = (await uploads.nth(0).locator('img').getAttribute('src')) ?? '';
    mobileUrl = (await uploads.nth(1).locator('img').getAttribute('src')) ?? '';

    await pickLink(page, form.getByTestId('link-picker'), 'Cushions', /^Cushions$/);
    await expect(form.getByTestId('link-picker')).toContainText('Collection · Cushions');
    await form.getByLabel(/Name \(only for you/).fill(title);
    await expect(form.getByRole('switch', { name: 'Show on the store' })).toHaveAttribute('aria-checked', 'true');

    // drag handles and arrows are disabled while the form is open
    await expect(page.getByTestId('banner-card').first().getByTestId('drag-handle')).toBeDisabled();
    await expect(page.getByTestId('banner-card').nth(1).getByRole('button', { name: 'Move up' })).toBeDisabled();

    await saveBar(page).getByRole('button', { name: /Add banner|Save/ }).click();
    await expect(page.getByText('Saved. The home page is updated.')).toBeVisible();
    const card = page.getByTestId('banner-card').filter({ hasText: title });
    await expect(card).toHaveCount(1);
    bannerId = (await card.getAttribute('data-banner-id')) ?? '';
    expect(bannerId).toMatch(/^\d+$/);
    await expect(card).toContainText('Collection · Cushions');
    await expect(page.locator('body')).not.toContainText('/collections/cushions');
  });

  test('the home page shows the slide with both photos', async ({ page }) => {
    await page.goto('/');
    const slide = page.locator(`a[aria-label="${title}"]`);
    await expect(slide).toHaveAttribute('href', '/collections/cushions');
    await expect(slide.locator('img')).toHaveAttribute('src', firstDesktop);
    await expect(slide.locator('source[media="(max-width: 767px)"]')).toHaveAttribute('srcset', mobileUrl);
  });

  test('changing only a photo warns before leaving; the replaced photo is deleted', async ({ page, request }) => {
    const replacement = fixture('banner-desktop-2.jpg');
    await page.goto('/admin/banners');
    const card = page.locator(`[data-banner-id="${bannerId}"]`);
    await card.getByRole('button', { name: 'Edit' }).click();
    const form = page.getByTestId('banner-form');
    await uploadInto(form.getByTestId('image-upload').nth(0), replacement);
    await expect(form.getByTestId('image-upload').nth(0).locator('img')).not.toHaveAttribute('src', firstDesktop);

    let asked = false;
    page.once('dialog', async (d) => {
      asked = true;
      await d.dismiss();
    });
    await page.getByRole('link', { name: 'Menus' }).first().click();
    await page.waitForTimeout(500);
    expect(asked).toBe(true);
    await expect(page).toHaveURL(/\/admin\/banners/);

    await saveBar(page).getByRole('button', { name: /Save banner|Save/ }).click();
    await expect(page.getByText('Saved. The home page is updated.')).toBeVisible();
    expect((await request.get(firstDesktop)).status()).toBe(404);
  });

  test('reorder with the arrows, then restore', async ({ page }) => {
    await page.goto('/admin/banners');
    const ids = await bannerIds(page);
    try {
      await saveOrder(page, [bannerId, ...ids.filter((id) => id !== bannerId)]);
      await page.goto('/');
      await expect(page.locator('[aria-roledescription="slide"]').first().locator('a')).toHaveAttribute('aria-label', title);
    } finally {
      await page.goto('/admin/banners');
      await saveOrder(page, [...original, bannerId]);
    }
    await page.goto('/admin/banners');
    expect(await bannerIds(page)).toEqual([...original, bannerId]);
  });

  test('delete it: gone from the home page and its photos are removed', async ({ page, request }) => {
    await page.goto('/admin/banners');
    const card = page.locator(`[data-banner-id="${bannerId}"]`);
    const desktopNow = (await card.locator('img').first().getAttribute('src')) ?? '';
    await card.getByTestId('confirm-delete').click();
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toContainText('Its uploaded photos are deleted if not used elsewhere');
    await dialog.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(card).toHaveCount(0);
    bannerId = '';
    await page.goto('/');
    await expect(page.locator(`a[aria-label="${title}"]`)).toHaveCount(0);
    expect((await request.get(desktopNow)).status()).toBe(404);
    expect((await request.get(mobileUrl)).status()).toBe(404);
  });
});
