import { expect, type Locator, type Page } from '@playwright/test';
import type { Section } from '../context';
import type { Guide } from '../guide';
import { BANNERS, BLOG_POSTS, COLLECTIONS, MENUS, PRODUCTS, SHOPPER, STORE, type ProductData } from '../data';

/**
 * Section 08 — a customer shopping on a computer (the separate, signed-out "shopper" browser):
 * home page, banners, mega menu, collection cards / sort / filters, search, ordering on WhatsApp
 * (order + availability messages), newsletter, WhatsApp chat bubble, My Account, contact form and 404 pages.
 * Admin-side results (inquiries, messages) are checked in section 10.
 */

/** Fixed in code (src/components/home/hotSelling.ts): the only products the home "Hot Selling Products" row can show. */
const HOT_SELLING_HANDLES = [
  'crf-2-door-sliding-wardrobe',
  'alexa-sofa-chair',
  'linea-wardrobe-3-door',
  'cooper-sofa',
  'sofa-majestic-2-seater-velvet-winter-green',
  'antonin-sofa',
  'sydney-trysil-wardrobe-3-doors-light-oak-grey-color',
  'marcus-visitor-chair-waffle-black',
  'visitor-chair-jxn-500m',
];
/** Fixed in code (CATEGORY_TILE_HANDLES in src/app/(store)/page.tsx): the only collections the home "Shop by Category" row can show. */
const HOME_TILE_HANDLES = ['coalesce-bedroom', 'sofas-all', 'office-chairs', 'beds', 'dining-table-sets', 'kids', 'decor-acc'];
/** Fixed in code (SITE.phone, shown by the "What is Pre-Order?" popup). */
const PREORDER_POPUP_PHONE = '042 111 269 926';
/** Fixed in code (GENERAL_QUESTION_TEXT): the floating chat button's message. */
const CHAT_TEXT = 'Hello Cozy Furnitures! I have a question.';

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

/** What a product card shows for a product (same rules as the store: lowest price, lowest struck price, biggest discount). */
function cardFacts(p: ProductData) {
  const vs = p.variants ?? [{ values: [], regular: p.regular ?? '0', sale: p.sale, status: p.status ?? 'Ready to ship' }];
  const price = Math.min(...vs.map((v) => Number(v.sale ?? v.regular)));
  const compares = vs.filter((v) => v.sale).map((v) => Number(v.regular));
  const compare = compares.length && Math.min(...compares) > price ? Math.min(...compares) : null;
  const pcts = vs.filter((v) => v.sale).map((v) => Math.round(((Number(v.regular) - Number(v.sale)) / Number(v.regular)) * 100));
  const statuses = vs.map((v) => v.status);
  const bar = statuses.includes('Ready to ship')
    ? 'Ready to ship'
    : statuses.includes('Pre-order')
      ? 'Pre-Order'
      : statuses.includes('Made to order')
        ? null
        : 'Sold Out';
  return { price, compare, pct: pcts.length ? Math.max(...pcts) : null, bar };
}

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
    'Here we use the shop the way a customer does on a computer: the home page, the menu, collections, search, choosing options and ordering on WhatsApp, the newsletter and what happens with wrong addresses. Use a separate browser window that is **not** signed in to the admin (for example a private / incognito window).',

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

    const hot = page.getByRole('region', { name: 'Hot Selling Products' });
    const hotProducts = HOT_SELLING_HANDLES.map((h) => PRODUCTS.find((p) => p.handle === h && !p.draft)).filter((p): p is ProductData => !!p);
    const notHot = PRODUCTS.filter((p) => !p.draft && !HOT_SELLING_HANDLES.includes(p.handle));
    if (hotProducts.length) {
      await expect(page.getByRole('heading', { name: 'Hot Selling Products' })).toBeVisible();
      for (const p of hotProducts) await expect(hot.getByRole('link', { name: p.title, exact: true })).toBeVisible();
      for (const p of notHot) await expect(hot.getByRole('link', { name: p.title, exact: true })).toHaveCount(0);
      g.expect(
        `Under the slider and the yellow “FREE Nationwide Delivery!” strip, **Hot Selling Products** shows ${hotProducts.map((p) => `**${p.title}**`).join(' and ')} — and no other product.`,
      );
    } else {
      await expect(page.getByRole('heading', { name: 'Hot Selling Products' })).toHaveCount(0);
      g.expect('There is no **Hot Selling Products** row.');
    }

    const tiles = page.getByRole('region', { name: 'Shop by Category' });
    const tileCollections = HOME_TILE_HANDLES.map((h) => COLLECTIONS.find((c) => c.handle === h)).filter((c): c is (typeof COLLECTIONS)[number] => !!c);
    // titles of the tiles actually on screen (the row is a looping slider, 3 tiles at a time)
    const tilesOnScreen = () =>
      tiles.evaluate((region) => {
        const box = region.getBoundingClientRect();
        return Array.from(region.querySelectorAll('h2'))
          .filter((h) => {
            const b = h.getBoundingClientRect();
            return b.width > 0 && b.left >= box.left - 1 && b.right <= box.right + 1;
          })
          .map((h) => h.textContent?.trim() ?? '');
      });
    const shownTiles = tileCollections.length ? [0, 1, 2].map((i) => tileCollections[i % tileCollections.length].title) : [];
    if (tileCollections.length) {
      await expect(page.getByRole('heading', { name: 'Shop by Category' })).toBeVisible();
      await expect(tiles.getByRole('heading', { level: 2 })).toHaveText(tileCollections.map((c) => c.title));
      await expect.poll(tilesOnScreen).toEqual(shownTiles);
      g.expect(
        `**Shop by Category** shows only ${tileCollections.map((c) => `**${c.title}**`).join(' and ')} (${tileCollections.length} of the ${COLLECTIONS.length} collections)${
          tileCollections.length < 3 ? `; because the row always shows three tiles, it reads ${shownTiles.map((t) => `“${t}”`).join(', ')}` : ''
        }.`,
      );
    }

    const hasReviews = (await page.getByText('Our customer speaks for us').count()) > 0;
    g.note(
      hasReviews
        ? 'The “Our customer speaks for us” block is shown because a **Store rating** is set in Settings.'
        : 'There is no “Our customer speaks for us” reviews block: it only appears once a **Store rating** is entered in Settings.',
    );
    await g.shot(page, 'Home page with banners, Hot Selling Products and Shop by Category', { fullPage: true });

    g.finding(
      'issue',
      'The owner cannot choose the “Hot Selling Products” on the home page',
      `This row is a fixed list of product web addresses copied from the old shop and written into the program. ${hotProducts.map((p) => p.title).join(' and ')} appear only because their addresses (${hotProducts.map((p) => '`' + p.handle + '`').join(', ')}) happen to be on that list; ${notHot.slice(0, 3).map((p) => p.title).join(', ')} and every other new product can never appear there. The **Best seller** tick in the product editor does not add a product to this row, and a shop whose products have other addresses gets no row at all.`,
    );
    if (tileCollections.length < COLLECTIONS.length) {
      g.note(
        `Same problem as finding **F02-1** (Collections): the “Shop by Category” tiles come from a fixed list of the old shop’s collection addresses, so only ${tileCollections.map((c) => c.title).join(' and ')} appear.${
          tileCollections.length < 3 ? ` With fewer than three matching collections the row repeats them (${shownTiles.join(', ')}).` : ''
        }`,
      );
    }

    await g.click(
      page.getByRole('switch', { name: 'Show more' }),
      'Scroll down to **The Same Experience & Quality You Trust Online** (just above the footer) and click **Show more**.',
    );
    const seo = page.getByText(/augmented reality \(AR\)/);
    await expect(seo).toBeVisible();
    await expect(seo).toContainText('the checkout process is simple and secure');
    await expect(seo).toContainText('credit/debit cards and bank transfers');
    await expect(seo).toContainText('track your orders in real-time');
    await expect(seo).toContainText('not available in physical outlets');
    await expect(page.getByRole('switch', { name: 'Show less' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Announcement' })).toContainText('FREE Nationwide Delivery!');
    g.expect(
      'The full text opens (the link now reads **Show less**). It talks about augmented reality (AR) previews, “the checkout process is simple and secure”, payment “including credit/debit cards and bank transfers”, tracking “your orders in real-time” and online discounts “not available in physical outlets”.',
    );
    g.note('These fixed texts are finding **F01-1** (section 1): they cannot be changed or hidden in the admin.');

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
    await expect(nav.getByRole('link', { name: firstItem.label, exact: true })).toHaveClass(/bg-maroon/);
    g.finding(
      'note',
      'The first main-menu item is always a dark red block',
      `“${firstItem.label}”, the first item of the main menu, is always drawn as a dark red button (on the old site it was “Wedding Packages”). Whatever the owner puts first in **Menus → Main menu** gets this look; there is no setting for it.`,
    );

    /* ------------------------------------------------------------------ 8.3 collection page */
    g.part('8.3 A collection page: product cards, sorting and filters');
    const sofaProducts = PRODUCTS.filter((p) => !p.draft && p.collections.includes('Sofas'));
    await expect(grid.locator('.product-card')).toHaveCount(sofaProducts.length);
    await expect(page.getByText(`${sofaProducts.length} products`, { exact: true }).filter({ visible: true })).toBeVisible();
    g.expect(`The page shows **${sofaProducts.length} products** (count on the right of the toolbar): ${sofaProducts.map((p) => `**${p.title}**`).join(', ')}.`);

    const cardRows: string[][] = [];
    for (const p of sofaProducts) {
      const f = cardFacts(p);
      const card = cardIn(grid, p.title);
      await expect(card.locator('.price ins')).toHaveText(rs(f.price));
      if (f.compare) await expect(card.locator('.price del')).toHaveText(rs(f.compare));
      else await expect(card.locator('.price del')).toHaveCount(0);
      if (f.pct) await expect(card.getByText(new RegExp(`^${f.pct}%\\s*off$`, 'i'))).toBeVisible();
      if (f.bar) await expect(card.getByText(f.bar, { exact: true })).toBeVisible();
      if (p.newArrival) await expect(card.getByText('NEW', { exact: true })).toBeVisible();
      else await expect(card.getByText('NEW', { exact: true })).toBeHidden();
      if (p.limitedEdition) await expect(card.getByText('Limited Edition', { exact: true })).toBeVisible();
      const colour = p.options?.find((o) => /^colou?r$/i.test(o.name));
      if (colour) await expect(card.locator('[aria-label="Colours"] > span')).toHaveCount(colour.values.length);
      cardRows.push([
        `**${p.title}**`,
        [p.newArrival ? 'red **NEW** above the title' : '', p.limitedEdition ? 'yellow **LIMITED EDITION** bar' : ''].filter(Boolean).join(', ') || '—',
        f.compare ? `${rs(f.price)} (and ${rs(f.compare)} struck through)` : rs(f.price),
        f.pct ? `${f.pct}% off` : '—',
        f.bar ? f.bar.toUpperCase() : '—',
        colour ? `${colour.values.length} colour dots (${colour.values.join(', ')})` : '—',
      ]);
    }
    g.table(['Card', 'Labels', 'Price', 'Red circle', 'Dark bar on the photo', 'Colours'], cardRows);
    g.expect('Each card shows exactly what the table above says.');
    await g.shot(page, 'Sofas collection: product cards with NEW, Limited Edition, sale price and status bars', { highlight: grid });

    const af = cardFacts(antonin);
    const cheapest = antonin.variants?.find((v) => Number(v.sale ?? v.regular) === af.price);
    const struck = antonin.variants?.find((v) => v.sale && Number(v.regular) === af.compare);
    if (af.compare && cheapest && struck && !cheapest.sale) {
      g.finding(
        'issue',
        'A product card can show a “discount” that no option really has',
        `The ${antonin.title} card shows **${rs(af.price)}** next to a struck-through **${rs(af.compare)}** and “${af.pct}% off”. But ${rs(af.price)} is the normal price of the ${cheapest.values.join(' / ')} (not on sale), and ${rs(af.compare)} is the old price of the ${struck.values.join(' / ')}. A customer reads it as ${rs(af.compare)} reduced to ${rs(af.price)}. The card takes the lowest price and the lowest struck price from different options (as the old Shopify theme did).`,
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
    g.expect(
      `The **Search Results** page lists ${searchHits.map((p) => `**${p.title}**`).join(' and ')} as product cards, with the same Filter / Sort by toolbar as a collection and **${searchHits.length} results** at its right end.`,
    );
    await g.click(page.getByRole('main').getByRole('button', { name: 'Show more' }), 'Click **Show more** next to the search box.');
    await expect(page.getByText(new RegExp(`\\d+ results? found for “${reEsc(SHOPPER.search)}”`))).toBeVisible();
    g.expect(`The sentence “… results found for “${SHOPPER.search}”” appears.`);
    g.finding(
      'note',
      'The number of search results is hidden behind “Show more”',
      'On the Search Results page the sentence “… results found for …” only appears after clicking a green **Show more** link next to the search box (copied from the old theme). Most customers will not click it; the count is also shown at the right end of the toolbar.',
    );

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
      g.finding(
        'note',
        'Filling in a delivery time also promises free delivery',
        `The ${antonin.title} page (delivery time “${antonin.delivery}”) shows a red **FREE DELIVERY!** tag; the ${arbour.title} page (no delivery time) does not. The tag comes only from the **Delivery time** box (the product editor’s hint says so); there is no separate switch, so a product cannot show its delivery time without also promising free delivery.`,
      );
    }

    await g.click(whatIs, 'Click **WHAT IS PRE-ORDER?**.');
    const preDialog = page.getByRole('dialog', { name: 'What is Pre-Order' });
    await expect(preDialog).toContainText('What is Pre-Order');
    await expect(preDialog).toContainText(`For any help, message us on WhatsApp or call ${PREORDER_POPUP_PHONE}.`);
    g.expect(`A popup explains pre-orders and ends with “For any help, message us on WhatsApp or call ${PREORDER_POPUP_PHONE}.”`);
    if (PREORDER_POPUP_PHONE.replace(/\D/g, '') !== STORE.phone.replace(/\D/g, '')) {
      g.finding(
        'bug',
        'The “What is Pre-Order?” popup shows the wrong phone number',
        `It always says “call ${PREORDER_POPUP_PHONE}”, a number written into the program, not the shop’s phone from **Settings → Contact details** (${STORE.phone}, shown in the footer). Customers of a pre-order product are told to call a different number.`,
      );
    }
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
    await g.click(banner.getByRole('link', { name: 'Cozy Furnitures home' }), 'Click the **Cozy Furnitures** logo to go back to the home page.');
    await expect(page).toHaveURL(new RegExp(`^${reEsc(origin)}/?$`));
    const footer = page.getByRole('contentinfo');
    g.step('Scroll down to the footer at the bottom of the page.');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByRole('link', { name: STORE.phone, exact: true })).toBeVisible();
    await expect(footer.getByText(STORE.address.split('\n')[0], { exact: true })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', STORE.facebook);
    await expect(footer.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', STORE.instagram);
    g.expect(`**Contact Info** shows the phone **${STORE.phone}** and the address (${STORE.address.replace(/\n/g, ', ')}); **Follow Us** has Facebook and Instagram icons linking to the shop’s pages (all from Settings, section 1).`);

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
    g.finding(
      'note',
      'The newsletter has no mailing list behind it',
      `A sign-up is sent to the same inbox as contact messages (**Admin → Messages**, see section 10). The shop gets no list of subscribers, no export and no way to send a newsletter; the owner has to copy the addresses by hand.`,
    );

    const bubble = page.getByTestId('whatsapp-bubble');
    await expect(bubble).toBeVisible();
    g.step('Click the round green **WhatsApp** button at the bottom right corner (it is on every page).');
    const chat = await openWhatsApp(page, bubble);
    expect(`${chat.url.origin}${chat.url.pathname}`).toBe(`https://wa.me/${STORE.whatsappStored}`);
    expect(chat.lines).toEqual([CHAT_TEXT]);
    g.expect(`WhatsApp opens for **${STORE.whatsappStored}** with the message “**${CHAT_TEXT}**”.`);

    /* ------------------------------------------------------------------ 8.8 my account + contact */
    g.part('8.8 “My Account” and contacting the shop');
    await g.click(banner.getByRole('link', { name: 'My Account' }), 'Click the **person icon** (My Account) at the top right, next to the magnifying glass.');
    await expect(page).toHaveURL(/\/account\/login/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Shop' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Facebook' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Email me with news and offers' })).toBeChecked();
    await expect(nav).toBeHidden();
    await expect(page.getByRole('link', { name: STORE.phone, exact: true })).toBeHidden(); // the footer's phone link
    g.expect(
      'A **Sign in** page opens without the shop’s menu and footer: a purple **Continue with Shop** button, Google and Facebook buttons, an **Email** box and a ticked “Email me with news and offers”.',
    );
    await g.click(page.getByRole('button', { name: 'Continue with Shop' }), 'Click **Continue with Shop**.');
    await expect(page.getByText('Customer accounts are coming soon.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Track your order' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Contact us' })).toBeVisible();
    g.expect('Nothing is signed in: the page only says **Customer accounts are coming soon.** and offers **Track your order** or **Contact us**.');
    await g.shot(page, 'My Account: “Customer accounts are coming soon”');

    await g.click(page.getByRole('link', { name: 'Contact us' }), 'Click **Contact us**.');
    await expect(page).toHaveURL(/\/pages\/contact$/);
    const notFound = page.getByRole('heading', { level: 1, name: 'Page not found' });
    const contactForm = page.getByRole('main').locator('form');
    await expect(notFound.or(contactForm)).toBeVisible();
    if (await notFound.isVisible()) {
      g.expect('The shop’s **Page not found** page opens: a new shop has no Contact page.');
      await g.click(banner.getByRole('link', { name: 'My Account' }), 'Click the **person icon** (My Account) again, then **Continue with Shop**, then **Track your order**.');
      await page.getByRole('button', { name: 'Continue with Shop' }).click();
      await page.getByRole('link', { name: 'Track your order' }).click();
      await expect(page).toHaveURL(/\/pages\/track-your-order$/);
      await expect(notFound).toBeVisible();
      g.expect('**Page not found** again.');
      const shopTermsHref = await page.getByRole('contentinfo').getByRole('link', { name: 'Terms & Conditions', exact: true }).getAttribute('href');
      await g.click(banner.getByRole('link', { name: 'My Account' }), 'Click the **person icon** once more and, under the email box, click **Terms of service**.');
      await page.getByRole('link', { name: 'Terms of service' }).click();
      await expect(page).toHaveURL(/\/pages\/terms-of-use$/);
      await expect(notFound).toBeVisible();
      g.expect(
        `**Page not found**: the link goes to /pages/terms-of-use, while the shop’s own terms page (footer link **Terms & Conditions**, section 7) is at ${shopTermsHref ? `\`${shopTermsHref}\`` : 'another address'}.`,
      );
      expect(shopTermsHref).not.toBe('/pages/terms-of-use');
      g.finding(
        'bug',
        '“My Account” leads to a sign-in page that does not work, and its links are broken',
        `The person icon in the header opens a copy of the old Shopify sign-in page (Shop, Google, Facebook, email, a ticked “Email me with news and offers”). Every button only shows “Customer accounts are coming soon.”, and its **Contact us**, **Track your order** and **Terms of service** links open **Page not found** on a new shop. The shop has no customer accounts, so the icon only confuses customers; it cannot be removed in the admin.`,
      );
      g.finding(
        'issue',
        'Customers have no way to send the shop a message',
        `The only contact form lives on the built-in Contact page (/pages/contact), and a new shop does not have it: built-in (“custom design”) pages cannot be created in the admin, and a normal page the owner creates shows only its text, never a form. So **Admin → Messages** (which the admin guide says “holds the contact-form submissions”) only ever receives newsletter sign-ups. Customers can still write on WhatsApp or call the phone number in the footer.`,
      );
    } else {
      // a shop that already has the built-in Contact page: send the test message
      const main = page.getByRole('main');
      await g.form(
        [
          { label: 'Name', value: SHOPPER.contact.name, locator: main.getByLabel('Name', { exact: true }) },
          { label: 'Email', value: SHOPPER.contact.email, locator: main.getByLabel('Email', { exact: true }) },
          { label: 'Phone number', value: SHOPPER.contact.phone, locator: main.getByLabel('Phone number', { exact: true }) },
          { label: 'Comment', value: SHOPPER.contact.message, locator: main.getByLabel('Comment', { exact: true }) },
          { label: 'SEND MESSAGE', value: 'click it', kind: 'click', locator: main.getByRole('button', { name: /send message/i }) },
        ],
        'The Contact page opens. Fill in the form:',
      );
      await expect(main.getByRole('status')).toContainText('Thanks for contacting us');
      g.expect('**Thanks for contacting us. We’ll get back to you as soon as possible.** appears above the form. The message arrives in **Admin → Messages** (section 10).');
    }

    /* ------------------------------------------------------------------ 8.9 404 */
    g.part('8.9 Hidden products and wrong addresses');
    if (draft) {
      await g.goto(page, `/products/${draft.handle}`, `Type the address of the draft product **${draft.title}** (saved as a draft in section 3) in the address bar: **${origin}/products/${draft.handle}**`);
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Continue shopping' })).toBeVisible();
      await expect(page.getByText(draft.title)).toHaveCount(0);
      await expect(nav).toBeVisible();
      await expect(page.getByRole('contentinfo').getByRole('link', { name: STORE.phone, exact: true })).toBeVisible();
      g.expect('Customers cannot see a draft: the shop’s **Page not found** page appears (with the menu, the footer and a **CONTINUE SHOPPING** button), not the product.');
      await g.shot(page, `Draft product ${draft.title}: Page not found`);
      if (await page.getByText(/looking for doesnt exist/).isVisible()) {
        g.note('The “doesnt” typo on this page is finding **F01-3** (section 1).');
      }
    }

    await g.goto(page, '/sofa-sale', `Type a wrong address, for example **${origin}/sofa-sale**`);
    await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();
    await expect(page.getByText('This page could not be found.')).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
    await expect(page.getByRole('link')).toHaveCount(0);
    g.expect('A bare white page that only says **404 | This page could not be found.** — no logo, no menu, no footer and no link back to the shop.');
    await g.shot(page, 'Wrong address: bare 404 page');
    g.finding(
      'issue',
      'A mistyped address shows a bare “404” page instead of the shop’s “Page not found”',
      'Wrong product or page addresses (/products/…, /pages/…, /collections/…) show the shop’s own **Page not found** page with the menu and a CONTINUE SHOPPING button, but any other wrong address (e.g. /sofa-sale) shows the plain technical page “404 | This page could not be found.” with no logo, menu or way back. A customer arriving from an old or mistyped link may think the shop is down.',
    );
    g.note('The blog (Blog in the main menu) was checked from the customer’s side in section 7.');
  },
};

export default section;
