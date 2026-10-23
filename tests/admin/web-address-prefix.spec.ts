import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * The grey text in front of every "Web address" box is the shop's own host (NEXT_PUBLIC_SITE_URL, else the
 * address the admin is open on) — never the old cozyfurnitures.pk. Read-only: opens the "new" forms, saves nothing.
 */

function siteUrlFromDotEnv(): string | undefined {
  try {
    const line = readFileSync(path.resolve(__dirname, '../../.env'), 'utf8')
      .split(/\r?\n/)
      .find((l) => /^\s*NEXT_PUBLIC_SITE_URL\s*=/.test(l));
    return line?.replace(/^[^=]*=\s*/, '').trim().replace(/^(["'])(.*)\1$/, '$2') || undefined;
  } catch {
    return undefined;
  }
}

const FORMS = [
  { path: '/admin/collections/new', prefix: '/collections/' },
  { path: '/admin/products/new', prefix: '/products/' },
  { path: '/admin/pages/new', prefix: '/pages/' },
  { path: '/admin/blog/new', prefix: '/blogs/news/' },
];

test("web address boxes show the shop's own host", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || siteUrlFromDotEnv() || baseURL!;
  const host = new URL(siteUrl).host;

  for (const form of FORMS) {
    await page.goto(form.path);
    const advanced = page.locator('main details').filter({ has: page.locator('summary', { hasText: /^Advanced/ }) });
    await advanced.locator('summary').click();
    // (the page and blog forms also print the address under the box on narrow screens; that copy is hidden here)
    await expect(advanced.getByText(`${host}${form.prefix}`, { exact: true }).filter({ visible: true }), form.path).toBeVisible();
    await expect(page.locator('main').getByText(/cozyfurnitures\.pk/), form.path).toHaveCount(0);
  }
});
