import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { saveBar, uniqueName } from '../helpers/admin';

/**
 * F02-2 — "Create collection" opens the new collection. The save must not answer with a redirect: after a
 * redirect from a server action Next.js fetches the target page from its own server, which fails on Hostinger
 * (runtime log: "failed to get redirect response TypeError: fetch failed"). The editor then got an empty answer
 * and showed "Something went wrong" instead of the saved collection. The editor now opens it itself.
 */

const prisma = new PrismaClient();
const created: string[] = [];

test.afterAll(async () => {
  if (created.length) await prisma.collection.deleteMany({ where: { title: { in: created } } });
  await prisma.$disconnect();
});

test('Create collection saves without a redirect and opens the new collection', async ({ page }) => {
  const title = uniqueName('Collection');
  created.push(title);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/admin/collections/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New collection' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(title);

  const [action] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && !!r.request().headers()['next-action']),
    saveBar(page).getByRole('button', { name: 'Create collection' }).click(),
  ]);
  expect(action.status()).toBe(200);
  expect(action.headers()['x-action-redirect']).toBeUndefined();

  await expect(page).toHaveURL(/\/admin\/collections\/\d+\?saved=1$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Saved. The store is updated.')).toBeVisible();
  await expect(page.getByText('This page could not finish loading')).toHaveCount(0);

  const id = Number(new URL(page.url()).pathname.split('/').pop());
  const row = await prisma.collection.findUnique({ where: { id }, select: { title: true } });
  expect(row?.title).toBe(title);
  expect(await prisma.collection.count({ where: { title } })).toBe(1);
  expect(errors).toEqual([]);
});

test('a collection never takes the shop’s own catalogue addresses (/collections/all, frontpage, all-1)', async ({ page }) => {
  // /collections/all lists every product and /collections/frontpage redirects there: a collection typed with
  // one of those addresses gets the next free one instead (its page would never be reachable)
  for (const [typed, expected] of [['all', 'all-2'], ['frontpage', 'frontpage-2']] as const) {
    const title = uniqueName('Reserved');
    created.push(title);
    await page.goto('/admin/collections/new');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(title);
    await page.locator('main summary', { hasText: /^Advanced/ }).click();
    await page.getByRole('textbox', { name: 'Web address' }).fill(typed);
    await saveBar(page).getByRole('button', { name: 'Create collection' }).click();
    await expect(page).toHaveURL(/\/admin\/collections\/\d+\?saved=1$/, { timeout: 30_000 });
    const row = await prisma.collection.findFirst({ where: { title }, select: { handle: true } });
    expect(row?.handle).toBe(expected);
  }
});
