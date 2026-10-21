import { expect, request as pwRequest, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { saveBar, uniqueName, uploadInto } from '../helpers/admin';
import { fixture, makeImage } from '../helpers/fixtures';
import {
  LayoutTestData,
  callAction,
  callFormAction,
  copyFromList,
  draftFromDb,
  editSection,
  kindsInEditor,
  openLayout,
  rename,
  rowsOf,
  saveLayout,
  section,
  sectionMenu,
  uploadRefs,
  type SectionRow,
} from '../helpers/layouts';
import { ratioOf } from '../../src/lib/product-layout-sections';
import type { LayoutDraft } from '../../src/lib/product-layout-draft';

/**
 * Product page layouts editor (docs/product-layouts/SPEC.md §13.1). Every layout, product, collection, preview
 * and photo made here is removed in afterAll; migrated layouts are only ever copied, never edited.
 *
 * Timeline (serial): A = copy of "General furniture (standard)"; P1/P2 = test products; B = "Save as a new
 * layout" from A; C = P1's own layout; D = a new layout that gets deleted; E = copy of "Coalesce — living";
 * F = layout with long text.
 */

test.describe.configure({ mode: 'serial' });

const prisma = new PrismaClient();
const data = new LayoutTestData(prisma);
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100';

const nameA = uniqueName('Layout A');
const headingA = `E2E heading ${data.stamp}`;
const quoteA = `E2E quote ${data.stamp}`;
const iconTitle = `E2E warranty ${data.stamp}`;

const S: {
  A?: number;
  keyA?: string;
  B?: number;
  C?: number;
  D?: number;
  E?: number;
  P1?: { id: number; handle: string; title: string };
  P2?: { id: number; handle: string; title: string };
  rowsBeforeSharedSave?: SectionRow[];
} = {};

const strip = (rows: SectionRow[]) => rows.map(({ kind, hidden, bodyHtml, data, refs, collectionId }) => ({ kind, hidden, bodyHtml, data, refs, collectionId }));
const layoutIdOf = async (key: string) => (await prisma.productLayout.findUniqueOrThrow({ where: { key }, select: { id: true } })).id;
const usage = (key: string) => prisma.product.count({ where: { layout: key } });

async function directSave(page: Page, layoutId: number, mutate: (d: LayoutDraft) => void) {
  const { updatedAt, draft } = await draftFromDb(prisma, layoutId);
  mutate(draft);
  return callAction<{ ok: boolean; code?: string; error?: string; sectionErrors?: Record<string, Record<string, string>>; field?: string }>(page.request, 'saveProductLayoutAction', [
    { layoutId, updatedAt, draft },
  ]);
}

/** Save layout without waiting for success (confirms the shared warning when `usedBy` ≥ 2). */
async function clickSave(page: Page, usedBy: number) {
  await saveBar(page).getByRole('button', { name: 'Save layout' }).click();
  if (usedBy >= 2) await page.getByTestId('save-warning').getByRole('button', { name: `Save for all ${usedBy} products` }).click();
}

test.afterAll(async () => {
  try {
    await data.cleanup();
  } finally {
    await prisma.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
});

test('list: every layout with its live "used by" count', async ({ page }) => {
  await page.goto('/admin/product-layouts');
  const layouts = await prisma.productLayout.findMany({ orderBy: { position: 'asc' }, select: { name: true, key: true } });
  expect(layouts.length).toBeGreaterThanOrEqual(18);
  const cards = page.getByTestId('layout-card');
  await expect(cards).toHaveCount(layouts.length);
  for (const l of layouts) await expect(cards.filter({ has: page.getByRole('link', { name: l.name, exact: true }) })).toHaveCount(1);
  const office = await usage('office-products');
  const card = cards.filter({ has: page.getByRole('link', { name: 'Office furniture', exact: true }) });
  await expect(card.getByTestId('used-by')).toHaveText(new RegExp(`^Used by ${office} products`));
  await expect(card).toContainText('Big photo with text');
  await expect(card).toContainText('Customer reviews');
});

test('copy and edit every kind of control, then reload', async ({ page }) => {
  test.setTimeout(240_000);
  data.uploadNames.add('sofa-grey.jpg');
  S.A = await copyFromList(page, data, 'General furniture (standard)');
  S.keyA = await data.layoutKey(S.A);
  await expect(page.getByText('This layout isn’t used by any product yet.')).toBeVisible();
  await rename(page, nameA);

  // photo and text 1: new photo, photo on the left, heading, a button to a collection
  const it = section(page, 'imageText', 0);
  await editSection(it);
  const upload = it.getByTestId('image-upload').first();
  await uploadInto(upload, fixture('sofa-grey.jpg'));
  await expect(upload.locator('img[src^="/uploads/"]')).toBeVisible({ timeout: 30_000 });
  await it.getByRole('radio', { name: 'Photo on the left' }).click();
  await it.getByLabel('Heading', { exact: true }).fill(headingA);
  await it.getByRole('switch', { name: 'Show a button under the text' }).click();
  await it.getByLabel('Button text').fill('See cushions');
  await it.getByTestId('link-picker').getByRole('button', { name: 'Choose link' }).click();
  const pop = page.getByTestId('link-picker-popover').last();
  await pop.getByRole('searchbox').fill('Cushions');
  await pop.getByTestId('link-result').filter({ has: page.locator('span', { hasText: /^Cushions$/ }) }).first().click();
  await expect(pop).toBeHidden();

  // quotes: add one, move it up, then hide the whole section
  const t = section(page, 'testimonials');
  await editSection(t);
  const n = await t.getByTestId('quote-item').count();
  await t.getByRole('button', { name: '+ Add quote' }).click();
  await expect(t.getByTestId('quote-item')).toHaveCount(n + 1);
  await t.getByTestId('quote-item').nth(n).getByLabel('Quote', { exact: true }).fill(quoteA);
  await t.getByTestId('quote-item').nth(n).getByLabel('Customer name').fill('E2E Customer');
  await t.getByTestId('quote-item').nth(n).getByRole('button', { name: 'Move up' }).click();
  await expect(t.getByTestId('quote-item').nth(n - 1).getByLabel('Quote', { exact: true })).toHaveValue(quoteA);
  await t.getByRole('switch', { name: 'Show on the store' }).first().click();
  await expect(t.getByText('Hidden', { exact: true })).toBeVisible();

  // a new icons row with the warranty icon
  await page.getByRole('button', { name: 'Add section' }).click();
  await page.getByTestId('add-section-dialog').locator('button[data-kind=icons]').click();
  const icons = section(page, 'icons');
  await expect(icons.getByTestId('section-editor')).toBeVisible();
  await icons.getByTestId('icon-picker').getByRole('button').first().click();
  await page.getByTestId('icon-picker-popover').locator('button[data-icon=warranty]').click();
  await expect(icons.getByTestId('icon-picker').getByRole('button').first()).toHaveAttribute('aria-label', /^Choose icon: /);
  await icons.getByTestId('icon-block').first().getByLabel('Title').fill(iconTitle);
  await icons.getByTestId('icon-block').first().getByLabel('Text', { exact: true }).fill('Ten years on every frame');

  await saveLayout(page); // used by no product: no warning
  await expect(page.getByTestId('save-warning')).toBeHidden();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nameA);
  const it2 = section(page, 'imageText', 0);
  await editSection(it2);
  await expect(it2.getByLabel('Heading', { exact: true })).toHaveValue(headingA);
  await expect(it2.getByRole('radio', { name: 'Photo on the left' })).toHaveAttribute('aria-checked', 'true');
  await expect(it2.getByLabel('Button text')).toHaveValue('See cushions');
  await expect(it2.getByTestId('link-picker-value')).toContainText('Cushions');
  await expect(section(page, 'testimonials').getByText('Hidden', { exact: true })).toBeVisible();
  await expect(section(page, 'icons').getByTestId('section-summary')).toContainText(iconTitle);

  // stored values: the photo's shape is derived from the upload, never typed
  const row = (await rowsOf(prisma, S.A)).find((r) => r.kind === 'imageText')!;
  const d = JSON.parse(row.data);
  const up = await prisma.upload.findUniqueOrThrow({ where: { url: d.image } });
  expect(d.image).toMatch(/^\/uploads\//);
  expect(d.ratio).toBe(ratioOf(up.width, up.height));
  expect(d.imageFirst).toBe(true);
  expect(d.button).toEqual({ label: 'See cushions', href: '/collections/cushions' });
  const iconRow = (await rowsOf(prisma, S.A)).find((r) => r.kind === 'icons')!;
  expect(JSON.parse(iconRow.data).blocks[0]).toMatchObject({ icon: 'warranty', title: iconTitle });
  const tRow = (await rowsOf(prisma, S.A)).find((r) => r.kind === 'testimonials')!;
  expect(tRow.hidden).toBe(true);
});

test('the store shows the edited copy', async ({ page }) => {
  S.P1 = await data.product('p1', S.keyA!);
  await page.goto(`/products/${S.P1.handle}`);
  const h = page.locator('main h3', { hasText: headingA });
  await expect(h).toBeVisible();
  const block = page.locator('main div.flow-root', { has: page.locator('h3', { hasText: headingA }) });
  const img = await block.locator('img').first().getAttribute('src');
  const row = (await rowsOf(prisma, S.A!)).find((r) => r.kind === 'imageText')!;
  expect(img).toBe(JSON.parse(row.data).image);
  await expect(block.locator('.md\\:flex-row-reverse')).toHaveCount(0);
  await expect(block.getByRole('link', { name: 'See cushions' })).toHaveAttribute('href', '/collections/cushions');
  await expect(page.getByText(quoteA)).toHaveCount(0);
  await expect(page.locator('main div.overflow-hidden.bg-accent.text-cream')).toHaveCount(0); // the quotes band is hidden
  const strip = page.locator('main div.bg-cream', { hasText: iconTitle });
  await expect(strip).toBeVisible();
  await expect(strip.locator('path[d^="M10 1.5 17 4"]')).toHaveCount(1); // the warranty shield
});

test('shared layout: banner, change list, keep editing, save as new, save for all', async ({ page }) => {
  test.setTimeout(240_000);
  S.P2 = await data.product('p2', S.keyA!);
  await openLayout(page, S.A!);
  await expect(page.getByText('Changes here affect 2 products. To change only some of them, make a copy first.')).toBeVisible();

  const edit = async () => {
    await sectionMenu(page, section(page, 'overlay'), 'Delete section');
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete section' }).click();
    await expect(section(page, 'overlay')).toHaveCount(0);
    await section(page, 'imageText', 1).getByRole('switch', { name: 'Show on the store' }).click();
  };
  const before = await rowsOf(prisma, S.A!);
  await edit();
  await saveBar(page).getByRole('button', { name: 'Save layout' }).click();
  const warn = page.getByTestId('save-warning');
  await expect(warn.getByRole('heading', { name: 'Change all 2 products?' })).toBeVisible();
  const lines = await warn.getByTestId('change-list').locator('li').allInnerTexts();
  expect(lines.slice(0, 2)).toEqual(['Removed: Big photo with text', 'Hidden: Photo and text 2']);
  await warn.getByRole('button', { name: 'Keep editing' }).click();
  await expect(warn).toBeHidden();
  expect(await rowsOf(prisma, S.A!)).toEqual(before);

  // save as a new layout instead: the copy stays as it is and the Move dialog opens on the new one
  await saveBar(page).getByRole('button', { name: 'Save layout' }).click();
  await warn.getByRole('button', { name: 'Save as a new layout instead' }).click();
  const nameB = uniqueName('Layout B');
  await page.getByTestId('save-as-new').locator('input').fill(nameB);
  await page.getByTestId('save-as-new').getByRole('button', { name: 'Save as a new layout' }).click();
  await page.waitForURL(new RegExp(`/admin/product-layouts/\\d+\\?from=${S.A}`));
  S.B = data.layoutFromUrl(page.url());
  await expect(page.getByTestId('move-products-dialog')).toBeVisible();
  await expect(page.getByTestId('move-products-dialog').getByRole('heading')).toHaveText(/Bring products here from/);
  expect(await rowsOf(prisma, S.A!)).toEqual(before);
  const rowsB = await rowsOf(prisma, S.B);
  expect(rowsB.some((r) => r.kind === 'overlay')).toBe(false);
  expect(rowsB.filter((r) => r.kind === 'imageText').map((r) => r.hidden)).toEqual([false, true, false]);
  await page.getByTestId('move-products-dialog').getByRole('button', { name: 'Cancel' }).click();

  // back on the copy: confirm the warning this time
  await openLayout(page, S.A!);
  await edit();
  S.rowsBeforeSharedSave = await rowsOf(prisma, S.A!);
  await saveLayout(page, 2);
  await expect(page.getByText('Saved. 2 product pages are updated.')).toBeVisible();
  const after = await rowsOf(prisma, S.A!);
  expect(after.some((r) => r.kind === 'overlay')).toBe(false);
  expect(after.filter((r) => r.kind === 'imageText')[1].hidden).toBe(true);
});

test('undo last save, then restore the original design', async ({ page }) => {
  test.setTimeout(180_000);
  await openLayout(page, S.A!);
  await page.getByTestId('layout-menu').click();
  await page.getByRole('button', { name: /^Undo last save/ }).click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Load the earlier version' }).click();
  await expect(section(page, 'overlay')).toHaveCount(1);
  await saveLayout(page, 2);
  expect(strip(await rowsOf(prisma, S.A!))).toEqual(strip(S.rowsBeforeSharedSave!));

  await page.getByTestId('layout-menu').click();
  await page.getByRole('button', { name: 'Restore the original design' }).click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Load the original design' }).click();
  await saveLayout(page, 2);
  const migrated = await rowsOf(prisma, await layoutIdOf('default'));
  expect(strip(await rowsOf(prisma, S.A!))).toEqual(strip(migrated));
  // the name is this layout's own, not the migrated layout's
  expect((await prisma.productLayout.findUniqueOrThrow({ where: { id: S.A! } })).name).toBe(nameA);
});

test('preview shows unsaved changes to the admin only', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const savedHeading = JSON.parse((await rowsOf(prisma, S.A!)).find((r) => r.kind === 'overlay')!.data).heading as string;
  const before = await rowsOf(prisma, S.A!);
  await openLayout(page, S.A!);
  const o = section(page, 'overlay');
  await editSection(o);
  const preview = `E2E preview ${data.stamp}`;
  await o.getByLabel('Heading', { exact: true }).fill(preview);
  await page.getByRole('button', { name: 'Preview changes' }).click();
  const dlg = page.getByTestId('preview-dialog');
  await expect(dlg.getByRole('radio').first()).toBeChecked();
  const [tab] = await Promise.all([page.context().waitForEvent('page'), dlg.getByRole('button', { name: 'Open the preview' }).click()]);
  await tab.waitForURL(/\/products\/[^?]+\?layoutPreview=[0-9a-f]{32}$/, { timeout: 60_000 });
  await expect(tab.locator('main h3', { hasText: preview })).toBeVisible();
  await expect(tab.getByText('Preview — not saved yet. Only you can see this.')).toBeVisible();
  expect(await rowsOf(prisma, S.A!)).toEqual(before);
  // the bar never covers the sticky site header (phone + desktop, at the top and while scrolling)
  for (const width of [390, 1440]) {
    await tab.setViewportSize({ width, height: 844 });
    for (const y of [0, 1500]) {
      await tab.evaluate((top) => window.scrollTo(0, top), y);
      await tab.waitForTimeout(150);
      const box = await tab.evaluate(() => {
        const r = (e: Element | null) => e!.getBoundingClientRect();
        const bar = r(document.querySelector('[data-testid="layout-preview-bar"]'));
        const header = r(document.querySelector('header.header'));
        return { barTop: bar.top, barBottom: bar.bottom, headerBottom: header.bottom, vh: window.innerHeight, scroll: document.documentElement.scrollWidth - window.innerWidth };
      });
      expect(box.barTop, `${width}px at ${y}`).toBeGreaterThanOrEqual(box.headerBottom);
      expect(box.barBottom, `${width}px at ${y}: bar on screen`).toBeLessThanOrEqual(box.vh + 1);
      expect(box.scroll).toBeLessThanOrEqual(1);
    }
  }

  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const ap = await anon.newPage();
  await ap.goto(tab.url());
  await expect(ap.locator('main h3', { hasText: savedHeading })).toBeVisible();
  await expect(ap.getByText(preview)).toHaveCount(0);
  await anon.close();
  await tab.close();
  await saveBar(page).getByRole('button', { name: 'Discard changes' }).click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Discard changes' }).click();
});

test('move chosen products to another layout, then undo', async ({ page }) => {
  await openLayout(page, S.A!);
  await page.getByTestId('layout-menu').click();
  await page.getByRole('button', { name: 'Move products…' }).click();
  const mv = page.getByTestId('move-products-dialog');
  const nameB = (await prisma.productLayout.findUniqueOrThrow({ where: { id: S.B! } })).name;
  // the To list never offers the From layout
  expect(await mv.getByLabel('To').locator('option').allInnerTexts()).not.toContain(nameA);
  await mv.getByLabel('To').selectOption({ label: nameB });
  await mv.getByLabel('Choose products').check();
  await mv.getByTestId('product-checklist').getByText(S.P1!.title).click();
  await mv.getByTestId('product-checklist').getByText(S.P2!.title).click();
  await mv.getByRole('button', { name: 'Move 2 products' }).click();
  const toast = page.getByTestId('move-toast');
  await expect(toast).toContainText(`Moved 2 products to “${nameB}”`);
  const keyB = await data.layoutKey(S.B!);
  expect(await prisma.product.count({ where: { id: { in: [S.P1!.id, S.P2!.id] }, layout: keyB } })).toBe(2);
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(toast).toContainText('Moved back.');
  expect(await prisma.product.count({ where: { id: { in: [S.P1!.id, S.P2!.id] }, layout: S.keyA! } })).toBe(2);

  // From = To is refused by the server too
  const res = await callAction<{ ok: boolean; error: string }>(page.request, 'moveProductsAction', [{ fromId: S.A, toId: S.A, scope: 'all' }]);
  expect(res.result).toMatchObject({ ok: false });
});

test('give this product its own layout', async ({ page }) => {
  await page.goto(`/admin/products/${S.P1!.id}`);
  await page.getByRole('button', { name: 'Give this product its own layout' }).click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Make the copy' }).click();
  await page.waitForURL(/\/admin\/product-layouts\/\d+\?own=1/);
  S.C = data.layoutFromUrl(page.url());
  await expect(page.getByText('This product now has its own layout.')).toBeVisible();
  const keyC = await data.layoutKey(S.C);
  expect((await prisma.product.findUniqueOrThrow({ where: { id: S.P1!.id } })).layout).toBe(keyC);
  expect(await usage(keyC)).toBe(1);
  expect(await usage(S.keyA!)).toBe(1);
  // "What it's for" names the product rather than repeating the source layout's purpose; plain copies start blank
  expect((await prisma.productLayout.findUniqueOrThrow({ where: { id: S.C } })).description).toBe(`Only for “${S.P1!.title}”.`);
  await expect(page.getByTestId('layout-editor')).toContainText(`Only for “${S.P1!.title}”.`);
  expect((await prisma.productLayout.findUniqueOrThrow({ where: { id: S.A! } })).description).toBe('');
});

test('product editor dropdown lists layouts by name and saves the choice', async ({ page }) => {
  const B = await prisma.productLayout.findUniqueOrThrow({ where: { id: S.B! } });
  await page.goto(`/admin/products/${S.P2!.id}`);
  const select = page.locator('#product-layout');
  expect(await select.locator('option').allInnerTexts()).toContain(B.name);
  await select.selectOption({ label: B.name });
  await saveBar(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved. The store is updated.')).toBeVisible({ timeout: 30_000 });
  expect((await prisma.product.findUniqueOrThrow({ where: { id: S.P2!.id } })).layout).toBe(B.key);
});

test('photos used only by a layout or its undo history survive the 24-hour sweep', async ({ page }) => {
  test.setTimeout(180_000);
  const u1 = await makeImage(`e2e-layout-u1-${data.stamp}`, { width: 1268, height: 1028, color: '#8a6b5c' });
  const u2 = await makeImage(`e2e-layout-u2-${data.stamp}`, { width: 1462, height: 842, color: '#5c7a8a' });
  data.uploadNames.add(`e2e-layout-u1-${data.stamp}.jpg`).add(`e2e-layout-u2-${data.stamp}.jpg`);

  // D: a new layout from scratch with one photo-and-text section
  await page.goto('/admin/product-layouts');
  await page.getByRole('button', { name: 'New layout' }).click();
  const dlg = page.getByTestId('new-layout-dialog');
  await dlg.getByLabel('Name').fill(uniqueName('Layout D'));
  await dlg.getByRole('button', { name: 'Create layout' }).click();
  await page.waitForURL(/\/admin\/product-layouts\/\d+\?created=1/);
  S.D = data.layoutFromUrl(page.url());
  expect((await rowsOf(prisma, S.D)).map((r) => r.kind)).toEqual(['recommendations']);
  await page.getByRole('button', { name: 'Add section' }).click();
  await page.getByTestId('add-section-dialog').locator('button[data-kind=imageText]').click();
  const it = section(page, 'imageText');
  await uploadInto(it.getByTestId('image-upload').first(), u1);
  await expect(it.getByTestId('image-upload').first().locator('img[src^="/uploads/"]')).toBeVisible({ timeout: 30_000 });
  await it.getByLabel('Heading', { exact: true }).fill('E2E photo one');
  await saveLayout(page);
  const url1 = JSON.parse((await rowsOf(prisma, S.D)).find((r) => r.kind === 'imageText')!.data).image as string;

  await uploadInto(it.getByTestId('image-upload').first(), u2);
  await expect(it.getByTestId('image-upload').first().locator(`img[src^="/uploads/"]:not([src="${url1}"])`)).toBeVisible({ timeout: 30_000 });
  await saveLayout(page);
  const url2 = JSON.parse((await rowsOf(prisma, S.D)).find((r) => r.kind === 'imageText')!.data).image as string;
  expect(url2).not.toBe(url1);
  const d = await prisma.productLayout.findUniqueOrThrow({ where: { id: S.D } });
  expect(d.previousVersion).toContain(url1); // url1 lives on only in the undo history

  expect(uploadRefs('referenced', [url1, url2])).toEqual({ [url1]: true, [url2]: true });
  const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await prisma.upload.updateMany({ where: { url: { in: [url1, url2] } }, data: { createdAt: old } });
  expect(uploadRefs('sweep', [url1, url2])).toEqual({ [url1]: true, [url2]: true });
  expect((await page.request.get(url1)).status()).toBe(200);
  expect((await page.request.get(url2)).status()).toBe(200);
});

test('delete rules: blocked while used, move products, delete releases its photos; the standard layout never', async ({ page }) => {
  test.setTimeout(180_000);
  const keyD = await data.layoutKey(S.D!);
  await prisma.product.update({ where: { id: S.P2!.id }, data: { layout: keyD } });
  const urls = (await rowsOf(prisma, S.D!)).flatMap((r) => r.refs.split('\n')).filter((u) => u.startsWith('/uploads/'));
  const prev = (await prisma.productLayout.findUniqueOrThrow({ where: { id: S.D! } })).previousVersion ?? '';
  const prevUrl = prev.match(/\/uploads\/[^"\\]+/)?.[0];
  expect(urls.length).toBe(1);
  expect(prevUrl).toBeTruthy();

  await openLayout(page, S.D!);
  await page.getByTestId('layout-menu').click();
  const del = page.getByRole('button', { name: /^Delete layout/ });
  await expect(del).toBeDisabled();
  await expect(del).toContainText('Used by 1 product. Move them to another layout first.');
  await page.keyboard.press('Escape');

  // deleting an in-use layout directly is refused as well
  const inUse = await callFormAction(page.request, 'deleteProductLayoutAction', { id: String(S.D) });
  expect(inUse.location).toContain(`/admin/product-layouts/${S.D}?error=in-use`);
  expect(await prisma.productLayout.count({ where: { id: S.D! } })).toBe(1);

  await openLayout(page, S.D!);
  await page.getByTestId('layout-menu').click();
  await page.getByRole('button', { name: 'Move products…' }).click();
  const mv = page.getByTestId('move-products-dialog');
  await mv.getByLabel('To').selectOption({ label: 'General furniture (standard)' });
  await mv.getByRole('button', { name: 'Move 1 product' }).click();
  await expect(page.getByTestId('move-toast')).toContainText('Moved 1 product');
  expect((await prisma.product.findUniqueOrThrow({ where: { id: S.P2!.id } })).layout).toBe('default');

  await openLayout(page, S.D!);
  await page.getByTestId('layout-menu').click();
  await page.getByRole('button', { name: 'Delete layout' }).click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete permanently' }).click();
  await page.waitForURL(/\/admin\/product-layouts\?deleted=1/);
  expect(await prisma.productLayout.count({ where: { id: S.D! } })).toBe(0);
  expect((await page.request.get(urls[0])).status()).toBe(404);
  expect((await page.request.get(prevUrl!)).status()).toBe(404);
  expect(await prisma.upload.count({ where: { url: { in: [urls[0], prevUrl!] } } })).toBe(0);

  // the standard layout: disabled in the menu, and refused when called directly
  const defId = await layoutIdOf('default');
  await openLayout(page, defId);
  await page.getByTestId('layout-menu').click();
  await expect(page.getByRole('button', { name: /^Delete layout/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^Delete layout/ })).toContainText("This is the standard layout used whenever a product has none; it can't be deleted.");
  await page.keyboard.press('Escape');
  await prisma.product.update({ where: { id: S.P2!.id }, data: { layout: S.keyA! } }); // nothing of ours on default
  const res = await callFormAction(page.request, 'deleteProductLayoutAction', { id: String(defId) });
  expect(res.location).toContain(`/admin/product-layouts/${defId}?error=protected`);
  expect(await prisma.productLayout.count({ where: { key: 'default' } })).toBe(1);
});

test('Coalesce copy: hidden legacy values, copied sections and icon texts stay byte for byte', async ({ page }) => {
  test.setTimeout(180_000);
  S.E = await copyFromList(page, data, 'Coalesce — living');
  await rename(page, uniqueName('Layout E'));
  const source = await rowsOf(prisma, await layoutIdOf('coalesce-living'));

  // only the quotes heading changes
  const t = section(page, 'testimonials');
  await editSection(t);
  await t.getByLabel('Heading', { exact: true }).fill(`E2E quotes ${data.stamp}`);
  await saveLayout(page);
  let rows = await rowsOf(prisma, S.E);
  for (const [i, r] of source.entries()) {
    if (r.kind === 'testimonials') continue;
    expect({ i, data: rows[i].data, bodyHtml: rows[i].bodyHtml, refs: rows[i].refs }).toEqual({ i, data: r.data, bodyHtml: r.bodyHtml, refs: r.refs });
  }
  const it0 = JSON.parse(rows.find((r) => r.kind === 'imageText')!.data);
  expect(it0).toMatchObject({ condensed: true, headingThin: ['comfort', ' reimagined'], ratio: 76.087 });

  // copy a photo-and-text section: same bytes, no "upload again"
  const first = source.findIndex((r) => r.kind === 'imageText');
  await sectionMenu(page, section(page, 'imageText', 0), 'Copy this section');
  await expect(page.locator('[data-testid=layout-section][data-kind=imageText]')).toHaveCount(source.filter((r) => r.kind === 'imageText').length + 1);
  await saveLayout(page);
  rows = await rowsOf(prisma, S.E);
  expect(rows[first + 1].kind).toBe('imageText');
  expect(rows[first + 1].data).toBe(source[first].data);
  expect(rows[first + 1].bodyHtml).toBe(source[first].bodyHtml);

  // edit one icon title only: every other block keeps its non-breaking spaces
  const icons = section(page, 'icons');
  await editSection(icons);
  await icons.getByTestId('icon-block').first().getByLabel('Title').fill(`E2E icon ${data.stamp}`);
  await saveLayout(page);
  const srcBlocks = JSON.parse(source.find((r) => r.kind === 'icons')!.data).blocks as { icon: string; title: string; text: string }[];
  const newBlocks = JSON.parse((await rowsOf(prisma, S.E)).find((r) => r.kind === 'icons')!.data).blocks as typeof srcBlocks;
  expect(newBlocks[0].title).toBe(`E2E icon ${data.stamp}`);
  expect(newBlocks.map((b) => b.text)).toEqual(srcBlocks.map((b) => b.text));
  expect(newBlocks.slice(1)).toEqual(srcBlocks.slice(1));
  expect(srcBlocks.some((b) => b.text.includes('\u00a0'))).toBe(true);
});

test('products from a collection: shown on the store, warning once the collection is deleted', async ({ page }) => {
  test.setTimeout(180_000);
  const P3 = await data.product('p3', 'default');
  const coll = await data.collection('featured', [P3.id]);
  const keyE = await data.layoutKey(S.E!);
  await prisma.product.update({ where: { id: S.P1!.id }, data: { layout: keyE } });

  await openLayout(page, S.E!);
  await page.getByRole('button', { name: 'Add section' }).click();
  await page.getByTestId('add-section-dialog').locator('button[data-kind=featuredCollection]').click();
  const f = section(page, 'featuredCollection');
  const heading = `E2E featured ${data.stamp}`;
  await f.getByLabel('Heading', { exact: true }).fill(heading);
  await f.getByTestId('collection-picker').getByRole('button').first().click();
  const pop = page.getByTestId('collection-picker-popover');
  await pop.getByRole('searchbox').fill(coll.title);
  await pop.getByTestId('collection-result').filter({ hasText: coll.title }).click();
  await expect(f.getByTestId('collection-picker-value')).toHaveText(`Collection · ${coll.title}`);
  await saveLayout(page);
  expect((await rowsOf(prisma, S.E!)).find((r) => r.kind === 'featuredCollection')!.collectionId).toBe(coll.id);

  await page.goto(`/products/${S.P1!.handle}`);
  const row = page.locator('main h2', { hasText: heading });
  await expect(row).toBeVisible();
  await expect(page.locator('main').getByText(P3.title).first()).toBeVisible();

  // delete the collection the owner's way
  await page.goto(`/admin/collections/${coll.id}`);
  await page.getByTestId('confirm-delete').first().click();
  await expect(page.getByTestId('confirm-dialog')).toContainText('Products from a collection');
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete permanently' }).click();
  await page.waitForURL(/\/admin\/collections(\?|$)/);
  data.collectionIds.delete(coll.id);

  await page.goto(`/products/${S.P1!.handle}`);
  await expect(page.locator('main h3').first()).toBeVisible();
  await expect(page.getByText(heading)).toHaveCount(0);
  await openLayout(page, S.E!);
  await expect(section(page, 'featuredCollection').getByText('⚠ Collection was deleted')).toBeVisible();
  await editSection(section(page, 'featuredCollection'));
  await expect(section(page, 'featuredCollection').getByTestId('collection-picker-value')).toHaveText('The collection was deleted — pick another');
});

test('validation: highlighted section, nothing saved; server limits and friendly name clash', async ({ page }) => {
  test.setTimeout(180_000);
  const before = await rowsOf(prisma, S.A!);
  await openLayout(page, S.A!);
  const o = section(page, 'overlay');
  await editSection(o);
  await o.getByLabel('Heading', { exact: true }).fill('');
  await clickSave(page, await usage(S.keyA!));
  await expect(saveBar(page)).toContainText('Please fix the highlighted sections.');
  await expect(o.getByText('⚠ Fix this')).toBeVisible();
  await expect(o.getByRole('alert').first()).toContainText('Fix this:');
  expect(await rowsOf(prisma, S.A!)).toEqual(before);

  const refused = async (mutate: (d: LayoutDraft) => void, message?: string | RegExp) => {
    const r = await directSave(page, S.A!, mutate);
    expect(r.result?.ok, JSON.stringify(r.result)).toBe(false);
    if (message) expect(r.result!.error).toMatch(message);
    return r.result!;
  };
  const extra = (kind: string, values: unknown, n = 1) => (d: LayoutDraft) => {
    for (let i = 0; i < n; i++) d.sections.push({ key: `x-${kind}-${i}`, kind, base: { from: 'new' }, hidden: false, bodyHtml: '', values } as never);
  };
  const cushions = (await prisma.collection.findUniqueOrThrow({ where: { handle: 'cushions' } })).id;
  await refused(extra('recommendations', {}), 'A layout can have only one “You may also like” section.');
  await refused(extra('reviews', {}), /only one “Customer reviews[^”]*” section/);
  await refused(extra('icons', { blocks: [{ key: 'b', icon: 'warranty', title: 'x', text: 'y' }] }, 20 - before.length + 1), 'A layout can have up to 20 sections.');
  await refused(extra('featuredCollection', { heading: 'x', collectionId: cushions, limit: 8 }, 5), 'A layout can have up to 4 “Products from a collection” sections.');
  await refused(extra('icons', { blocks: Array.from({ length: 9 }, (_, i) => ({ key: `b${i}`, icon: 'warranty', title: 't', text: 'x' })) }), 'An icons row can have up to 8 icons.');
  await refused(extra('testimonials', { subheading: '', heading: 'h', size: 'text-small', items: Array.from({ length: 21 }, (_, i) => ({ key: `q${i}`, quote: 'q', author: 'a' })) }), 'Customer quotes can have up to 20 quotes.');
  await refused(extra('slideshow', { slides: Array.from({ length: 7 }, (_, i) => ({ key: `s${i}`, desktop: '/images/pdp/Living.jpg', mobile: '' })) }), 'A slideshow can have up to 6 slides.');
  expect(await rowsOf(prisma, S.A!)).toEqual(before);

  // another layout's name, in different capitals
  const nameB = (await prisma.productLayout.findUniqueOrThrow({ where: { id: S.B! } })).name;
  const clash = await refused((d) => (d.name = nameB.toUpperCase()));
  expect(clash.error).toBe(`Another layout is already called “${nameB.toUpperCase()}”.`);
});

test('sanitising: scripts are stripped from text, javascript: buttons refused', async ({ page }) => {
  const r = await directSave(page, S.A!, (d) => {
    const o = d.sections.find((s) => s.kind === 'overlay')!;
    o.bodyHtml = '<p>Clean <strong>text</strong><script>alert(1)</script><img src="x" onerror="alert(1)"></p>';
  });
  expect(r.result?.ok, JSON.stringify(r.result)).toBe(true);
  const body = (await rowsOf(prisma, S.A!)).find((x) => x.kind === 'overlay')!.bodyHtml;
  expect(body).toContain('<strong>text</strong>');
  expect(body).not.toMatch(/script|onerror|<img/i);

  const bad = await directSave(page, S.A!, (d) => {
    const it = d.sections.find((s) => s.kind === 'imageText')!;
    (it.values as { button: unknown }).button = { label: 'Click', href: 'javascript:alert(1)' };
  });
  expect(bad.result?.ok).toBe(false);
  expect((await rowsOf(prisma, S.A!)).map((x) => x.data).join('')).not.toContain('javascript:');
});

test('stale: a save in another tab (also a reorder-only save) makes this one stale', async ({ page }) => {
  test.setTimeout(180_000);
  const other = await page.context().newPage();
  other.on('dialog', (d) => void d.accept());
  await openLayout(page, S.A!);
  await openLayout(other, S.A!);

  const o1 = section(other, 'overlay');
  await editSection(o1);
  await o1.getByLabel('Heading', { exact: true }).fill(`E2E tab two ${data.stamp}`);
  const n = await usage(S.keyA!);
  await saveLayout(other, n);

  const o = section(page, 'overlay');
  await editSection(o);
  await o.getByLabel('Heading', { exact: true }).fill(`E2E tab one ${data.stamp}`);
  await clickSave(page, n);
  await expect(saveBar(page)).toContainText('Someone else saved this layout a moment ago.');
  await expect(saveBar(page).getByRole('button', { name: /Save as a new layout instead|Save as new/ })).toBeVisible();
  await expect(saveBar(page).getByRole('button', { name: /^Reload/ })).toBeVisible();

  // reorder only
  await openLayout(page, S.A!);
  await openLayout(other, S.A!);
  await section(other, 'overlay').getByRole('button', { name: 'Move down' }).click();
  await saveLayout(other, n);
  await section(page, 'reviews').getByRole('switch', { name: 'Show on the store' }).click();
  await clickSave(page, n);
  await expect(saveBar(page)).toContainText('Someone else saved this layout a moment ago.');
  expect((await rowsOf(prisma, S.A!)).find((r) => r.kind === 'reviews')!.hidden).toBe(false);
  await other.close();
});

test('moving products: malformed layout ids are refused, nothing moves', async ({ page }) => {
  await openLayout(page, S.A!);
  const before = await prisma.product.findMany({ where: { layout: { in: [S.keyA!, 'default'] } }, select: { id: true, layout: true }, orderBy: { id: 'asc' } });
  // ids next to the test layout, so a regression only touches test data
  for (const [fromId, toId] of [
    [S.A! + 0.5, S.B],
    ['abc', S.B],
    [S.A, String(S.B)],
    [S.A, -1],
  ] as const) {
    const r = await callAction<{ ok: boolean; error?: string }>(page.request, 'moveProductsAction', [{ fromId, toId, scope: 'all' }]);
    expect(r.status, `${fromId} → ${toId}`).toBe(200);
    expect(r.result?.ok, `${fromId} → ${toId}`).toBe(false);
    expect(r.result?.error).toBeTruthy();
  }
  expect(await prisma.product.findMany({ where: { layout: { in: [S.keyA!, 'default'] } }, select: { id: true, layout: true }, orderBy: { id: 'asc' } })).toEqual(before);
  for (const input of [{ layoutId: S.A! + 0.5 }, { layoutId: 'abc' }, { layoutId: S.A, collectionId: 1.5 }, { layoutId: S.A, skip: 2.5, take: 3.7 }]) {
    const r = await callAction<{ items: unknown[]; total: number }>(page.request, 'searchProductsForMoveAction', [input]);
    expect(r.status, JSON.stringify(input)).toBe(200);
    if ('skip' in input) expect(r.result?.total).toBe(await usage(S.keyA!));
    else expect(r.result?.total, JSON.stringify(input)).toBe(0);
  }
});

test('names that look blank are refused', async ({ page }) => {
  await openLayout(page, S.A!);
  for (const name of ['\u200B', '\u00A0\u00A0', ' \uFEFF\u2060 ', '\u3000']) {
    const r = await directSave(page, S.A!, (d) => {
      d.name = name;
    });
    expect(r.result, JSON.stringify(name)).toMatchObject({ ok: false, field: 'name', error: 'Please give the layout a name.' });
  }
  expect((await prisma.productLayout.findUniqueOrThrow({ where: { id: S.A! } })).name).not.toMatch(/^[\s\u200B]*$/);
});

test('a delete racing a move onto the same layout never leaves products on a deleted layout', async ({ page }) => {
  test.setTimeout(180_000);
  await openLayout(page, S.A!);
  await prisma.product.update({ where: { id: S.P2!.id }, data: { layout: S.keyA! } });
  for (let i = 0; i < 12; i++) {
    const made = await callAction<{ ok: boolean; id: number }>(page.request, 'createProductLayoutAction', [{ name: uniqueName(`Race ${i}`), fromLayoutId: null }]);
    expect(made.result?.ok).toBe(true);
    const X = made.result!.id;
    data.layoutIds.add(X);
    const [del, move] = await Promise.all([
      callFormAction(page.request, 'deleteProductLayoutAction', { id: String(X) }),
      callAction<{ ok: boolean; count?: number }>(page.request, 'moveProductsAction', [{ fromId: S.A, toId: X, scope: 'chosen', productIds: [S.P2!.id] }]),
    ]);
    const layout = (await prisma.product.findUniqueOrThrow({ where: { id: S.P2!.id } })).layout;
    const exists = await prisma.productLayout.count({ where: { key: layout } });
    expect(exists, `round ${i}: delete → ${del.location}, move → ${JSON.stringify(move.result)}`).toBe(1);
    // exactly one of the two won: either the move (delete refused) or the delete (move refused)
    if (move.result?.ok) expect(del.location).toContain('error=in-use');
    else expect(del.location).toContain('deleted=1');
    await prisma.product.update({ where: { id: S.P2!.id }, data: { layout: S.keyA! } });
    await prisma.productLayout.deleteMany({ where: { id: X } });
  }
});

test('removing a quote or icon can be undone; a photo preview leaves the settings in view', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLayout(page, S.A!);
  const tm = section(page, 'testimonials');
  await editSection(tm);
  const quotes = tm.getByTestId('quote-item');
  const n = await quotes.count();
  expect(n).toBeGreaterThan(2);
  const second = await quotes.nth(1).locator('textarea').inputValue();
  await quotes.nth(1).getByRole('button', { name: 'Remove quote 2' }).click();
  await expect(quotes).toHaveCount(n - 1);
  await expect(tm.getByTestId('undo-remove')).toContainText('Quote 2 removed.');
  await tm.getByTestId('undo-remove').getByRole('button', { name: 'Undo' }).click();
  await expect(quotes).toHaveCount(n);
  await expect(quotes.nth(1).locator('textarea')).toHaveValue(second);
  await expect(tm.getByTestId('undo-remove')).toHaveCount(0);

  const it = section(page, 'imageText', 0);
  await editSection(it);
  const box = await it.getByTestId('image-upload-preview').boundingBox();
  expect(box!.height).toBeLessThanOrEqual(341);
  // nothing was changed in the end: the page is not left with unsaved edits
  await page.goto('/admin/product-layouts');
});

test('signed out: every layout action refuses', async ({ page }) => {
  await openLayout(page, S.A!); // makes sure every action is compiled
  const anon = await pwRequest.newContext({ baseURL: BASE, storageState: { cookies: [], origins: [] } });
  const { updatedAt, draft } = await draftFromDb(prisma, S.A!);
  const calls: [string, unknown[]][] = [
    ['saveProductLayoutAction', [{ layoutId: S.A, updatedAt, draft }]],
    ['saveAsNewLayoutAction', [{ sourceLayoutId: S.A, name: 'E2E signed out', draft }]],
    ['createLayoutPreviewAction', [{ layoutId: S.A, draft, productId: S.P2!.id }]],
    ['createProductLayoutAction', [{ name: 'E2E signed out', fromLayoutId: null }]],
    ['duplicateProductLayoutAction', [S.A]],
    ['makeLayoutForProductAction', [{ productId: S.P2!.id }]],
    ['layoutUsageAction', [S.A]],
    ['searchProductsForMoveAction', [{ q: '' }]],
    ['moveProductsAction', [{ fromId: S.A, toId: S.B, scope: 'all' }]],
    ['undoMoveProductsAction', [{ movedIds: [S.P2!.id], fromKey: 'default', toKey: S.keyA }]],
  ];
  const layoutsBefore = await prisma.productLayout.count();
  for (const [name, args] of calls) {
    const r = await callAction(anon, name, args);
    expect(r.redirect, name).toMatch(/^\/admin\/login/);
    expect(r.status, name).toBe(303);
  }
  const s = await callAction(anon, 'searchCollectionsAction', ['cush'], { filename: 'app/admin/actions/collections.ts' });
  expect(s.redirect).toMatch(/^\/admin\/login/);
  const del = await callFormAction(anon, 'deleteProductLayoutAction', { id: String(S.B) });
  expect(del.location ?? '').toMatch(/\/admin\/login/);
  await anon.dispose();
  expect(await prisma.productLayout.count()).toBe(layoutsBefore);
  expect((await prisma.product.findUniqueOrThrow({ where: { id: S.P2!.id } })).layout).toBe(S.keyA);
});

test('long text fits a 360px phone', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await openLayout(page, S.A!);
  const dup = await callAction<{ ok: boolean; id: number }>(page.request, 'duplicateProductLayoutAction', [S.A]);
  expect(dup.result?.ok).toBe(true);
  const F = dup.result!.id;
  data.layoutIds.add(F);
  const longHeading = 'Extra large heading that keeps going and going to reach eighty characters total!'.slice(0, 80);
  const word = 'x'.repeat(60);
  const text = `<p>${'Long text for the overlay section. '.repeat(20).slice(0, 600).trim()}</p>`;
  const r = await directSave(page, F, (d) => {
    d.name = uniqueName('Layout F');
    const o = d.sections.find((s) => s.kind === 'overlay')!;
    Object.assign(o.values, { heading: longHeading, headingClass: 'h2' });
    o.bodyHtml = text;
    d.sections.push({ key: 'x-icons', kind: 'icons', base: { from: 'new' }, hidden: false, bodyHtml: '', values: { blocks: [{ key: 'b0', icon: 'warranty', title: 'Long', text: `Unbroken ${word}` }] } } as never);
    for (const s of d.sections) if (s.kind === 'testimonials') s.hidden = false;
    // one unbroken run in the photo-with-text body must wrap, not scroll the page sideways
    const it = d.sections.find((s) => s.kind === 'imageText')!;
    it.bodyHtml = `<p>${'B'.repeat(300)}</p>`;
    it.hidden = false;
  });
  expect(r.result?.ok, JSON.stringify(r.result)).toBe(true);
  const P4 = await data.product('p4', await data.layoutKey(F));

  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/products/${P4.handle}`);
  const h = p.locator('main h3', { hasText: longHeading.slice(0, 30) });
  await expect(h).toBeVisible();
  await expect(p.getByText(word)).toBeAttached();
  const m = await p.evaluate(() => {
    const doc = document.documentElement;
    const h3 = [...document.querySelectorAll('main h3')].find((e) => e.textContent?.startsWith('Extra large heading')) as HTMLElement;
    const band = h3.closest('div.relative.mt-\\[30px\\]') as HTMLElement;
    const inner = h3.parentElement as HTMLElement;
    return {
      scroll: doc.scrollWidth - window.innerWidth,
      h3Overflow: h3.scrollWidth - h3.clientWidth,
      bandBottom: band.getBoundingClientRect().bottom,
      textBottom: inner.getBoundingClientRect().bottom,
      bandRight: band.getBoundingClientRect().right,
    };
  });
  expect(m.scroll).toBeLessThanOrEqual(1);
  expect(m.h3Overflow).toBeLessThanOrEqual(1);
  const bodyRight = await p.evaluate(() => [...document.querySelectorAll('main p')].find((e) => e.textContent?.startsWith('BBBB'))!.getBoundingClientRect().right);
  expect(bodyRight).toBeLessThanOrEqual(361);
  expect(m.textBottom).toBeLessThanOrEqual(m.bandBottom + 1);
  expect(m.bandRight).toBeLessThanOrEqual(361);
  await ctx.close();
});
