import { expect, test, type Page } from '@playwright/test';
import { pickLink, saveBar, uniqueName, uploadInto } from '../helpers/admin';
import { fixture } from '../helpers/fixtures';
import { releaseTestUploads } from '../helpers/uploads';

/**
 * Decision 30: create a sofa with Size × Color, upload & tag photos, write a description, publish;
 * then edit it without reloading and check that every variant and photo keeps its id (decision 13),
 * and that the store shows prices, statuses, the gallery switch and the WhatsApp availability button.
 */

const title = uniqueName('Sofa');
let editUrl = '';

const rows = (page: Page) => page.getByTestId('variant-row');
const ids = async (page: Page, testId: string, attr: string) =>
  page.getByTestId(testId).evaluateAll((els, a) => els.map((e) => e.getAttribute(a) ?? ''), attr);

async function addValues(page: Page, option: string, values: string[]) {
  for (const v of values) {
    const input = page.getByLabel(`Add a value to ${option}`);
    await input.fill(v);
    await input.press('Enter');
    await expect(page.getByTestId('option-value').filter({ hasText: v })).toHaveCount(1);
  }
}

async function bulk(page: Page, fields: { regular?: string; sale?: string }) {
  if (fields.regular) await page.getByLabel('New regular price').fill(fields.regular);
  if (fields.sale) await page.getByLabel('New sale price').fill(fields.sale);
  await page.getByTestId('bulk-edit').getByRole('button', { name: 'Apply', exact: true }).click();
}

async function save(page: Page, label: 'Publish' | 'Save') {
  await saveBar(page).getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByText('Saved. The store is updated.')).toBeVisible({ timeout: 30_000 });
  await expect(saveBar(page)).not.toContainText('Unsaved changes');
}

test.describe.configure({ mode: 'serial' });

test.describe('product editor: sofa with Size × Color', () => {
  const since = new Date(Date.now() - 1000);
  test.afterAll(async ({ browser }) => {
    if (!editUrl) return;
    const page = await browser.newPage({ storageState: `tests/.auth/admin-${process.env.E2E_AGENT ?? 'default'}.json` });
    await page.goto(editUrl);
    if (await page.getByTestId('confirm-delete').count()) {
      await page.getByTestId('confirm-delete').first().click();
      await page.getByRole('button', { name: 'Delete permanently' }).click();
      await page.waitForURL(/\/admin\/products\?deleted=1/);
    }
    await page.close();
  });
  test.afterAll(async () => {
    await releaseTestUploads({ since, originalNames: ['sofa-grey.jpg', 'sofa-blue.jpg'] });
  });

  test('create, edit in place, check the store, delete', async ({ page, request }) => {
    test.setTimeout(240_000);
    const photo1 = fixture('sofa-grey.jpg');
    const photo2 = fixture('sofa-blue.jpg');

    await page.goto('/admin/products/new');
    await page.locator('#product-title').fill(title);
    await page.locator('#product-delivery').fill('Delivered in 20 to 30 working days');

    // options: Size × Color → 4 combinations
    await page.getByRole('switch', { name: 'This product has options like size or colour' }).click();
    await page.getByTestId('option-card').last().getByLabel('Option name').fill('Size');
    await addValues(page, 'Size', ['1 Seater', '3 Seater']);
    await page.getByRole('button', { name: '+ Add another option' }).click();
    await page.getByTestId('option-card').last().getByLabel('Option name').fill('Color');
    await addValues(page, 'Color', ['Grey', 'Blue']);
    await expect(rows(page)).toHaveCount(4);
    await expect(page.getByTestId('variant-label')).toHaveText(['1 Seater / Grey', '3 Seater / Grey', '1 Seater / Blue', '3 Seater / Blue']);

    // swatch for Grey from the palette
    await page.getByRole('button', { name: 'Swatch for Grey' }).click();
    await page.getByTestId('swatch-popover').getByRole('button', { name: 'Grey', exact: true }).click();

    // bulk prices, then one status
    await page.getByRole('button', { name: 'Set all prices' }).click();
    await bulk(page, { regular: '100000' });
    await page.getByRole('button', { name: 'More for 3 Seater' }).click();
    await page.getByRole('button', { name: 'Apply prices to all “3 Seater”' }).click();
    await bulk(page, { regular: '150000', sale: '120000' });
    await expect(page.getByLabel('Regular price for 3 Seater / Blue')).toHaveValue('150000');
    await expect(page.getByLabel('Sale price for 3 Seater / Blue')).toHaveValue('120000');
    await expect(page.getByLabel('Regular price for 1 Seater / Grey')).toHaveValue('100000');
    await page.getByLabel('Status for 1 Seater / Blue').selectOption({ label: 'Pre-order' });

    // photos: upload 2, tag the second "Shows: Color: Blue"
    await uploadInto(page.getByTestId('image-gallery'), [photo1, photo2]);
    await expect(page.getByTestId('gallery-item')).toHaveCount(2, { timeout: 30_000 });
    await page.getByTestId('gallery-item').nth(1).getByTestId('gallery-tag-select').selectOption({ label: 'Color: Blue' });

    // description: bold text, a bullet list and a link to a collection
    const editor = page.getByTestId('rich-text-editor').getByRole('textbox');
    await editor.click();
    await page.getByRole('button', { name: 'Bold', exact: true }).click();
    await page.keyboard.type('Solid wood frame');
    await page.getByRole('button', { name: 'Bold', exact: true }).click();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Bullet list', exact: true }).click();
    await page.keyboard.type('Washable covers');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Browse sofas');
    for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowLeft');
    await page.getByRole('button', { name: 'Link', exact: true }).click();
    await pickLink(page, page.getByTestId('editor-link-popover').getByTestId('link-picker'), 'Sofas', /Sofas/);

    // collections + visibility
    await page.getByPlaceholder('Search collections…').fill('Sofas');
    await page.getByRole('group', { name: 'Collections' }).getByRole('checkbox', { name: 'Sofas', exact: true }).check();
    await page.getByRole('checkbox', { name: /New arrival/ }).check();
    await page.locator('#product-layout').selectOption({ label: 'Sofas' });

    await save(page, 'Publish');
    await page.waitForURL(/\/admin\/products\/\d+\?saved=1/);
    editUrl = page.url().split('?')[0];
    await expect(rows(page)).toHaveCount(4);
    const variantIds = await ids(page, 'variant-row', 'data-variant-id');
    const imageIds = await ids(page, 'gallery-item', 'data-image-id');
    expect(variantIds.every(Boolean)).toBe(true);
    expect(imageIds.every(Boolean)).toBe(true);

    // rename Grey → Charcoal and add "2 Seater" without reloading: ids survive
    await page.getByTestId('option-value').filter({ hasText: 'Grey' }).getByRole('button', { name: 'Grey', exact: true }).click();
    await page.getByLabel('Rename Grey').fill('Charcoal');
    await page.getByLabel('Rename Grey').press('Enter');
    await expect(page.getByTestId('variant-label').filter({ hasText: 'Charcoal' })).toHaveCount(2);
    await addValues(page, 'Size', ['2 Seater']);
    await expect(rows(page)).toHaveCount(6);
    await save(page, 'Save');
    const afterIds = await ids(page, 'variant-row', 'data-variant-id');
    expect(afterIds.slice(0, 4)).toEqual(variantIds);
    expect(afterIds.slice(4).every(Boolean)).toBe(true);
    expect(await ids(page, 'gallery-item', 'data-image-id')).toEqual(imageIds);

    // change one price and save again: nothing is re-created, no "changed somewhere else"
    await page.getByLabel('Regular price for 2 Seater / Charcoal').fill('130000');
    await save(page, 'Save');
    await expect(saveBar(page)).not.toContainText('changed somewhere else');
    expect(await ids(page, 'variant-row', 'data-variant-id')).toEqual(afterIds);

    // reload: everything persisted
    await page.reload();
    expect(await ids(page, 'variant-row', 'data-variant-id')).toEqual(afterIds);
    expect(await ids(page, 'gallery-item', 'data-image-id')).toEqual(imageIds);
    await expect(page.getByLabel('Regular price for 2 Seater / Charcoal')).toHaveValue('130000');
    await expect(page.getByLabel('Status for 1 Seater / Blue')).toHaveValue('PRE_ORDER');

    // the store
    const handle = (await page.locator('#product-handle').inputValue()) || '';
    expect(handle).toBeTruthy();
    const pdp = await page.context().newPage();
    await pdp.goto(`/products/${handle}`);
    await expect(pdp.locator('h1')).toHaveText(title);
    await expect(pdp.getByText('NEW', { exact: true }).first()).toBeVisible();
    await expect(pdp.getByText('Rs.100,000').first()).toBeVisible();
    await pdp.getByRole('button', { name: '3 Seater', exact: true }).click();
    await expect(pdp.locator('ins').first()).toHaveText('Rs.120,000');
    await expect(pdp.locator('del').first()).toHaveText('Rs.150,000');
    const blueSrc = await page.getByTestId('gallery-item').nth(1).locator('img').getAttribute('src');
    await pdp.getByRole('button', { name: '1 Seater', exact: true }).click();
    await pdp.getByRole('button', { name: 'Blue', exact: true }).click();
    await expect(pdp.locator('img[src="' + blueSrc + '"]').first()).toBeVisible();
    await expect(pdp.getByTestId('order-on-whatsapp')).toContainText(/ask about availability/i);
    const body = pdp.locator('.text-accent', { has: pdp.locator('ul') }).first();
    await expect(body.locator('strong')).toContainText('Solid wood frame');
    await expect(body.locator('ul li')).toContainText(['Washable covers']);
    await expect(body.locator('a[href="/collections/sofas-all"]')).toHaveText('sofas');
    await pdp.goto('/collections/sofas-all?sort_by=created-descending');
    const card = pdp.locator('.product-card', { hasText: title });
    await expect(card).toBeVisible();
    await expect(card).toContainText(/ready to ship/i);
    await pdp.close();

    // removing a value asks first and lists the combinations; cancel keeps them
    await page.getByRole('button', { name: 'Remove 1 Seater' }).click();
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toContainText('1 Seater / Charcoal');
    await expect(dialog).toContainText('1 Seater / Blue');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(rows(page)).toHaveCount(6);

    // delete: the confirmation says what is lost; the product page is gone afterwards
    await page.getByTestId('confirm-delete').first().click();
    await expect(page.getByTestId('confirm-dialog')).toContainText('6 combinations');
    await expect(page.getByTestId('confirm-dialog')).toContainText('2 photos');
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await page.waitForURL(/\/admin\/products\?deleted=1/);
    editUrl = '';
    expect((await request.get(`/products/${handle}`)).status()).toBe(404);
  });
});
