import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page, type Response } from '@playwright/test';
import type { Ctx, Section } from '../context';
import { BANNERS, MENUS, PRODUCTS, SHOPPER, TEMP_ADMIN_PASSWORD } from '../data';
import { gotoPage, type Guide } from '../guide';

/**
 * 10. Day-to-day admin work after the shopper sections (8, 9) have clicked WhatsApp buttons, sent the Contact us form
 * and signed up for the newsletter: the Dashboard and WhatsApp inquiries (with filters), Messages (the contact
 * message, the newsletter sign-ups tab with its CSV download, mark read / closed), a price change and a
 * draft/publish round trip checked on the store, the unsaved-changes warning (a native confirm box, see
 * tests/admin/unsaved-guard.spec.ts), deleting the hidden banner and one Popular searches link, and changing the
 * admin password to TEMP_ADMIN_PASSWORD and back, so the documented credentials stay valid.
 */

const SAVED = 'Saved. The store is updated.';
/** Product editor message after saving a draft (Unpublish / Save as draft). */
const SAVED_DRAFT = 'Saved as a draft. It is not on the store.';
const NEW_SALE_PRICE = '37000';
/** Group title of the Popular searches footer menu (section 6; data.ts has only its links). */
const POPULAR_GROUP = 'Popular searches';
const POPULAR_TAB = 'Footer “Popular searches”';
const GUARD_MESSAGE = 'You have unsaved changes. Leave this page and lose them?';
/** The Change password form refuses shorter new passwords (src/app/admin/actions/auth.ts). */
const PASSWORD_MIN = 10;

function productData(title: string) {
  const p = PRODUCTS.find((x) => x.title === title);
  if (!p) throw new Error(`10-admin-ops: no product "${title}" in data.ts`);
  return p;
}
const ALEXA = productData('Alexa Sofa Chair');
const ARBOUR = productData('Arbour Coffee Table');
const AURA = productData('Aura Bedside Table');
const RENAMED_AURA = `${AURA.title} (new name)`;

const HIDDEN_BANNER = (() => {
  const b = BANNERS.find((x) => !x.visible);
  if (!b) throw new Error('10-admin-ops: data.ts has no hidden banner');
  return b;
})();
const REMOVED_LINK = (() => {
  const l = MENUS.popular.find((x) => x.label === 'Office chairs');
  if (!l) throw new Error('10-admin-ops: no "Office chairs" link in MENUS.popular');
  return l;
})();
const KEPT_LINKS = MENUS.popular.filter((l) => l !== REMOVED_LINK);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rs = (v: string | number) => `Rs.${Number(v).toLocaleString('en-US')}`;
/** Digits of a shown number ("1,234" → 1234). */
const num = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* ------------------------------------------------------------------ admin locators */

const sidebar = (page: Page) => page.getByRole('complementary');
/** A left-menu link; WhatsApp inquiries and Messages carry a number badge, so it may follow the name. */
const menuLink = (page: Page, name: string) =>
  sidebar(page).getByRole('navigation').getByRole('link', { name: new RegExp(`^${escapeRe(name)}( [\\d,]+)?$`) });
const saveBar = (page: Page) => page.getByTestId('save-bar');
const savedNotice = (page: Page) => page.getByText(SAVED);
const draftNotice = (page: Page) => page.getByText(SAVED_DRAFT);

/** The number on a Dashboard card ("Today 3 Since midnight" → 3). */
async function cardValue(card: Locator): Promise<number> {
  return num(await card.locator('p').nth(1).innerText());
}

/** Menu editor: the top-level items, and an item's direct children (same structure section 6 uses). */
const topItems = (page: Page) => page.locator('[aria-label="Menu items"] > [data-testid="sortable-item"] > [data-testid="menu-item"]');
const childItems = (item: Locator) =>
  item.locator('[aria-label="Links inside"]').first().locator(':scope > [data-testid="sortable-item"] > [data-testid="menu-item"]');
const labelsOf = (items: Locator) => items.evaluateAll((els) => els.map((e) => e.getAttribute('data-label') ?? ''));

/* ------------------------------------------------------------------ store helpers */

/** Open a store page and return the HTTP status of the page that finally loaded (after any CDN check page). */
async function openOnStore(page: Page, url: string): Promise<number> {
  let status = 0;
  const onResponse = (r: Response) => {
    if (r.request().isNavigationRequest() && r.frame() === page.mainFrame()) status = r.status();
  };
  page.on('response', onResponse);
  try {
    await gotoPage(page, url);
  } finally {
    page.off('response', onResponse);
  }
  return status;
}

/* ------------------------------------------------------------------ admin flows */

/** Left menu → Products → the product's name in the list; ends on its edit page. */
async function openProduct(g: Guide, page: Page, title: string) {
  await g.click(menuLink(page, 'Products'), 'In the left menu, click **Products**.');
  await expect(page).toHaveURL(/\/admin\/products(\?.*)?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
  await g.click(page.getByRole('link', { name: title, exact: true }), `In the list, click **${title}**.`);
  await expect(page).toHaveURL(/\/admin\/products\/\d+/);
  await expect(page.locator('#product-title')).toHaveValue(title);
}

/** Click a link that the unsaved-changes guard intercepts; answer its browser box. Returns the box's text. */
async function clickThroughGuard(g: Guide, page: Page, link: Locator, md: string, answer: 'accept' | 'dismiss'): Promise<string> {
  let message = '';
  let type = '';
  page.once('dialog', (d) => {
    message = d.message();
    type = d.type();
    void (answer === 'accept' ? d.accept() : d.dismiss());
  });
  await g.click(link, md);
  await expect.poll(() => message, { message: 'the unsaved-changes box should appear' }).not.toBe('');
  expect(type).toBe('confirm');
  return message;
}

async function signIn(g: Guide, page: Page, email: string, password: string, intro: string) {
  await g.form(
    [
      { label: 'Email address', value: email, locator: page.getByLabel('Email address') },
      { label: 'Password', value: password, locator: page.getByLabel('Password', { exact: true }) },
    ],
    intro,
  );
  await g.click(page.getByRole('button', { name: 'Sign in to Dashboard' }), 'Click **Sign in to Dashboard**.');
}

async function signOut(g: Guide, page: Page) {
  await g.click(sidebar(page).getByRole('button', { name: 'Sign out' }), 'At the very bottom of the left menu, click **Sign out**.');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in to Dashboard' })).toBeVisible();
}

async function expectDashboard(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/admin\/?$/);
}

const pwField = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const PW_LABELS = ['Current password', 'New password', 'Confirm new password'] as const;

/** Left menu → Change password, fill the three boxes, show them, screenshot, submit, check the result. */
/** `caption`: take a screenshot of the filled form (only the first change; the second looks the same with the two passwords swapped). */
async function changePassword(g: Guide, page: Page, email: string, current: string, next: string, caption?: string) {
  await g.click(
    sidebar(page).getByRole('link', { name: 'Change password' }),
    'At the bottom of the left menu, under your name and email, click **Change password**.',
  );
  await expect(page).toHaveURL(/\/admin\/account\/password$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Change password' })).toBeVisible();
  await expect(page.getByText(`For ${email}`)).toBeVisible();
  const form = page.getByTestId('password-form');
  await g.form(
    [
      { label: 'Current password', value: current, locator: pwField(page, 'Current password') },
      { label: 'New password', value: next, locator: pwField(page, 'New password') },
      { label: 'Confirm new password', value: next, locator: pwField(page, 'Confirm new password') },
    ],
    'Fill in the three boxes:',
  );
  g.step('Click **Show** at the right end of each of the three boxes, so you can check what you typed.');
  for (const label of PW_LABELS) {
    const field = pwField(page, label);
    await field.locator('xpath=..').getByRole('button', { name: 'Show password' }).click();
    await expect(field).toHaveAttribute('type', 'text');
  }
  await expect(pwField(page, 'Current password')).toHaveValue(current);
  await expect(pwField(page, 'New password')).toHaveValue(next);
  await expect(pwField(page, 'Confirm new password')).toHaveValue(next);
  await expect(form.getByText('The two new passwords do not match yet.')).toHaveCount(0);
  g.expect('The three passwords are shown in plain text, the two new ones are identical, and no red message is shown under the boxes.');
  if (caption) await g.shot(page, caption, { highlight: form });

  await g.click(
    form.getByRole('button', { name: 'Change password', exact: true }),
    'Click the **Change password** button under the boxes (not the link with the same name in the left menu).',
  );
  await expect(form.getByText('Password changed.')).toBeVisible({ timeout: 30_000 });
  await expect(form.getByText('Other devices have been logged out. You stay signed in here.')).toBeVisible();
  for (const label of PW_LABELS) await expect(pwField(page, label)).toHaveValue('');
  await expect(page).toHaveURL(/\/admin\/account\/password$/);
  g.expect(
    'A box says **Password changed.** “Other devices have been logged out. You stay signed in here.” The three boxes are empty again and you are still signed in.',
  );
}

/**
 * Safety net (not part of the guide): if the run stops after the password was changed to the temporary one,
 * change it back through the same screen, so the documented sign-in keeps working.
 */
async function restoreOriginalPassword(page: Page, creds: Ctx['creds']) {
  await gotoPage(page, '/admin/account/password');
  if (/\/admin\/login/.test(page.url())) {
    await page.getByLabel('Email address').fill(creds.email);
    await page.getByLabel('Password', { exact: true }).fill(TEMP_ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in to Dashboard' }).click();
    const wrong = page.getByText('Invalid email or password');
    await expect(wrong.or(page.getByRole('heading', { level: 1, name: /^(Dashboard|Change password)$/ }))).toBeVisible({ timeout: 30_000 });
    if (await wrong.isVisible()) return; // the password is not the temporary one: nothing to restore
    await gotoPage(page, '/admin/account/password');
  }
  await pwField(page, 'Current password').fill(TEMP_ADMIN_PASSWORD);
  await pwField(page, 'New password').fill(creds.password);
  await pwField(page, 'Confirm new password').fill(creds.password);
  await page.getByTestId('password-form').getByRole('button', { name: 'Change password', exact: true }).click();
  // "not correct" = the temporary password was never set (the run stopped before the change): nothing to restore
  await expect(page.getByText('Password changed.').or(page.getByText('Your current password is not correct.'))).toBeVisible({ timeout: 30_000 });
}

/* ------------------------------------------------------------------ section */

type InquiryLine = { when: string; type: string; product: string; options: string; qty: string; price: string; from: string };

const section: Section = {
  id: '10',
  title: '10. Running the shop: inquiries, messages, edits, password',
  intro:
    'The everyday work in the admin once customers are using the shop: reading the WhatsApp clicks, the contact message and the newsletter sign-up made by the shopper in sections 8 and 9, changing a price, hiding a product and showing it again, the unsaved-changes warning, deleting a banner and a menu link, and changing the admin password (and back again).',
  async run(ctx: Ctx) {
    const { guide: g, admin: a, shopper: s, creds } = ctx;

    /* ================================================================ Dashboard */
    g.part('10.1 Dashboard: WhatsApp clicks', 'The Dashboard is the first page after signing in. Its top row counts the taps on WhatsApp buttons in the shop.');
    await g.click(menuLink(a, 'Dashboard'), 'In the left menu, click **Dashboard**.');
    await expectDashboard(a);
    const todayCard = a.getByTestId('stat-inquiries-today');
    const last7Card = a.getByRole('link', { name: /^Last 7 days [\d,]+ Including today$/ });
    const last30Card = a.getByRole('link', { name: /^Last 30 days [\d,]+ Including today$/ });
    const availCard = a.getByRole('link', { name: /^Availability questions \d+% / });
    await expect(a.getByRole('heading', { level: 2, name: 'WhatsApp clicks', exact: true })).toBeVisible();
    const today = await cardValue(todayCard);
    const last7 = await cardValue(last7Card);
    const last30 = await cardValue(last30Card);
    expect(last30, 'WhatsApp clicks made by the shopper in sections 8 and 9').toBeGreaterThan(0);
    expect(today).toBeLessThanOrEqual(last7);
    expect(last7).toBeLessThanOrEqual(last30);
    const availShare = (await availCard.locator('p').nth(1).innerText()).trim();
    const availSub = (await availCard.locator('p').nth(2).innerText()).trim();
    expect(availSub).toMatch(new RegExp(`^[\\d,]+ of ${escapeRe(last30.toLocaleString('en-PK'))} clicks in 30 days$`));
    if (today > 0) await expect(menuLink(a, 'WhatsApp inquiries')).toHaveAccessibleName(`WhatsApp inquiries ${today}`);
    g.expect(
      `Under **WhatsApp clicks** the four cards are no longer 0: **Today ${today}**, **Last 7 days ${last7}**, **Last 30 days ${last30}**, and **Availability questions ${availShare}** (${availSub}).` +
        (today > 0 ? ` In the left menu, **WhatsApp inquiries** shows a small badge with **${today}**, today's clicks.` : ''),
    );

    const top = a.getByTestId('top-products');
    const topItemsList = top.locator('li');
    await expect(topItemsList.first()).toBeVisible();
    const topRows = await topItemsList.evaluateAll((lis) =>
      lis.map((li) => {
        const title = li.querySelector('a[href^="/admin/products/"]')?.textContent?.trim() ?? '';
        const clicks = Array.from(li.querySelectorAll('span')).map((x) => x.textContent?.trim() ?? '').find((t) => /^\d[\d,]* clicks?$/.test(t)) ?? '';
        return [title, clicks];
      }),
    );
    expect(topRows.length).toBeGreaterThan(0);
    for (const [title, clicks] of topRows) {
      expect(PRODUCTS.map((p) => p.title)).toContain(title);
      expect(clicks).toMatch(/^\d[\d,]* clicks?$/);
    }
    const clickCounts = topRows.map(([, c]) => num(c));
    expect(clickCounts).toEqual([...clickCounts].sort((x, y) => y - x));
    await expect(a.getByText('No product inquiries in the last 30 days yet.')).toHaveCount(0);
    await expect(top.getByRole('heading', { level: 2, name: 'Most asked-about products · last 30 days' })).toBeVisible();
    await expect(a.getByRole('heading', { level: 2, name: 'Recent inquiries', exact: true })).toBeVisible();
    const recent = a.locator('table [data-testid="inquiry-row"]');
    await expect(recent.first()).toBeVisible();
    g.expect(
      `**Most asked-about products · last 30 days** lists the products whose WhatsApp buttons were tapped, most clicks first, each with its number of clicks. **Recent inquiries** at the bottom shows the latest clicks.`,
    );
    g.text('In this test the list showed:');
    g.table(['#', 'Product', 'Clicks'], topRows.map(([t, c], i) => [String(i + 1), t, c]));
    const newMessagesCard = a.getByRole('link', { name: /^New messages [\d,]+ / });
    const newMessages = await cardValue(newMessagesCard);
    await g.shot(a, 'Dashboard with the WhatsApp clicks from the shopper sections', { fullPage: true, highlight: top });

    /* ================================================================ WhatsApp inquiries */
    g.part(
      '10.2 WhatsApp inquiries',
      'Every tap on **Order on WhatsApp**, **Ask about availability** or the round chat button is listed here. The customer’s actual message arrives in your WhatsApp, not in the admin.',
    );
    await g.click(menuLink(a, 'WhatsApp inquiries'), 'In the left menu, click **WhatsApp inquiries**.');
    await expect(a).toHaveURL(/\/admin\/inquiries$/);
    await expect(a.getByRole('heading', { level: 1, name: 'WhatsApp inquiries' })).toBeVisible();
    // the <label> wraps the select (with its options), so find the boxes by their accessible name
    const period = a.getByRole('combobox', { name: 'Period', exact: true });
    const type = a.getByRole('combobox', { name: 'Type', exact: true });
    await expect(period).toHaveValue('30');
    await expect(type).toHaveValue('all');
    const total = num(await a.getByTestId('inquiries-total').innerText());
    expect(total).toBe(last30);
    const rows = a.locator('table [data-testid="inquiry-row"]');
    await expect(rows).toHaveCount(Math.min(total, 50));
    const lines: InquiryLine[] = await rows.evaluateAll((trs) =>
      trs.map((tr) => {
        const td = Array.from(tr.querySelectorAll('td')).map((c) => (c as HTMLElement).innerText.trim());
        return { when: tr.querySelector('time')?.getAttribute('datetime') ?? '', type: td[1], product: td[2], options: td[3], qty: td[4], price: td[5], from: td[6] };
      }),
    );
    // newest first
    const times = lines.map((l) => Date.parse(l.when));
    expect(times).toEqual([...times].sort((x, y) => y - x));
    const orders = lines.filter((l) => l.type === 'Order');
    const availability = lines.filter((l) => l.type === 'Availability question');
    const general = lines.filter((l) => l.type === 'General question');
    expect(orders.length, 'Order on WhatsApp clicks from section 8').toBeGreaterThan(0);
    for (const l of [...orders, ...availability]) {
      expect(PRODUCTS.map((p) => p.title)).toContain(l.product);
      expect(l.qty).toMatch(/^\d+$/);
      expect(l.from).toBe('Product page');
    }
    for (const l of general) {
      expect(l.product).toBe('—');
      expect(l.qty).toBe('—');
      expect(l.from).toMatch(/^Chat button · /);
    }
    const kindsSeen = [
      `**Order** (${orders.length})`,
      ...(availability.length ? [`**Availability question** (${availability.length})`] : []),
      ...(general.length ? [`**General question** (${general.length})`] : []),
    ];
    g.expect(
      `The page opens on **Last 30 days**, with **${total}** ${total === 1 ? 'inquiry' : 'inquiries'}, newest first. Each line shows when, the type (${kindsSeen.join(', ')}), the product, the options the customer picked, the quantity, the price and where the tap came from: **Product page** for the order and availability buttons` +
        (general.length ? ', **Chat button · …** (with the page name) for the round WhatsApp button, which has no product.' : '.'),
    );
    g.text(`In this test the list showed${lines.length > 15 ? ' (the 15 newest lines)' : ''}:`);
    g.table(
      ['Type', 'Product', 'Options', 'Qty', 'Price', 'From'],
      lines.slice(0, 15).map((l) => [l.type, l.product, l.options, l.qty, l.price, l.from]),
    );

    // Filters: today's orders (all clicks of a fresh run are from today, unless the run crossed midnight in Pakistan)
    const periodLabel = today > 0 ? 'Today' : 'Last 7 days';
    const periodValue = today > 0 ? '1' : '7';
    await g.form(
      [
        { label: 'Period', kind: 'select', value: periodLabel, locator: period },
        { label: 'Type', kind: 'select', value: 'Order', locator: type },
        { label: 'Product name', value: '' },
      ],
      'Try the filters at the top. Choose:',
    );
    await g.click(a.getByRole('button', { name: 'Show', exact: true }), 'Click **Show**.');
    await expect(a).toHaveURL(new RegExp(`range=${periodValue}`));
    await expect(a).toHaveURL(/kind=ORDER/);
    await expect(period).toHaveValue(periodValue);
    await expect(type).toHaveValue('ORDER');
    const totalBox = a.getByTestId('inquiries-total').locator('xpath=..');
    await expect(totalBox).toContainText(periodLabel);
    const filtered = num(await a.getByTestId('inquiries-total').innerText());
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThanOrEqual(total >= 50 ? Number.MAX_SAFE_INTEGER : orders.length);
    await expect(rows).toHaveCount(Math.min(filtered, 50));
    const filteredTypes = await rows.evaluateAll((trs) => trs.map((tr) => (tr.querySelectorAll('td')[1] as HTMLElement).innerText.trim()));
    expect(new Set(filteredTypes)).toEqual(new Set(['Order']));
    const clear = a.getByRole('link', { name: 'Clear', exact: true });
    await expect(clear).toBeVisible();
    g.expect(
      `The list now shows only the **${filtered}** Order ${filtered === 1 ? 'click' : 'clicks'} of **${periodLabel.toLowerCase()}**: every line has the **Order** label, and the box on the left is headed **${periodLabel}**. A **Clear** button appears next to **Show**.`,
    );
    await g.shot(a, `WhatsApp inquiries filtered to ${periodLabel.toLowerCase()}'s orders`, { highlight: a.locator('form[action="/admin/inquiries"]') });
    await g.click(clear, 'Click **Clear** to see every inquiry again.');
    await expect(a).toHaveURL(/\/admin\/inquiries$/);
    await expect(totalBox).toContainText('Last 30 days');
    await expect(a.getByTestId('inquiries-total')).toHaveText(total.toLocaleString('en-PK'));
    await expect(rows).toHaveCount(Math.min(total, 50));
    await expect(clear).toHaveCount(0);
    // F10-1 of the previous run is fixed: Clear also puts the filter boxes back (the form is redrawn for the new filters).
    const filterForm = a.locator('form[action="/admin/inquiries"]');
    const productBox = filterForm.getByRole('searchbox', { name: 'Product name', exact: true });
    await expect(period).toHaveValue('30');
    await expect(type).toHaveValue('all');
    await expect(productBox).toHaveValue('');
    g.expect(
      `All **${total}** inquiries are listed again, the box on the left is headed **Last 30 days** again and the **Clear** button is gone. The filter boxes are back to **Last 30 days** and **All types**, so the page no longer looks filtered.`,
    );
    await g.shot(a, `After Clear: all ${total} inquiries, the filters back to Last 30 days / All types`, { highlight: filterForm });

    g.text('The **WhatsApp inquiries** link in the left menu also starts again from the full list:');
    await g.form([{ label: 'Type', kind: 'select', value: 'Order', locator: type }], 'Choose again:');
    await g.click(a.getByRole('button', { name: 'Show', exact: true }), 'Click **Show**.');
    await expect(a).toHaveURL(/kind=ORDER/);
    await expect(type).toHaveValue('ORDER');
    await expect(clear).toBeVisible();
    await g.click(menuLink(a, 'WhatsApp inquiries'), 'In the left menu, click **WhatsApp inquiries**.');
    await expect(a).toHaveURL(/\/admin\/inquiries$/);
    await expect(clear).toHaveCount(0);
    await expect(period).toHaveValue('30');
    await expect(type).toHaveValue('all');
    await expect(a.getByTestId('inquiries-total')).toHaveText(total.toLocaleString('en-PK'));
    g.expect(`The boxes show **Last 30 days** and **All types** again, and all **${total}** inquiries are listed.`);

    /* ================================================================ Messages */
    // F08-7 / F10-2 of the previous run are fixed: newsletter sign-ups are kept with the subject "Newsletter", have their
    // own tab (with a CSV download), and the admin says plainly that there is no mailing list.
    g.part(
      '10.3 Messages and newsletter sign-ups',
      'Messages holds what customers send with the **Contact us** form (section 8 sent one) and the email addresses typed into **Join our mailing list** at the bottom of the store.',
    );
    await g.click(menuLink(a, 'Messages'), 'In the left menu, click **Messages**.');
    await expect(a).toHaveURL(/\/admin\/messages$/);
    await expect(a.getByRole('heading', { level: 1, name: 'Messages' })).toBeVisible();
    await expect(a.getByText('Messages customers send from the store, and newsletter sign-ups', { exact: true })).toBeVisible();
    const kindTabs = a.getByRole('navigation', { name: 'Kind of message', exact: true });
    const everythingTab = kindTabs.getByRole('tab', { name: 'Everything', exact: true });
    const messagesTab = kindTabs.getByRole('tab', { name: 'Messages', exact: true });
    const signupsTab = kindTabs.getByRole('tab', { name: /^Newsletter sign-ups \(\d+\)$/ });
    await expect(everythingTab).toHaveAttribute('aria-selected', 'true');
    const signups = num(await signupsTab.innerText());
    expect(signups, 'the newsletter sign-up from section 8').toBeGreaterThan(0);
    // the status counters (All / New / Read / Closed) are links with the number in a badge
    const statusTab = (label: string) => a.getByRole('link', { name: new RegExp(`^${label} \\d+$`) });
    const statusCount = async (label: string) => num(await statusTab(label).innerText());
    const allMessages = await statusCount('All');
    const newEverything = await statusCount('New');
    for (const h of ['Name', 'Subject', 'Contact', 'Status', 'Date']) await expect(a.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
    const summaryRows = a.getByRole('row').filter({ has: a.getByRole('link', { name: /^(Expand|Collapse) message$/ }) });
    await expect(summaryRows).toHaveCount(Math.min(allMessages, 20));
    const contactRow = summaryRows.filter({ hasText: SHOPPER.contact.name });
    const signupRow = summaryRows.filter({ hasText: SHOPPER.newsletterEmail });
    await expect(contactRow, 'the Contact us message sent in section 8').toHaveCount(1);
    await expect(signupRow, 'the newsletter sign-up made in section 8').toHaveCount(1);
    const contactCells = contactRow.getByRole('cell');
    await expect(contactCells.nth(0)).toHaveText(SHOPPER.contact.name);
    await expect(contactCells.nth(1)).toHaveText('General');
    await expect(contactCells.nth(2)).toContainText(SHOPPER.contact.phone);
    await expect(contactCells.nth(2)).toContainText(SHOPPER.contact.email);
    await expect(contactCells.nth(3)).toHaveText('NEW');
    const signupCells = signupRow.getByRole('cell');
    await expect(signupCells.nth(0)).toHaveText('Newsletter Subscriber');
    await expect(signupCells.nth(1)).toHaveText('Newsletter');
    await expect(signupCells.nth(2)).toContainText(SHOPPER.newsletterEmail);
    await expect(signupCells.nth(3)).toHaveText('NEW');
    g.expect(
      `Above the list are three tabs: **Everything** (selected), **Messages** and **Newsletter sign-ups (${signups})**. Under them, the counters **All ${allMessages}** and **New ${newEverything}**. Each line shows the sender, the subject, the phone/email, the status and the date. The list has:`,
    );
    g.table(
      ['Name', 'Subject', 'Contact', 'Status', 'Where it comes from'],
      [
        [SHOPPER.contact.name, 'General', `${SHOPPER.contact.phone}\n${SHOPPER.contact.email}`, 'NEW', 'the **Contact us** page (section 8.8)'],
        ['Newsletter Subscriber', 'Newsletter', SHOPPER.newsletterEmail, 'NEW', '**Join our mailing list** in the footer (section 8.7)'],
      ],
    );
    await g.shot(a, 'Messages: the contact message and the newsletter sign-up', { highlight: a.locator('table').first().locator('xpath=..') });

    await g.click(signupsTab, `Click the tab **Newsletter sign-ups (${signups})**.`);
    await expect(a).toHaveURL(/[?&]type=newsletter/);
    await expect(signupsTab).toHaveAttribute('aria-selected', 'true');
    const noMailingList = a.getByRole('status').filter({ hasText: 'There is no mailing list' });
    await expect(noMailingList).toBeVisible();
    await expect(noMailingList).toContainText('The shop has no mailing service, so nothing is ever sent to them. Sign-ups are only collected here.');
    await expect(summaryRows).toHaveCount(Math.min(signups, 20));
    await expect(signupRow).toHaveCount(1);
    await expect(contactRow).toHaveCount(0);
    const signupSubjects = await summaryRows.evaluateAll((trs) => trs.map((tr) => (tr.querySelectorAll('td')[1] as HTMLElement).innerText.trim()));
    expect(new Set(signupSubjects)).toEqual(new Set(['Newsletter']));
    const csvButton = noMailingList.getByRole('link', { name: 'Download sign-ups (CSV)', exact: true });
    await expect(csvButton).toBeVisible();
    g.expect(
      `Only the sign-ups are listed (here **${SHOPPER.newsletterEmail}**). A blue box says **There is no mailing list**: “These are the email addresses typed into “Join our mailing list” at the bottom of the store. The shop has no mailing service, so nothing is ever sent to them. Sign-ups are only collected here. To send news, download the list and use your own email or a mailing service.” It has a **Download sign-ups (CSV)** button.`,
    );
    await g.shot(a, 'Newsletter sign-ups: “There is no mailing list” and the download button', { highlight: noMailingList });
    const [download] = await Promise.all([a.waitForEvent('download'), g.click(csvButton, 'Click **Download sign-ups (CSV)**.')]);
    expect(download.suggestedFilename()).toBe('newsletter-signups.csv');
    const csvLines = readFileSync(await download.path(), 'utf8').trim().split(/\r?\n/);
    expect(csvLines[0]).toBe('Email,Signed up');
    const csvRows = csvLines.slice(1).map((l) => l.split(','));
    expect(csvRows.map(([email]) => email)).toContain(SHOPPER.newsletterEmail);
    expect(csvRows.length).toBe(new Set(csvRows.map(([email]) => email.toLowerCase())).size);
    for (const [, date] of csvRows) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    g.expect(
      'The browser saves the file **newsletter-signups.csv**, which opens in Excel or Google Sheets: one line per email address (an address that signed up twice is listed once) with the date it signed up. In this test it held:',
    );
    g.table(['Email', 'Signed up'], csvRows);

    await g.click(messagesTab, 'Click the tab **Messages**.');
    await expect(a).toHaveURL(/[?&]type=messages/);
    await expect(messagesTab).toHaveAttribute('aria-selected', 'true');
    await expect(a.getByText('Sent with the forms on the store, such as the Contact us page.', { exact: true })).toBeVisible();
    await expect(noMailingList).toHaveCount(0);
    await expect(contactRow).toHaveCount(1);
    await expect(signupRow).toHaveCount(0);
    const messagesOnly = await statusCount('All');
    expect(messagesOnly).toBe(allMessages - signups);
    // sign-ups are not waiting for a reply: the Dashboard "New messages" card and the left-menu badge count only these
    expect(await statusCount('New')).toBe(newMessages);
    g.expect(
      `Only the messages customers wrote are listed (**All ${messagesOnly}**), without the sign-ups. The line under the tabs says “Sent with the forms on the store, such as the Contact us page.” Its **New ${newMessages}** is the same number as **New messages** on the Dashboard and the badge next to **Messages** in the left menu: newsletter sign-ups are not counted as unread messages.`,
    );

    const row = contactRow.first();
    const name = SHOPPER.contact.name;
    const status = row.getByRole('cell').nth(3);
    await expect(status).toHaveText('NEW');
    const [newBefore, readBefore, closedBefore] = [await statusCount('New'), await statusCount('Read'), await statusCount('Closed')];
    await g.click(row.getByRole('link', { name: 'Expand message' }), `On the line from **${name}**, click **View** (on the right).`);
    await expect(a).toHaveURL(/[?&]open=\d+/);
    await expect(a).toHaveURL(/[?&]type=messages/);
    const detail = a.getByRole('row').filter({ hasText: `From ${name}` });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText(`From ${name} · ${SHOPPER.contact.email} · ${SHOPPER.contact.phone} · `);
    await expect(detail).toContainText(SHOPPER.contact.message);
    const reply = detail.getByRole('link', { name: 'Reply by email →' });
    await expect(reply).toHaveAttribute('href', `mailto:${SHOPPER.contact.email}?subject=${encodeURIComponent('Re: General')}`);
    const markRead = detail.getByRole('button', { name: 'Mark as Read' });
    const markClosed = detail.getByRole('button', { name: 'Mark as Closed' });
    await expect(markRead).toBeVisible();
    await expect(markClosed).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
    await expect(row.getByRole('link', { name: 'Collapse message' })).toBeVisible();
    g.expect(
      `The message opens under its line: who sent it, with email, phone and date, the full text (“${SHOPPER.contact.message}”), and the buttons **Mark as Read**, **Mark as Closed** and **Delete**. **Reply by email →** opens your email program with a reply to ${SHOPPER.contact.email} ready. **View** has become **Close**.`,
    );
    g.note('Opening a message does not mark it as read by itself: use the buttons.');
    // the table's scrolling frame clips an outline drawn around a row, so outline the message text inside it
    await g.shot(a, `Message from ${name} opened`, { highlight: detail.getByText(SHOPPER.contact.message, { exact: true }).locator('xpath=..') });

    await g.click(markRead, 'Click **Mark as Read**.');
    await expect(status).toHaveText('READ');
    await expect(markRead).toHaveCount(0);
    await expect(statusTab('New')).toHaveAccessibleName(`New ${newBefore - 1}`);
    await expect(statusTab('Read')).toHaveAccessibleName(`Read ${readBefore + 1}`);
    g.expect(`The status changes to **READ**, the **Mark as Read** button disappears, and the counters now show **New ${newBefore - 1}** and **Read ${readBefore + 1}**.`);
    await g.click(markClosed, 'When the customer has been answered, click **Mark as Closed**.');
    await expect(status).toHaveText('CLOSED');
    await expect(markClosed).toHaveCount(0);
    await expect(statusTab('Closed')).toHaveAccessibleName(`Closed ${closedBefore + 1}`);
    await expect(statusTab('Read')).toHaveAccessibleName(`Read ${readBefore}`);
    await expect(detail.getByRole('button', { name: 'Mark as Read' })).toBeVisible();
    g.expect(`The status changes to **CLOSED** and the message moves to the **Closed** counter (**Closed ${closedBefore + 1}**). **Mark as Read** is back, in case you want to reopen it.`);
    // newsletter sign-ups are not counted as unread messages, so the badge only follows real messages
    const stillNew = newMessages - 1;
    await expect(menuLink(a, 'Messages')).toHaveAccessibleName(stillNew > 0 ? `Messages ${stillNew}` : 'Messages');
    g.step('Look at **Messages** in the left menu.');
    g.expect(
      stillNew > 0
        ? `The red badge next to **Messages** now shows **${stillNew}**: the other unread customer messages.`
        : 'The red badge next to **Messages** is gone: the only customer message has been answered, and newsletter sign-ups are not counted as unread messages.',
    );

    /* ================================================================ price change */
    g.part('10.4 Change a price and see it on the store', `${ALEXA.title} goes from ${rs(ALEXA.sale!)} to ${rs(NEW_SALE_PRICE)} (the regular price ${rs(ALEXA.regular!)} stays).`);
    const alexaPath = `/products/${ALEXA.handle}`;
    const alexaHead = s.getByRole('heading', { level: 1, name: ALEXA.title, exact: true }).locator('xpath=..');
    await g.goto(s, alexaPath, `In the **shopper** window, open **${ctx.baseURL.replace(/\/+$/, '')}${alexaPath}**.`);
    await expect(alexaHead.locator('ins')).toHaveText(rs(ALEXA.sale!));
    await expect(alexaHead.locator('del')).toHaveText(rs(ALEXA.regular!));
    g.expect(`The product page shows **${rs(ALEXA.sale!)}** with **${rs(ALEXA.regular!)}** struck through.`);

    await openProduct(g, a, ALEXA.title);
    const salePrice = a.getByLabel('Sale price', { exact: true });
    await expect(a.getByLabel('Regular price', { exact: true })).toHaveValue(ALEXA.regular!);
    await expect(salePrice).toHaveValue(new RegExp(`^(${ALEXA.sale}|${NEW_SALE_PRICE})$`));
    await g.form([{ label: 'Sale price (Rs.)', value: NEW_SALE_PRICE, locator: salePrice }], 'Scroll down to **Options & prices** and change the sale price:');
    await expect(saveBar(a)).toContainText('Unsaved changes');
    g.expect('The bar at the bottom of the screen says **Unsaved changes**.');
    // the "Options & prices" card at the top of the screen: clear of the bottom bar and of the description's sticky toolbar
    await a.getByText('Options & prices', { exact: true }).evaluate((el) => {
      el.scrollIntoView({ block: 'start', behavior: 'instant' });
      window.scrollBy({ top: -24, behavior: 'instant' });
    });
    await g.shot(a, `${ALEXA.title}: sale price changed to ${NEW_SALE_PRICE}, before saving`, { highlight: salePrice });
    await g.click(saveBar(a).getByRole('button', { name: 'Save', exact: true }), 'Click **Save** in the bar at the bottom.');
    await expect(savedNotice(a)).toBeVisible({ timeout: 30_000 });
    await expect(saveBar(a)).not.toContainText('Unsaved changes');
    await expect(salePrice).toHaveValue(NEW_SALE_PRICE);
    await expect(a.getByTestId('product-status')).toHaveText('Published');
    g.expect(`The message **${SAVED}** appears at the top of the form; the sale price box keeps **${NEW_SALE_PRICE}**.`);

    g.step('In the **shopper** window, reload the product page (press **F5**).');
    await expect(async () => {
      await gotoPage(s, alexaPath);
      await expect(alexaHead.locator('ins')).toHaveText(rs(NEW_SALE_PRICE), { timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await expect(alexaHead.locator('del')).toHaveText(rs(ALEXA.regular!));
    const pct = Math.round(((Number(ALEXA.regular) - Number(NEW_SALE_PRICE)) / Number(ALEXA.regular)) * 100);
    await expect(alexaHead.getByText(new RegExp(`^${pct}% off$`, 'i'))).toBeVisible();
    g.expect(`The price is now **${rs(NEW_SALE_PRICE)}**, with **${rs(ALEXA.regular!)}** struck through and the label **${pct}% OFF**.`);
    await g.shot(s, `Store: ${ALEXA.title} at the new price ${rs(NEW_SALE_PRICE)}`, { fullPage: true, highlight: alexaHead });

    /* ================================================================ draft / publish */
    g.part(
      '10.5 Hide a product and show it again',
      `A product saved as a **draft** disappears from the store (its page says “Page not found”) but nothing is lost. Here **${ARBOUR.title}** is hidden and then published again.`,
    );
    const arbourPath = `/products/${ARBOUR.handle}`;
    await openProduct(g, a, ARBOUR.title);
    const pill = a.getByTestId('product-status');
    if ((await pill.innerText()).trim() === 'Draft') {
      // only on a re-run that stopped while the product was hidden: publish it first
      await saveBar(a).getByRole('button', { name: 'Publish', exact: true }).click();
      await expect(pill).toHaveText('Published', { timeout: 30_000 });
    }
    await expect(pill).toHaveText('Published');
    await expect(saveBar(a)).toContainText('Published — visible on the store');
    g.expect('Next to the title the label says **Published**, and the bottom bar says **Published — visible on the store**.');
    await g.click(
      saveBar(a).getByRole('button', { name: 'Unpublish (save as draft)' }),
      'In the bar at the bottom, click **Unpublish (save as draft)**.',
    );
    await expect(pill).toHaveText('Draft', { timeout: 30_000 });
    // F03-2 of the previous run is fixed: a draft save no longer says "The store is updated".
    await expect(draftNotice(a)).toBeVisible();
    await expect(savedNotice(a)).toHaveCount(0);
    await expect(saveBar(a)).toContainText('Draft — not visible on the store');
    await expect(saveBar(a).getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
    await expect(saveBar(a).getByRole('button', { name: 'Save as draft' })).toBeVisible();
    await expect(a.getByText('Publish to see it on the store')).toBeVisible();
    await expect(a.getByRole('link', { name: 'View on store' })).toHaveCount(0);
    g.expect(
      `**${SAVED_DRAFT}** appears, the label changes to **Draft**, the bottom bar says **Draft — not visible on the store** and now offers **Save as draft** and **Publish**. The **View on store** button at the top is replaced by a grey **Publish to see it on the store**.`,
    );

    g.step(`In the **shopper** window, open **${ctx.baseURL.replace(/\/+$/, '')}${arbourPath}**.`);
    await expect(async () => {
      expect(await openOnStore(s, arbourPath)).toBe(404);
      await expect(s.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await expect(s.getByRole('heading', { level: 1, name: ARBOUR.title })).toHaveCount(0);
    g.expect('The store shows **Page not found** instead of the product (the page answers with the “not found” code 404).');
    await g.shot(s, `Store: ${ARBOUR.title} while it is a draft`, { fullPage: true });

    await g.click(saveBar(a).getByRole('button', { name: 'Publish', exact: true }), 'Back in the **admin** window, click **Publish** in the bar at the bottom.');
    await expect(pill).toHaveText('Published', { timeout: 30_000 });
    await expect(savedNotice(a)).toBeVisible();
    await expect(draftNotice(a)).toHaveCount(0);
    await expect(saveBar(a)).toContainText('Published — visible on the store');
    await expect(a.getByRole('link', { name: 'View on store' })).toHaveAttribute('href', arbourPath);
    g.expect(`**${SAVED}** appears, the label is **Published** again and the **View on store** button is back.`);
    g.step('In the **shopper** window, reload the page (press **F5**).');
    await expect(async () => {
      expect(await openOnStore(s, arbourPath)).toBe(200);
      await expect(s.getByRole('heading', { level: 1, name: ARBOUR.title, exact: true })).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await expect(s.getByRole('heading', { level: 1, name: ARBOUR.title, exact: true }).locator('xpath=..').locator('ins')).toHaveText(rs(ARBOUR.regular!));
    g.expect(`The product page is back, with the price **${rs(ARBOUR.regular!)}**.`);

    /* ================================================================ unsaved-changes guard */
    g.part(
      '10.6 The unsaved-changes warning',
      'If you leave an edit page without saving, the admin asks first. Here a product name is changed and not saved.',
    );
    await openProduct(g, a, AURA.title);
    const title = a.locator('#product-title');
    await g.form([{ label: 'Title', value: RENAMED_AURA, locator: title }], 'Change the title (do **not** save):');
    await expect(saveBar(a)).toContainText('Unsaved changes');
    await expect(a.getByRole('heading', { level: 1 })).toHaveText(RENAMED_AURA);
    g.expect('The bottom bar says **Unsaved changes**.');

    const collectionsLink = menuLink(a, 'Collections');
    const productUrl = a.url();
    const msg1 = await clickThroughGuard(g, a, collectionsLink, 'In the left menu, click **Collections**.', 'dismiss');
    expect(msg1).toBe(GUARD_MESSAGE);
    g.expect(`A small box from the browser asks: **“${GUARD_MESSAGE}”** with the buttons **OK** and **Cancel**.`);
    g.step('Click **Cancel** (stay on the page).');
    await expect(a).toHaveURL(productUrl);
    await expect(title).toHaveValue(RENAMED_AURA);
    await expect(saveBar(a)).toContainText('Unsaved changes');
    g.expect('You stay on the product, and the new title you typed is still in the box, not saved yet.');
    g.note('The warning box belongs to the browser itself, so it looks a little different in each browser and cannot be captured in the screenshots of this guide.');
    await a.mouse.move(1000, 30); // away from the left menu, so Collections does not look selected (hover)
    await g.shot(a, 'After Cancel: still on the product, the change is kept but not saved', { highlight: title });

    const msg2 = await clickThroughGuard(g, a, collectionsLink, 'Click **Collections** in the left menu again; this time click **OK** in the box.', 'accept');
    expect(msg2).toBe(GUARD_MESSAGE);
    await expect(a).toHaveURL(/\/admin\/collections$/);
    await expect(a.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible();
    g.expect('The **Collections** page opens; the change to the title is thrown away.');
    await g.click(menuLink(a, 'Products'), 'In the left menu, click **Products**.');
    await expect(a.getByRole('link', { name: AURA.title, exact: true })).toBeVisible();
    await expect(a.getByRole('link', { name: RENAMED_AURA, exact: true })).toHaveCount(0);
    g.expect(`The list still shows **${AURA.title}** with its old name: nothing was saved.`);

    /* ================================================================ delete a banner */
    g.part('10.7 Delete a banner', `The hidden banner **${HIDDEN_BANNER.name}** (added switched off in section 5) is no longer needed.`);
    await g.click(menuLink(a, 'Home banners'), 'In the left menu, click **Home banners**.');
    await expect(a).toHaveURL(/\/admin\/banners$/);
    await expect(a.getByRole('heading', { level: 1, name: 'Home banners' })).toBeVisible();
    const cards = a.getByTestId('banner-card');
    const card = cards.filter({ has: a.locator(`p[title="${HIDDEN_BANNER.name}"]`) });
    await expect(cards.first()).toBeVisible();
    if ((await card.count()) === 0) {
      g.note(`**${HIDDEN_BANNER.name}** is not in the list: it was already deleted in an earlier try of this section.`);
    } else {
      await expect(card).toHaveCount(1);
      await expect(card).toContainText('Hidden');
      const before = await cards.count();
      const shownBefore = await cards.filter({ hasText: 'Shown on the store' }).count();
      await g.click(
        card.getByRole('button', { name: `Delete “${HIDDEN_BANNER.name}”` }),
        `On the **${HIDDEN_BANNER.name}** line, click the **bin** icon on the right.`,
      );
      const dlg = a.getByTestId('confirm-dialog');
      await expect(dlg.getByRole('heading', { name: `Delete “${HIDDEN_BANNER.name}”?` })).toBeVisible();
      await expect(dlg).toContainText('The slide is removed from the home page');
      await expect(dlg).toContainText('Its uploaded photos are deleted if not used elsewhere');
      await expect(dlg).toContainText("This can't be undone.");
      await expect(dlg.getByRole('button', { name: 'Cancel' })).toBeVisible();
      g.expect(
        `A box asks **Delete “${HIDDEN_BANNER.name}”?** and lists what happens: the slide is removed from the home page and its uploaded photos are deleted if not used elsewhere. It warns **This can't be undone.** and offers **Cancel** and **Delete permanently**.`,
      );
      await g.shot(a, `Confirm deleting the banner "${HIDDEN_BANNER.name}"`, { highlight: dlg });
      await g.click(dlg.getByRole('button', { name: 'Delete permanently' }), 'Click **Delete permanently**.');
      await expect(dlg).toBeHidden({ timeout: 30_000 });
      await expect(card).toHaveCount(0);
      await expect(cards).toHaveCount(before - 1);
      await expect(a.getByText(`${plural(before - 1, 'banner')} · ${shownBefore} shown on the store`)).toBeVisible();
      g.expect(
        `The box closes and **${HIDDEN_BANNER.name}** is gone from the list, which now says **${plural(before - 1, 'banner')} · ${shownBefore} shown on the store**.`,
      );
      g.note('Shoppers see no difference: this banner was switched off, so it was never on the store.');
    }

    /* ================================================================ remove a menu link */
    g.part('10.8 Remove a link from Popular searches', `The **${REMOVED_LINK.label}** link is taken out of the Popular searches group at the bottom of the footer.`);
    await g.click(menuLink(a, 'Menus'), 'In the left menu, click **Menus**.');
    await expect(a).toHaveURL(/\/admin\/menus/);
    await g.click(a.getByRole('tab', { name: POPULAR_TAB, exact: true }), `Click the tab **${POPULAR_TAB}**.`);
    await expect(a).toHaveURL(/tab=popular/);
    await expect(a.getByRole('tab', { name: POPULAR_TAB, exact: true })).toHaveAttribute('aria-selected', 'true');
    const group = topItems(a).and(a.locator(`[data-label="${POPULAR_GROUP}"]`));
    await expect(group).toHaveCount(1);
    const expand = group.locator(':scope > div > button[aria-expanded]');
    if ((await expand.getAttribute('aria-expanded')) !== 'true') await g.click(expand, `Click **${POPULAR_GROUP}** to open the group.`);
    else g.step(`The **${POPULAR_GROUP}** group is already open.`);
    await expect(expand).toHaveAttribute('aria-expanded', 'true');
    const links = childItems(group);
    const target = links.and(a.locator(`[data-label="${REMOVED_LINK.label}"]`));
    if ((await target.count()) === 0) {
      g.note(`**${REMOVED_LINK.label}** is not in the group: it was already removed in an earlier try of this section.`);
    } else {
      const before = await labelsOf(links);
      const after = before.filter((l) => l !== REMOVED_LINK.label);
      g.expect(`The group opens and lists its links: ${before.map((l) => `**${l}**`).join(', ')}.`);
      await g.click(
        target.getByRole('button', { name: `Remove “${REMOVED_LINK.label}”` }).first(),
        `On the **${REMOVED_LINK.label}** line, click the **bin** icon on the right.`,
      );
      const dlg = a.getByTestId('confirm-dialog');
      await expect(dlg.getByRole('heading', { name: `Remove “${REMOVED_LINK.label}”?` })).toBeVisible();
      await expect(dlg).toContainText('Removed when you save.');
      g.expect(`A box asks **Remove “${REMOVED_LINK.label}”?** and says **Removed when you save.**`);
      await g.click(dlg.getByRole('button', { name: 'Remove', exact: true }), 'Click **Remove**.');
      await expect(dlg).toBeHidden();
      await expect.poll(() => labelsOf(links)).toEqual(after);
      await expect(saveBar(a)).toContainText('Unsaved changes');
      g.expect(`**${REMOVED_LINK.label}** disappears from the group and the bottom bar says **Unsaved changes**: nothing is changed on the store until you save.`);
      await g.click(saveBar(a).getByRole('button', { name: 'Save menu' }), 'Click **Save menu** in the bar at the bottom.');
      await expect(savedNotice(a)).toBeVisible({ timeout: 30_000 });
      await expect(saveBar(a)).toContainText('All changes saved');
      await expect(group).toContainText(plural(after.length, 'link'));
      g.expect(`**${SAVED}** appears, the bottom bar says **All changes saved**, and the group now shows **${plural(after.length, 'link')}** under its name.`);
    }

    g.step(`In the **shopper** window, open the home page **${ctx.baseURL.replace(/\/+$/, '')}/** and scroll down to the very bottom.`);
    const seo = s.locator('footer + div section').filter({ hasText: POPULAR_GROUP });
    await expect(async () => {
      await gotoPage(s, '/');
      await expect(seo.getByRole('link')).toHaveCount(KEPT_LINKS.length, { timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    // F06-1 of the previous run is fixed: the commas sit between the links, not at the start of the next one.
    for (const l of KEPT_LINKS) await expect(seo.getByRole('link', { name: l.label, exact: true })).toBeVisible();
    await expect(seo.getByRole('list')).toHaveText(KEPT_LINKS.map((l) => l.label).join(', '));
    await expect(seo.getByRole('link', { name: new RegExp(escapeRe(REMOVED_LINK.label), 'i') })).toHaveCount(0);
    await seo.scrollIntoViewIfNeeded();
    await s.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    g.expect(`**${POPULAR_GROUP}** now reads only “${KEPT_LINKS.map((l) => l.label).join(', ')}”; **${REMOVED_LINK.label}** is gone.`);
    await g.shot(s, `Store footer: Popular searches without "${REMOVED_LINK.label}"`, { highlight: seo });

    /* ================================================================ password */
    g.part(
      '10.9 Change the admin password (and change it back)',
      'The password is changed to a temporary one, checked by signing out and in, and then changed back, so the sign-in details at the start of this guide keep working.',
    );
    g.table(
      ['What', 'Password'],
      [
        ['Your password now (the one used since section 1)', creds.password],
        ['Temporary password used in this test', TEMP_ADMIN_PASSWORD],
      ],
    );
    g.data('Temporary admin password (section 10, changed back afterwards)', TEMP_ADMIN_PASSWORD);
    g.data('Admin password at the end of the walkthrough', creds.password);
    const canChangeBack = creds.password.length >= PASSWORD_MIN && creds.password !== TEMP_ADMIN_PASSWORD;
    if (!canChangeBack) {
      g.finding(
        'issue',
        'The admin password could not be tested: it is shorter than the Change password form allows',
        `The first sign-in accepts an ADMIN_PASSWORD of 8 characters or more, but **Change password** refuses new passwords shorter than ${PASSWORD_MIN} characters. This shop's password (${creds.password.length} characters) could not be set again after a test change, so the password change was skipped. Suggestion: require the same minimum in both places.`,
      );
    } else {
      let onTemporary = false;
      try {
        g.note('Changing the password signs out every other phone or computer that is signed in to the admin. This window stays signed in.');
        // set first: if anything fails after the form was sent, the safety net below puts the original back
        onTemporary = true;
        await changePassword(g, a, creds.email, creds.password, TEMP_ADMIN_PASSWORD, 'Change password: from the current to the temporary password');

        await signOut(g, a);
        g.expect('The sign-in page (**Admin Panel**) opens.');
        await signIn(g, a, creds.email, creds.password, 'First try the **old** password:');
        await expect(a.getByText('Invalid email or password')).toBeVisible({ timeout: 30_000 });
        await expect(a).toHaveURL(/\/admin\/login/);
        g.expect('You stay on the sign-in page with the message **Invalid email or password**: the old password no longer works.');
        await signIn(g, a, creds.email, TEMP_ADMIN_PASSWORD, 'Now sign in with the **temporary** password:');
        await expectDashboard(a);
        g.expect('The **Dashboard** opens: the temporary password works.');

        g.text('Now put the original password back.');
        await changePassword(g, a, creds.email, TEMP_ADMIN_PASSWORD, creds.password);
        onTemporary = false;

        await signOut(g, a);
        await signIn(g, a, creds.email, creds.password, 'Sign in with the **original** password again:');
        await expectDashboard(a);
        g.expect(`The **Dashboard** opens: the password is **${creds.password}** again, as written at the start of this guide.`);
      } finally {
        if (onTemporary) await restoreOriginalPassword(a, creds).catch((e) => console.error('10-admin-ops: could not restore the admin password:', e));
      }
    }

    /* ================================================================ finish */
    g.part('10.10 Sign out', 'When you are done, sign out, especially on a shared computer.');
    await signOut(g, a);
    await expect(a.getByLabel('Email address')).toHaveValue('');
    await expect(a.getByText('Sign in to manage your store')).toBeVisible();
    g.expect('The sign-in page opens, with **Admin Panel** and “Sign in to manage your store”. To work in the admin again, sign in with your email and password.');
    await g.shot(a, 'Signed out: the admin sign-in page', { highlight: a.getByRole('button', { name: 'Sign in to Dashboard' }) });
  },
};

export default section;
