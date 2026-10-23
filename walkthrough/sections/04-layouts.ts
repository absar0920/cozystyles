import { expect, type Locator, type Page } from '@playwright/test';
import type { Section } from '../context';
import { chooseFiles, expectImagesLoaded, gotoPage, type FieldRow, type Guide } from '../guide';
import { COLLECTIONS, LAYOUT, PRODUCTS } from '../data';
import { ICON_LABELS, type IconKey } from '../../src/lib/product-layout-icons';

/*
 * 4. Product page layouts: copy the built-in standard layout, rename it to LAYOUT.name, give it five sections
 * (big photo, photo and text, icons, quotes, products from a collection) — each new one goes in above the automatic
 * "You may also like", so no reordering is needed — preview it, save it, move LAYOUT.products onto it and check the
 * store: the sofa page shows the new sections in order, the bed page keeps the standard layout.
 */

const STANDARD = 'General furniture (standard)';
/** "Customer quotes" needs a heading (the store always shows one); data.ts has none for it. */
const QUOTES_HEADING = 'What our customers say';
/** The ready-made icon picked for each of LAYOUT.icons, in order. */
const ICON_KEYS: IconKey[] = ['delivery', 'warranty', 'quality'];
/** Name under the icon in the picker ("Warranty (shield with tick)" → "Warranty"). */
const iconName = (k: IconKey) => ICON_LABELS[k].replace(/\s*\(.*\)$/, '');

const byTitle = (title: string) => {
  const p = PRODUCTS.find((x) => x.title === title);
  if (!p) throw new Error(`data.ts has no product “${title}”`);
  return p;
};
const SOFA = byTitle(LAYOUT.products[0]);
const BED = byTitle('Alpen Bed');
const SOFAS = COLLECTIONS.find((c) => c.title === LAYOUT.featuredCollection)!;
const DRAFTS = PRODUCTS.filter((p) => p.draft).length;
/** The "Used by …" line on a layout card (drafts are counted in the total and named in brackets). */
const usedBy = (n: number, drafts = 0) =>
  `Used by ${n} product${n === 1 ? '' : 's'}${drafts ? ` (${drafts} draft${drafts === 1 ? '' : 's'})` : ''}`;
/** What "Products from a collection" shows on the sofa page: the collection's published products except the sofa itself. */
const FEATURED_ON_SOFA = PRODUCTS.filter((p) => p.collections.includes(SOFAS.title) && !p.draft && p.title !== SOFA.title).map((p) => p.title);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactly = (s: string) => new RegExp(`^${escapeRe(s)}$`);

const layoutCard = (page: Page, name: string) => page.getByTestId('layout-card').filter({ has: page.getByRole('link', { name, exact: true }) });
/** A section row in the layout editor (each kind is added once here). */
const sectionRow = (page: Page, kind: string) => page.locator(`[data-testid=layout-section][data-kind=${kind}]`).first();
const kindsInEditor = (page: Page) => page.getByTestId('layout-section').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.kind ?? ''));
const saveBar = (page: Page) => page.getByTestId('save-bar');

/** Picks the option whose text is `text` (or `text — N products`, as in the Move dialog's From list). */
async function selectOptionNamed(select: Locator, text: string) {
  const value = await select
    .locator('option')
    .filter({ hasText: new RegExp(`^${escapeRe(text)}( —|$)`) })
    .first()
    .getAttribute('value');
  if (!value) throw new Error(`No option “${text}”`);
  await select.selectOption(value);
}

/** Upload one photo into a section's photo box with the OS file dialog, then wait for the uploaded preview. */
async function uploadPhoto(sec: Locator, file: string) {
  const box = sec.getByTestId('image-upload').first();
  await chooseFiles(box.getByRole('button', { name: /^(Upload photo|Replace)$/ }), [file]);
  await expect(box.locator('img[src^="/uploads/"]')).toBeVisible({ timeout: 60_000 });
}

/** Opens "Add section" and picks a kind; returns the new section (its settings open by themselves). */
async function addSection(g: Guide, page: Page, kind: string, name: string): Promise<Locator> {
  await g.click(page.getByRole('button', { name: 'Add section', exact: true }), 'Under the sections, click **Add section**.');
  const dlg = page.getByTestId('add-section-dialog');
  await expect(dlg).toBeVisible();
  await g.click(dlg.locator(`button[data-kind=${kind}]`), `In the **Add a section** window, click **${name}**. Its settings open straight away.`);
  await expect(dlg).toBeHidden();
  const sec = sectionRow(page, kind);
  await expect(sec.getByTestId('section-editor')).toBeVisible();
  return sec;
}

/** Folds a section's settings away and checks the one-line summary on its row. */
async function closeSection(g: Guide, sec: Locator, name: string, summary: string) {
  await g.click(sec.getByRole('button', { name: '← Back to all sections' }), `Click **← Back to all sections** to fold the ${name} settings away.`);
  await expect(sec.getByTestId('section-editor')).toHaveCount(0);
  await expect(sec.getByTestId('section-summary')).toHaveText(summary);
  g.expect(`The **${name}** row now reads _${summary}_ under its name.`);
}

/**
 * Screenshot of a tall admin screen. The sidebar and the save bar are fixed to the window, so a full-page or tall
 * element shot draws the save bar over the content; instead the window is made as tall as the page for the shot.
 */
async function tallShot(g: Guide, page: Page, caption: string, opts: { clip?: Locator; highlight?: Locator } = {}) {
  const vp = page.viewportSize() ?? { width: 1440, height: 900 };
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: vp.width, height: Math.min(Math.max(height, vp.height), 5000) });
  await page.mouse.move(vp.width - 5, 5); // no hover effect on the buttons last clicked
  try {
    await g.shot(page, caption, opts);
  } finally {
    await page.setViewportSize(vp);
  }
}

/** The preview tab can show the CDN's "Checking your browser" page first (staging); wait it out. */
async function waitOutBrowserCheck(page: Page) {
  for (let i = 0; i < 20; i++) {
    const checking = await page
      .locator('body')
      .innerText({ timeout: 2000 })
      .then((t) => /checking your browser/i.test(t))
      .catch(() => false);
    if (!checking) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForLoadState('networkidle').catch(() => {});
}

/**
 * Only when the section is run again on the same database (WALK_FROM=04 while debugging): removes the layout an
 * earlier attempt made (and any leftover "Copy of General furniture (standard)"), moving its products back to
 * the standard layout first, so the copy can be renamed again. Done in the browser like everything else, but not
 * written into the guide; on a fresh database it finds nothing.
 */
async function removeEarlierAttempt(page: Page) {
  await gotoPage(page, '/admin/product-layouts');
  await expect(page.getByRole('heading', { level: 1, name: 'Product page layouts' })).toBeVisible();
  const names = new RegExp(`^(${escapeRe(LAYOUT.name)}|Copy of ${escapeRe(STANDARD)}( \\d+)?)$`);
  const leftovers = page.getByTestId('layout-card').filter({ has: page.getByRole('link', { name: names }) });
  for (let n = await leftovers.count(); n > 0; n = await leftovers.count()) {
    const card = leftovers.first();
    const name = (await card.getByRole('link').first().innerText()).trim();
    const menu = card.getByRole('button', { name: `More actions for ${name}` });
    if (!/^Not used/.test((await card.getByTestId('used-by').innerText()).trim())) {
      await menu.click();
      await page.getByRole('button', { name: 'Move products…' }).click();
      const mv = page.getByTestId('move-products-dialog');
      await selectOptionNamed(mv.getByLabel('To', { exact: true }), STANDARD);
      await mv.getByRole('button', { name: /^Move \d+ products?$/ }).click();
      await expect(page.getByTestId('move-toast')).toContainText('Moved');
      await expect(card.getByTestId('used-by')).toHaveText(/^Not used/, { timeout: 30_000 });
    }
    await menu.click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete permanently' }).click();
    await expect(leftovers).toHaveCount(n - 1, { timeout: 30_000 });
  }
}

const section: Section = {
  id: '04',
  title: '4. Product page layouts',
  intro:
    'A **page layout** is the set of ready-made sections (big photos, icons, customer quotes, rows of products…) shown under the description on a product page. ' +
    `Here you build a “${LAYOUT.name}” layout and put the two sofas on it, while every other product keeps the standard layout.`,
  async run({ guide: g, admin, shopper }) {
    await removeEarlierAttempt(admin);

    /* ------------------------------------------------------------------ the list */
    g.part(
      'What a page layout is',
      'Every product page shows the photos, price and description first. Under the description come the **sections** of the product’s page layout, in a fixed order. ' +
        'Each product uses one layout (chosen in the product’s **Page layout** list) and **many products share the same layout**, so changing a layout changes every product that uses it. ' +
        'To give only some products a different page, you make a copy of a layout, change the copy and move those products to it. That is what this part does.',
    );
    await g.click(admin.getByRole('navigation').getByRole('link', { name: 'Product page layouts' }), 'In the left menu, click **Product page layouts**.');
    await expect(admin.getByRole('heading', { level: 1, name: 'Product page layouts' })).toBeVisible();
    const stdCard = layoutCard(admin, STANDARD);
    await expect(stdCard).toHaveCount(1);
    await expect(stdCard.getByTestId('layout-summary').locator(':scope > span')).toHaveText(['“You may also like”']);
    await expect(stdCard.getByTestId('used-by')).toHaveText(usedBy(PRODUCTS.length, DRAFTS));
    g.expect(
      `The list shows the built-in layout **${STANDARD}**. The shop made it by itself; it only contains **“You may also like”** (four similar products, picked automatically). ` +
        `Every new product uses it until you choose another one, so it says **${usedBy(PRODUCTS.length, DRAFTS)}**: all the products from part 3.`,
    );
    await g.shot(admin, 'Product page layouts: only the built-in standard layout', { highlight: stdCard });

    /* ------------------------------------------------------------------ copy and rename */
    g.part('Make a copy and name it');
    await g.click(stdCard.getByRole('button', { name: 'Make a copy' }), `On the **${STANDARD}** card, click **Make a copy**.`);
    await admin.waitForURL(/\/admin\/product-layouts\/\d+\?copied=\d+/);
    await expect(admin.getByTestId('layout-editor')).toBeVisible();
    await expect(admin.getByRole('heading', { level: 1 })).toHaveText(/^Copy of General furniture \(standard\)/);
    await expect(admin.getByText('Copy made. Move products to it with “Bring products here…”.')).toBeVisible();
    await expect(admin.getByText('This layout isn’t used by any product yet.')).toBeVisible();
    g.expect(
      `The editor of the copy opens, called **Copy of ${STANDARD}**, with the green message _Copy made. Move products to it with “Bring products here…”._ ` +
        'and a blue note _This layout isn’t used by any product yet._',
    );

    await g.click(admin.getByRole('button', { name: 'Rename', exact: true }), 'Click **Rename** next to the name.');
    const renameBox = admin.getByTestId('rename-fields');
    await expect(renameBox).toBeVisible();
    await g.form([
      { label: 'Layout name', value: LAYOUT.name, locator: admin.locator('#layout-name') },
      { label: 'What it’s for (optional)', value: LAYOUT.description, locator: admin.locator('#layout-description') },
    ]);
    await g.shot(admin, 'Renaming the copy', { highlight: renameBox });
    await g.click(renameBox.getByRole('button', { name: 'Done' }), 'Click **Done**.');
    await expect(admin.getByRole('heading', { level: 1 })).toHaveText(LAYOUT.name);
    await expect(admin.getByTestId('layout-editor').getByText(LAYOUT.description, { exact: true })).toBeVisible();
    await expect(saveBar(admin)).toContainText('Unsaved changes');
    g.expect(
      `The title changes to **${LAYOUT.name}** with _${LAYOUT.description}_ under it. The bar at the bottom says **Unsaved changes**: the new name is kept when you save the layout (later in this part).`,
    );

    /* ------------------------------------------------------------------ sections */
    g.part(
      'Add the sections',
      'The **Sections** list shows what appears under the product description, from top to bottom. The copy starts with only “You may also like”. ' +
        'Add five sections; each one opens its settings as soon as you add it, and goes in **above** “You may also like”, which stays last on the page.',
    );

    // 1. Big photo with text — open the "Add a section" window once with a screenshot
    await g.click(admin.getByRole('button', { name: 'Add section', exact: true }), 'Under the sections, click **Add section**.');
    const addDlg = admin.getByTestId('add-section-dialog');
    await expect(addDlg.getByRole('heading', { name: 'Add a section' })).toBeVisible();
    await expect(addDlg.locator('button[data-kind]')).toHaveText([
      /^Big photo with text/,
      /^Photo and text/,
      /^Icons row/,
      /^Customer quotes/,
      /^Wide photo slideshow/,
      /^Products from a collection/,
      /^“You may also like” \(automatic\)\s*Already in this layout$/,
    ]);
    await expect(addDlg.locator('button[data-kind=recommendations]')).toBeDisabled();
    await expect(addDlg.getByText(/Customer reviews/)).toHaveCount(0);
    g.expect(
      'The **Add a section** window offers **Big photo with text**, **Photo and text**, **Icons row**, **Customer quotes**, **Wide photo slideshow** and **Products from a collection**. ' +
        '**“You may also like”** is greyed out (_Already in this layout_: there can be only one).',
    );
    g.note('There is no **Customer reviews** section to add: this shop does not use product reviews.');
    await addDlg.getByRole('heading', { name: 'Add a section' }).hover(); // no hover highlight on a choice in the shot
    await g.shot(admin, 'The Add a section window', { highlight: addDlg });
    await g.click(addDlg.locator('button[data-kind=overlay]'), 'Click **Big photo with text**. Its settings open straight away.');
    await expect(addDlg).toBeHidden();
    const overlay = sectionRow(admin, 'overlay');
    await expect(overlay.getByTestId('section-editor')).toBeVisible();
    expect(await kindsInEditor(admin)).toEqual(['overlay', 'recommendations']);
    await expect(sectionRow(admin, 'recommendations').getByRole('button', { name: 'Move down' }).first()).toBeDisabled();
    g.expect(
      '**Big photo with text** is added **above** “You may also like”, which stays the last section (the products row normally closes the product page). ' +
        'You never have to move a new section up past it.',
    );
    await g.form([
      { label: 'Background photo', kind: 'upload', button: 'Upload photo', value: LAYOUT.overlayPhoto, act: () => uploadPhoto(overlay, LAYOUT.overlayPhoto) },
      { label: 'Heading', value: LAYOUT.overlayHeading, locator: overlay.getByLabel('Heading', { exact: true }) },
      { label: 'Heading size', kind: 'none', value: 'Large' },
    ]);
    g.expect('The photo appears in the **Background photo** box as soon as it has uploaded.');
    await closeSection(g, overlay, 'Big photo with text', LAYOUT.overlayHeading);

    // 2. Photo and text, with a button to the Sofas collection
    const imageText = await addSection(g, admin, 'imageText', 'Photo and text');
    await g.form([
      { label: 'Photo', kind: 'upload', button: 'Upload photo', value: LAYOUT.imageTextPhoto, act: () => uploadPhoto(imageText, LAYOUT.imageTextPhoto) },
      { label: 'Photo position', kind: 'none', value: 'Photo on the left' },
      { label: 'Heading', value: LAYOUT.imageTextHeading, locator: imageText.getByLabel('Heading', { exact: true }) },
      { label: 'Text', kind: 'type', value: LAYOUT.imageTextBody, locator: imageText.getByRole('textbox', { name: 'Text', exact: true }) },
      {
        label: 'Show a button under the text',
        kind: 'check',
        value: '',
        act: async () => {
          const sw = imageText.getByRole('switch', { name: 'Show a button under the text' });
          await sw.click();
          await expect(sw).toHaveAttribute('aria-checked', 'true');
        },
      },
      { label: 'Button text', value: LAYOUT.imageTextButton, locator: imageText.getByLabel('Button text') },
      {
        label: 'Button goes to',
        kind: 'click',
        value: `click **Choose link**, type \`${SOFAS.title}\` in the search box and pick **${SOFAS.title}** under _Collections_`,
        act: async () => {
          await imageText.getByTestId('link-picker').getByRole('button', { name: 'Choose link' }).click();
          const pop = admin.getByTestId('link-picker-popover').last();
          await pop.getByRole('searchbox').fill(SOFAS.title);
          await pop
            .getByTestId('link-result')
            .filter({ has: admin.locator('span', { hasText: exactly(SOFAS.title) }) })
            .first()
            .click();
          await expect(pop).toBeHidden();
        },
      },
    ]);
    await expect(imageText.getByTestId('link-picker-value')).toContainText(`Collection · ${SOFAS.title}`);
    await expect(imageText.getByText('⚠ Button goes nowhere')).toHaveCount(0);
    g.expect(`**Button goes to** shows _Collection · ${SOFAS.title}_.`);
    await tallShot(g, admin, 'Photo and text: photo, heading, text and a button to the Sofas collection', { clip: imageText });
    await closeSection(g, imageText, 'Photo and text', LAYOUT.imageTextHeading);

    // 3. Icons row with three icons
    const icons = await addSection(g, admin, 'icons', 'Icons row');
    const blocks = icons.getByTestId('icon-block');
    const iconRows: FieldRow[] = [
      {
        label: '+ Add icon',
        kind: 'click',
        value: `click it ${LAYOUT.icons.length - 1} times, so there are ${LAYOUT.icons.length} icons`,
        act: async () => {
          for (let i = 1; i < LAYOUT.icons.length; i++) await icons.getByRole('button', { name: '+ Add icon' }).click();
          await expect(blocks).toHaveCount(LAYOUT.icons.length);
        },
      },
    ];
    LAYOUT.icons.forEach((ic, i) => {
      const block = blocks.nth(i);
      const key = ICON_KEYS[i] ?? 'delivery';
      iconRows.push(
        {
          label: `Icon ${i + 1}: picture`,
          kind: 'click',
          value: `click the icon square and choose **${iconName(key)}**`,
          act: async () => {
            const btn = block.getByTestId('icon-picker').getByRole('button').first();
            await btn.click();
            await admin.getByTestId('icon-picker-popover').locator(`button[data-icon=${key}]`).click();
            await expect(btn).toHaveAttribute('aria-label', `Choose icon: ${ICON_LABELS[key]}`);
          },
        },
        { label: `Icon ${i + 1}: Title`, value: ic.title, locator: block.getByLabel('Title', { exact: true }) },
        { label: `Icon ${i + 1}: Text`, value: ic.text, locator: block.getByLabel('Text', { exact: true }) },
      );
    });
    await g.form(iconRows);
    await tallShot(g, admin, 'Icons row with three icons', { clip: icons });
    await closeSection(g, icons, 'Icons row', LAYOUT.icons.map((i) => i.title).join(' · '));

    // 4. Customer quotes
    const quotes = await addSection(g, admin, 'testimonials', 'Customer quotes');
    const quoteItems = quotes.getByTestId('quote-item');
    const quoteRows: FieldRow[] = [{ label: 'Heading', value: QUOTES_HEADING, locator: quotes.getByLabel('Heading', { exact: true }) }];
    LAYOUT.quotes.forEach((q, i) => {
      if (i > 0)
        quoteRows.push({
          label: '+ Add quote',
          kind: 'click',
          value: 'click it once',
          act: async () => {
            await quotes.getByRole('button', { name: '+ Add quote' }).click();
            await expect(quoteItems).toHaveCount(i + 1);
          },
        });
      quoteRows.push(
        { label: `Quote ${i + 1}: Quote`, value: q.text, locator: quoteItems.nth(i).getByLabel('Quote', { exact: true }) },
        { label: `Quote ${i + 1}: Customer name`, value: q.name, locator: quoteItems.nth(i).getByLabel('Customer name') },
      );
    });
    await g.form(quoteRows);
    await closeSection(g, quotes, 'Customer quotes', `${QUOTES_HEADING} · ${LAYOUT.quotes.length} quotes`);

    // 5. Products from a collection
    const featured = await addSection(g, admin, 'featuredCollection', 'Products from a collection');
    await g.form([
      { label: 'Heading', value: LAYOUT.featuredHeading, locator: featured.getByLabel('Heading', { exact: true }) },
      {
        label: 'Collection',
        kind: 'click',
        value: `click **Choose a collection**, type \`${SOFAS.title}\` and pick **${SOFAS.title}**`,
        act: async () => {
          await featured.getByTestId('collection-picker').getByRole('button').first().click();
          const pop = admin.getByTestId('collection-picker-popover');
          await pop.getByRole('searchbox').fill(SOFAS.title);
          await pop
            .getByTestId('collection-result')
            .filter({ has: admin.locator('span', { hasText: exactly(SOFAS.title) }) })
            .first()
            .click();
          await expect(pop).toBeHidden();
        },
      },
      { label: 'How many products', kind: 'none', value: '8' },
    ]);
    await expect(featured.getByTestId('collection-picker-value')).toHaveText(`Collection · ${SOFAS.title}`);
    g.expect(`**Collection** shows _Collection · ${SOFAS.title}_.`);
    await closeSection(g, featured, 'Products from a collection', LAYOUT.featuredHeading);

    /* ------------------------------------------------------------------ order */
    g.part(
      'Check the order of the sections',
      'Each section was added above “You may also like”, in the order you added them, so the list is already in the right order. ' +
        'To change the order, use the **↑** / **↓** arrows on the right of a row (on a computer you can also drag a row by the handle at its left edge).',
    );
    const wanted = ['overlay', 'imageText', 'icons', 'testimonials', 'featuredCollection', 'recommendations'];
    expect(await kindsInEditor(admin)).toEqual(wanted);
    const recs = sectionRow(admin, 'recommendations');
    await expect(recs.getByRole('button', { name: 'Move down' }).first()).toBeDisabled();
    await expect(sectionRow(admin, 'overlay').getByRole('button', { name: 'Move up' }).first()).toBeDisabled();
    g.expect(
      'Without moving anything, the sections read from top to bottom: **Big photo with text**, **Photo and text**, **Icons row**, **Customer quotes**, **Products from a collection**, **“You may also like”** ' +
        '(the last one’s ↓ arrow and the first one’s ↑ arrow are greyed out).',
    );
    await tallShot(g, admin, `The ${LAYOUT.name} sections in their final order`, { highlight: admin.getByRole('list', { name: 'Sections' }) });

    /* ------------------------------------------------------------------ preview */
    g.part('Preview before saving', 'Nothing changes on the store until you press **Save layout**. **Preview changes** shows your unsaved layout on a real product page that only you can see.');
    await g.click(admin.getByRole('button', { name: 'Preview changes' }), 'At the top right, click **Preview changes ↗**.');
    const pv = admin.getByTestId('preview-dialog');
    await expect(pv.getByRole('heading', { name: 'Preview on' })).toBeVisible();
    await expect(pv).toContainText('Not used yet, so pick any product to preview on.');
    await g.form(
      [
        { label: 'Search products', value: SOFA.title, locator: pv.getByRole('searchbox', { name: 'Search products' }) },
        { label: SOFA.title, kind: 'click', value: 'select it', act: () => pv.getByRole('radio', { name: SOFA.title }).check() },
      ],
      'In the **Preview on** window, choose the product to look at:',
    );
    g.step('Click **Open the preview**. The product page opens in a new browser tab.');
    const [tab] = await Promise.all([admin.context().waitForEvent('page'), pv.getByRole('button', { name: 'Open the preview' }).click()]);
    await tab.waitForURL(new RegExp(`/products/${escapeRe(SOFA.handle)}\\?layoutPreview=`), { timeout: 60_000 });
    await waitOutBrowserCheck(tab);
    await expect(tab.getByTestId('layout-preview-bar')).toContainText('Preview — not saved yet. Only you can see this.', { timeout: 30_000 });
    await expect(tab.locator('main h3', { hasText: LAYOUT.overlayHeading })).toBeVisible();
    await expect(tab.locator('main h3', { hasText: LAYOUT.imageTextHeading })).toBeVisible();
    const previewBar = tab.getByTestId('layout-preview-bar');
    await tab.locator('main h3', { hasText: LAYOUT.overlayHeading }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(previewBar).toBeInViewport();
    g.expect(
      `The **${SOFA.title}** page opens with the new sections under the description, and a yellow bar stays at the bottom of the window: _Preview — not saved yet. Only you can see this._`,
    );
    await g.shot(tab, `Preview of the unsaved layout on the ${SOFA.title} page (yellow bar at the bottom)`, { highlight: previewBar });
    g.step('Close the preview tab to return to the layout editor.');
    await tab.close();

    /* ------------------------------------------------------------------ save */
    g.part('Save the layout');
    await g.click(saveBar(admin).getByRole('button', { name: 'Save layout' }), 'In the bar at the bottom of the screen, click **Save layout**.');
    await expect(admin.getByText('Saved.', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(saveBar(admin).getByRole('button', { name: 'Save layout' })).toBeDisabled();
    await expect(admin.getByRole('heading', { level: 1 })).toHaveText(LAYOUT.name);
    g.expect('A green **Saved.** message appears and **Save layout** is greyed out again.');
    g.note('No product uses this layout yet, so customers still see the old pages. The next step moves the sofas to it.');

    /* ------------------------------------------------------------------ move products */
    g.part('Move the sofas to the new layout');
    await expect(admin.getByText('This layout isn’t used by any product yet.')).toBeVisible();
    await g.click(admin.getByRole('button', { name: 'Bring products here…' }), 'In the blue note _This layout isn’t used by any product yet._, click **Bring products here…**.');
    const mv = admin.getByTestId('move-products-dialog');
    await expect(mv.getByRole('heading', { name: 'Bring products here' })).toBeVisible();
    const checklist = mv.getByTestId('product-checklist');
    await g.form(
      [
        { label: 'From', kind: 'none', value: STANDARD, act: () => selectOptionNamed(mv.getByLabel('From', { exact: true }), STANDARD) },
        {
          label: 'To',
          kind: 'none',
          value: LAYOUT.name,
          act: () => expect(mv.getByLabel('To', { exact: true }).locator('option:checked')).toHaveText(LAYOUT.name),
        },
        { label: 'Which products', kind: 'click', value: 'choose **Choose products**', act: () => mv.getByRole('radio', { name: 'Choose products' }).check() },
        ...LAYOUT.products.map(
          (title): FieldRow => ({
            label: title,
            kind: 'check',
            value: '',
            act: () => checklist.getByRole('checkbox', { name: new RegExp(`^${escapeRe(title)}\\b`) }).check(),
          }),
        ),
      ],
      'In the **Bring products here** window (you can type a name in **Search products** to find a product quickly):',
    );
    await expect(checklist.getByText(`${LAYOUT.products.length} selected`, { exact: true })).toBeVisible();
    const moveBtn = mv.getByRole('button', { name: `Move ${LAYOUT.products.length} products` });
    await expect(moveBtn).toBeEnabled();
    g.expect(`The window says **${LAYOUT.products.length} selected** and the button reads **Move ${LAYOUT.products.length} products**.`);
    await g.shot(admin, 'Choosing the two sofas to move', { highlight: mv });
    await g.click(moveBtn, `Click **Move ${LAYOUT.products.length} products**.`);
    const toast = admin.getByTestId('move-toast');
    await expect(toast).toContainText(`Moved ${LAYOUT.products.length} products to “${LAYOUT.name}”`);
    await expect(toast.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect(admin.getByRole('link', { name: `Used by ${LAYOUT.products.length} products`, exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(admin.getByText(`Changes here affect ${LAYOUT.products.length} products. To change only some of them, make a copy first.`)).toBeVisible();
    g.expect(
      `A message at the bottom says _Moved ${LAYOUT.products.length} products to “${LAYOUT.name}”_ (with **Undo** for a few seconds). Under the title it now says **Used by ${LAYOUT.products.length} products**, ` +
        `and a yellow note warns that _Changes here affect ${LAYOUT.products.length} products_: from now on, saving this layout changes both sofa pages at once.`,
    );
    await g.shot(admin, `${LAYOUT.name} after the move: used by ${LAYOUT.products.length} products`, { highlight: toast });

    await g.click(admin.getByRole('link', { name: '← Product page layouts' }), 'At the top left, click **← Product page layouts** to go back to the list.');
    await expect(admin.getByRole('heading', { level: 1, name: 'Product page layouts' })).toBeVisible();
    const sofaCard = layoutCard(admin, LAYOUT.name);
    await expect(sofaCard.getByTestId('used-by')).toHaveText(`Used by ${LAYOUT.products.length} products`);
    await expect(sofaCard).toContainText(LAYOUT.description);
    await expect(sofaCard.getByTestId('layout-summary').locator(':scope > span')).toHaveText([
      'Big photo with text',
      'Photo and text',
      'Icons row',
      'Customer quotes',
      'Products from a collection',
      '“You may also like”',
    ]);
    const stdLeft = usedBy(PRODUCTS.length - LAYOUT.products.length, DRAFTS);
    await expect(layoutCard(admin, STANDARD).getByTestId('used-by')).toHaveText(stdLeft);
    g.expect(
      `The **${LAYOUT.name}** card lists its six sections in order and says **Used by ${LAYOUT.products.length} products**. ` +
        `The standard layout now says **${stdLeft}**: every other product still uses it.`,
    );
    await g.shot(admin, `The list with ${LAYOUT.name} used by ${LAYOUT.products.length} products`, { highlight: sofaCard });

    await g.click(sofaCard.getByTestId('used-by'), `On the **${LAYOUT.name}** card, click **Used by ${LAYOUT.products.length} products**.`);
    await admin.waitForURL(/\/admin\/products\?layout=/);
    await expect(admin.getByText(`${LAYOUT.products.length} products match`)).toBeVisible();
    const productRows = admin.getByTestId('product-row').filter({ visible: true });
    await expect(productRows).toHaveCount(LAYOUT.products.length);
    for (const title of LAYOUT.products) await expect(productRows.filter({ hasText: title })).toHaveCount(1);
    g.expect(`The **Products** list opens filtered to this layout and shows exactly ${LAYOUT.products.map((t) => `**${t}**`).join(' and ')}.`);

    /* ------------------------------------------------------------------ store */
    g.part('Check the store as a customer');
    await g.goto(shopper, `/products/${SOFA.handle}`, `In a browser window where you are **not** signed in, open the store page **/products/${SOFA.handle}** and scroll down past the description.`);
    const main = shopper.locator('main');
    await expect(shopper.getByRole('heading', { level: 1, name: SOFA.title })).toBeVisible();
    const marks = [
      { name: 'Big photo with text', loc: main.locator('h3', { hasText: LAYOUT.overlayHeading }) },
      { name: 'Photo and text', loc: main.locator('h3', { hasText: LAYOUT.imageTextHeading }) },
      { name: 'Icons row', loc: main.locator('h6').filter({ hasText: exactly(LAYOUT.icons[0].title) }) },
      { name: 'Customer quotes', loc: main.locator('h2', { hasText: QUOTES_HEADING }) },
      { name: 'Products from a collection', loc: main.locator('h2', { hasText: LAYOUT.featuredHeading }) },
      { name: '“You may also like”', loc: main.locator('h4', { hasText: 'You may also like' }) },
    ];
    const tops: number[] = [];
    for (const m of marks) {
      await expect(m.loc.first(), m.name).toBeVisible();
      tops.push(await m.loc.first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY));
    }
    for (let i = 1; i < tops.length; i++) expect(tops[i], `${marks[i].name} is below ${marks[i - 1].name}`).toBeGreaterThan(tops[i - 1]);
    for (const ic of LAYOUT.icons) await expect(main.locator('h6').filter({ hasText: exactly(ic.title) }).first()).toBeVisible();
    for (const q of LAYOUT.quotes) {
      await expect(main.getByText(q.text).first()).toBeAttached();
      await expect(main.getByText(q.name).first()).toBeAttached();
    }
    const featuredRow = marks[4].loc.first().locator('xpath=..');
    for (const t of FEATURED_ON_SOFA) await expect(featuredRow).toContainText(t);
    const button = main.getByRole('link', { name: LAYOUT.imageTextButton, exact: true });
    await expect(button).toHaveAttribute('href', `/collections/${SOFAS.handle}`);
    await expectImagesLoaded(shopper, 'main img[src^="/uploads/"]');
    g.expect(
      `Under the description the page shows, in this order: the big photo with **${LAYOUT.overlayHeading}**, the photo with **${LAYOUT.imageTextHeading}** and a **${LAYOUT.imageTextButton}** button, ` +
        `the icons **${LAYOUT.icons.map((i) => i.title).join('**, **')}**, the dark **${QUOTES_HEADING}** band with both quotes, ` +
        `**${LAYOUT.featuredHeading}** with ${FEATURED_ON_SOFA.map((t) => `**${t}**`).join(', ')}, and **You may also like** at the end. Every photo has loaded.`,
    );
    await g.shot(shopper, `${SOFA.title} on the store with the ${LAYOUT.name} layout`, { fullPage: true });

    await g.click(button, `In the **${LAYOUT.imageTextHeading}** section, click **${LAYOUT.imageTextButton}**.`);
    await expect(shopper).toHaveURL(new RegExp(`/collections/${escapeRe(SOFAS.handle)}(\\?|$)`));
    await expect(shopper.getByRole('heading', { level: 1, name: SOFAS.title })).toBeAttached();
    g.expect(`The **${SOFAS.title}** collection page opens.`);

    await g.goto(shopper, `/products/${BED.handle}`, `Now open **/products/${BED.handle}** (a product that still uses the standard layout) and scroll down.`);
    await expect(shopper.getByRole('heading', { level: 1, name: BED.title })).toBeVisible();
    await expect(main.locator('h4', { hasText: 'You may also like' })).toBeVisible();
    for (const t of [LAYOUT.overlayHeading, LAYOUT.imageTextHeading, LAYOUT.icons[0].title, QUOTES_HEADING, LAYOUT.featuredHeading]) {
      await expect(main.getByText(t, { exact: true })).toHaveCount(0);
    }
    g.expect(`The **${BED.title}** page has none of the new sections: under the description there is only **You may also like**.`);
    await g.shot(shopper, `${BED.title} still uses the standard layout`, { fullPage: true });
  },
};

export default section;
