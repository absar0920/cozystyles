import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, type Response } from '@playwright/test';
import type { Ctx, Section } from '../context';
import { PRODUCTS, type ProductData } from '../data';
import { chooseFiles, expectImagesLoaded, gotoPage, type FieldRow, type Guide } from '../guide';

/**
 * Section 3: every product in data.ts is created through Products → + New product. The Antonin Sofa is shown in full
 * (options, colour circles, a price per combination, photos tagged by colour, collections, publish); the others get
 * one form table each. The Antonin Sofa and the Alexa Sofa Chair are ticked Best seller (Hot Selling Products on the
 * home page; section 8 checks that row). Then: a draft that the store does not show, Duplicate + Delete, the products
 * list, and a light look at the store (section 8 checks the store in detail).
 */

const SAVED = 'Saved. The store is updated.';
const SAVED_DRAFT = 'Saved as a draft. It is not on the store.';
const BEST_SELLER_HINT = 'Puts the product in Hot Selling Products on the home page';
const COPY_NOTICE = 'This is a copy. It is a draft until you publish it.';
const DRAFT_BAR = 'Draft — not visible on the store';

function productData(title: string): ProductData {
  const p = PRODUCTS.find((x) => x.title === title);
  if (!p) throw new Error(`walkthrough/data.ts has no product "${title}"`);
  return p;
}
const ANTONIN = productData('Antonin Sofa');
const ALEXA = productData('Alexa Sofa Chair');
const COPY_TITLE = `${ALEXA.title} (copy)`;

/* ------------------------------------------------------------------ small helpers */

const combo = (values: string[]) => values.join(' / ');
const rs = (amount: string) => `Rs.${Number(amount).toLocaleString('en-US')}`;
const code = (s: string) => '`' + s + '`';
/** The upload keeps the photo's file name: public/…/antonin-sofa-1.jpg → /uploads/…/antonin-sofa-1-<8 hex>.webp */
const uploadedAs = (file: string) =>
  new RegExp(
    path
      .basename(file)
      .replace(/\.[^.]*$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-[0-9a-f]{8}\\.webp',
  );
const rgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const site = (ctx: Ctx, urlPath: string) => new URL(urlPath, ctx.baseURL).toString();

const saveBar = (page: Page) => page.getByTestId('save-bar');
const leftMenuProducts = (page: Page) => page.getByRole('navigation').getByRole('link', { name: 'Products', exact: true });
const productsHeading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Products', exact: true });
/** Table rows of the products list (the phone cards share the test id but are hidden on a computer screen). */
const listRows = (page: Page) => page.locator('tr[data-testid="product-row"]');
const listRow = (page: Page, title: string) => listRows(page).filter({ has: page.getByRole('link', { name: title, exact: true }) });
const descriptionBox = (page: Page) => page.getByRole('textbox', { name: 'Description', exact: true });
const galleryItems = (page: Page) => page.getByTestId('image-gallery').getByTestId('gallery-item');
const bestSellerBox = (page: Page) => page.getByRole('checkbox', { name: /^Best seller/ });
const newArrivalBox = (page: Page) => page.getByRole('checkbox', { name: /^New arrival/ });
const limitedBox = (page: Page) => page.getByRole('checkbox', { name: /^Limited edition/ });

/** Shot of one tall part of the editor: the bottom save bar is fixed and would cover the middle of it, so it is hidden meanwhile. */
async function sectionShot(g: Guide, page: Page, caption: string, cardId: string) {
  const bar = saveBar(page);
  await bar.evaluate((el: HTMLElement) => (el.style.visibility = 'hidden')).catch(() => {});
  try {
    await g.shot(page, caption, { clip: page.locator(`section#${cardId}`) });
  } finally {
    await bar.evaluate((el: HTMLElement) => (el.style.visibility = '')).catch(() => {});
  }
}

/* ------------------------------------------------------------------ editor pieces (rows for g.form) */

async function openNewProduct(g: Guide, page: Page, first: boolean) {
  if (first) {
    await g.click(leftMenuProducts(page), 'In the left menu, click **Products**.');
    await expect(productsHeading(page)).toBeVisible();
    await g.click(page.getByRole('link', { name: '+ New product' }), 'Click **+ New product** (top right).');
  } else {
    g.step('Click **← Products** at the top left of the page, then **+ New product**.');
    await page.getByRole('link', { name: '← Products' }).click();
    await expect(productsHeading(page)).toBeVisible();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.getByRole('link', { name: '+ New product' }).click();
  }
  // On a slow server a navigation still in flight can land after the form opened (seen on staging):
  // make sure the New product form is open and stays open before typing.
  const newHeading = page.getByRole('heading', { level: 1, name: 'New product', exact: true });
  for (let attempt = 1; ; attempt++) {
    await expect(newHeading).toBeVisible();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1_000);
    if (await newHeading.isVisible()) break;
    if (attempt >= 3) await expect(newHeading).toBeVisible();
    await gotoPage(page, '/admin/products');
    await page.getByRole('link', { name: '+ New product' }).click();
  }
  await expect(page.getByTestId('product-status')).toHaveText('Not saved yet');
}

function basicsRows(page: Page, p: ProductData): FieldRow[] {
  return [
    { label: 'Title', value: p.title, locator: page.locator('#product-title') },
    { label: 'Delivery time (optional)', value: p.delivery ?? '', locator: page.locator('#product-delivery') },
  ];
}

async function uploadPhotos(page: Page, photos: string[]) {
  await chooseFiles(page.getByTestId('image-gallery').getByRole('button', { name: 'Upload photos' }), photos);
  await expect(galleryItems(page)).toHaveCount(photos.length, { timeout: 90_000 });
}

function photoRow(page: Page, p: ProductData): FieldRow {
  return { label: 'Photos', value: p.photos, kind: 'upload', button: 'Upload photos', act: () => uploadPhotos(page, p.photos) };
}

/** One row per photo: what it "Shows" (only offered once the product has options). */
function tagRows(page: Page, p: ProductData): FieldRow[] {
  return p.photos.map((file, i) => {
    const tag = p.photoTags?.[i];
    const label = `Photo ${i + 1} (${path.basename(file)}): **Shows**`;
    return tag
      ? { label, value: tag, kind: 'select' as const, locator: galleryItems(page).nth(i).getByTestId('gallery-tag-select') }
      : { label, value: 'Any option (always shown)', kind: 'none' as const };
  });
}

function descriptionRow(page: Page, p: ProductData): FieldRow {
  return { label: 'Description', value: p.description, kind: 'type', locator: descriptionBox(page) };
}

async function addOptionValues(page: Page, option: string, values: string[]) {
  for (const v of values) {
    const input = page.getByLabel(`Add a value to ${option}`, { exact: true });
    await input.fill(v);
    await input.press('Enter');
    await expect(page.getByTestId('option-value').getByRole('button', { name: v, exact: true })).toHaveCount(1);
  }
}

function optionRows(page: Page, options: NonNullable<ProductData['options']>): FieldRow[] {
  const rows: FieldRow[] = [
    {
      label: 'This product has options like size or colour',
      value: 'switch it **on**',
      kind: 'click',
      locator: page.getByRole('switch', { name: 'This product has options like size or colour' }),
    },
  ];
  options.forEach((o, i) => {
    if (i > 0) rows.push({ label: '+ Add another option', value: 'click it', kind: 'click', locator: page.getByRole('button', { name: '+ Add another option' }) });
    rows.push({
      label: i === 0 ? 'Option name' : 'Option name (in the new box)',
      value: o.name,
      act: () => page.getByTestId('option-card').last().getByLabel('Option name').fill(o.name),
    });
    rows.push({ label: `Values of ${o.name} (press **Enter** after each one)`, value: o.values, kind: 'type', act: () => addOptionValues(page, o.name, o.values) });
  });
  return rows;
}

async function expectCombinations(g: Guide, page: Page, p: ProductData) {
  const variants = p.variants ?? [];
  await expect(page.getByTestId('variant-row')).toHaveCount(variants.length);
  await expect(page.getByTestId('variant-label')).toHaveText(variants.map((v) => combo(v.values)));
  g.expect(`A table of ${variants.length} combinations appears: ${variants.map((v) => `**${combo(v.values)}**`).join(', ')}.`);
}

async function fillCombinations(g: Guide, page: Page, p: ProductData) {
  const variants = p.variants ?? [];
  g.step('In the combinations table, type the prices and choose the status of each row exactly as follows:');
  g.table(
    ['Combination', 'Regular price (Rs.)', 'Sale price (Rs.)', 'Status'],
    variants.map((v) => [`**${combo(v.values)}**`, code(v.regular), v.sale ? code(v.sale) : '_(leave empty)_', v.status]),
  );
  for (const v of variants) {
    const c = combo(v.values);
    await page.getByLabel(`Regular price for ${c}`, { exact: true }).fill(v.regular);
    if (v.sale) await page.getByLabel(`Sale price for ${c}`, { exact: true }).fill(v.sale);
    await page.getByLabel(`Status for ${c}`, { exact: true }).selectOption({ label: v.status });
  }
  for (const v of variants) {
    const c = combo(v.values);
    await expect(page.getByLabel(`Regular price for ${c}`, { exact: true })).toHaveValue(v.regular);
    await expect(page.getByLabel(`Sale price for ${c}`, { exact: true })).toHaveValue(v.sale ?? '');
    await expect(page.getByLabel(`Status for ${c}`, { exact: true }).locator('option:checked')).toHaveText(v.status);
  }
}

/** Products without options: one Regular price, Sale price and Status. */
function priceRows(page: Page, p: ProductData): FieldRow[] {
  return [
    { label: 'Regular price (Rs.)', value: p.regular ?? '', locator: page.getByLabel('Regular price', { exact: true }) },
    { label: 'Sale price (Rs.)', value: p.sale ?? '', locator: page.getByLabel('Sale price', { exact: true }) },
    { label: 'Status', value: p.status ?? 'Ready to ship', kind: 'select', locator: page.getByRole('combobox', { name: 'Status', exact: true }) },
  ];
}

async function expectSinglePrice(page: Page, p: ProductData) {
  await expect(page.getByLabel('Regular price', { exact: true })).toHaveValue(p.regular ?? '');
  await expect(page.getByLabel('Sale price', { exact: true })).toHaveValue(p.sale ?? '');
  await expect(page.getByRole('combobox', { name: 'Status', exact: true }).locator('option:checked')).toHaveText(p.status ?? 'Ready to ship');
}

function collectionRows(page: Page, names: string[]): FieldRow[] {
  return names.map((name) => ({
    label: 'Collections',
    value: `type ${code(name)} in **Search collections…**, then tick **${name}**`,
    kind: 'click' as const,
    act: async () => {
      const search = page.getByPlaceholder('Search collections…');
      await search.fill(name);
      await page.getByRole('group', { name: 'Collections' }).getByRole('checkbox', { name, exact: true }).check();
      await search.fill('');
    },
  }));
}

function labelRows(page: Page, p: ProductData): FieldRow[] {
  const rows: FieldRow[] = [];
  if (p.bestSeller) rows.push({ label: 'Best seller (in Visibility)', value: '', kind: 'check', locator: bestSellerBox(page) });
  if (p.newArrival) rows.push({ label: 'New arrival (in Visibility)', value: '', kind: 'check', locator: newArrivalBox(page) });
  if (p.limitedEdition) rows.push({ label: 'Limited edition (in Visibility)', value: '', kind: 'check', locator: limitedBox(page) });
  return rows;
}

async function expectPhotos(page: Page, p: ProductData) {
  const items = galleryItems(page);
  await expect(items).toHaveCount(p.photos.length);
  for (let i = 0; i < p.photos.length; i++) await expect(items.nth(i).locator('img')).toHaveAttribute('src', uploadedAs(p.photos[i]));
  await expect(items.first()).toContainText('Main photo');
  await expectImagesLoaded(page, '[data-testid="gallery-item"] img');
  for (const [i, tag] of Object.entries(p.photoTags ?? {})) {
    await expect(items.nth(Number(i)).getByTestId('gallery-tag-select').locator('option:checked')).toHaveText(tag);
  }
}

async function expectCollectionsAndLabels(page: Page, p: ProductData) {
  const chosen = page.locator('[aria-label="Chosen collections"]');
  for (const c of p.collections) await expect(chosen.getByRole('button', { name: `Remove ${c}`, exact: true })).toBeVisible();
  await expect(bestSellerBox(page)).toBeChecked({ checked: !!p.bestSeller });
  await expect(newArrivalBox(page)).toBeChecked({ checked: !!p.newArrival });
  await expect(limitedBox(page)).toBeChecked({ checked: !!p.limitedEdition });
}

/** Publish (or Save as draft) and check the editor says so. */
async function save(g: Guide, page: Page, p: ProductData, brief: boolean) {
  const button = p.draft ? 'Save as draft' : 'Publish';
  await g.click(saveBar(page).getByRole('button', { name: button, exact: true }), `In the bar at the bottom of the screen, click **${button}**.`);
  // a new product moves to its own address once saved
  await page.waitForURL(/\/admin\/products\/\d+/, { timeout: 30_000 });
  await expect(page.getByText(p.draft ? SAVED_DRAFT : SAVED)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(p.draft ? SAVED : SAVED_DRAFT)).toHaveCount(0);
  await expect(page.getByTestId('product-status')).toHaveText(p.draft ? 'Draft' : 'Published');
  await expect(saveBar(page)).not.toContainText('Unsaved changes');
  await expect(page.locator('#product-title')).toHaveValue(p.title);
  if (p.draft) {
    await expect(page.getByText('Publish to see it on the store')).toBeVisible();
    await expect(saveBar(page)).toContainText(DRAFT_BAR);
    g.expect(
      `The message **${SAVED_DRAFT}** appears at the top, the label next to the title reads **Draft**, where published products have **View on store** the page shows **Publish to see it on the store**, and the bottom bar says **${DRAFT_BAR}**.`,
    );
  } else {
    await expect(page.getByRole('link', { name: 'View on store' })).toHaveAttribute('href', `/products/${p.handle}`);
    g.expect(
      brief
        ? `**${SAVED}** appears, the label reads **Published**, and **View on store** opens ${code(`/products/${p.handle}`)}.`
        : `The message **${SAVED}** appears at the top, the label next to the title changes to **Published**, and the **View on store** button opens the product's page, ${code(`/products/${p.handle}`)}.`,
    );
  }
}

/** Shorter walk-through for one product: one form table (plus the combinations table when it has options). */
async function addProduct(ctx: Ctx, p: ProductData) {
  const { guide: g, admin: page } = ctx;
  g.text(`**${p.title}**${p.draft ? ' (kept as a draft)' : ''}`);
  await openNewProduct(g, page, false);
  const top = [...basicsRows(page, p), photoRow(page, p), descriptionRow(page, p)];
  const bottom = [...collectionRows(page, p.collections), ...labelRows(page, p)];
  if (p.options?.length) {
    await g.form([...top, ...optionRows(page, p.options)]);
    await expectCombinations(g, page, p);
    await fillCombinations(g, page, p);
    if (p.photoTags) await g.form(tagRows(page, p), 'Under each photo, choose what it **Shows**:');
    await g.form(bottom, 'Then:');
  } else {
    await g.form([...top, ...priceRows(page, p), ...bottom]);
    await expectSinglePrice(page, p);
  }
  await expectPhotos(page, p);
  await expect(descriptionBox(page)).toContainText(p.description);
  await expectCollectionsAndLabels(page, p);
  await save(g, page, p, !p.draft);
}

function summaryRows(): string[][] {
  const price = (regular: string, sale?: string) => (sale ? `${rs(regular)} → **${rs(sale)}**` : rs(regular));
  return PRODUCTS.map((p) => [
    `**${p.title}**`,
    p.variants
      ? p.variants.map((v) => `${combo(v.values)}: ${price(v.regular, v.sale)} · ${v.status}`).join('\n')
      : `${price(p.regular ?? '0', p.sale)} · ${p.status ?? 'Ready to ship'}`,
    p.collections.join(', '),
    String(p.photos.length),
    [p.bestSeller && 'Best seller', p.newArrival && 'New arrival', p.limitedEdition && 'Limited edition'].filter(Boolean).join(', ') || '—',
    p.draft ? 'Draft' : 'Published',
  ]);
}

/**
 * Re-runs only (WALK_FROM / WALK_ONLY on a database that already has them): delete products this section creates,
 * through the list's Delete buttons, so the names and web addresses come out the same. Nothing happens on a fresh run.
 */
async function removeLeftovers(g: Guide, page: Page) {
  const removed: string[] = [];
  for (const title of [...PRODUCTS.map((p) => p.title), COPY_TITLE]) {
    const search = `/admin/products?q=${encodeURIComponent(title)}`;
    await gotoPage(page, search);
    for (let n = await listRow(page, title).count(); n > 0; n--) {
      await listRow(page, title).first().getByRole('button', { name: `Delete ${title}`, exact: true }).click();
      await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete permanently' }).click();
      await page.waitForURL(/\/admin\/products\?deleted=1/);
      removed.push(title);
      await gotoPage(page, search);
    }
  }
  await gotoPage(page, '/admin');
  if (removed.length) g.note(`Before starting, products left over from an earlier, interrupted test run were deleted: ${removed.join(', ')}.`);
}

/* ------------------------------------------------------------------ parts */

async function addAntonin(ctx: Ctx) {
  const { guide: g, admin: page } = ctx;
  const p = ANTONIN;
  const options = p.options ?? [];
  const variants = p.variants ?? [];
  g.part(
    '3.1 Antonin Sofa: a product with sizes and colours',
    `The **${p.title}** comes as a 3 or 2 seater in grey or beige: ${variants.length} combinations, each with its own price and status. Its photos are tagged by colour, so the store shows the grey photo when a customer picks Grey.`,
  );

  await openNewProduct(g, page, true);
  let readme = '';
  try {
    readme = readFileSync(path.resolve(__dirname, '../../README.md'), 'utf8');
  } catch {
    /* no README: nothing to compare */
  }
  if (readme) {
    // the owner guide names the same button as the screen
    expect(readme, 'README → Adding a product').toContain('Products → + New product');
    expect(readme, 'README → Adding a product').not.toContain('Products → Add product');
  }
  g.expect(
    'The **New product** form opens; the label next to its title reads **Not saved yet**. (The owner guide in the README, _Adding a product_, names the same button: **Products → + New product**.)',
  );

  await g.form(basicsRows(page, p), 'In **Basics**, fill in:');
  await expect(page.locator('#product-title')).toHaveValue(p.title);
  await expect(page.locator('#product-delivery')).toHaveValue(p.delivery ?? '');

  // options first: the photos' "Shows" choices list the option values
  await g.form(optionRows(page, options), 'Scroll down to **Options & prices** and set up the options first (the photos can then be tagged with a colour):');
  await expectCombinations(g, page, p);
  // Adding a second value copies the first value's prices into the new combinations, and the editor says so.
  const last = options[options.length - 1];
  if (last && last.values.length > 1) {
    const [firstValue, lastValue] = [last.values[0], last.values[last.values.length - 1]];
    const copied = page.getByTestId('option-card').last().getByText(`copied the prices and status of “${firstValue}”`);
    await expect(copied).toBeVisible();
    await expect(copied).toContainText(`for “${lastValue}”`);
    g.note(
      `A yellow message says the new combinations for **${lastValue}** _copied the prices and status of “${firstValue}”_. That is expected: no prices are typed yet, and you enter every one of them a few steps below.`,
    );
  }

  // colour circles (swatches)
  const colour = options.find((o) => o.swatches);
  const swatches = Object.entries(colour?.swatches ?? {});
  for (let i = 0; i < swatches.length; i++) {
    const [value, hex] = swatches[i];
    g.step(
      i === 0
        ? `In the **${colour?.name}** box every value has a colour circle. Click the circle next to **${value}**, click **Custom colour** and enter ${code(hex)}, then close the small window with **×**.`
        : `Do the same for **${value}**: click its circle → **Custom colour** → ${code(hex)} → **×**.`,
    );
    const trigger = page.getByRole('button', { name: `Swatch for ${value}`, exact: true });
    // near the top of the screen, so the (tall) colour window opens below the circle and both show in the screenshot
    if (i === 0) await trigger.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 150));
    await trigger.click();
    const pop = page.getByTestId('swatch-popover');
    await expect(pop.getByRole('dialog')).toBeVisible();
    await pop.getByLabel('Custom colour').fill(hex);
    if (i === 0) await g.shot(page, `Colour circle for ${value}: Custom colour ${hex}`, { highlight: pop.getByRole('dialog') });
    await pop.getByRole('button', { name: 'Close' }).click();
    await expect(pop).toHaveCount(0);
    await expect(trigger.locator('span')).toHaveCSS('background-color', rgb(hex));
  }
  if (swatches.length) g.expect(`The circles next to ${swatches.map(([v, h]) => `**${v}** (${code(h)})`).join(' and ')} show the chosen colours.`);

  // a price and status per combination
  await fillCombinations(g, page, p);
  g.expect('Every row shows the regular price, sale price and status from the table above.');
  await sectionShot(g, page, `${p.title}: options and the ${variants.length} combinations with prices`, 'options');

  // photos, tagged by colour
  g.note('In the file window you can pick several photos at once: hold **Ctrl** (Windows) or **⌘ Cmd** (Mac) while clicking them.');
  await g.form([photoRow(page, p), ...tagRows(page, p)], 'Scroll up to **Photos**. Upload the photos, then under each photo choose what it **Shows**:');
  await expectPhotos(page, p);
  const tags = Object.entries(p.photoTags ?? {}).map(([i, tag]) => `photo ${Number(i) + 1} shows **${tag}**`);
  g.expect(`The ${p.photos.length} photos appear in the order chosen and the first is marked **Main photo**${tags.length ? `; ${tags.join(', ')}` : ''}.`);
  await sectionShot(g, page, `${p.title}: photos with their “Shows” tags`, 'photos');

  await g.form([descriptionRow(page, p)], 'In **Description**, click into the text box and type:');
  await expect(descriptionBox(page)).toContainText(p.description);

  const ticks = [p.bestSeller && 'Best seller', p.newArrival && 'New arrival', p.limitedEdition && 'Limited edition'].filter((x): x is string => !!x);
  const tickList = ticks.map((t) => `**${t}**`).join(' and ');
  await g.form(
    [...collectionRows(page, p.collections), ...labelRows(page, p)],
    `In **Collections**, add the sofa to its collections; then in **Visibility** tick ${tickList}:`,
  );
  await expectCollectionsAndLabels(page, p);
  g.expect(`${p.collections.map((c) => `**${c}**`).join(' and ')} appear as chips above the search box${ticks.length ? `, and ${tickList} ${ticks.length > 1 ? 'are' : 'is'} ticked` : ''}.`);
  if (p.bestSeller) {
    // the tick's own help line says what it does on the store
    const bestSellerLabel = page.locator('section#visibility label').filter({ has: bestSellerBox(page) });
    await expect(bestSellerLabel).toContainText(BEST_SELLER_HINT);
    const hint = ((await bestSellerLabel.innerText()).replace(/^\s*Best seller\s*/, '').trim() || BEST_SELLER_HINT).replace(/\s+/g, ' ');
    g.expect(
      `Under **Best seller** the admin explains what the tick does: _${hint}_ Once published, the ${p.title} appears in **Hot Selling Products** on the home page (section 8 checks that row).`,
    );
  }
  // Collections card at the top of the screen, so the Visibility ticks below it are in the picture too
  const collectionsCard = page.locator('section#collections');
  await collectionsCard.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 16));
  if (p.bestSeller) await expect(bestSellerBox(page)).toBeInViewport();
  if (p.newArrival) await expect(newArrivalBox(page)).toBeInViewport();
  await g.shot(page, `${p.title}: collections chosen${ticks.length ? `, ${ticks.join(' and ')} ticked` : ''}`, { highlight: collectionsCard });

  await save(g, page, p, false);
  await g.shot(page, `${p.title} published`, { highlight: page.getByText(SAVED) });
}

async function addOthers(ctx: Ctx) {
  const g = ctx.guide;
  g.part(
    '3.2 The other products',
    `All ${PRODUCTS.length} products of the shop at a glance (prices in rupees, regular price → **sale price**):`,
  );
  g.table(['Product', 'Price and status', 'Collections', 'Photos', 'Labels', 'Saved as'], summaryRows());
  g.text(
    'Add each remaining product the same way: open a new product, fill in its table, and press **Publish**. A product without options has just one Regular price, Sale price and Status.',
  );
  for (const p of PRODUCTS) if (p !== ANTONIN && !p.draft) await addProduct(ctx, p);
}

async function addDraft(ctx: Ctx) {
  const { guide: g, admin: page, shopper } = ctx;
  const p = PRODUCTS.find((x) => x.draft);
  if (!p) return;
  g.part(
    `3.3 ${p.title}: keep a product hidden as a draft`,
    'A product that is not ready for sale can be saved as a **draft**: it stays in the admin, but customers cannot see it.',
  );
  await addProduct(ctx, p);
  await g.shot(page, `${p.title} saved as a draft: “${SAVED_DRAFT}”`, { highlight: page.getByText(SAVED_DRAFT) });

  const url = `/products/${p.handle}`;
  let status = 0;
  const onResponse = (r: Response) => {
    const req = r.request();
    if (req.isNavigationRequest() && req.frame() === shopper.mainFrame() && new URL(r.url()).pathname === url) status = r.status();
  };
  shopper.on('response', onResponse);
  try {
    await g.goto(shopper, url, `In a browser where you are **not** signed in (for example a private window), open **${site(ctx, url)}**.`);
  } finally {
    shopper.off('response', onResponse);
  }
  const notFound = shopper.getByRole('heading', { level: 1, name: 'Page not found' });
  await expect(notFound).toBeVisible();
  expect(status, `status of ${url}`).toBe(404);
  g.expect('The store shows **Page not found** (error 404): customers cannot open a draft product.');
  await g.shot(shopper, 'A draft product is not on the store', { highlight: notFound });
}

async function duplicateAndDelete(ctx: Ctx) {
  const { guide: g, admin: page } = ctx;
  g.part(
    '3.4 Copy a product, then delete the copy',
    `**Duplicate** is a quick way to start a similar product. We copy the ${ALEXA.title}, check that the copy starts hidden as a draft, and delete it again.`,
  );
  await g.click(page.getByRole('link', { name: '← Products' }), 'Click **← Products** to go back to the list.');
  await expect(productsHeading(page)).toBeVisible();
  await g.click(listRow(page, ALEXA.title).getByRole('link', { name: ALEXA.title, exact: true }), `In the list, click **${ALEXA.title}** to open it.`);
  await expect(page.getByRole('heading', { level: 1, name: ALEXA.title, exact: true })).toBeVisible();

  await g.click(page.getByRole('button', { name: 'Duplicate', exact: true }), 'At the top of the page, click **Duplicate**.');
  await page.waitForURL(/\/admin\/products\/\d+\?duplicated=1/, { timeout: 30_000 });
  const notice = page.getByText(COPY_NOTICE);
  await expect(notice).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: COPY_TITLE, exact: true })).toBeVisible();
  await expect(page.locator('#product-title')).toHaveValue(COPY_TITLE);
  await expect(page.getByTestId('product-status')).toHaveText('Draft');
  await expect(galleryItems(page)).toHaveCount(ALEXA.photos.length);
  g.expect(
    `A new product **${COPY_TITLE}** opens with the message **${COPY_NOTICE}**, the label **Draft**, and the same ${ALEXA.photos.length} photos.`,
  );
  await g.shot(page, 'The copy opens as a draft', { highlight: notice });

  await g.click(page.getByRole('button', { name: 'Delete', exact: true }), 'We do not need the copy: at the top of the page, click **Delete**.');
  const dialog = page.getByTestId('confirm-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`Delete “${COPY_TITLE}”?`);
  await expect(dialog).toContainText('The product and its 1 combination');
  await expect(dialog).toContainText(`${ALEXA.photos.length} photos (uploaded photos not used anywhere else are deleted)`);
  await expect(dialog).toContainText("This can't be undone.");
  g.expect(
    `A window asks **Delete “${COPY_TITLE}”?** and lists what will be lost: **The product and its 1 combination** and **${ALEXA.photos.length} photos (uploaded photos not used anywhere else are deleted)**. It warns **This can't be undone.**`,
  );
  await g.shot(page, 'Delete asks first and lists what will be lost', { highlight: dialog });

  await g.click(dialog.getByRole('button', { name: 'Delete permanently' }), 'Click **Delete permanently**.');
  await page.waitForURL(/\/admin\/products\?deleted=1/, { timeout: 30_000 });
  await expect(page.getByText('Product deleted.')).toBeVisible();
  await expect(listRow(page, COPY_TITLE)).toHaveCount(0);
  await expect(listRow(page, ALEXA.title)).toHaveCount(1);
  g.expect(`The Products list opens with **Product deleted.**; the copy is gone and the original **${ALEXA.title}** is still listed.`);
}

async function productsList(ctx: Ctx) {
  const { guide: g, admin: page } = ctx;
  const draft = PRODUCTS.find((p) => p.draft);
  g.part('3.5 The products list');
  await g.click(leftMenuProducts(page), 'In the left menu, click **Products**.');
  await expect(productsHeading(page)).toBeVisible();
  await expect(page.getByText(`${PRODUCTS.length} products in the catalogue`)).toBeVisible();
  await expect(listRows(page)).toHaveCount(PRODUCTS.length);
  for (const p of PRODUCTS) await expect(listRow(page, p.title).locator('td').nth(2)).toHaveText(p.draft ? 'Draft' : 'Published');
  await expectImagesLoaded(page, 'tr[data-testid="product-row"] img');
  g.expect(
    `The page says **${PRODUCTS.length} products in the catalogue** and lists each one with its photo, price and status: ${
      draft ? `**${draft.title}** is **Draft**, the other ${PRODUCTS.length - 1} are **Published**` : `all are **Published**`
    }.`,
  );
  // the star in each row is the same switch as the editor's Best seller tick
  const bestSellers = PRODUCTS.filter((p) => p.bestSeller);
  for (const p of PRODUCTS) {
    const star = listRow(page, p.title).getByRole('button', { name: /best seller/i });
    await expect(star).toHaveAccessibleName(p.bestSeller ? /^Best seller: in Hot Selling Products on the home page/ : /^Mark as best seller/);
  }
  if (bestSellers.length) {
    g.expect(
      `In the **Actions** column, a filled yellow ★ marks the best sellers, ${bestSellers.map((p) => `**${p.title}**`).join(' and ')}; the other stars are grey. Clicking a star does the same as the **Best seller** tick in the product (pointing at it says _Mark as best seller: puts it in Hot Selling Products on the home page_).`,
    );
  }
  await g.shot(page, `The products list: ${PRODUCTS.length} products`, draft ? { highlight: listRow(page, draft.title) } : {});
}

async function checkStore(ctx: Ctx) {
  const { guide: g, shopper } = ctx;
  const p = ANTONIN;
  const first = p.variants?.[0];
  g.part('3.6 A first look at the store', 'A quick check as a customer (section 8 goes through the store in detail).');

  await g.goto(shopper, `/products/${p.handle}`, `In the browser where you are not signed in, open **${site(ctx, `/products/${p.handle}`)}**.`);
  const main = shopper.locator('main');
  await expect(shopper.getByRole('heading', { level: 1, name: p.title, exact: true })).toBeVisible();
  await expect(main.getByText('NEW', { exact: true }).first()).toBeVisible();
  const priceLine: string[] = [];
  if (first) {
    if (first.sale) {
      await expect(main.locator('ins').first()).toHaveText(rs(first.sale));
      await expect(main.locator('del').first()).toHaveText(rs(first.regular));
      const pct = Math.round(((Number(first.regular) - Number(first.sale)) / Number(first.regular)) * 100);
      await expect(main.getByText(`${pct}% off`, { exact: true }).first()).toBeVisible();
      priceLine.push(`the price **${rs(first.sale)}** with **${rs(first.regular)}** crossed out and a **${pct}% off** badge (the ${combo(first.values)} sofa)`);
    } else {
      await expect(main.locator('ins').first()).toHaveText(rs(first.regular));
      priceLine.push(`the price **${rs(first.regular)}**`);
    }
  }
  if (p.delivery) {
    await expect(main.getByText('Free Delivery!').first()).toBeVisible();
    await expect(main.getByText(p.delivery, { exact: true }).first()).toBeVisible();
    priceLine.push(`a red **FREE DELIVERY!** tag and the line **${p.delivery}**`);
  }
  for (const o of p.options ?? []) for (const v of o.values) await expect(main.getByRole('button', { name: v, exact: true }).first()).toBeVisible();
  await expectImagesLoaded(shopper, 'main img[src*="/uploads/"]');
  g.expect(
    `The page shows **${p.title}** with the red **NEW** label, ${priceLine.join(', ')}, and the choices ${(p.options ?? [])
      .map((o) => `${o.name}: ${o.values.join(' / ')}`)
      .join(' and ')}. The photos load.`,
  );
  await g.shot(shopper, `${p.title} on the store`, { fullPage: true });

  const sofas = '/collections/sofas';
  await g.goto(shopper, sofas, `Open **${site(ctx, sofas)}**.`);
  const inSofas = PRODUCTS.filter((x) => !x.draft && x.collections.includes('Sofas'));
  const cards = main.locator('.product-card');
  await expect(cards).toHaveCount(inSofas.length);
  for (const x of inSofas) await expect(cards.filter({ hasText: x.title })).toHaveCount(1);
  const alexa = cards.filter({ hasText: ALEXA.title });
  await expect(alexa).toContainText(/limited edition/i);
  if (ALEXA.sale && ALEXA.regular) {
    await expect(alexa.locator('ins')).toHaveText(rs(ALEXA.sale));
    await expect(alexa.locator('del')).toHaveText(rs(ALEXA.regular));
  }
  await expectImagesLoaded(shopper, 'main .product-card img');
  g.expect(
    `The Sofas page shows ${inSofas.length} products, ${inSofas.map((x) => `**${x.title}**`).join(' and ')}, with their photos (so deleting the copy in 3.4 kept the photos the original ${ALEXA.title} uses). The ${ALEXA.title} card has the yellow **LIMITED EDITION** bar and the price **${rs(
      ALEXA.sale ?? ALEXA.regular ?? '0',
    )}**${ALEXA.sale && ALEXA.regular ? ` with **${rs(ALEXA.regular)}** crossed out` : ''}.`,
  );

  // The card price of a product with options comes from ONE combination, the cheapest: its own sale price and its own
  // crossed-out regular price (none when that combination is not on sale), so the card never shows a discount no option has.
  const antonin = cards.filter({ hasText: p.title });
  const variants = p.variants ?? [];
  if (variants.length) {
    const pays = Math.min(...variants.map((v) => Number(v.sale ?? v.regular)));
    const cheapest = variants.filter((v) => Number(v.sale ?? v.regular) === pays);
    const onSale = cheapest.find((v) => v.sale);
    const badge = antonin.getByText(/^\d+%\s*off$/i);
    await expect(antonin.locator('ins').first()).toHaveText(rs(String(pays)));
    const names = cheapest.map((v) => combo(v.values)).join(' and ');
    if (onSale) {
      const pct = Math.round(((Number(onSale.regular) - pays) / Number(onSale.regular)) * 100);
      await expect(antonin.locator('del').first()).toHaveText(rs(onSale.regular));
      await expect(badge).toHaveText(new RegExp(`^${pct}%\\s*off$`, 'i'));
      g.expect(
        `The ${p.title} card shows its cheapest option, the ${names}: **${rs(String(pays))}** with its own regular price **${rs(onSale.regular)}** crossed out and **${pct}% OFF**.`,
      );
    } else {
      // the cheapest combinations are not on sale, so the card shows no crossed-out price and no "% OFF" circle
      await expect(antonin.locator('del')).toHaveCount(0);
      await expect(badge).toHaveCount(0);
      const sales = variants.filter((v) => v.sale).map((v) => combo(v.values));
      g.expect(
        `The ${p.title} card shows **${rs(String(pays))}**, the price of its cheapest option (the ${names}), with nothing crossed out and no **% OFF** circle: that option is not on sale.${
          sales.length ? ` (The sale price of the ${sales.join(' and ')} shows on the product page when a customer picks ${sales.length > 1 ? 'one of them' : 'it'}.)` : ''
        }`,
      );
    }
  }
  await g.shot(shopper, 'The Sofas collection on the store', { fullPage: true, highlight: alexa });
}

/* ------------------------------------------------------------------ section */

const section: Section = {
  id: '03',
  title: '3. Products',
  intro:
    'Here we add the shop’s 8 products from the admin: the Antonin Sofa in full detail (sizes, colours, a price for each combination, photos per colour), then seven shorter ones, one of them kept hidden as a draft. The Antonin Sofa and the Alexa Sofa Chair are ticked **Best seller**, which puts them in **Hot Selling Products** on the home page. We also copy and delete a product, and look at the result on the store.',
  async run(ctx) {
    await removeLeftovers(ctx.guide, ctx.admin);
    await addAntonin(ctx);
    await addOthers(ctx);
    await addDraft(ctx);
    await duplicateAndDelete(ctx);
    await productsList(ctx);
    await checkStore(ctx);
  },
};

export default section;
