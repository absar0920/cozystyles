import { test, expect, devices } from '@playwright/test';
import { shot, watchErrors } from './helpers';

// Shopper on a phone: mobile menu, product page, cart.
test.use({ ...devices['iPhone 13'], browserName: 'chromium' });

test('mobile: navigate via the menu drawer and add to cart', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Featured promotions' })).toBeVisible();
  await shot(page, '50-mobile-home');

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Toggle Living Room' }).click();
  await page.getByRole('link', { name: 'Sofas', exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/collections\/sofas$/);
  await shot(page, '51-mobile-collection');

  await page.getByRole('link', { name: 'Antonin Sofa', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Antonin Sofa' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to Cart' }).first().click();
  await page.goto('/cart');
  await expect(page.getByText('Antonin Sofa').first()).toBeVisible();
  await shot(page, '52-mobile-cart');

  // No horizontal scrolling on key pages.
  for (const url of ['/', '/collections/sofas', '/products/antonin-sofa', '/cart', '/checkout', '/pages/privacy-policy']) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect.soft(overflow, `${url} horizontal overflow (px)`).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});
