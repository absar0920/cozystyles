import { expect, test } from '@playwright/test';

/** Store pages and footer: Page not found, footer headings, Popular searches, search summary, text page titles. */

for (const path of ['/sofa-sale', '/products', '/pages/privacy-policy/extra', '/collections/a/b/c']) {
  test(`unknown address ${path} shows the shop's Page not found with header and footer`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
    await expect(page.locator('main h1')).toHaveText('Page not found');
    await expect(page.locator('main')).toContainText('The page you were looking for doesn’t exist.');
    await expect(page.locator('header.header')).toHaveCount(1);
    await expect(page.locator('footer.footer')).toHaveCount(1);
    await expect(page.locator('main').getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/');
  });
}

test('footer menu headings are the admin tab names', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer.footer');
  await expect(footer.locator('nav[aria-label="About"] h3')).toHaveText('About');
  await expect(footer.locator('nav[aria-label="Customer Support"] h3')).toHaveText('Customer Support');
  await expect(footer.getByText('User Area', { exact: true })).toHaveCount(0);
  await expect(footer.getByText('Information', { exact: true })).toHaveCount(0);
});

test('Popular searches: links are the plain names, commas sit after the previous name', async ({ page }) => {
  await page.goto('/');
  const lists = page.locator('section ul:has(> li.contents)');
  test.skip((await lists.count()) === 0, 'no Popular searches menu');
  const names = await lists.first().locator('a').allTextContents();
  expect(names.length).toBeGreaterThan(1);
  for (const name of names) expect(name).not.toMatch(/^[\s,]|[\s,]$/);
  const text = await lists.first().innerText();
  expect(text).not.toMatch(/\s,/);
  expect(text).toContain(`${names[0]}, ${names[1]}`);
});

test('search results: the number of results and the magnifier show without "Show more"', async ({ page }) => {
  await page.goto('/search?q=sofa');
  await expect(page.locator('main').getByText(/^\d+ results? found for “sofa”$/)).toBeVisible();
  await expect(page.locator('main form[role=search] button[type=submit] svg')).toBeVisible();
  await expect(page.getByRole('button', { name: /Show more/ })).toHaveCount(0);
});

test('a text page shows its title as the page heading', async ({ page }) => {
  await page.goto('/pages/privacy-policy');
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Privacy Policy');
  await expect(page.locator('main h1')).toBeVisible();
});
