import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

/** The store's /collections page: no leftover template text, and a search description built from what it shows. Read-only. */

const prisma = new PrismaClient();
test.afterAll(async () => {
  await prisma.$disconnect();
});

test('/collections has no template sentence and describes the collections it shows', async ({ page }) => {
  const rows = await prisma.collectionIndexCard.findMany({
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { systemHandle: true, systemTitle: true, collection: { select: { handle: true, title: true } } },
  });
  const titles = rows.filter((r) => r.collection?.handle ?? r.systemHandle).map((r) => (r.collection?.title ?? r.systemTitle ?? '').trim());

  await page.goto('/collections');
  await expect(page.getByRole('heading', { level: 1, name: 'Shop by Category' })).toBeVisible();
  await expect(page.getByText('Add a short description for your collections')).toHaveCount(0);

  const description = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
  expect(description).toMatch(/^Browse the .+ collections/);
  if (titles[0]) expect(description).toContain(titles[0]);
  // the old text listed furniture the shop does not sell
  expect(description).not.toMatch(/office chairs and desks|wardrobes, doors|kids furniture|home decor/i);
});
