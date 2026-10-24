import { expect, test, type Page } from '@playwright/test';
import { FOOTER_USER_AREA } from '../../scripts/fidelity/global';
import { saveBar } from '../helpers/admin';

/**
 * SPEC §8.2 #4 — reorder a footer menu with arrows and drag; the storefront follows.
 * Always restores the SEED order (never the order found at start), so one failed run can't leave the
 * shop's footer reordered for later runs to treat as "original".
 */

const SEED_ORDER = FOOTER_USER_AREA.map((i) => i.label);

const TAB = '/admin/menus?tab=support';
const topItems = (page: Page) => page.locator('[aria-label="Menu items"] > [data-testid="sortable-item"] > [data-testid="menu-item"]');

async function labels(page: Page): Promise<string[]> {
  return topItems(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-label') ?? ''));
}

async function storefrontCustomerSupport(page: Page): Promise<string[]> {
  await page.goto('/');
  return page.locator('nav[aria-label="Customer Support"] li').allInnerTexts().then((t) => t.map((s) => s.trim()));
}

async function saveMenu(page: Page) {
  await saveBar(page).getByRole('button', { name: 'Save menu' }).click();
  await expect(page.getByText('Saved. The store is updated.')).toBeVisible();
}

const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Puts the top-level items back in `order` with the arrow buttons and saves. Reloads first (and waits for the
 * editor to respond) so it works whatever state the test left the page in; retries, and checks the saved result.
 */
async function restore(page: Page, order: string[]) {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(TAB, { waitUntil: 'networkidle' });
      await expect(topItems(page).first()).toBeVisible();
      if (sameOrder(await labels(page), order)) return;
      for (let target = 0; target < order.length; target++) {
        let at = (await labels(page)).indexOf(order[target]);
        while (at > target) {
          const before = at;
          await topItems(page).nth(at).getByRole('button', { name: 'Move up' }).first().click();
          // a click before hydration does nothing: wait until it moved, else this attempt fails and retries
          await expect.poll(async () => (await labels(page)).indexOf(order[target]), { timeout: 5_000 }).toBeLessThan(before);
          at = (await labels(page)).indexOf(order[target]);
        }
      }
      await expect(saveBar(page).getByRole('button', { name: 'Save menu' })).toBeEnabled();
      await saveMenu(page);
      await page.reload({ waitUntil: 'networkidle' });
      expect(await labels(page)).toEqual(order);
      return;
    } catch (e) {
      if (attempt >= 3) throw e;
    }
  }
}

test('reorder the Customer Support footer menu', async ({ page }) => {
  // start from the seed order (repairs a previous run that could not restore)
  await restore(page, SEED_ORDER);
  // the tab's hint names the footer heading the store shows (the same words as the tab)
  await expect(page.getByTestId('tabs')).toContainText('under the “Customer Support” heading');
  const original = await labels(page);
  expect(original).toEqual(SEED_ORDER);

  try {
    // item 3 → position 1 with "Move up" twice
    await topItems(page).nth(2).getByRole('button', { name: 'Move up' }).first().click();
    await topItems(page).nth(1).getByRole('button', { name: 'Move up' }).first().click();
    const afterArrows = [original[2], original[0], original[1], ...original.slice(3)];
    expect(await labels(page)).toEqual(afterArrows);
    await saveMenu(page);
    expect((await storefrontCustomerSupport(page))[0]).toBe(original[2]);

    // drag item 1 below item 2 with the handle
    await page.goto(TAB);
    const handle = topItems(page).nth(0).getByTestId('drag-handle').first();
    const target = topItems(page).nth(1);
    const from = (await handle.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10, { steps: 3 });
    await page.mouse.move(from.x + from.width / 2, to.y + to.height * 0.9, { steps: 12 });
    await page.mouse.up();
    const afterDrag = [afterArrows[1], afterArrows[0], ...afterArrows.slice(2)];
    await expect.poll(() => labels(page)).toEqual(afterDrag);
    // the drop has registered once the save bar says so (a click during the drop animation is swallowed)
    await expect(saveBar(page)).toContainText('Unsaved changes');
    // dnd-kit swallows every click for 50 ms after a drop (its document click blocker is removed on a timer);
    // a production build renders fast enough for the save click to land inside that window
    await page.waitForTimeout(100);
    await saveMenu(page);
    expect((await storefrontCustomerSupport(page)).slice(0, afterDrag.length)).toEqual(afterDrag);

    // removing asks first and only happens on save
    await page.goto(TAB);
    await topItems(page).nth(0).getByRole('button', { name: /^Remove/ }).click();
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toContainText('Removed when you save.');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    expect(await labels(page)).toEqual(afterDrag);
  } finally {
    await restore(page, SEED_ORDER);
  }
  expect(await storefrontCustomerSupport(page)).toEqual(SEED_ORDER);
});

test('main menu: a stacked heading shows an unticked "Start a new column" box', async ({ page }) => {
  await page.goto('/admin/menus?tab=main');
  const expand = (label: string, top = false) =>
    (top ? topItems(page) : page.getByTestId('menu-item')).and(page.locator(`[data-label="${label}"]`)).first().locator(':scope > div > button[aria-expanded]').click();
  await expand('Home', true);
  const recliners = page.locator('[data-testid="menu-item"][data-label="Recliners"]');
  await expand('Recliners');
  await expect(recliners.getByLabel('Start a new column in the dropdown').first()).not.toBeChecked();
  const living = page.locator('[data-testid="menu-item"][data-label="Living"]');
  await expand('Living');
  await expect(living.getByLabel('Start a new column in the dropdown').first()).toBeChecked();
  await expect(saveBar(page).getByRole('button', { name: 'Save menu' })).toBeDisabled();
});
