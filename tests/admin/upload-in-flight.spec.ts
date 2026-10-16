import { expect, test } from '@playwright/test';
import { saveBar, uploadInto } from '../helpers/admin';
import { fixture } from '../helpers/fixtures';
import { releaseTestUploads } from '../helpers/uploads';

const since = new Date(Date.now() - 1000);
// the product is never saved, so the uploaded photo would stay behind in the committed dev.db
test.afterAll(async () => {
  await releaseTestUploads({ since, originalNames: ['sofa-grey.jpg'] });
});

/**
 * A photo still uploading must not be lost: every save button waits for it, leaving the page warns,
 * and once it lands the photo is in the gallery and the product shows unsaved changes.
 */
test('product save waits for a photo that is still uploading', async ({ page }) => {
  await page.goto('/admin/products/new');
  await page.locator('#product-title').fill('Upload in flight');
  await page.route('**/api/admin/uploads', async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });

  await uploadInto(page.getByTestId('image-gallery'), fixture('sofa-grey.jpg'));
  await expect(saveBar(page)).toContainText('Waiting for the photo to finish uploading');
  for (const name of ['Save as draft', 'Publish']) {
    await expect(saveBar(page).getByRole('button', { name, exact: true })).toBeDisabled();
  }

  // leaving now asks first (dismissed: we stay)
  const asked = page.waitForEvent('dialog').then(async (d) => {
    const msg = d.message();
    await d.dismiss();
    return msg;
  });
  await page.getByRole('link', { name: '← Products' }).click();
  expect(await asked).toMatch(/Leave this page/);

  await expect(page.getByTestId('gallery-item')).toHaveCount(1, { timeout: 30_000 });
  await expect(saveBar(page)).toContainText('Unsaved changes');
  await expect(saveBar(page).getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/\/admin\/products\/new$/);
});
