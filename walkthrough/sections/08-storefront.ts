import { expect, type Locator, type Page } from '@playwright/test';
import type { Section } from '../context';
import { gotoPage, type Guide } from '../guide';
import { BANNERS, BLOG_POSTS, COLLECTIONS, MENUS, PRODUCTS, SHOPPER, STORE, type ProductData } from '../data';

/**
 * Section 08 — a customer shopping on a computer (the separate, signed-out "shopper" browser):
 * home page (strip, Hot Selling Products, Shop by Category, text block), banners, mega menu, collection cards / sort /
 * filters, search, ordering on WhatsApp (order + availability messages), newsletter, WhatsApp chat bubble, no customer
 * accounts, the built-in Contact us form and wrong addresses. Admin-side results (inquiries, messages) are checked in
 * section 10.
 */

/** Fixed in code (GENERAL_QUESTION_TEXT): the floating chat button's message. */
const CHAT_TEXT = 'Hello Cozy Furnitures! I have a question.';
/** The shop's name (NEXT_PUBLIC_SITE_NAME; the logo link is "<name> home"). */
const SHOP_NAME = 'Cozy Furnitures';

const rs = (n: number | string) => `Rs.${Number(n).toLocaleString('en-US')}`;
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function productData(handle: string): ProductData {
  const p = PRODUCTS.find((x) => x.handle === handle);
  if (!p) throw new Error(`data.ts has no product ${handle}`);
  return p;
}

function collectionData(title: string) {
  const c = COLLECTIONS.find((x) => x.title === title);
  if (!c) throw new Error(`data.ts has no collection ${title}`);
  return c;
}

/**
 * What a product card shows for a product: the lowest price of any option; the struck-through price and the “% off”
 * circle only when that cheapest option itself is on sale (taken from that same option, never from another one).
 */
function cardFacts(p: ProductData) {
  const vs = p.variants ?? [{ values: [], regular: p.regular ?? '0', sale: p.sale, status: p.status ?? 'Ready to ship' }];
  const selling = (v: (typeof vs)[number]) => Number(v.sale ?? v.regular);
  const price = Math.min(...vs.map(selling));
  const cheapest = vs.filter((v) => selling(v) === price);
  const was = Math.max(0, ...cheapest.map((v) => (v.sale && Number(v.regular) > Number(v.sale) ? Number(v.regular) : 0)));
  const compare = was || null;
  const pct = compare ? Math.round(((compare - price) / compare) * 100) : null;
  const statuses = vs.map((v) => v.status);
  const bar = statuses.includes('Ready to ship')
    ? 'Ready to ship'
    : statuses.includes('Pre-order')
      ? 'Pre-Order'
      : statuses.includes('Made to order')
        ? null
        : 'Sold Out';
  return { price, compare, pct, bar, cheapest };
}

/** Checks a product card's price, struck-through price and “% off” circle against cardFacts. */
async function expectCardPrice(card: Locator, p: ProductData) {
  const f = cardFacts(p);
  await expect(card.locator('.price ins')).toHaveText(rs(f.price));
  if (f.compare) await expect(card.locator('.price del')).toHaveText(rs(f.compare));
  else await expect(card.locator('.price del')).toHaveCount(0);
  if (f.pct) await expect(card.getByText(new RegExp(`^${f.pct}%\\s*off$`, 'i'))).toBeVisible();
  else await expect(card.getByText(/%\s*off$/i)).toHaveCount(0);
  return f;
}

const priceCell = (f: ReturnType<typeof cardFacts>) => (f.compare ? `${rs(f.price)} (and ${rs(f.compare)} struck through)` : rs(f.price));

/** The product card in a grid/row, found by its title link. */
function cardIn(scope: Locator, title: string): Locator {
  return scope.locator('.product-card').filter({ has: scope.page().getByRole('link', { name: title, exact: true }) });
}

/** Click a WhatsApp button, read the address of the tab it opens (WhatsApp itself is blocked), close that tab. */
async function openWhatsApp(page: Page, trigger: Locator): Promise<{ url: URL; lines: string[] }> {
  const popupPromise = page.waitForEvent('popup');
  await trigger.click();
  const popup = await popupPromise;
  await popup.waitForURL(/wa\.me|whatsapp\.com/);
  await expect(popup.getByText('WhatsApp (blocked in test)')).toBeVisible();
  const url = new URL(popup.url());
  await popup.close();
  await page.bringToFront();
  return { url, lines: (url.searchParams.get('text') ?? '').split('\n') };
}

/** The home slider pauses while the mouse is over it: keeps a photo from being caught in the middle of a cross-fade. */
async function holdSlider(page: Page) {
  await page.getByRole('region', { name: 'Featured' }).hover();
}

/** The reader scrolls back up to the top of the page. */
async function scrollToTop(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}

function messageTable(g: Guide, lines: string[]) {
  g.table(
    ['Line', 'Text of the WhatsApp message'],
    lines.map((l, i) => [String(i + 1), l.trim() ? '`' + l + '`' : '_(empty line)_']),
  );
}

const section: Section = {
  id: '08',
  title: '8. Shopping on the store (desktop)',
  intro:
    'Here we use the shop the way a customer does on a computer: the home page, the menu, collections, search, choosing options and ordering on WhatsApp, the newsletter, sending the shop a message and what happens with wrong addresses. Use a separate browser window that is **not** signed in to the admin (for example a private / incognito window).',

  async run(ctx) {
    const g = ctx.guide;
    const page = ctx.shopper;
    const origin = new URL(ctx.baseURL).origin;
    const banner = page.getByRole('banner');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    const grid = page.locator('#product-grid');

    // WhatsApp itself is not opened during the test: its pages are replaced by a short placeholder.
    await page.context().route(/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)/, (r) =>
      r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>WhatsApp (blocked in test)</h1>' }),
    );
    g.note(
      'During this test the WhatsApp website is blocked, so every WhatsApp button opens a tab that only says “WhatsApp (blocked in test)”. We read the message from that tab’s address. On a real computer or phone, WhatsApp opens with the message already typed and the customer only presses Send.',
    );

    const antonin = productData('antonin-sofa');
    const arbour = productData('arbour-dining-set');
    const apex = productData('apex-manager-chair');
    const draft = PRODUCTS.find((p) => p.draft);
    const visibleBanners = BANNERS.filter((b) => b.visible);
    const hiddenBanners = BANNERS.filter((b) => !b.visible);

    /* ------------------------------------------------------------------ 8.1 home */
    g.part('8.1 The home page');
    await g.goto(page, '/', `Open the shop’s home page: **${origin}/**`);
    await expect(page.getByText(STORE.announcement, { exact: true })).toBeVisible();
    g.expect(`The dark bar at the very top shows the announcement **${STORE.announcement}** (set in Settings, section 1).`);

    const slides = page.locator('[aria-roledescription="slide"]');
    await expect(slides).toHaveCount(visibleBanners.length);
    for (const b of visibleBanners) await expect(slides.locator(`a[aria-label="${b.name}"]`)).toHaveCount(1);
    for (const b of hiddenBanners) await expect(slides.locator(`a[aria-label="${b.name}"]`)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Go to slide \d+$/ })).toHaveCount(visibleBanners.length);
    g.expect(
      `The big photo slider shows **${visibleBanners.length} banners** (${visibleBanners.map((b) => `“${b.name}”`).join(', ')}), with one dot per banner under the photo. ${
        hiddenBanners.length ? `${hiddenBanners.map((b) => `“${b.name}”`).join(', ')} is not shown because its **Show on the store** switch is off.` : ''
      }`,
    );

    // F01-1 of the previous run (fixed texts of the old website) is fixed: the strip and the text block come from
    // Settings → Home page (filled in section 1) and are hidden while empty.
    const strip = page.getByRole('region', { name: 'Announcement', exact: true });
    await expect(strip).toBeVisible();
    for (const m of STORE.homeStrip) await expect(strip).toContainText(m);
    await expect(page.getByText('FREE Nationwide Delivery!')).toHaveCount(0);
    g.expect(
      `Under the slider, a yellow strip scrolls the messages typed in **Settings → Home page** (section 1): ${STORE.homeStrip.map((m) => `“${m}”`).join(' and ')}.`,
    );

    // F08-1 of the previous run (a fixed list of the old shop's products) is fixed: the row = published Best sellers.
    const hot = page.getByRole('region', { name: 'Hot Selling Products' });
    const bestSellers = PRODUCTS.filter((p) => p.bestSeller && !p.draft);
    const notHot = PRODUCTS.filter((p) => !p.draft && !p.bestSeller);
    const hotRows: string[][] = [];
    let hotOrder: string[] = [];
    if (bestSellers.length) {
      await expect(page.getByRole('heading', { level: 2, name: 'Hot Selling Products' })).toBeVisible();
      await expect(hot.locator('.product-card')).toHaveCount(bestSellers.length);
      for (const p of bestSellers) await expect(hot.getByRole('link', { name: p.title, exact: true })).toBeVisible();
      for (const p of notHot) await expect(hot.getByRole('link', { name: p.title, exact: true })).toHaveCount(0);
      hotOrder = (await hot.locator('.product-card .product-card-info a').allTextContents()).map((t) => t.trim());
      for (const title of hotOrder) {
        const p = bestSellers.find((x) => x.title === title)!;
        const f = await expectCardPrice(cardIn(hot, p.title), p);
        hotRows.push([`**${p.title}**`, priceCell(f), f.pct ? `${f.pct}% off` : '—']);
      }
      g.expect(
        `Next comes **Hot Selling Products** with exactly the products ticked **Best seller** in section 3 — ${hotOrder.map((t) => `**${t}**`).join(', ')} (the most recently changed first) — and no other product. Their cards show:`,
      );
      g.table(['Card', 'Price', 'Red circle'], hotRows);
    } else {
      await expect(page.getByRole('heading', { name: 'Hot Selling Products' })).toHaveCount(0);
      g.expect('There is no **Hot Selling Products** row: no product is ticked **Best seller**.');
    }

    // F02-5 of the previous run is fixed: the row = the Collections page cards with a cover photo, in the saved order.
    const tiles = page.getByRole('region', { name: 'Shop by Category' });
    const withCover = COLLECTIONS.filter((c) => c.cover);
    // the slider keeps copies of its tiles on both sides for the wrap-around; only the real ones can be tabbed to
    const realTiles = tiles.locator('a[tabindex="0"]');
    await expect(page.getByRole('heading', { level: 2, name: 'Shop by Category' })).toBeVisible();
    await expect(realTiles).toHaveCount(Math.min(withCover.length, 24));
    const tileOrder = (await realTiles.locator('h2').allTextContents()).map((t) => t.trim());
    expect([...tileOrder].sort(), 'home tiles = the collections with a cover photo').toEqual(withCover.map((c) => c.title).sort());
    // same order as the cards of the store's Collections page (read in a second tab; section 2 documents that page)
    const collectionsTab = await page.context().newPage();
    await gotoPage(collectionsTab, '/collections');
    const pageOrder = (
      await collectionsTab
        .locator('main section')
        .filter({ has: collectionsTab.getByRole('heading', { level: 1, name: 'Shop by Category' }) })
        .getByRole('heading', { level: 2 })
        .allTextContents()
    ).map((t) => t.trim());
    await collectionsTab.close();
    await page.bringToFront();
    expect(tileOrder, 'home tiles in the Collections page order').toEqual(pageOrder.filter((t) => withCover.some((c) => c.title === t)).slice(0, 24));
    g.expect(
      `**Shop by Category** shows all ${tileOrder.length} collections, each once with its cover photo, in the order of the store’s Collections page (set in section 2 under **Arrange Collections page**): ${tileOrder.join(', ')}.`,
    );

    // F01-2 of the previous run is fixed: no review cards and no Store rating setting.
    await expect(page.getByText('Our customer speaks for us')).toHaveCount(0);
    g.expect('There is no customer-reviews block (“Our customer speaks for us”): the shop has no product reviews.');

    const textBlock = page.getByTestId('home-text-block');
    await expect(textBlock.getByRole('heading', { name: STORE.homeTextHeading, exact: true })).toBeVisible();
    await expect(textBlock).toContainText(STORE.homeText);
    await expect(textBlock.getByRole('switch')).toHaveCount(0);
    await expect(page.getByText('The Same Experience & Quality You Trust Online')).toHaveCount(0);
    g.expect(
      `Just above the footer, the text block from **Settings → Home page** (section 1): the heading **${STORE.homeTextHeading}** and the text “${STORE.homeText}” — in full, without a **Show more** link, because it is short.`,
    );
    await holdSlider(page);
    await g.shot(page, 'Home page: banners, yellow strip, Hot Selling Products, Shop by Category and the text block', { fullPage: true });

    /* ------------------------------------------------------------------ 8.2 banners + menu */
    g.part('8.2 Banners and the main menu');
    const dot = page.getByRole('button', { name: 'Go to slide 2' });
    await scrollToTop(page);
    await g.click(dot, 'Go back to the top of the home page. Under the big photo, click the **second dot**.');
    await expect(dot).toHaveAttribute('aria-current', 'true');
    const activeSlide = page.locator('[aria-roledescription="slide"][aria-hidden="false"] a');
    const slideName = (await activeSlide.getAttribute('aria-label')) ?? '';
    const slideBanner = BANNERS.find((b) => b.name === slideName);
    expect(slideBanner, `banner "${slideName}" from data.ts`).toBeTruthy();
    const slideTarget = collectionData(slideBanner!.link);
    g.expect(`The slider moves to the second banner (**${slideName}**).`);
    await g.click(activeSlide, `Click the banner photo.`);
    await expect(page).toHaveURL(new RegExp(`/collections/${reEsc(slideTarget.handle)}$`));
    await expect(page.getByRole('navigation', { name: 'breadcrumbs' })).toContainText(slideTarget.title);
    const inTarget = PRODUCTS.filter((p) => !p.draft && p.collections.includes(slideTarget.title));
    for (const p of inTarget) await expect(grid.getByRole('link', { name: p.title, exact: true })).toBeVisible();
    g.expect(
      `The **${slideTarget.title}** collection opens (the banner’s link from section 5)${inTarget.length ? `, showing ${inTarget.map((p) => `**${p.title}**`).join(', ')}` : ''}.`,
    );

    const firstItem = MENUS.main[0];
    const withDropdown = MENUS.main.find((m) => m.children.includes('Sofas')) ?? MENUS.main[0];
    const sofas = collectionData('Sofas');
    g.step(`In the menu under the logo, move the mouse over **${withDropdown.label}** (do not click). A drop-down panel opens.`);
    await scrollToTop(page);
    await nav.getByRole('link', { name: withDropdown.label, exact: true }).hover();
    const sofasLink = nav.getByRole('link', { name: 'Sofas', exact: true });
    for (const child of withDropdown.children) await expect(nav.getByRole('link', { name: child, exact: true })).toBeVisible();
    g.expect(`The panel lists ${withDropdown.children.map((c) => `**${c}**`).join(' and ')}.`);
    await g.shot(page, `Main menu: the ${withDropdown.label} drop-down`, { highlight: sofasLink });
    await g.click(sofasLink, 'Click **Sofas** in the panel.');
    await expect(page).toHaveURL(new RegExp(`/collections/${reEsc(sofas.handle)}(\\?|$)`));
    g.expect(`The **Sofas** collection opens (address ends in \`/collections/${sofas.handle}\`).`);
    // F08-2 of the previous run is fixed: the first main-menu item is drawn like the others.
    const menuLook = (label: string) =>
      nav.getByRole('link', { name: label, exact: true }).evaluate((el) => {
        const cs = getComputedStyle(el);
        return `${cs.backgroundColor} ${cs.color} ${cs.fontWeight}`;
      });
    g.step('Move the mouse away from the menu, down onto the page.');
    await page.mouse.move(0, 600);
    for (const child of withDropdown.children) await expect(nav.getByRole('link', { name: child, exact: true })).toBeHidden();
    g.expect(`The drop-down panel closes.`);
    await expect(nav.getByRole('link', { name: firstItem.label, exact: true })).not.toHaveClass(/bg-maroon/);
    for (const m of MENUS.main.slice(1)) expect(await menuLook(firstItem.label), `menu item ${m.label} looks like the first`).toBe(await menuLook(m.label));
    g.expect(`In the menu, **${firstItem.label}** (the first item) looks like all the others: black text on white, no coloured block.`);

    /* ------------------------------------------------------------------ 8.3 collection page */
    g.part('8.3 A collection page: product cards, sorting and filters');
    const sofaProducts = PRODUCTS.filter((p) => !p.draft && p.collections.includes('Sofas'));
    await expect(grid.locator('.product-card')).toHaveCount(sofaProducts.length);
    await expect(page.getByText(`${sofaProducts.length} products`, { exact: true }).filter({ visible: true })).toBeVisible();
    g.expect(`The page shows **${sofaProducts.length} products** (count on the right of the toolbar): ${sofaProducts.map((p) => `**${p.title}**`).join(', ')}.`);

    const cardRows: string[][] = [];
    for (const p of sofaProducts) {
      const card = cardIn(grid, p.title);
      const f = await expectCardPrice(card, p);
      if (f.bar) await expect(card.getByText(f.bar, { exact: true })).toBeVisible();
      if (p.newArrival) await expect(card.getByText('NEW', { exact: true })).toBeVisible();
      else await expect(card.getByText('NEW', { exact: true })).toBeHidden();
      if (p.limitedEdition) await expect(card.getByText('Limited Edition', { exact: true })).toBeVisible();
      const colour = p.options?.find((o) => /^colou?r$/i.test(o.name));
      if (colour) await expect(card.locator('[aria-label="Colours"] > span')).toHaveCount(colour.values.length);
      cardRows.push([
        `**${p.title}**`,
        [p.newArrival ? 'red **NEW** above the title' : '', p.limitedEdition ? 'yellow **LIMITED EDITION** bar' : ''].filter(Boolean).join(', ') || '—',
        priceCell(f),
        f.pct ? `${f.pct}% off` : '—',
        f.bar ? f.bar.toUpperCase() : '—',
        colour ? `${colour.values.length} colour dots (${colour.values.join(', ')})` : '—',
      ]);
    }
    g.table(['Card', 'Labels', 'Price', 'Red circle', 'Dark bar on the photo', 'Colours'], cardRows);
    g.expect('Each card shows exactly what the table above says.');
    await g.shot(page, 'Sofas collection: product cards with NEW, Limited Edition, sale price and status bars', { highlight: grid });

    // F08-3 of the previous run is fixed: price, struck-through price and "% off" all come from the cheapest option.
    const af = cardFacts(antonin);
    const onSale = antonin.variants?.find((v) => v.sale);
    const cheapestOpt = af.cheapest[0];
    if (onSale && cheapestOpt && !cheapestOpt.sale) {
      expect(af.compare).toBeNull();
      g.expect(
        `The ${antonin.title} card shows **${rs(af.price)}**, the price of its cheapest option (${cheapestOpt.values.join(' / ')}), with no struck-through price and no “% off” circle: that option is not on sale. The sale of the ${onSale.values.join(' / ')} (${rs(onSale.sale!)} instead of ${rs(onSale.regular)}) shows on the product page once that option is chosen. A card never mixes the price of one option with the old price of another.`,
      );
    }

    // Availability filter
    await g.click(page.getByRole('button', { name: 'Availability', exact: true }), 'In the **Filter:** row above the products, click **Availability**.');
    // a product counts as "in stock" when any option is not sold out, "out of stock" when one is
    const statusesOf = (p: ProductData) => p.variants?.map((v) => v.status) ?? [p.status];
    const inStockN = sofaProducts.filter((p) => statusesOf(p).some((s) => s !== 'Sold out')).length;
    const anySoldOut = sofaProducts.some((p) => statusesOf(p).includes('Sold out'));
    await expect(page.locator('#avail-d-1')).toBeEnabled();
    await expect(page.locator('#avail-d-1').locator('..')).toHaveText(new RegExp(`^\\s*In stock\\s*\\(${inStockN}\\)\\s*$`));
    await expect(page.locator('#avail-d-0').locator('..')).toHaveText(/^\s*Out of stock\s*\(\d+\)\s*$/);
    if (!anySoldOut) {
      await expect(page.locator('#avail-d-0')).toBeDisabled();
      await expect(page.locator('#avail-d-0').locator('..')).toHaveText(/\(0\)/);
    }
    g.expect(
      `A small list opens with **In stock (${inStockN})** and **Out of stock**${anySoldOut ? '' : ' (0), which is greyed out because nothing in Sofas is sold out'}.`,
    );
    await g.click(page.getByRole('button', { name: 'Availability', exact: true }), 'Click **Availability** again to close the list.');

    // Sort
    const sortSelect = page.locator('#sort-by-d');
    await g.form([{ label: 'Sort by (right side of the toolbar)', value: 'Price, low to high', locator: sortSelect, kind: 'select' }], 'Change the sort order:');
    await expect(page).toHaveURL(/sort_by=price-ascending/);
    const byPrice = [...sofaProducts].sort((a, b) => cardFacts(a).price - cardFacts(b).price);
    await expect(grid.locator('.product-card').first()).toContainText(byPrice[0].title);
    g.expect(`The cheapest product, **${byPrice[0].title}** (${rs(cardFacts(byPrice[0]).price)}), moves to the first place.`);

    // Price filter
    // the store's "highest price" = the highest selling price (sale price when there is one) of any option
    const sellingPrices = (p: ProductData) => (p.variants ?? [{ regular: p.regular ?? '0', sale: p.sale }]).map((v) => Number(v.sale ?? v.regular));
    const highest = Math.max(...sofaProducts.flatMap(sellingPrices));
    await g.click(page.getByRole('button', { name: 'Price', exact: true }), 'In the **Filter:** row, click **Price**.');
    await expect(page.getByText(`The highest price is ${rs(highest)}`).filter({ visible: true })).toBeVisible();
    const maxBox = page.getByRole('textbox', { name: 'Maximum price' });
    await expect(page.getByRole('textbox', { name: 'Minimum price' })).toHaveValue('');
    await expect(maxBox).toHaveValue('');
    g.expect(`The box says **The highest price is ${rs(highest)}** and has two empty price boxes (from / to).`);
    const limit = 100000;
    await g.form([{ label: 'Second price box (“to”)', value: String(limit), locator: maxBox }], 'Type the highest price you want to see, then press **Enter**:');
    await maxBox.press('Enter');
    await expect(page).toHaveURL(new RegExp(`filter\\.v\\.price\\.lte=${limit}`));
    const underLimit = sofaProducts.filter((p) => sellingPrices(p).some((n) => n <= limit));
    await expect(grid.locator('.product-card')).toHaveCount(underLimit.length);
    for (const p of underLimit) await expect(grid.getByRole('link', { name: p.title, exact: true })).toBeVisible();
    const pill = page.getByRole('link', { name: `${rs(0)} - ${rs(limit)}`, exact: true });
    await expect(pill).toBeVisible();
    g.expect(
      `Only products with a price up to ${rs(limit)} stay: ${underLimit.map((p) => `**${p.title}**`).join(', ') || 'none'}. A round tag **${rs(0)} - ${rs(limit)}** and **Clear all** appear under the toolbar.`,
    );
    await g.shot(page, `Sofas filtered to prices up to ${rs(limit)}`, { highlight: pill });
    await g.click(page.getByRole('link', { name: 'Clear all', exact: true }), 'Click **Clear all**.');
    await expect(page).not.toHaveURL(/filter\.v\.price/);
    await expect(grid.locator('.product-card')).toHaveCount(sofaProducts.length);
    g.expect(`All ${sofaProducts.length} sofas are back.`);
    await expect(sortSelect.locator('option')).toHaveText([
      'Featured',
      'Most relevant',
      'Best selling',
      'Alphabetically, A-Z',
      'Alphabetically, Z-A',
      'Price, low to high',
      'Price, high to low',
      'Date, old to new',
      'Date, new to old',
    ]);
    g.note(
      'A collection page can be filtered only by **Availability** and **Price** (plus a **Discount %** list on phones). **Sort by** offers Featured, Most relevant, Best selling (products ticked **Best seller** first), A-Z / Z-A, price and date. There is no filter by colour, size or material.',
    );

    /* ------------------------------------------------------------------ 8.4 search */
    g.part('8.4 Searching');
    await g.click(banner.getByRole('link', { name: 'Search', exact: true }), 'Click the **magnifying glass** at the top right of the page.');
    const searchBox = banner.getByRole('searchbox', { name: 'Search for anything' });
    await expect(searchBox).toBeVisible();
    await g.form([{ label: 'Search for anything', value: SHOPPER.search, locator: searchBox, kind: 'type' }], 'A search bar slides down. Type:');
    const searchHits = PRODUCTS.filter((p) => !p.draft && (p.title + ' ' + p.description).toLowerCase().includes(SHOPPER.search.toLowerCase()));
    for (const p of searchHits) await expect(banner.getByRole('link', { name: new RegExp(reEsc(p.title)) })).toBeVisible();
    g.expect(`While typing, the bar already lists matching products with photo and price under **Products**: ${searchHits.map((p) => `**${p.title}**`).join(', ')}.`);
    await g.shot(page, `Search bar suggestions for “${SHOPPER.search}”`, { highlight: searchBox });

    // the other two tabs: blog posts and collections whose title contains the word
    const q = SHOPPER.search.toLowerCase();
    const postHits = BLOG_POSTS.filter((b) => b.title.toLowerCase().includes(q));
    const collectionHits = COLLECTIONS.filter((c) => c.title.toLowerCase().includes(q));
    await g.click(banner.getByRole('button', { name: 'Articles', exact: true }), 'Click **Articles** above the results.');
    for (const b of postHits) await expect(banner.getByRole('link', { name: b.title, exact: true })).toBeVisible();
    g.expect(postHits.length ? `It lists the blog post${postHits.length > 1 ? 's' : ''} ${postHits.map((b) => `**${b.title}**`).join(', ')} (section 7).` : 'No blog post title contains the word.');
    await g.click(banner.getByRole('button', { name: 'Suggestions', exact: true }), 'Click **Suggestions**.');
    for (const c of collectionHits) await expect(banner.getByRole('link', { name: c.title, exact: true })).toBeVisible();
    g.expect(collectionHits.length ? `It lists the collection${collectionHits.length > 1 ? 's' : ''} ${collectionHits.map((c) => `**${c.title}**`).join(', ')}.` : 'No collection title contains the word.');

    g.step('Click in the search box again and press **Enter** on the keyboard.');
    await searchBox.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/search\\?q=${reEsc(SHOPPER.search)}`));
    await expect(page.getByRole('heading', { level: 1, name: 'Search Results' })).toBeVisible();
    for (const p of searchHits) await expect(grid.getByRole('link', { name: p.title, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Availability', exact: true })).toBeVisible();
    await expect(page.locator('#sort-by-d')).toBeVisible();
    const resultsCount = page.getByText(`${searchHits.length} result${searchHits.length === 1 ? '' : 's'}`, { exact: true }).filter({ visible: true });
    await expect(resultsCount).toBeVisible();
    // F08-4 of the previous run is fixed: the sentence is always shown (no "Show more" link).
    const summary = page.getByText(`${searchHits.length} result${searchHits.length === 1 ? '' : 's'} found for “${SHOPPER.search}”`, { exact: true });
    await expect(summary).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Show more' })).toHaveCount(0);
    g.expect(
      `The **Search Results** page says **${searchHits.length} results found for “${SHOPPER.search}”** under the search box, and lists ${searchHits.map((p) => `**${p.title}**`).join(' and ')} as product cards, with the same Filter / Sort by toolbar as a collection and **${searchHits.length} results** at its right end.`,
    );
    await g.shot(page, `Search Results for “${SHOPPER.search}”`, { highlight: summary });

    /* ------------------------------------------------------------------ 8.5 order on WhatsApp */
    g.part('8.5 Choosing options and ordering on WhatsApp');
    await g.click(grid.getByRole('link', { name: antonin.title, exact: true }), `Click **${antonin.title}** in the results.`);
    await expect(page).toHaveURL(new RegExp(`/products/${reEsc(antonin.handle)}`));
    const h1 = page.getByRole('heading', { level: 1, name: antonin.title });
    await expect(h1).toBeVisible();
    const orderBtn = page.locator('[data-testid=order-on-whatsapp][data-ready=true]');
    await expect(orderBtn).toBeVisible();
    g.expect(`The ${antonin.title} page opens: photos on the left; title, price, options and the WhatsApp button on the right.`);

    const pick = antonin.variants!.find((v) => v.values[0] === '2 Seater' && v.values[1] === 'Beige')!;
    const [sizeOpt, colorOpt] = antonin.options!;
    await g.form(
      [
        { label: sizeOpt.name, value: `click **${pick.values[0]}**`, kind: 'click', locator: page.getByRole('button', { name: pick.values[0], exact: true }) },
        { label: colorOpt.name, value: `click the **${pick.values[1]}** colour dot (the light one)`, kind: 'click', locator: page.getByRole('button', { name: pick.values[1], exact: true }) },
        { label: 'Quantity', value: 'click **+** once (the box shows **2**)', kind: 'click', locator: page.getByRole('button', { name: 'Increase quantity' }) },
      ],
      'Choose the options:',
    );
    const head = h1.locator('..');
    await expect(page.getByText(`${sizeOpt.name}: ${pick.values[0]}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${colorOpt.name}: ${pick.values[1]}`, { exact: true })).toBeVisible();
    await expect(head.locator('ins')).toHaveText(rs(pick.sale ?? pick.regular));
    if (!pick.sale) await expect(head.locator('del')).toHaveCount(0);
    await expect(page.getByText(/^Made to Order — our team will confirm the delivery time with you\.?$/)).toBeVisible();
    const freeTag = page.getByText('Free Delivery!', { exact: true });
    if (antonin.delivery) {
      await expect(page.getByText(antonin.delivery, { exact: true })).toBeVisible();
      await expect(freeTag).toBeVisible();
    }
    await expect(page.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('2');
    await expect(page).toHaveURL(/[?&]variant=\d+/);
    // the gallery leads with the photo tagged with the chosen colour
    const taggedIndex = Number(Object.entries(antonin.photoTags ?? {}).find(([, tag]) => tag === `${colorOpt.name}: ${pick.values[1]}`)?.[0] ?? -1);
    const taggedFile = taggedIndex >= 0 ? antonin.photos[taggedIndex].split('/').pop()!.replace(/\.[^.]+$/, '') : '';
    const firstThumb = page.getByRole('button', { name: 'Show image 1' });
    if (taggedFile) {
      await expect(firstThumb).toHaveAttribute('aria-current', 'true');
      await expect(firstThumb.locator('img')).toHaveAttribute('src', new RegExp(`${reEsc(taggedFile)}-[0-9a-f]+\\.webp`));
      await expect(page.getByRole('button', { name: 'Zoom' }).locator('..').locator('div[aria-hidden="false"] img')).toHaveAttribute(
        'src',
        new RegExp(`${reEsc(taggedFile)}-`),
      );
    }
    g.expect(
      `Above the buttons it reads **${sizeOpt.name}: ${pick.values[0]}** and **${colorOpt.name}: ${pick.values[1]}**; the price is **${rs(pick.sale ?? pick.regular)}**${pick.sale ? '' : ' (no struck price)'}${antonin.delivery ? ' with a red **FREE DELIVERY!** tag under it' : ''}; under the button: **“Made to Order — our team will confirm the delivery time with you.”**${antonin.delivery ? ` and “${antonin.delivery}”` : ''}. ${taggedFile ? `The big photo jumps to the ${pick.values[1]} photo (\`${antonin.photos[taggedIndex]}\`, tagged “${colorOpt.name}: ${pick.values[1]}” in section 3), which is now also the first small photo on the left. ` : ''}The quantity box shows **2**.`,
    );
    await expect(orderBtn).toHaveText(/order on whatsapp/i);
    await g.shot(page, `${antonin.title}: ${pick.values.join(' / ')}, quantity 2, ready to order`, { highlight: orderBtn });

    g.step('Click **ORDER ON WHATSAPP**.');
    const order = await openWhatsApp(page, orderBtn);
    const variantId = new URL(page.url()).searchParams.get('variant');
    const productUrl = `${origin}/products/${antonin.handle}?variant=${variantId}`;
    expect(`${order.url.origin}${order.url.pathname}`).toBe(`https://wa.me/${STORE.whatsappStored}`);
    expect(order.lines[0].trim()).not.toBe('');
    expect(order.lines[1]).toBe(`*${antonin.title}*`);
    const orderPrice = `Price: ${rs(pick.sale ?? pick.regular)} each${pick.sale ? ` (was ${rs(pick.regular)})` : ''}`;
    expect(order.lines.slice(2, 6)).toEqual([`${sizeOpt.name}: ${pick.values[0]}`, `${colorOpt.name}: ${pick.values[1]}`, 'Quantity: 2', orderPrice]);
    expect(order.lines).toContain(productUrl);
    expect(order.lines.at(-1)?.trim()).not.toBe('');
    g.expect(
      `A new tab opens WhatsApp for the shop’s number **${STORE.whatsappStored}** (wa.me/${STORE.whatsappStored}) with this message already typed — greeting, product in bold, the chosen options, quantity, price, a link back to exactly this option, and the closing line:`,
    );
    messageTable(g, order.lines);
    g.note('Every click on a WhatsApp button is also counted under **WhatsApp inquiries** in the admin (checked in section 10). The customer’s actual message arrives in the shop’s WhatsApp, not in the admin.');

    /* ------------------------------------------------------------------ 8.6 pre-order + sold out */
    g.part('8.6 Pre-order and sold-out products');
    const diningItem = MENUS.main.find((m) => m.link === arbour.collections[0]) ?? MENUS.main.find((m) => m.label === 'Dining')!;
    const dining = collectionData(arbour.collections[0]);
    await g.click(nav.getByRole('link', { name: diningItem.label, exact: true }), `In the main menu, click **${diningItem.label}**.`);
    await expect(page).toHaveURL(new RegExp(`/collections/${reEsc(dining.handle)}`));
    const arbourCard = cardIn(grid, arbour.title);
    await expect(arbourCard.getByText('Pre-Order', { exact: true })).toBeVisible();
    g.expect(`The ${dining.title} collection shows **${arbour.title}** with a dark **PRE-ORDER** bar on its photo.`);
    await g.click(grid.getByRole('link', { name: arbour.title, exact: true }), `Click **${arbour.title}**.`);
    const arbourH1 = page.getByRole('heading', { level: 1, name: arbour.title });
    await expect(arbourH1).toBeVisible();
    const askBtn = page.locator('[data-testid=order-on-whatsapp][data-ready=true]');
    await expect(askBtn).toHaveText(/ask about availability/i);
    await expect(arbourH1.locator('..').locator('ins')).toHaveText(rs(arbour.sale ?? arbour.regular!));
    await expect(arbourH1.locator('..').getByText('Pre-order', { exact: true })).toBeVisible();
    await expect(page.getByText('Our team will contact you to let you know about the delivery date of this product.')).toBeVisible();
    const whatIs = page.getByRole('button', { name: 'What is Pre-Order?' });
    await expect(whatIs).toBeVisible();
    if (!arbour.delivery) await expect(page.getByText('Free Delivery!', { exact: true })).toHaveCount(0);
    g.expect(
      `The price **${rs(arbour.sale ?? arbour.regular!)}** has a red **PRE-ORDER** label${arbour.delivery ? '' : ' (no FREE DELIVERY! tag: this product has no delivery time)'}. Instead of “Order on WhatsApp” the button reads **ASK ABOUT AVAILABILITY**, followed by a **WHAT IS PRE-ORDER?** button and “Our team will contact you to let you know about the delivery date of this product.”`,
    );
    await g.shot(page, `${arbour.title} (pre-order): Ask about availability`, { highlight: askBtn });
    if (antonin.delivery && !arbour.delivery) {
      // F08-5 of the previous run: kept as designed, now explained in the editor (and never shown while sold out).
      g.note(
        `The red **FREE DELIVERY!** tag comes from the product’s **Delivery time** box: the ${antonin.title} page (delivery time “${antonin.delivery}”) shows it, the ${arbour.title} page (no delivery time) does not. The hint under **Delivery time** in the product editor says so (“Filling this in also shows a red FREE DELIVERY! tag under the price, so leave it empty if delivery is not free”), and the tag is not shown while the chosen option is sold out.`,
      );
    }

    // F08-6 of the previous run is fixed: the popup's phone is the Phone from Settings → Contact details.
    await g.click(whatIs, 'Click **WHAT IS PRE-ORDER?**.');
    const preDialog = page.getByRole('dialog', { name: 'What is Pre-Order' });
    await expect(preDialog).toContainText('What is Pre-Order');
    const helpLine = /For any help, message us on WhatsApp or call ([\d +()-]+?)\./;
    await expect(preDialog).toContainText(helpLine);
    const popupPhone = ((await preDialog.innerText()).match(helpLine)?.[1] ?? '').trim();
    expect(popupPhone.replace(/\D/g, ''), 'pre-order popup phone = Settings phone').toBe(STORE.phone.replace(/\D/g, ''));
    g.expect(
      `A popup explains pre-orders and ends with “For any help, message us on WhatsApp or call **${popupPhone}**.” — the shop’s phone from **Settings → Contact details** (${STORE.phone}, section 1), the same number as in the footer.`,
    );
    await g.shot(page, 'What is Pre-Order? popup with the shop’s phone number', { highlight: preDialog });
    await g.click(preDialog.getByRole('button', { name: 'Close' }), 'Close the popup with the **X** at its top right.');
    await expect(preDialog).toHaveCount(0);

    g.step('Click **ASK ABOUT AVAILABILITY**.');
    const ask = await openWhatsApp(page, askBtn);
    expect(ask.lines[0].trim()).not.toBe('');
    expect(ask.lines[0]).not.toBe(order.lines[0]);
    expect(ask.lines[1]).toBe(`*${arbour.title}*`);
    expect(ask.lines).toEqual(expect.arrayContaining(['Quantity: 1', `Price: ${rs(arbour.sale ?? arbour.regular!)}`, 'Status: Pre-order']));
    expect(ask.lines.some((l) => new RegExp(`^${reEsc(origin)}/products/${reEsc(arbour.handle)}\\?variant=\\d+$`).test(l))).toBe(true);
    g.expect('WhatsApp opens with a different greeting (the **availability** greeting from Settings) and the line **Status: Pre-order**:');
    messageTable(g, ask.lines);

    const officeItem = MENUS.main.find((m) => m.link === apex.collections[0]) ?? MENUS.main.find((m) => m.label === 'Office Chairs')!;
    const office = collectionData(apex.collections[0]);
    await g.click(nav.getByRole('link', { name: officeItem.label, exact: true }), `In the main menu, click **${officeItem.label}**.`);
    await expect(page).toHaveURL(new RegExp(`/collections/${reEsc(office.handle)}`));
    await expect(cardIn(grid, apex.title).getByText('Ready to ship', { exact: true })).toBeVisible();
    g.expect(`**${apex.title}** shows a **READY TO SHIP** bar (one of its options is in stock).`);
    await g.click(grid.getByRole('link', { name: apex.title, exact: true }), `Click **${apex.title}**.`);
    const apexH1 = page.getByRole('heading', { level: 1, name: apex.title });
    await expect(apexH1).toBeVisible();
    const soldOut = apex.variants!.find((v) => v.status === 'Sold out')!;
    const inStockOpt = apex.variants!.find((v) => v.status !== 'Sold out')!;
    const apexOpt = apex.options![0];
    await expect(page.getByText(`${apexOpt.name}: ${inStockOpt.values[0]}`, { exact: true })).toBeVisible();
    await expect(apexH1.locator('..').locator('ins')).toHaveText(rs(inStockOpt.sale ?? inStockOpt.regular));
    await expect(page.locator('[data-testid=order-on-whatsapp][data-ready=true]')).toHaveText(/order on whatsapp/i);
    g.expect(`The page opens with **${apexOpt.name}: ${inStockOpt.values[0]}** chosen, **${rs(inStockOpt.sale ?? inStockOpt.regular)}** and the **ORDER ON WHATSAPP** button.`);
    await g.click(page.getByRole('button', { name: soldOut.values[0], exact: true }), `Under **${apexOpt.name}**, click **${soldOut.values[0]}** (it has a thin diagonal line through it).`);
    await expect(page.getByText(`${apexOpt.name}: ${soldOut.values[0]}`, { exact: true })).toBeVisible();
    await expect(apexH1.locator('..').locator('ins')).toHaveText(rs(soldOut.sale ?? soldOut.regular));
    await expect(apexH1.locator('..').getByText('Sold out', { exact: true })).toBeVisible();
    const apexAsk = page.locator('[data-testid=order-on-whatsapp][data-ready=true]');
    await expect(apexAsk).toHaveText(/ask about availability/i);
    g.expect(
      `The price changes to **${rs(soldOut.sale ?? soldOut.regular)}** with a grey **SOLD OUT** label, and the button changes from ORDER ON WHATSAPP to **ASK ABOUT AVAILABILITY**.`,
    );
    if (!apex.photoTags) {
      // no photo is tagged with an option, so the gallery stays on the first photo
      const firstFile = apex.photos[0].split('/').pop()!.replace(/\.[^.]+$/, '');
      await expect(page.getByRole('button', { name: 'Show image 1' })).toHaveAttribute('aria-current', 'true');
      await expect(page.getByRole('button', { name: 'Show image 1' }).locator('img')).toHaveAttribute('src', new RegExp(`${reEsc(firstFile)}-`));
      g.note(
        `The big photo still shows the chair **with** headrest (\`${apex.photos[0]}\`): in section 3 no photo of this product was tagged with an option. In the product editor, choosing “${apexOpt.name}: ${soldOut.values[0]}” under **Shows** below the second photo would make the gallery switch to it, as it does for the ${antonin.title} colours.`,
      );
    }
    await g.shot(page, `${apex.title} “${soldOut.values[0]}”: Sold out`, { highlight: apexAsk });
    g.step('Click **ASK ABOUT AVAILABILITY**.');
    const askSold = await openWhatsApp(page, apexAsk);
    expect(askSold.lines[0]).toBe(ask.lines[0]);
    expect(askSold.lines[1]).toBe(`*${apex.title}*`);
    expect(askSold.lines).toEqual(
      expect.arrayContaining([`${apexOpt.name}: ${soldOut.values[0]}`, 'Quantity: 1', `Price: ${rs(soldOut.sale ?? soldOut.regular)}`, 'Status: Sold out']),
    );
    g.expect('WhatsApp opens with the availability greeting, the chosen option and **Status: Sold out**:');
    messageTable(g, askSold.lines);

    /* ------------------------------------------------------------------ 8.7 footer */
    g.part('8.7 Footer: contact details, newsletter and WhatsApp chat');
    await g.click(banner.getByRole('link', { name: `${SHOP_NAME} home` }), `Click the **${SHOP_NAME}** logo to go back to the home page.`);
    await expect(page).toHaveURL(new RegExp(`^${reEsc(origin)}/?$`));
    const footer = page.getByRole('contentinfo');
    g.step('Scroll down to the footer at the bottom of the page.');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByRole('link', { name: STORE.phone, exact: true })).toBeVisible();
    await expect(footer.getByRole('link', { name: STORE.email, exact: true })).toBeVisible();
    await expect(footer.getByText(STORE.address.split('\n')[0], { exact: true })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', STORE.facebook);
    await expect(footer.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', STORE.instagram);
    g.expect(`**Contact Info** shows the phone **${STORE.phone}**, the email **${STORE.email}** and the address (${STORE.address.replace(/\n/g, ', ')}); **Follow Us** has Facebook and Instagram icons linking to the shop’s pages (all from Settings, section 1).`);

    const newsletterEmail = footer.getByRole('textbox', { name: 'Email' });
    await g.form(
      [
        { label: 'Email (under **Join our mailing list**)', value: SHOPPER.newsletterEmail, locator: newsletterEmail },
        { label: 'Arrow button → at the end of the line', value: 'click it', kind: 'click', locator: footer.getByRole('button', { name: 'Enter your mail address' }) },
      ],
      'Sign up for the newsletter:',
    );
    const thanks = footer.getByRole('status');
    await expect(thanks).toHaveText('Thanks for subscribing!');
    g.expect('The email box is replaced by **Thanks for subscribing!**');
    await g.shot(page, 'Footer after signing up for the newsletter', { highlight: thanks });
    // F08-7 / F10-2 of the previous run are fixed: sign-ups are kept under the subject "Newsletter", and the admin
    // says plainly that there is no mailing list.
    g.note(
      'There is no mailing service behind this box: nothing is ever emailed to the customer. Each address is kept in **Admin → Messages** with the subject **Newsletter** (section 10 finds it there); the admin explains this and offers a **Download sign-ups (CSV)** button.',
    );

    const bubble = page.getByTestId('whatsapp-bubble');
    await expect(bubble).toBeVisible();
    g.step('Click the round green **WhatsApp** button at the bottom right corner (it is on every page).');
    const chat = await openWhatsApp(page, bubble);
    expect(`${chat.url.origin}${chat.url.pathname}`).toBe(`https://wa.me/${STORE.whatsappStored}`);
    expect(chat.lines).toEqual([CHAT_TEXT]);
    g.expect(`WhatsApp opens for **${STORE.whatsappStored}** with the message “**${CHAT_TEXT}**”.`);

    /* ------------------------------------------------------------------ 8.8 no accounts + contact */
    // F08-8 of the previous run is fixed: no My Account icon, old /account addresses lead to the home page.
    g.part('8.8 No customer accounts; sending the shop a message');
    await scrollToTop(page);
    const searchIcon = banner.getByRole('link', { name: 'Search', exact: true });
    await expect(searchIcon).toBeVisible();
    await expect(banner.getByRole('link', { name: /account|sign in|log ?in/i })).toHaveCount(0);
    await expect(banner.getByRole('list').filter({ has: page.getByRole('link', { name: 'Search', exact: true }) }).getByRole('listitem')).toHaveCount(1); // the icons next to the menu
    g.step('Look at the top right corner of the page, next to the menu.');
    g.expect(
      'There is only the **magnifying glass** (Search): no person icon and no “My Account” link. The shop has no customer accounts — customers order on WhatsApp without signing in.',
    );
    await holdSlider(page);
    await g.shot(page, 'Header: only the search icon at the top right, no My Account', { highlight: searchIcon });

    await g.goto(page, '/account/login', `Type the address of the old sign-in page in the address bar: **${origin}/account/login**`);
    await expect(page).toHaveURL(new RegExp(`^${reEsc(origin)}/?$`));
    await expect(page.getByRole('region', { name: 'Featured' })).toBeVisible();
    g.expect('The home page opens instead (old links to “My Account” pages such as /account or /account/login lead there), so nobody lands on a sign-in page that does not work.');

    // F08-9 of the previous run is fixed: every shop has the built-in Contact us page with a working form.
    const supportMenu = page.getByRole('contentinfo').getByRole('navigation', { name: 'Customer Support', exact: true });
    const contactLink = supportMenu.getByRole('link', { name: MENUS.footerContact.label, exact: true });
    g.step('Scroll down to the footer.');
    await contactLink.scrollIntoViewIfNeeded();
    await g.click(contactLink, `Under **CUSTOMER SUPPORT**, click **${MENUS.footerContact.label}** (the link added in section 6).`);
    await expect(page).toHaveURL(new RegExp(`${reEsc(MENUS.footerContact.href)}$`));
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'Contact Us' })).toBeVisible();
    await expect(main.getByRole('link', { name: STORE.phone, exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: STORE.email, exact: true })).toBeVisible();
    g.expect(`The **Contact Us** page opens with a form on the left and the shop’s email, phone and address (from Settings) on the right.`);
    const sendBtn = main.getByRole('button', { name: /send message/i });
    await g.form(
      [
        { label: 'Name', value: SHOPPER.contact.name, locator: main.getByLabel('Name', { exact: true }) },
        { label: 'Email', value: SHOPPER.contact.email, locator: main.getByLabel('Email', { exact: true }) },
        { label: 'Phone number', value: SHOPPER.contact.phone, locator: main.getByLabel('Phone number', { exact: true }) },
        { label: 'Comment', value: SHOPPER.contact.message, locator: main.getByLabel('Comment', { exact: true }) },
      ],
      'Fill in the form as a customer would:',
    );
    await g.click(sendBtn, 'Click **SEND MESSAGE**.');
    const sent = main.getByRole('status');
    await expect(sent).toHaveText(/^Thanks for contacting us\. We['’]ll get back to you as soon as possible\.$/);
    await expect(main.getByLabel('Name', { exact: true })).toHaveValue('');
    g.expect(
      "**Thanks for contacting us. We'll get back to you as soon as possible.** appears above the form, and the boxes are emptied. The message arrives in **Admin → Messages** (section 10 opens it there).",
    );
    await g.shot(page, 'Contact Us: the message is sent', { highlight: sent });

    /* ------------------------------------------------------------------ 8.9 404 */
    g.part('8.9 Hidden products and wrong addresses');
    const notFound = page.getByRole('heading', { level: 1, name: 'Page not found' });
    const notFoundText = page.getByText('The page you were looking for doesn’t exist. You may have mistyped the address or the page may have moved.');
    if (draft) {
      await g.goto(page, `/products/${draft.handle}`, `Type the address of the draft product **${draft.title}** (saved as a draft in section 3) in the address bar: **${origin}/products/${draft.handle}**`);
      await expect(notFound).toBeVisible();
      await expect(notFoundText).toBeVisible();
      await expect(page.getByRole('link', { name: 'Continue shopping' })).toBeVisible();
      await expect(page.getByText(draft.title)).toHaveCount(0);
      await expect(nav).toBeVisible();
      await expect(page.getByRole('contentinfo').getByRole('link', { name: STORE.phone, exact: true })).toBeVisible();
      g.expect('Customers cannot see a draft: the shop’s **Page not found** page appears (with the menu, the footer and a **CONTINUE SHOPPING** button), not the product.');
      await g.shot(page, `Draft product ${draft.title}: Page not found`);
    }

    // F08-10 of the previous run is fixed: any unknown address shows the shop's own Page not found.
    await g.goto(page, '/sofa-sale', `Type a wrong address, for example **${origin}/sofa-sale**`);
    await expect(notFound).toBeVisible();
    await expect(notFoundText).toBeVisible();
    await expect(page.getByText('This page could not be found.')).toHaveCount(0);
    await expect(nav).toBeVisible();
    await expect(page.getByRole('contentinfo').getByRole('link', { name: STORE.phone, exact: true })).toBeVisible();
    const continueBtn = page.getByRole('link', { name: 'Continue shopping' });
    await expect(continueBtn).toBeVisible();
    g.expect(
      'The same **Page not found** page, inside the shop’s own header, menu and footer: “The page you were looking for doesn’t exist. You may have mistyped the address or the page may have moved.” and a **CONTINUE SHOPPING** button.',
    );
    await g.shot(page, 'Wrong address: the shop’s Page not found', { highlight: continueBtn });
    await g.click(continueBtn, 'Click **CONTINUE SHOPPING**.');
    await expect(page).toHaveURL(new RegExp(`^${reEsc(origin)}/?$`));
    g.expect('The home page opens.');
    g.note('The blog (Blog in the main menu) was checked from the customer’s side in section 7.');
  },
};

export default section;
