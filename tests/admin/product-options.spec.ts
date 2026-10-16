import { expect, test } from '@playwright/test';

/** A new option card keeps every value typed into it, not just the first one (nothing is saved here). */
test.describe('product editor: typing values into a new option', () => {
  test('a comma list, then more values one by one, all become chips', async ({ page }) => {
    await page.goto('/admin/products/new');
    await page.getByText('This product has options like size or colour').click();
    const size = page.getByLabel('Add a value to Size');
    await size.fill('1 Seater, 2 Seater, 3 Seater');
    await size.press('Enter');
    await expect(page.getByTestId('option-value')).toHaveCount(3);
    // focus stays in the value box of the new card
    await page.keyboard.type('4 Seater');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('option-value')).toHaveCount(4);

    await page.getByRole('button', { name: /Add another option/ }).click();
    await page.getByPlaceholder('e.g. Size, Color, Finish').fill('Color');
    const color = page.getByLabel('Add a value to Color');
    await color.fill('Grey, Blue, Grey, Red');
    await color.press('Enter');
    const card = page.getByTestId('option-card').nth(1);
    await expect(card.getByTestId('option-value')).toHaveText([/Grey/, /Blue/]);
    // what could not be added stays in the box with the reason
    await expect(card.getByLabel('Add a value to Color')).toHaveValue('Grey, Red');
    await expect(card.getByRole('alert')).toContainText('Grey');
    await expect(page.getByTestId('variant-row')).toHaveCount(8);
  });
});

/** Typed-but-not-added values and decimal prices are never lost or mangled silently (nothing is saved here). */
test.describe('product editor: half-typed values and decimal prices', () => {
  test('a value typed without Enter is added on leaving the box, or blocks saving', async ({ page }) => {
    await page.goto('/admin/products/new');
    await page.getByText('This product has options like size or colour').click();
    const size = page.getByLabel('Add a value to Size');
    await size.fill('1 Seater, 2 Seater');
    await size.press('Enter');
    // leaving the box adds what was typed
    await size.fill('3 Seater');
    await page.locator('#product-title').click();
    await expect(page.getByTestId('option-value')).toHaveCount(3);
    await expect(page.getByTestId('variant-row')).toHaveCount(3);

    // a value that can't be added stays in the box and stops the save with a clear message
    await size.fill('2 Seater');
    await page.getByRole('button', { name: 'Save as draft' }).click();
    await expect(page.getByText('Press Enter to add “2 Seater” to Size, or clear that box.')).toBeVisible();
    await expect(size).toBeFocused();
    await size.fill('');
    await expect(page.getByText('Press Enter to add “2 Seater” to Size, or clear that box.')).toHaveCount(0);

    // a new option card that was opened but not finished also stops the save
    await page.getByRole('button', { name: /Add another option/ }).click();
    await page.getByPlaceholder('e.g. Size, Color, Finish').fill('Finish');
    await page.getByRole('button', { name: 'Save as draft' }).click();
    await expect(page.getByText('Finish the new option “Finish”', { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/products\/new/);
  });

  test('prices keep the decimal point: .00 is fine, other decimals show an error', async ({ page }) => {
    await page.goto('/admin/products/new');
    const price = page.getByLabel('Regular price', { exact: true });
    await price.fill('45,000.00');
    await expect(price).toHaveValue('45,000.00');
    await expect(page.getByText('Whole rupees only, e.g. 45000')).toHaveCount(0);
    await price.fill('45,000.50');
    await expect(price).toHaveValue('45,000.50');
    await expect(page.getByText('Whole rupees only, e.g. 45000')).toBeVisible();
  });
});
