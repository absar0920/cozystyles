import { devices, expect, type Locator, type Page } from '@playwright/test';
import type { Section } from '../context';
import { BLOG_POSTS, COLLECTIONS, MENUS, PAGES, PRODUCTS, STORE } from '../data';
import { gotoPage, loadAllImages, type Guide } from '../guide';
import { WHATSAPP_DEFAULTS } from '../../src/lib/whatsapp';

/**
 * 9. Shopping on a phone: a Pixel 7-sized Chrome (412 × 839, touch) goes through the store the way a shopper on a
 * phone does: home page, ☰ menu → Living Room → Sofas, the collection grid, the Antonin Sofa with options picked,
 * ORDER ON WHATSAPP (the wa.me address is caught; the WhatsApp site itself is blocked), the blog, a text page and
 * the built-in Contact us page from the footer (section 8 sends its form from a computer). Then the owner signs in to the admin on a phone and opens the Dashboard, the ☰ admin menu, the
 * product list and the Antonin Sofa editor (one letter is typed and removed again to see the save bar's messages;
 * nothing is saved). Every page is checked for sideways scrolling; a page that is wider than the phone becomes a finding.
 */

const PHONE = devices['Pixel 7'];
/** wa.me and the page it forwards to: blocked so no real WhatsApp page opens (the address is still checked). */
const WHATSAPP_SITE = /^https:\/\/(wa\.me|api\.whatsapp\.com)\//;

const rs = (n: number) => `Rs.${n.toLocaleString('en-US')}`;
const exactText = (s: string) => new RegExp(`^\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);

function product(title: string) {
  const p = PRODUCTS.find((x) => x.title === title);
  if (!p) throw new Error(`data.ts: product "${title}" is missing`);
  return p;
}
function collection(title: string) {
  const c = COLLECTIONS.find((x) => x.title === title);
  if (!c) throw new Error(`data.ts: collection "${title}" is missing`);
  return c;
}

const SOFA = product('Antonin Sofa');
const SOFAS = collection('Sofas');
const LIVING = MENUS.main.find((m) => m.children.includes(SOFAS.title));
const BLOG_ITEM = MENUS.main.find((m) => m.link === 'Blog');
const POST = BLOG_POSTS[0];
const TEXT_PAGE = PAGES.find((p) => p.title === 'Shipping & Delivery') ?? PAGES[0];
const IN_SOFAS = PRODUCTS.filter((p) => p.collections.includes(SOFAS.title) && !p.draft);

/** The combination the shopper picks: different from the first one in every option, and orderable. */
const PICK = (() => {
  const vs = SOFA.variants ?? [];
  const first = vs[0];
  const v = vs.find(
    (x) => first && x.values.every((val, i) => val !== first.values[i]) && (x.status === 'Ready to ship' || x.status === 'Made to order'),
  );
  if (!v || !SOFA.options) throw new Error('data.ts: Antonin Sofa needs options and an orderable combination unlike the first one');
  return v;
})();
const PICK_PRICE = Number(PICK.sale ?? PICK.regular);
const PICK_WAS = PICK.sale ? Number(PICK.regular) : null;
const QTY = 2;
const STATUS_LINE: Record<string, string> = {
  'Ready to ship': 'Our team will get in touch with you to communicate the exact delivery time.',
  'Made to order': 'Made to Order — our team will confirm the delivery time with you.',
};

/* ------------------------------------------------------------------------------------------------ helpers */

type Width = { scrollWidth: number; screenWidth: number; culprits: string[] };

/** Page width vs. screen width, plus (when too wide) the outermost elements that stick out on the right. */
async function measureWidth(page: Page): Promise<Width> {
  return page.evaluate(() => {
    // the layout width, not window.innerWidth: a phone zooms out to fit a too-wide page and innerWidth grows with it
    const screenWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const culprits: string[] = [];
    if (scrollWidth - screenWidth > 1) {
      // an element is harmless when an ancestor that clips its overflow (or is fixed) fits on the screen
      const clipped = (el: Element) => {
        for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (s.position === 'fixed') return true;
          if (s.overflowX !== 'visible') return p.getBoundingClientRect().right <= screenWidth + 1;
        }
        return false;
      };
      const wide = Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.right > screenWidth + 1 && getComputedStyle(el).position !== 'fixed' && !clipped(el);
      });
      const outer = wide.filter((el) => !wide.some((o) => o !== el && o.contains(el)));
      for (const el of outer.slice(0, 3)) {
        const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
        const text = (el.innerText ?? '').trim().replace(/\s+/g, ' ').slice(0, 50);
        const what = `${el.tagName.toLowerCase()}${cls ? ` class "${cls}"` : ''}${text ? ` ("${text}")` : ''}`;
        culprits.push(`${what}, ${Math.round(el.getBoundingClientRect().right)}px from the left`.replace(/[_`*|\\]/g, ' '));
      }
    }
    return { scrollWidth, screenWidth, culprits };
  });
}

/**
 * The page must not scroll sideways on the phone: scrollWidth − screen width ≤ 1. Passing → an Expected line;
 * too wide → a finding (the walkthrough continues). Store pages are scrolled once first so late photos are in.
 */
async function checkPhoneWidth(g: Guide, page: Page, name: string, opts: { loadImages?: boolean } = {}): Promise<boolean> {
  if (opts.loadImages) await loadAllImages(page);
  await page.waitForTimeout(300);
  const w = await measureWidth(page);
  if (w.scrollWidth - w.screenWidth <= 1) {
    g.expect(`The ${name} fits the phone's width: it does not slide sideways when you swipe left or right.`);
    return true;
  }
  const path = new URL(page.url()).pathname;
  g.finding(
    'bug',
    `The ${name} is wider than a phone screen`,
    `On a ${w.screenWidth}px-wide phone screen the ${name} (\`${path}\`) is ${w.scrollWidth}px wide, so it slides sideways when a shopper swipes and part of it is cut off at the right edge.${
      w.culprits.length ? ` Parts that stick out: ${w.culprits.join('; ')}.` : ''
    } Suggestion: make these parts shrink or wrap to the screen width.`,
  );
  return false;
}

/** Start waiting for the wa.me request (and the new tab it opens), tap the button, return the WhatsApp address. */
async function orderAndCatch(page: Page, button: Locator): Promise<URL> {
  const request = page.context().waitForEvent('request', { predicate: (r) => WHATSAPP_SITE.test(r.url()), timeout: 20_000 });
  const popup = page.waitForEvent('popup', { timeout: 20_000 }).catch(() => null);
  await button.click();
  const [req, tab] = await Promise.all([request, popup]);
  if (tab && tab !== page) await tab.close();
  return new URL(req.url());
}

/* ------------------------------------------------------------------------------------------------ section */

const section: Section = {
  id: '09',
  title: '9. Shopping on a phone',
  intro:
    'Most shoppers will visit on their phone. Here we go through the store on a phone-sized screen (menu, a collection, ordering on WhatsApp, the blog, a text page and the Contact us page), then check that the admin can be used from a phone too.',
  async run(ctx) {
    const { guide: g } = ctx;
    if (!LIVING || !BLOG_ITEM) throw new Error('data.ts: the main menu needs the Sofas parent item and a Blog item');
    const sofaCard = (page: Page) => page.locator('#product-grid > li').filter({ has: page.getByRole('link', { name: SOFA.title, exact: true }) });

    /* ============================================================================ the store on a phone */
    const phoneContext = await ctx.newContext({ ...PHONE });
    try {
      await phoneContext.route(WHATSAPP_SITE, (r) => r.abort());
      const phone = await phoneContext.newPage();
      const vp = phone.viewportSize()!;

      /* ------------------------------------------------------------------ home */
      g.part(
        'The home page on a phone',
        `Use any phone (Android or iPhone). The screenshots in this part come from a phone screen ${vp.width} pixels wide (the size of a Google Pixel 7), in Google Chrome.`,
      );
      await g.goto(phone, '/', `On your phone, open the store's home page **${ctx.baseURL}/**.`);
      const menuButton = phone.getByRole('button', { name: 'Open menu' });
      await expect(menuButton).toBeVisible();
      const menuBox = await menuButton.boundingBox();
      expect(menuBox && menuBox.width >= 40 && menuBox.height >= 40, 'the ☰ button is big enough to tap').toBe(true);
      await expect(phone.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
      await expect(phone.getByRole('link', { name: 'Cozy Furnitures home' })).toBeVisible();
      // F08-8 of the previous run (a My Account icon leading to a sign-in page that did not work) is fixed: no account links
      await expect(phone.locator('a[href*="/account"]')).toHaveCount(0);
      const slider = phone.locator('section[aria-roledescription="carousel"][aria-label="Featured"]');
      await expect(slider).toBeVisible();
      g.expect(
        'The page opens with the logo at the top and a **☰** menu button (three lines) on the left, big enough to tap with a thumb. The long menu bar of the computer version is not shown, and there is no person (My Account) icon: this shop has no customer accounts. The banner slider is at the top of the page.',
      );
      await checkPhoneWidth(g, phone, 'home page', { loadImages: true });
      await g.shot(phone, 'Home page on a phone: the ☰ menu button is top left', { highlight: menuButton });

      /* ------------------------------------------------------------------ menu → Living Room → Sofas */
      g.part('Find the sofas through the menu');
      await g.click(menuButton, 'Tap the **☰** button at the top left.');
      const mobileNav = phone.getByRole('navigation', { name: 'Mobile navigation' });
      await expect(mobileNav).toBeVisible();
      await expect(phone.getByRole('button', { name: 'Close menu' })).toBeVisible();
      for (const item of MENUS.main) await expect(mobileNav.getByRole('link', { name: item.label, exact: true })).toBeVisible();
      // F08-8 of the previous run: the phone menu no longer ends with a Login row (the shop has no customer accounts)
      await expect(phone.getByRole('link', { name: /^\s*login\s*$/i })).toHaveCount(0);
      await expect(phone.locator('a[href*="/account"]')).toHaveCount(0);
      // F08-2 of the previous run (the first menu item was always a dark red block) is fixed: every row looks the same
      const rowLooks = await mobileNav
        .locator(':scope > ul > li > div > :first-child')
        .evaluateAll((els) => els.map((e) => { const s = getComputedStyle(e); return `${s.backgroundColor} ${s.color}`; }));
      expect(rowLooks).toHaveLength(MENUS.main.length);
      expect(new Set(rowLooks).size, `menu rows look the same: ${rowLooks.join(' | ')}`).toBe(1);
      const expand = mobileNav.getByRole('button', { name: `Expand ${LIVING.label}` });
      await expect(expand).toBeVisible();
      g.expect(
        `The menu opens with one row per item: ${MENUS.main.map((m) => `**${m.label}**`).join(', ')}. Every row looks the same (black text on white; the first item is not highlighted), and there is no **Login** row. The ☰ button turns into an **×** (close). **${LIVING.label}** has a small arrow (⌄) on its right for its sub-items.`,
      );
      await g.shot(phone, 'The phone menu is open; the arrow next to Living Room is outlined', { highlight: expand });

      await g.click(expand, `Tap the small arrow (⌄) on the right of **${LIVING.label}**. (Tapping the words **${LIVING.label}** itself would open the whole ${LIVING.label} collection.)`);
      await expect(mobileNav.getByRole('button', { name: `Collapse ${LIVING.label}` })).toHaveAttribute('aria-expanded', 'true');
      const sofasLink = mobileNav.getByRole('link', { name: SOFAS.title, exact: true });
      for (const child of LIVING.children) await expect(mobileNav.getByRole('link', { name: child, exact: true })).toBeVisible();
      g.expect(`The row opens and shows ${LIVING.children.map((c) => `**${c}**`).join(' and ')} under it; the arrow now points up.`);
      await g.shot(phone, `${LIVING.label} opened in the phone menu, showing ${LIVING.children.join(' and ')}`, { highlight: sofasLink });

      await g.click(sofasLink, `Tap **${SOFAS.title}**.`);
      await expect(phone).toHaveURL(new RegExp(`/collections/${SOFAS.handle}/?(\\?.*)?$`));
      await expect(phone.getByRole('heading', { level: 1, name: SOFAS.title })).toBeAttached();
      await expect(menuButton).toBeVisible();
      await expect(mobileNav).toBeHidden();

      /* ------------------------------------------------------------------ the collection grid */
      const cards = phone.locator('#product-grid > li');
      await expect(cards).toHaveCount(IN_SOFAS.length);
      for (const p of IN_SOFAS) await expect(phone.getByRole('link', { name: p.title, exact: true })).toBeVisible();
      const boxes = (await cards.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) as DOMRect[];
      for (const b of boxes) expect(b.right, 'card fits the screen').toBeLessThanOrEqual(vp.width + 1);
      let twoPerRow = false;
      if (boxes.length >= 2) {
        expect(Math.abs(boxes[0].top - boxes[1].top), 'first two cards share a row').toBeLessThan(2);
        expect(boxes[1].left).toBeGreaterThan(boxes[0].right - 1);
        twoPerRow = true;
      }
      g.expect(
        `The menu closes and the **${SOFAS.title}** collection opens (the address ends in \`/collections/${SOFAS.handle}\`). It lists ${IN_SOFAS.map((p) => `**${p.title}**`).join(' and ')}${
          twoPerRow ? ', two products side by side in each row' : ''
        }, each fitting on the screen.`,
      );
      await checkPhoneWidth(g, phone, `${SOFAS.title} collection page`, { loadImages: true });
      await g.shot(phone, `The ${SOFAS.title} collection on a phone`, { highlight: sofaCard(phone) });

      /* ------------------------------------------------------------------ the product, options, WhatsApp */
      g.part(`Order the ${SOFA.title} on WhatsApp`);
      await g.click(sofaCard(phone).getByRole('link', { name: SOFA.title, exact: true }), `Tap the name **${SOFA.title}** under its photo.`);
      await expect(phone).toHaveURL(new RegExp(`/products/${SOFA.handle}/?(\\?.*)?$`));
      const title = phone.getByRole('heading', { level: 1, name: SOFA.title, exact: true });
      await expect(title).toBeVisible();
      const orderButton = phone.locator('[data-testid=order-on-whatsapp][data-ready=true]');
      await expect(orderButton).toBeVisible();
      g.expect(`The **${SOFA.title}** page opens (the address ends in \`/products/${SOFA.handle}\`) with the product name and an **ORDER ON WHATSAPP** button.`);
      await checkPhoneWidth(g, phone, `${SOFA.title} product page`, { loadImages: true });

      const options = SOFA.options!;
      const increase = phone.getByRole('button', { name: 'Increase quantity' });
      await g.form(
        [
          ...options.map((o, i) => ({
            label: o.name,
            kind: 'click' as const,
            value: o.swatches ? `tap the **${PICK.values[i]}** colour circle` : `tap **${PICK.values[i]}**`,
            locator: phone.getByRole('button', { name: PICK.values[i], exact: true }),
          })),
          { label: 'Quantity', kind: 'click', value: `tap **+** once, so the box shows **${QTY}**`, locator: increase },
        ],
        'Scroll down a little and choose the options under the price:',
      );
      for (const [i, value] of PICK.values.entries()) {
        await expect(phone.getByRole('button', { name: value, exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(phone.locator('legend').filter({ hasText: `${options[i].name}:` })).toContainText(`${options[i].name}: ${value}`);
      }
      await expect(phone.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue(String(QTY));
      await expect(phone).toHaveURL(/[?&]variant=\d+/);
      const info = title.locator('xpath=..');
      await expect(info.locator('ins')).toHaveText(rs(PICK_PRICE));
      if (PICK_WAS) await expect(info.locator('del')).toHaveText(rs(PICK_WAS));
      else await expect(info.locator('del')).toHaveCount(0);
      const statusLine = STATUS_LINE[PICK.status];
      if (statusLine) await expect(phone.getByText(statusLine, { exact: true }).first()).toBeVisible();
      if (SOFA.delivery) {
        await expect(phone.getByText(SOFA.delivery, { exact: true }).first()).toBeVisible();
        await expect(phone.getByText('Free Delivery!', { exact: true }).first()).toBeVisible();
      }
      await expect(orderButton).toHaveText(/order on whatsapp/i);
      g.expect(
        `The chosen buttons are filled in (${options.map((o, i) => `**${o.name}: ${PICK.values[i]}**`).join(', ')}), the quantity box shows **${QTY}** and the price changes to **${rs(PICK_PRICE)}**${
          PICK_WAS ? ` with ${rs(PICK_WAS)} struck through` : ''
        }${SOFA.delivery ? ', with a red **FREE DELIVERY!** tag under it' : ''}. Under the **ORDER ON WHATSAPP** button: ${SOFA.delivery ? `**${SOFA.delivery}**` : ''}${SOFA.delivery && statusLine ? ' and ' : ''}${statusLine ? `**${statusLine}**` : ''}`,
      );
      await g.shot(phone, `${SOFA.title}: ${PICK.values.join(', ')}, quantity ${QTY}, ready to order`, { highlight: orderButton });

      const pageUrl = new URL(phone.url());
      const variantId = pageUrl.searchParams.get('variant');
      g.step('Tap the dark **ORDER ON WHATSAPP** button.');
      const wa = await orderAndCatch(phone, orderButton);
      const lines = (wa.searchParams.get('text') ?? '').split('\n');
      expect(`${wa.origin}${wa.pathname}`).toBe(`https://wa.me/${STORE.whatsappStored}`);
      const expected = [
        WHATSAPP_DEFAULTS.greeting,
        `*${SOFA.title}*`,
        ...options.map((o, i) => `${o.name}: ${PICK.values[i]}`),
        `Quantity: ${QTY}`,
        `Price: ${rs(PICK_PRICE)}${QTY > 1 ? ' each' : ''}${PICK_WAS ? ` (was ${rs(PICK_WAS)})` : ''}`,
        `${pageUrl.origin}/products/${SOFA.handle}?variant=${variantId}`,
        WHATSAPP_DEFAULTS.closing,
      ];
      expect(lines).toEqual(expected);
      g.expect(
        `WhatsApp opens (on a phone: the WhatsApp app) with a chat to the shop's number **${STORE.whatsapp}** and this message already typed, ready to send. The last line is left open for the customer's city:`,
      );
      g.table(['Line', 'Message text'], lines.map((l, i) => [String(i + 1), '`' + l.trimEnd() + '`']));
      g.note('In this test the WhatsApp website was blocked, so the message was checked but never sent.');

      /* ------------------------------------------------------------------ blog */
      g.part('Read the blog and the pages in the footer');
      await g.click(menuButton, `Back on the store, tap **☰** at the top left again.`);
      await expect(mobileNav).toBeVisible();
      await g.click(mobileNav.getByRole('link', { name: BLOG_ITEM.label, exact: true }), `Tap **${BLOG_ITEM.label}**.`);
      await expect(phone).toHaveURL(/\/blogs\/news\/?(\?.*)?$/);
      await expect(phone.getByRole('heading', { level: 1, name: 'Blog Posts' })).toBeVisible();
      const postHeadings = BLOG_POSTS.map((p) => phone.getByRole('heading', { name: p.title, exact: true }));
      for (const h of postHeadings) await expect(h).toBeVisible();
      let stacked = false;
      if (postHeadings.length >= 2) {
        const [h0, h1] = [await postHeadings[0].boundingBox(), await postHeadings[1].boundingBox()];
        expect(h0 && h1 && Math.abs(h1.y - h0.y) > h0.height, 'posts are one under the other').toBe(true);
        stacked = true;
      }
      g.expect(
        `The blog opens with the heading **Blog Posts** and the posts${stacked ? ' one under the other' : ''}: ${BLOG_POSTS.map((p) => `**${p.title}**`).join(', ')}.`,
      );
      await checkPhoneWidth(g, phone, 'blog page', { loadImages: true });

      await g.click(phone.getByRole('heading', { name: POST.title, exact: true }).getByRole('link'), `Tap the post title **${POST.title}**.`);
      await expect(phone).toHaveURL(/\/blogs\/news\/[^/?]+/);
      await expect(phone.getByRole('heading', { level: 1, name: POST.title })).toBeVisible();
      const article = phone.locator('#blog-post-detail');
      await expect(article).toContainText(POST.body);
      await expect(article).toContainText(POST.subheading);
      const photo = article.locator('img').first();
      await expect(photo).toBeVisible();
      const photoBox = await photo.boundingBox();
      expect(photoBox && photoBox.width >= vp.width * 0.9, 'the post photo spans the screen').toBe(true);
      g.expect(`The post opens with its title **${POST.title}**, its photo across the width of the screen and the text, including the subheading **${POST.subheading}**.`);
      await checkPhoneWidth(g, phone, 'blog post', { loadImages: true });
      await g.shot(phone, `The blog post "${POST.title}" on a phone`);

      const footer = phone.getByRole('contentinfo');
      const pageLink = footer.getByRole('link', { name: TEXT_PAGE.title, exact: true });
      await expect(pageLink).toHaveCount(1);
      // `has` is matched inside each footer column, so the inner locator starts from the page
      const columnNav = footer.getByRole('navigation').filter({ has: phone.getByRole('link', { name: TEXT_PAGE.title, exact: true }) });
      const column = (await columnNav.count()) === 1 ? await columnNav.getAttribute('aria-label') : null;
      // the page's address is fixed by the store when the page is saved (section 7), so it is read from the link
      const pagePath = new URL((await pageLink.getAttribute('href')) ?? '', phone.url()).pathname.replace(/\/$/, '');
      expect(pagePath).toMatch(/^\/pages\/[^/]+$/);
      await g.click(
        pageLink,
        `Scroll down to the bottom of the page. In the footer${column ? `, under **${column.toUpperCase()}**` : ''}, tap **${TEXT_PAGE.title}**.`,
      );
      await expect(phone).toHaveURL(new RegExp(`${pagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?(\\?.*)?$`));
      // F07-4 of the previous run (a text page showed no title) is fixed: the title is the page heading
      const pageHeading = phone.getByRole('heading', { level: 1, name: TEXT_PAGE.title, exact: true });
      await expect(pageHeading).toBeVisible();
      await expect(phone.locator('main')).toContainText(TEXT_PAGE.body);
      await expect(phone).toHaveTitle(`${TEXT_PAGE.title} - Cozy Furnitures`);
      g.expect(
        `The **${TEXT_PAGE.title}** page opens (the address ends in \`${pagePath}\`) with its title **${TEXT_PAGE.title}** as the heading, and under it its text, wrapped to the screen: _${TEXT_PAGE.body}_`,
      );
      await checkPhoneWidth(g, phone, `${TEXT_PAGE.title} page`, { loadImages: true });
      await g.shot(phone, `The ${TEXT_PAGE.title} page on a phone`);

      // the built-in Contact us page (F08-9 of the previous run; section 8 sends its form from a computer) on a phone
      const contact = MENUS.footerContact;
      const contactLink = footer.getByRole('navigation', { name: 'Customer Support', exact: true }).getByRole('link', { name: contact.label, exact: true });
      await contactLink.scrollIntoViewIfNeeded();
      await g.click(contactLink, `Scroll down to the footer again. Under **CUSTOMER SUPPORT**, tap **${contact.label}**.`);
      await expect(phone).toHaveURL(new RegExp(`${contact.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?(\\?.*)?$`));
      const contactMain = phone.getByRole('main');
      await expect(contactMain.getByRole('heading', { level: 1, name: 'Contact Us' })).toBeVisible();
      const contactFields = ['Name', 'Email', 'Phone number', 'Comment'];
      for (const label of contactFields) await expect(contactMain.getByLabel(label, { exact: true })).toBeVisible();
      const send = contactMain.getByRole('button', { name: /send message/i });
      await expect(send).toBeVisible();
      const callLink = contactMain.getByRole('link', { name: STORE.phone, exact: true });
      await expect(callLink).toHaveAttribute('href', `tel:${STORE.phone.replace(/[^\d+]/g, '')}`);
      await expect(contactMain.getByRole('link', { name: STORE.email, exact: true })).toHaveAttribute('href', `mailto:${STORE.email}`);
      for (const line of STORE.address.split('\n')) await expect(contactMain).toContainText(line);
      // the details (first heading: Email) come under the form, with room between them and the button
      const [sendBox, detailsBox] = [await send.boundingBox(), await contactMain.locator('strong').filter({ hasText: /^Email$/ }).boundingBox()];
      expect(sendBox && detailsBox && detailsBox.y >= sendBox.y + sendBox.height + 16, 'the contact details are under the form, clear of the button').toBe(true);
      g.expect(
        `The **Contact Us** page opens (the address ends in \`${contact.href}\`). The form (${contactFields.map((f) => `**${f}**`).join(', ')} and **SEND MESSAGE**) fits the screen. Under the button, with some space, come the shop's email **${STORE.email}**, phone **${STORE.phone}** and address (${STORE.address.replace(/\n/g, ', ')}) from Settings. Tapping the phone number starts a call; tapping the email opens the email app.`,
      );
      await checkPhoneWidth(g, phone, 'Contact Us page', { loadImages: true });
      await g.shot(phone, 'The Contact Us page on a phone: the form, then the shop’s contact details', { highlight: send });
    } finally {
      await phoneContext.close();
    }

    /* ============================================================================ the admin on a phone */
    const adminContext = await ctx.newContext({ ...PHONE });
    try {
      const a = await adminContext.newPage();
      g.part(
        'The admin on a phone',
        'You can look after the shop from your phone as well. Here we only check that the main screens fit and can be used; nothing is saved.',
      );
      await g.goto(a, '/admin/login', `On your phone, open **${ctx.baseURL}/admin/login**.`);
      await expect(a.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
      const email = a.getByLabel('Email address');
      const password = a.getByLabel('Password', { exact: true });
      await expect(email).toBeVisible();
      g.expect('The **Admin Panel** sign-in box opens, with **Email address** and **Password**.');
      await checkPhoneWidth(g, a, 'admin sign-in page');
      await g.form(
        [
          { label: 'Email address', value: ctx.creds.email, locator: email },
          { label: 'Password', kind: 'click', value: 'the admin password (see **Test data and credentials** at the end of this guide)', act: () => password.fill(ctx.creds.password) },
        ],
        'Sign in:',
      );
      await g.click(a.getByRole('button', { name: 'Sign in to Dashboard' }), 'Tap **Sign in to Dashboard**.');
      await expect(a.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible({ timeout: 30_000 });
      await expect(a).toHaveURL(/\/admin\/?$/);
      const openAdminMenu = a.getByRole('button', { name: 'Open admin menu' });
      const drawer = a.getByRole('complementary', { name: 'Admin navigation' });
      await expect(openAdminMenu).toBeVisible();
      await expect(drawer).not.toBeInViewport();
      await expect(a.getByRole('link', { name: 'Store ↗' })).toBeVisible();
      await expect(a.getByRole('heading', { level: 2, name: 'WhatsApp clicks' })).toBeVisible();
      await expect(a.getByRole('heading', { level: 2, name: 'Catalogue' })).toBeVisible();
      g.expect(
        'The **Dashboard** opens. On a phone the left menu of the computer version is folded away behind a **☰** button at the top left; the top bar also has a **Store ↗** link. The **WhatsApp clicks** and **Catalogue** boxes are shown.',
      );
      await checkPhoneWidth(g, a, 'admin Dashboard');
      await g.shot(a, 'The admin Dashboard on a phone', { highlight: openAdminMenu });

      await g.click(openAdminMenu, 'Tap the **☰** button at the top left.');
      await expect(drawer).toBeInViewport({ ratio: 0.95 });
      const productsLink = drawer.getByRole('link', { name: 'Products', exact: true });
      for (const name of ['Dashboard', 'Products', 'Collections', 'Home banners', 'Menus', 'Pages', 'Blog posts', 'Settings']) {
        await expect(drawer.getByRole('link', { name, exact: true })).toBeVisible();
      }
      await expect(drawer.getByRole('button', { name: 'Sign out' })).toBeVisible();
      g.expect('The admin menu slides in from the left. It lists the admin pages, including **Dashboard**, **Products**, **Collections**, **Home banners**, **Menus**, **Pages**, **Blog posts** and **Settings**, and a **Sign out** button.');
      await g.shot(a, 'The admin menu open on a phone', { highlight: productsLink });

      await g.click(productsLink, 'Tap **Products**.');
      await expect(a).toHaveURL(/\/admin\/products\/?(\?.*)?$/);
      await expect(a.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
      await expect(drawer).not.toBeInViewport();
      const row = a
        .getByTestId('product-row')
        .filter({ visible: true })
        .filter({ has: a.getByRole('link', { name: SOFA.title, exact: true }) });
      await expect(row).toHaveCount(1);
      const variants = SOFA.variants ?? [];
      const prices = variants.map((v) => Number(v.sale ?? v.regular));
      const range = Math.min(...prices) === Math.max(...prices) ? rs(prices[0]) : `${rs(Math.min(...prices))} – ${rs(Math.max(...prices))}`;
      await expect(row).toContainText('Published');
      await expect(row).toContainText(`${variants.length} combinations`);
      await expect(row).toContainText(range);
      await expect(row.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
      if (SOFA.bestSeller) await expect(row.getByRole('button', { name: /^Best seller: in Hot Selling Products on the home page/ })).toBeVisible();
      await expect(a.getByRole('table')).toBeHidden();
      g.expect(
        `The menu closes and **Products** opens. On a phone each product is a card instead of a table row. The **${SOFA.title}** card shows **${range}**, **Published** and **${variants.length} combinations**, and an **Edit** link${
          SOFA.bestSeller ? '. Its star is filled in orange: it is a **Best seller** (section 3), so it is in **Hot Selling Products** on the home page' : ''
        }.`,
      );
      await checkPhoneWidth(g, a, 'admin product list');
      await g.shot(a, `Products on a phone: the ${SOFA.title} card`, { highlight: row });

      await g.click(row.getByRole('link', { name: 'Edit', exact: true }), `On the **${SOFA.title}** card, tap **Edit**.`);
      await expect(a).toHaveURL(/\/admin\/products\/\d+\/?(\?.*)?$/);
      await expect(a.getByRole('heading', { level: 1, name: SOFA.title })).toBeVisible();
      const titleBox = a.getByRole('textbox', { name: 'Title', exact: true });
      await expect(titleBox).toHaveValue(SOFA.title);
      const bar = a.getByTestId('save-bar');
      await expect(bar).toBeInViewport();
      const barStatus = bar.getByRole('status');
      const STATUS_TEXT = 'Published — visible on the store';
      await expect(barStatus).toHaveText(STATUS_TEXT);
      const save = bar.getByRole('button', { name: 'Save', exact: true });
      await expect(save).toBeVisible();
      const unpublish = bar.getByRole('button', { name: /Unpublish/ });
      await expect(unpublish).toBeVisible();
      const unpublishLabel = (await unpublish.innerText()).trim();
      // F09-1 of the previous run (on phones 400px and wider the status was cut to "Published …") is fixed: on a phone
      // the message has its own line above the buttons and wraps instead of being cut, so it is always shown in full.
      const expectStatusInFull = async () => {
        const fit = await barStatus.evaluate((el) => ({ shown: el.clientWidth, needed: el.scrollWidth, ellipsis: getComputedStyle(el).textOverflow }));
        expect(fit.needed - fit.shown, `save bar status fits (${fit.needed}px needed, ${fit.shown}px shown)`).toBeLessThanOrEqual(1);
        expect(fit.ellipsis).not.toBe('ellipsis');
        const [statusBox, buttonBox] = [await barStatus.boundingBox(), await unpublish.boundingBox()];
        expect(statusBox && buttonBox && statusBox.y + statusBox.height <= buttonBox.y + 1, 'the status is above the buttons').toBe(true);
      };
      await expectStatusInFull();
      const [unpublishBox, saveBox] = [await unpublish.boundingBox(), await save.boundingBox()];
      expect(unpublishBox && saveBox && Math.abs(unpublishBox.y - saveBox.y) < 2, 'the two buttons share a row').toBe(true);
      g.expect(
        `The **${SOFA.title}** editor opens, with the **Title** box filled in. A bar stays at the bottom of the screen. Its first line says **${STATUS_TEXT}** in full; under it are the **${unpublishLabel}** and **Save** buttons side by side.`,
      );
      await checkPhoneWidth(g, a, `admin product editor (${SOFA.title})`);
      await g.shot(a, `The ${SOFA.title} editor on a phone; the save bar is at the bottom`, { highlight: barStatus });

      // the bar's message after an edit ("Unsaved changes") is shown in full too; the edit is undone, nothing is saved
      const ADDED = ' test';
      await g.form(
        [
          {
            label: 'Title',
            kind: 'click',
            value: `type a space and **test** at the end, so the box reads **${SOFA.title}${ADDED}**`,
            act: async () => {
              await titleBox.tap();
              await titleBox.press('End');
              await titleBox.pressSequentially(ADDED);
            },
          },
        ],
        `To see the bar's message after a change, make a small change that is taken back in the next step (nothing is saved):`,
      );
      await expect(titleBox).toHaveValue(`${SOFA.title}${ADDED}`);
      g.step('Tap an empty spot of the page to close the keyboard (the bar at the bottom hides while the keyboard is open).');
      await a.getByRole('heading', { level: 1, name: SOFA.title }).tap();
      await expect(bar).toBeInViewport();
      await expect(barStatus).toHaveText(/^\s*Unsaved changes\s*$/);
      await expectStatusInFull();
      g.expect('The first line of the bar changes to an orange dot and **Unsaved changes**, in full.');
      await g.shot(a, 'After typing in the Title box the save bar says Unsaved changes', { highlight: barStatus });

      g.step(`Tap at the end of the **Title** box again and delete the word **test** and the space before it, so the title is **${SOFA.title}** again. Close the keyboard. Do not tap **Save**.`);
      await titleBox.tap();
      await titleBox.press('End');
      for (let i = 0; i < ADDED.length; i++) await titleBox.press('Backspace');
      await expect(titleBox).toHaveValue(SOFA.title);
      await a.getByRole('heading', { level: 1, name: SOFA.title }).tap();
      await expect(barStatus).toHaveText(STATUS_TEXT);
      await expectStatusInFull();
      g.expect(`The bar says **${STATUS_TEXT}** again: the product is exactly as it was saved, so there is nothing to save.`);

      g.step('Scroll down to **Options & prices**. Do not change anything.');
      const optionsHeading = a.getByRole('heading', { level: 2, name: 'Options & prices' });
      await optionsHeading.scrollIntoViewIfNeeded();
      const variantRows = a.getByTestId('variant-row');
      await expect(variantRows).toHaveCount(variants.length);
      for (const v of variants) {
        const combo = v.values.join(' / ');
        await expect(a.getByRole('textbox', { name: `Regular price for ${combo}`, exact: true })).toHaveValue(v.regular);
        await expect(a.getByRole('textbox', { name: `Sale price for ${combo}`, exact: true })).toHaveValue(v.sale ?? '');
        await expect(a.getByRole('combobox', { name: `Status for ${combo}`, exact: true }).locator('option:checked')).toHaveText(exactText(v.status));
      }
      await expect(bar).toBeInViewport();
      await expect(bar).not.toContainText('Unsaved changes');
      g.expect(
        `All ${variants.length} combinations are listed with their **Regular price**, **Sale price** and **Status** as typed in section 3 (for example **${variants[0].values.join(' / ')}**: regular ${variants[0].regular}${
          variants[0].sale ? `, sale ${variants[0].sale}` : ''
        }, **${variants[0].status}**). Nothing is marked as changed, and the save bar is still at the bottom of the screen.`,
      );
      await g.shot(a, 'Options & prices on a phone, with the save bar at the bottom', { highlight: variantRows.first() });
      g.note('Nothing was changed (the word test was removed again), so there is nothing to save: just close the page or tap **← Products** at the top.');
    } finally {
      await adminContext.close();
    }
  },
};

export default section;
