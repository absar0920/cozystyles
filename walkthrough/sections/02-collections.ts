import { expect, type Locator, type Page } from '@playwright/test';
import type { Section } from '../context';
import { COLLECTIONS, STORE, type CollectionData } from '../data';
import { chooseFiles, expectImagesLoaded, gotoPage, type Guide } from '../guide';

/** The main departments, first on the store's Collections ("Shop by Category") page, in this order. */
const TOP_ORDER = ['Living Room', 'Bedroom', 'Dining', 'Office Chairs'];

const SAVED = 'Saved. The store is updated.';
const ORDER_SAVED = 'Saved. The Collections page is updated.';
/** The admin's error screen (it used to appear now and then right after creating a collection on staging). */
const ERROR_SCREEN = 'This page could not finish loading';

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactly = (s: string) => new RegExp(`^\\s*${reEsc(s)}\\s*$`);
const listed = (titles: string[]) => titles.map((t, i) => `${i + 1}. ${t}`).join(', ');
const times = (n: number) => (n === 1 ? 'once' : `${n} times`);

function byTitle(title: string): CollectionData {
  const c = COLLECTIONS.find((x) => x.title === title);
  if (!c) throw new Error(`data.ts: no collection called "${title}"`);
  return c;
}

/** The fields of the New collection / collection page. */
function collectionForm(page: Page) {
  const cover = page.getByTestId('image-upload');
  return {
    name: page.getByRole('textbox', { name: 'Name', exact: true }),
    description: page.getByRole('textbox', { name: 'Description', exact: true }),
    upload: cover.getByRole('button', { name: 'Upload photo' }),
    replace: cover.getByRole('button', { name: 'Replace' }),
    remove: cover.getByRole('button', { name: 'Remove' }),
    coverImg: cover.getByTestId('image-upload-preview').locator('img'),
    parent: page.getByRole('combobox', { name: 'Inside collection (optional)' }),
    showOnPage: page.getByRole('checkbox', { name: /Show on the Collections page/ }),
    advanced: page.locator('summary').filter({ hasText: 'Advanced' }),
    webAddress: page.getByRole('textbox', { name: 'Web address' }),
    /** same field while "Advanced" is still folded (not visible, but filled in from the name) */
    handleInput: page.locator('input[name="handle"]'),
    create: page.getByTestId('save-bar').getByRole('button', { name: 'Create collection' }),
  };
}

const sidebarCollections = (page: Page) => page.getByRole('complementary').getByRole('link', { name: 'Collections', exact: true });

/** One row of the admin Collections list, found by its name link (not the "Inside" link of its children). */
const listRow = (page: Page, title: string) =>
  page.getByTestId('collection-row').filter({ has: page.locator('a[href^="/admin/collections/"]').filter({ hasText: exactly(title) }) });

/** Card titles on Collections → Arrange Collections page, top to bottom. */
const cardTitles = (page: Page) =>
  page.getByTestId('index-card').evaluateAll((els) => els.map((el) => el.querySelector('p')?.textContent?.trim() ?? ''));

async function openNewCollectionForm(page: Page) {
  await sidebarCollections(page).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Collections', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '+ New collection' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'New collection' })).toBeVisible();
}

/** Types the name; if the form was still starting up (slow server) the web address stays empty, so type it again. */
async function fillName(page: Page, c: CollectionData) {
  const f = collectionForm(page);
  for (let attempt = 1; ; attempt++) {
    await f.name.fill('');
    await f.name.fill(c.title);
    try {
      await expect(f.handleInput).toHaveValue(c.handle, { timeout: 5_000 });
      return;
    } catch (e) {
      if (attempt >= 4) throw e;
      await page.waitForTimeout(1_000);
    }
  }
}

async function uploadCover(page: Page, file: string) {
  const f = collectionForm(page);
  await chooseFiles(f.upload, [file]);
  await expect(f.replace).toBeVisible({ timeout: 60_000 });
  await expect(f.coverImg).toHaveAttribute('src', /\/uploads\//);
}

/**
 * After "Create collection": the page becomes the saved collection with the green notice — never the admin's
 * "Something went wrong — This page could not finish loading" screen (F02-2 of the previous run, fixed).
 */
async function expectCreated(page: Page, c: CollectionData) {
  await expect(page).toHaveURL(/\/admin\/collections\/\d+\?saved=1/, { timeout: 30_000 });
  await expect(page.getByText(SAVED)).toBeVisible();
  await expect(page.getByText(ERROR_SCREEN)).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: c.title, exact: true })).toBeVisible();
  const f = collectionForm(page);
  await expect(f.parent.locator('option:checked')).toHaveText(c.parent ?? '— Top level —');
  await expect(f.coverImg).toHaveAttribute('src', /\/uploads\//);
  await expect(page.getByRole('link', { name: 'View on store' })).toHaveAttribute('href', `/collections/${c.handle}`);
}

/** Moves a card one place up with its arrow; a click before the page is ready does nothing, so it retries. */
async function moveUpOnce(page: Page, title: string) {
  const at = (await cardTitles(page)).indexOf(title);
  for (let attempt = 1; ; attempt++) {
    await page.getByTestId('sortable-item').nth(at).getByRole('button', { name: 'Move up', exact: true }).click();
    try {
      await expect.poll(async () => (await cardTitles(page)).indexOf(title), { timeout: 5_000 }).toBe(at - 1);
      return;
    } catch (e) {
      if (attempt >= 3 || (await cardTitles(page)).indexOf(title) !== at) throw e;
    }
  }
}

/**
 * Screenshot of a whole admin page. A normal full-page capture paints the bottom save bar in the middle of the
 * page (over the form), so the window is made as tall as the page for the moment of the shot instead.
 */
async function wholeAdminShot(g: Guide, page: Page, caption: string, opts: { highlight?: Locator } = {}) {
  const vp = page.viewportSize() ?? { width: 1440, height: 900 };
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: vp.width, height: Math.min(Math.max(height, vp.height), 2400) });
  await page.evaluate(() => window.scrollTo(0, 0));
  try {
    await g.shot(page, caption, opts);
  } finally {
    await page.setViewportSize(vp);
  }
}

/** HTTP status of the page currently shown (the real page, after any CDN check page). */
const documentStatus = (page: Page) =>
  page.evaluate(() => (performance.getEntriesByType('navigation')[0] as (PerformanceEntry & { responseStatus?: number }) | undefined)?.responseStatus ?? 0);

const section: Section = {
  id: '02',
  title: '2. Collections',
  intro:
    'Collections are the departments of the shop (Living Room, Bedroom…) and the groups inside them (Sofas, Beds…). ' +
    'This section creates all eight with a description and cover photo, puts the main departments first on the store\'s "Shop by Category" page (the home page\'s "Shop by Category" row follows the same order), and checks every collection on the store.',
  async run({ guide: g, admin, shopper, baseURL }) {
    const site = baseURL.replace(/\/$/, '');
    const storeUrl = (handle: string) => `${site}/collections/${handle}`;
    for (const t of TOP_ORDER) expect(byTitle(t).parent, `${t} is a top-level collection in data.ts`).toBeUndefined();
    const [first, ...rest] = COLLECTIONS;
    const f = collectionForm(admin);

    /* ------------------------------------------------------------ the first collection, in detail */
    g.part(
      'Create the first collection: Living Room',
      'Create the main departments before the collections that go inside them: a collection can only be put inside one that already exists.',
    );
    await g.goto(admin, '/admin', `Open the admin at **${site}/admin** (you are still signed in from section 1).`);
    await g.click(sidebarCollections(admin), 'In the left menu, click **Collections**.');
    await expect(admin.getByRole('heading', { level: 1, name: 'Collections', exact: true })).toBeVisible();
    const existing = new Set(
      (await admin.getByTestId('collection-row').locator('a[href^="/admin/collections/"]').allTextContents()).map((t) => t.trim()),
    );
    if (existing.size === 0) {
      await expect(admin.getByText('No collections yet.')).toBeVisible();
      g.expect('The list is empty: **No collections yet.**');
    } else {
      g.note(`This store already has collections (${[...existing].filter((t) => t !== 'Edit').join(', ')}). The ones below that already exist are not created again.`);
    }

    if (existing.has(first.title)) {
      g.note(`**${first.title}** already exists, so it is not created again.`);
    } else {
      await g.click(admin.getByRole('link', { name: '+ New collection' }), 'Click **+ New collection** (top right).');
      await expect(admin.getByRole('heading', { level: 1, name: 'New collection' })).toBeVisible();
      g.expect('The **New collection** page opens.');
      await g.form([
        { label: 'Name', value: first.title, act: () => fillName(admin, first) },
        { label: 'Description', value: first.description, locator: f.description, kind: 'type' },
        { label: 'Cover photo', value: first.cover, kind: 'upload', button: 'Upload photo', act: () => uploadCover(admin, first.cover) },
        { label: 'Inside collection (optional)', value: '— Top level —', kind: 'none' },
        { label: 'Show on the Collections page', value: '', locator: f.showOnPage, kind: 'check' },
      ]);
      await expect(f.name).toHaveValue(first.title);
      await expect(f.description).toHaveText(first.description);
      await expect(f.parent.locator('option:checked')).toHaveText('— Top level —');
      await expect(f.replace).toBeVisible();
      await expect(f.remove).toBeVisible();
      g.expect('The photo appears in the **Cover photo** box, with **Replace** and **Remove** buttons under it.');
      await expect(admin.getByText('in the home “Shop by Category” row', { exact: false })).toBeVisible();
      g.note(
        'The grey hint under the photo says where it is shown: on the store\'s Collections page and, while the collection is on that page, in the home page\'s **Shop by Category** row (in the **Arrange Collections page** order).',
      );
      g.note('Leave **Products in this collection** empty: there are no products yet. In section 3 every product is put into its collections from the product page.');

      await g.click(f.advanced, 'Click **Advanced** (bottom right) to see the **Web address** the shop made from the name. Leave it as it is.');
      await expect(f.webAddress).toBeVisible();
      await expect(f.webAddress).toHaveValue(first.handle);
      g.expect(`**Web address** shows \`${first.handle}\`, so the collection's page on the store will be **${storeUrl(first.handle)}**.`);
      // The grey text in front of the box: the shop's own domain (set when the website is installed), never the
      // old website's name cozyfurnitures.pk (F02-1 of the previous run, fixed).
      const prefix = ((await f.webAddress.locator('xpath=..').innerText()) || '').trim();
      expect(prefix, 'grey text in front of the Web address box').toMatch(/^[a-z0-9.-]+(:\d+)?\/collections\/$/i);
      const prefixHost = prefix.replace(/\/collections\/$/, '');
      const host = new URL(site).hostname;
      const bare = (h: string) => h.replace(/:\d+$/, '').replace(/^(www|staging)\./, '');
      if (bare(host) !== 'cozyfurnitures.pk') expect(prefix).not.toContain('cozyfurnitures.pk');
      if (/^(localhost|127\.0\.0\.1)$/.test(host)) {
        g.expect(`In front of the box the grey text shows the shop's own address followed by **/collections/**: \`${prefix}\`.`);
        g.note(
          `The grey text shows the domain the website was installed with. In this local test that is the test address \`${prefixHost}\`; on the live shop it is the shop's real domain (for example \`cozystyle.pk/collections/\`). The product, page and blog post forms show the same domain.`,
        );
      } else if (bare(prefixHost) === bare(host)) {
        g.expect(`In front of the box the grey text shows this shop's own domain: \`${prefix}\`. The product, page and blog post forms show the same domain.`);
      } else {
        g.finding(
          'note',
          'Web address box shows a different website name',
          `In front of the web address the form shows \`${prefix}\`, but this store runs at \`${host}\`. The grey text comes from the shop address set when the website was installed (NEXT_PUBLIC_SITE_URL in the hosting panel); make sure it is the shop's real domain.`,
        );
      }
      await wholeAdminShot(g, admin, 'Living Room filled in, before saving', { highlight: f.webAddress.locator('xpath=..') });

      await g.click(f.create, 'At the bottom of the screen, click **Create collection**.');
      await expectCreated(admin, first);
      g.expect(
        `The page becomes the **${first.title}** collection with the green message **${SAVED}** at the top, and a **View on store** button appears next to the name.`,
      );
      await g.shot(admin, 'Living Room created', { highlight: admin.getByText(SAVED) });
    }

    /* ------------------------------------------------------------ the other seven */
    g.part('Create the other seven collections', 'Create the rest the same way, one after the other, in the order of this table:');
    g.table(
      ['#', 'Name', 'Description', 'Cover photo (click Upload photo)', 'Inside collection (optional)', 'Web address (made from the name)'],
      rest.map((c, i) => [String(i + 2), `**${c.title}**`, c.description, '`' + c.cover + '`', c.parent ? `**${c.parent}**` : '— Top level —', '`' + c.handle + '`']),
    );
    const topRest = rest.filter((c) => !c.parent).map((c) => c.title);
    g.step('In the left menu, click **Collections**, then **+ New collection**.');
    g.step('Type the **Name** and the **Description** from the table.');
    g.step('Under **Cover photo**, click **Upload photo** and choose the photo from the table.');
    g.step(
      `Under **Inside collection (optional)**, choose the collection shown in the table (for ${topRest.join(', ').replace(/, ([^,]*)$/, ' and $1')} leave **— Top level —**). Leave **Show on the Collections page** ticked.`,
    );
    g.step(`At the bottom, click **Create collection** and wait for **${SAVED}**`);
    g.step('Repeat steps 1 to 5 for the next row of the table.');

    const firstSub = rest.find((c) => c.parent);
    for (const c of rest) {
      if (existing.has(c.title)) {
        g.note(`**${c.title}** already exists, so it is not created again.`);
        continue;
      }
      await openNewCollectionForm(admin);
      await fillName(admin, c);
      await f.description.click();
      await f.description.pressSequentially(c.description);
      await expect(f.description).toHaveText(c.description);
      await uploadCover(admin, c.cover);
      if (c.parent) await f.parent.selectOption({ label: c.parent });
      await expect(f.showOnPage).toBeChecked();
      await expect(f.handleInput).toHaveValue(c.handle);
      if (c === firstSub) await wholeAdminShot(g, admin, `${c.title} filled in: inside ${c.parent}`, { highlight: f.parent });
      await f.create.click();
      await expectCreated(admin, c);
    }
    g.expect(
      `After each **Create collection** the green message **${SAVED}** appears, and the saved page shows the chosen collection under **Inside collection (optional)**.`,
    );

    /* ------------------------------------------------------------ the list */
    g.part('Check the Collections list');
    await g.click(sidebarCollections(admin), 'In the left menu, click **Collections**.');
    await expect(admin.getByRole('heading', { level: 1, name: 'Collections', exact: true })).toBeVisible();
    await expect(admin.getByText(`${COLLECTIONS.length} collections`, { exact: true })).toBeVisible();
    for (const c of COLLECTIONS) {
      const row = listRow(admin, c.title);
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(c.parent ?? 'Top level');
      await expect(row).toContainText('Shown');
      await expect(row.locator('img')).toHaveAttribute('src', /\/uploads\//);
      await expect(row.getByRole('link', { name: 'View', exact: true })).toHaveAttribute('href', `/collections/${c.handle}`);
    }
    const insideText = [...new Set(COLLECTIONS.filter((c) => c.parent).map((c) => c.parent as string))]
      .map((p) => `${COLLECTIONS.filter((c) => c.parent === p).map((c) => c.title).join(' and ')} show **${p}**`)
      .join(', ');
    g.expect(
      `The list says **${COLLECTIONS.length} collections**. Every row has its cover photo and **Shown** in the _Collections page_ column. In the _Inside_ column ${insideText}; the others say **Top level**.`,
    );
    await wholeAdminShot(g, admin, `Collections list with all ${COLLECTIONS.length} collections`);
    g.data('Collections (web address)', COLLECTIONS.map((c) => `${c.title}: /collections/${c.handle}`).join('\n'));

    /* ------------------------------------------------------------ arrange */
    g.part(
      'Arrange the Collections page',
      'The store\'s **Collections** page ("Shop by Category") shows a card for every collection with **Show on the Collections page** ticked. ' +
        'The **Shop by Category** row on the home page shows the same cards in the same order (those with a cover photo, at most 24). New collections are added at the end, so put the four main departments first.',
    );
    await g.click(admin.getByRole('link', { name: 'Arrange Collections page' }), 'On the Collections list, click **Arrange Collections page** (top right).');
    await expect(admin.getByRole('heading', { level: 1, name: 'Collections page' })).toBeVisible();
    const homeHint = admin.getByText('Cards with a cover photo also make the home page', { exact: false });
    await expect(homeHint).toBeVisible();
    g.expect(
      'Under the heading **Collections page** the page explains: _"The cards on the store\'s Collections page (“Shop by Category”), in this order. Cards with a cover photo also make the home page\'s “Shop by Category” row (the first 24)."_',
    );
    await admin.waitForLoadState('networkidle');
    const cardList = admin.getByRole('list', { name: 'Collections page cards' });
    await expect(admin.getByTestId('index-card').first()).toBeVisible();
    const before = await cardTitles(admin);
    expect(before).toEqual(expect.arrayContaining(COLLECTIONS.map((c) => c.title)));
    g.expect(`All ${COLLECTIONS.length} collections are there as cards, numbered in the order the store shows them: ${listed(before)}.`);
    await wholeAdminShot(g, admin, 'Collections page cards before arranging', { highlight: homeHint });

    const final = [...TOP_ORDER, ...before.filter((t) => !TOP_ORDER.includes(t))];
    g.text(`Put **${TOP_ORDER.join('**, **')}** at the top, in that order, with the up arrow (**Move up**) on the right of each card:`);
    let moves = 0;
    for (let target = 0; target < TOP_ORDER.length; target++) {
      const title = TOP_ORDER[target];
      const from = (await cardTitles(admin)).indexOf(title);
      expect(from, `"${title}" card position`).toBeGreaterThanOrEqual(target);
      const clicks = from - target;
      if (clicks === 0) {
        g.step(`**${title}** is already card number ${target + 1}: leave it.`);
        continue;
      }
      g.step(`On the **${title}** card, click the up arrow (**Move up**) ${times(clicks)}, until it is card number ${target + 1}.`);
      for (let i = 0; i < clicks; i++) await moveUpOnce(admin, title);
      moves += clicks;
    }
    expect(await cardTitles(admin)).toEqual(final);
    g.note('You can also drag a card by the dotted handle on its left. The arrows are easier to control.');

    if (moves > 0) {
      await expect(admin.getByTestId('save-bar')).toContainText('Unsaved changes');
      g.expect(`The cards are now in this order: ${listed(final)}. The bar at the bottom says **Unsaved changes**.`);
      await g.click(admin.getByTestId('save-bar').getByRole('button', { name: 'Save order' }), 'At the bottom of the screen, click **Save order**.');
      await expect(admin.getByText(ORDER_SAVED)).toBeVisible();
      g.expect(`The green message **${ORDER_SAVED}** appears.`);
      await wholeAdminShot(g, admin, 'Collections page order saved', { highlight: admin.getByText(ORDER_SAVED) });
    } else {
      await expect(admin.getByTestId('save-bar').getByRole('button', { name: 'Save order' })).toBeDisabled();
      g.note('The cards were already in this order, so there is nothing to save (**Save order** stays grey).');
    }

    g.step('Reload the page (press **F5**).');
    await gotoPage(admin, '/admin/collections/arrange');
    await expect(cardList).toBeVisible();
    await expect.poll(() => cardTitles(admin)).toEqual(final);
    g.expect('After reloading, the cards are still in the new order.');

    /* ------------------------------------------------------------ the store */
    g.part('See the collections on the store', 'Now look at the store as a customer, in a browser where you are not signed in (for example a private window).');
    await g.goto(shopper, '/collections', `Open **${site}/collections**.`);
    const grid = shopper.locator('main section').filter({ has: shopper.getByRole('heading', { level: 1, name: 'Shop by Category' }) });
    await expect(grid.getByRole('heading', { level: 1, name: 'Shop by Category' })).toBeVisible();
    await expect(grid.getByRole('heading', { level: 2 })).toHaveText(final);
    const tile = (title: string): Locator =>
      grid.getByRole('link').filter({ has: shopper.getByRole('heading', { level: 2, name: title, exact: true }) });
    for (const t of final) {
      await expect(tile(t).getByRole('img', { name: t, exact: true })).toBeVisible();
      const c = COLLECTIONS.find((x) => x.title === t);
      if (c) await expect(tile(t)).toHaveAttribute('href', `/collections/${c.handle}`);
    }
    await expectImagesLoaded(shopper, 'main a[href^="/collections/"] img');
    g.expect(`The **Shop by Category** page shows ${final.length} cards in the saved order (${listed(final)}), each with its cover photo.`);
    await g.shot(shopper, 'Store: Shop by Category page', { fullPage: true });

    // Nothing between the heading and the cards (F02-3 of the previous run, the template sentence, is fixed).
    await expect(shopper.getByText('Add a short description', { exact: false })).toHaveCount(0);
    g.expect('The cards start right under the heading **Shop by Category**: there is no template sentence such as _"Add a short description for your collections"_.');

    // The description given to Google names this shop's collections, nothing it does not sell (F02-4, fixed).
    const meta = (await shopper.locator('head meta[name="description"]').first().getAttribute('content')) ?? '';
    const named = meta.match(/^Browse the .+ collections: (.+?)(?: and more)?\.$/);
    expect(named, `description of /collections: "${meta}"`).not.toBeNull();
    const names = (named as RegExpMatchArray)[1].split(', ');
    expect(names, `collections named in "${meta}"`).toEqual(final.slice(0, names.length));
    expect(meta).not.toMatch(/wardrobe|kitchen|doors|desks|kids|d[ée]cor|flooring/i);
    g.step('_(Optional)_ Right-click an empty part of the page, choose **View page source**, and search (**Ctrl+F**) for `name="description"`.');
    g.expect(
      `The description given to Google lists this shop's collections in the order of the page, and nothing else: “${meta}”`,
    );

    const sofas = byTitle('Sofas');
    await g.click(tile(sofas.title), `Click the **${sofas.title}** card.`);
    await expect(shopper).toHaveURL(new RegExp(`/collections/${sofas.handle}$`));
    await shopper.waitForLoadState('networkidle');
    const crumbs = shopper.getByRole('navigation', { name: 'breadcrumbs' });
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText(sofas.title);
    await expect(crumbs).toContainText(/Home\s*\/\s*Shop\s*\//);
    await expect(shopper.getByText('No products found')).toBeVisible();
    await expect(shopper.getByText(sofas.description)).toBeVisible();
    g.expect(
      `The address becomes **${storeUrl(sofas.handle)}**. The page shows _Home / Shop / ${sofas.title}_ at the top, **No products found**, and the description _"${sofas.description}"_ under it.`,
    );
    g.note('The collection is empty for now: products are put into their collections in section 3.');
    const shopSofas = shopper.getByRole('link', { name: STORE.announcementButton, exact: true });
    if ((await shopSofas.count()) && (await shopSofas.first().getAttribute('href')) === `/collections/${sofas.handle}`) {
      g.note(`The red **${STORE.announcementButton}** button in the dark bar at the top (section 1) links to this collection, so it no longer opens _Page not found_.`);
    }
    await g.shot(shopper, 'Store: the Sofas collection, no products yet', { fullPage: true });

    /* ------------------------------------------------------------ every web address */
    g.part('Check every collection\'s web address');
    g.step('Open each address below in the customer browser:');
    g.table(
      ['Collection', 'Address on the store'],
      COLLECTIONS.map((c) => [c.title, storeUrl(c.handle)]),
    );
    for (const c of COLLECTIONS) {
      await gotoPage(shopper, `/collections/${c.handle}`);
      expect(await documentStatus(shopper), `HTTP status of /collections/${c.handle}`).toBe(200);
      await expect(shopper.getByRole('heading', { name: 'Page not found' })).toHaveCount(0);
      await expect(crumbs.locator('[aria-current="page"]')).toHaveText(c.title);
      await expect(shopper.getByText(c.description)).toBeVisible();
    }
    g.expect(
      `All ${COLLECTIONS.length} addresses open their collection (none says _Page not found_): the collection's name is at the end of the line _Home / Shop / …_ at the top, and its description is under the products area.`,
    );

    /* ------------------------------------------------------------ home page tiles */
    // F02-5 of the previous run (the row used a fixed list of the old website's collections) is fixed: the row is
    // the Collections page cards that have a cover photo, in the saved order, each once.
    g.part('The "Shop by Category" row on the home page', 'The home page shows the cards of the Collections page as a sliding row of photos, in the same order.');
    await g.goto(shopper, '/', `Open the home page **${site}/** and scroll down to **Shop by Category**.`);
    const homeRow = shopper.locator('section').filter({ has: shopper.getByRole('heading', { level: 2, name: 'Shop by Category' }) });
    await expect(homeRow).toHaveCount(1);
    const slider = homeRow.getByRole('region', { name: 'Shop by Category' });
    await expect(slider).toBeVisible();
    /* every collection here has a cover photo, so the row is the whole saved order (at most 24) */
    const rowOrder = final.slice(0, 24);
    // the slider keeps copies of its tiles on both sides for the wrap-around; only the real ones can be tabbed to
    const realTiles = slider.locator('a[tabindex="0"]');
    await expect.poll(async () => (await realTiles.locator('h2').allTextContents()).map((t) => t.trim())).toEqual(rowOrder);
    for (const [i, t] of rowOrder.entries()) await expect(realTiles.nth(i)).toHaveAttribute('href', `/collections/${byTitle(t).handle}`);
    await expectImagesLoaded(shopper, 'section [role="region"][aria-label="Shop by Category"] a[tabindex="0"] img');
    /* the tiles actually in view on a computer screen: the first three, each once */
    await homeRow.scrollIntoViewIfNeeded();
    const inView = await slider.evaluate((region) => {
      const r = region.getBoundingClientRect();
      return Array.from(region.querySelectorAll('a'))
        .filter((a) => {
          const b = a.getBoundingClientRect();
          return b.width > 0 && b.left >= r.left - 2 && b.right <= r.right + 2;
        })
        .map((a) => a.querySelector('h2')?.textContent?.trim() ?? '');
    });
    expect(inView, 'home tiles in view').toEqual(rowOrder.slice(0, 3));
    const dots = homeRow.getByRole('list', { name: 'Category slides' }).getByRole('button');
    await expect(dots).toHaveCount(rowOrder.length);
    g.expect(
      `The row shows the same ${rowOrder.length} collections as the Collections page, in the saved order: ${listed(rowOrder)}. ` +
        `On a computer screen the first three (${inView.join(', ')}) are in view, each with its cover photo; the row slides on to the others (drag it, or click one of the ${rowOrder.length} dots next to it).`,
    );
    g.note(
      'The row follows **Arrange Collections page** by itself: change the order there and the home page changes with it. A collection without a cover photo, or with **Show on the Collections page** unticked, is left out of the row; when no collection is left, the home page has no **Shop by Category** row at all.',
    );
    await g.shot(shopper, 'Home page: Shop by Category in the saved order', { highlight: homeRow });

    const firstTile = byTitle(rowOrder[0]);
    await g.click(realTiles.first(), `Click the first photo in the row, **${firstTile.title}**.`);
    await expect(shopper).toHaveURL(new RegExp(`/collections/${firstTile.handle}$`));
    await expect(shopper.getByRole('navigation', { name: 'breadcrumbs' }).locator('[aria-current="page"]')).toHaveText(firstTile.title);
    g.expect(`The **${firstTile.title}** collection opens (**${storeUrl(firstTile.handle)}**).`);
  },
};

export default section;
