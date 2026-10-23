import { expect, type Locator, type Page } from '@playwright/test';
import type { Section } from '../context';
import { COLLECTIONS, MENUS, STORE } from '../data';
import { gotoPage, type FieldRow, type Guide } from '../guide';

/**
 * 6. Menus — the Main menu (with Living Room / Bedroom dropdowns), the built-in Contact us page in Footer “Customer
 * Support” and the footer "Popular searches" group are built with the link picker; all are then checked on the store
 * as a shopper. The other footer links go to pages created in section 7, which adds them by picking the pages by name
 * (after Contact us).
 */

/** Group title of the Popular searches footer menu (data.ts has only its links). */
const POPULAR_GROUP = 'Popular searches';
const SAVED = 'Saved. The store is updated.';
const DOT = '·'; // "Collection · Sofas"

const TAB = {
  main: 'Main menu',
  about: 'Footer “About”',
  support: 'Footer “Customer Support”',
  popular: 'Footer “Popular searches”',
};
const HINT = {
  main: 'The menu at the top of every page. Items with links inside open a dropdown.',
  about: 'Shown in the website footer under the “About” heading.',
  support: 'Shown in the website footer under the “Customer Support” heading.',
  popular: 'Shown at the bottom of the website footer as groups of links.',
};

type LinkSpec = { label: string; link: string };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Footer column headings on the store: the names of the two tabs in Menus (the CSS shows them in capitals). */
const FOOTER_HEADING = { about: 'About', support: 'Customer Support' };
const CONTACT = MENUS.footerContact;

/** Store address a menu link points to: a collection (by its data.ts title), the Blog shortcut or the Contact us page. */
function hrefFor(link: string): string {
  if (link === 'Blog') return '/blogs/news';
  if (link === CONTACT.link) return CONTACT.href;
  const c = COLLECTIONS.find((x) => x.title === link);
  if (!c) throw new Error(`06-menus: no collection "${link}" in data.ts`);
  return `/collections/${c.handle}`;
}

/** What the link box shows once the link is picked ("Collection · Sofas", "Shortcut · Blog", "Page · Contact us (Built-in)"). */
const pickedText = (link: string) =>
  link === CONTACT.link ? `Page ${DOT} ${link} (Built-in)` : `${link === 'Blog' ? 'Shortcut' : 'Collection'} ${DOT} ${link}`;
const pickerGroup = (link: string) => (link === 'Blog' ? 'Shortcuts' : link === CONTACT.link ? 'Pages' : 'Collections');

/* ------------------------------------------------------------------ menu editor locators */

const topItems = (page: Page) => page.locator('[aria-label="Menu items"] > [data-testid="sortable-item"] > [data-testid="menu-item"]');
/** Direct children of an item (the first "Links inside" list in it is its own). */
const childItems = (item: Locator) =>
  item.locator('[aria-label="Links inside"]').first().locator(':scope > [data-testid="sortable-item"] > [data-testid="menu-item"]');
const labelsOf = (items: Locator) => items.evaluateAll((els) => els.map((e) => e.getAttribute('data-label') ?? ''));
/** The item's own fields come before the items inside it, so .first() is always its own. */
const labelInput = (item: Locator) => item.getByLabel('Label', { exact: true }).first();
const linkValue = (item: Locator) => item.getByTestId('link-picker-value').first();
const saveBar = (page: Page) => page.getByTestId('save-bar');
/** The open "Choose a link" box (its test-id wrapper has no size of its own: the panel inside is fixed). */
const linkPopover = (page: Page) => page.getByTestId('link-picker-popover').last().getByRole('dialog', { name: 'Choose a link' });

/** Open the item's link box, search, and click the result whose name is exactly `result`. */
async function pickLink(page: Page, item: Locator, search: string, result: string) {
  await item.getByRole('button', { name: 'Choose link' }).first().click();
  const pop = linkPopover(page);
  await expect(pop).toBeVisible();
  await pop.getByRole('searchbox').fill(search);
  await pop.getByTestId('link-result').filter({ has: page.getByText(result, { exact: true }) }).first().click();
  await expect(pop).toBeHidden();
}

/**
 * Fill a new menu item: pick the link first (an empty Label then fills in with the collection's name), and type
 * the label only when it differs from that name.
 */
async function fillItem(g: Guide, page: Page, item: Locator, spec: LinkSpec, opts: { explainAutoLabel?: boolean } = {}) {
  const auto = spec.label === spec.link;
  const rows: FieldRow[] = [
    {
      label: 'Link',
      kind: 'click',
      value: `click **Choose link**, type \`${spec.link}\` in the search box and click **${spec.link}** (under _${pickerGroup(spec.link)}_)`,
      act: () => pickLink(page, item, spec.link, spec.link),
    },
    auto
      ? { label: 'Label', kind: 'none', value: `\`${spec.label}\`, filled in by itself when you pick the link` }
      : { label: 'Label', kind: 'fill', value: spec.label, locator: labelInput(item) },
  ];
  await g.form(
    rows,
    auto ? 'Fill in the new item:' : 'Fill in the new item (the **Label** first fills in with the collection name; replace it with the text below):',
  );
  await expect(labelInput(item)).toHaveValue(spec.label);
  await expect(linkValue(item)).toHaveText(pickedText(spec.link));
  if (opts.explainAutoLabel) {
    g.expect(`The **Label** box fills in by itself with **${spec.label}**, and the link box shows **${pickedText(spec.link)}**.`);
  } else if (!auto) {
    g.expect(`The label reads **${spec.label}** and the link box still shows **${pickedText(spec.link)}**.`);
  } else if (spec.link === 'Blog') {
    g.expect(`The link box shows **${pickedText(spec.link)}**: it opens the list of all blog posts.`);
  }
}

/** Scroll the window so an item taller than the screen starts at the top (its name visible) / ends just above the save bar. */
const scrollToStartOf = (el: Locator) =>
  el.evaluate((e) => window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - 16, behavior: 'instant' }));
const scrollToEndOf = (el: Locator) =>
  el.evaluate((e) => window.scrollTo({ top: e.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 90, behavior: 'instant' }));

/** Open a collapsed item by clicking its name (retried: a click before the page is interactive does nothing). */
async function expand(item: Locator) {
  const toggle = item.locator(':scope > div > button[aria-expanded]');
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

async function saveMenu(g: Guide, page: Page) {
  await g.click(saveBar(page).getByRole('button', { name: 'Save menu' }), 'Click **Save menu** in the bar at the bottom of the screen.');
  await expect(page.getByText(SAVED)).toBeVisible();
  await expect(saveBar(page)).toContainText('All changes saved');
  g.expect(`A green message says **${SAVED}** and the bottom bar says **All changes saved**.`);
}

async function openTab(g: Guide, page: Page, key: keyof typeof TAB) {
  await g.click(page.getByRole('tab', { name: TAB[key], exact: true }), `Click the tab **${TAB[key]}**.`);
  await expect(page).toHaveURL(new RegExp(`tab=${key}`));
  await expect(page.getByText(HINT[key], { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: TAB[key], exact: true })).toHaveAttribute('aria-selected', 'true');
}

/** Only on a re-run: removes what an earlier try of this section saved, so the menu is not built twice. */
async function clearIfNotEmpty(g: Guide, page: Page) {
  const n = await topItems(page).count();
  if (n === 0) return;
  g.step(
    `This menu already has ${n} item${n === 1 ? '' : 's'} from an earlier try. Remove ${n === 1 ? 'it' : 'them'} first: click the **bin** icon on the right of each item, confirm with **Remove**, then click **Save menu**.`,
  );
  for (let left = n; left > 0; left--) {
    await topItems(page).first().getByRole('button', { name: /^Remove/ }).first().click();
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(topItems(page)).toHaveCount(left - 1);
  }
  await saveBar(page).getByRole('button', { name: 'Save menu' }).click();
  await expect(page.getByText(SAVED)).toBeVisible();
}

/* ------------------------------------------------------------------ section */

const section: Section = {
  id: '06',
  title: '6. Menus',
  intro:
    'Build the menu at the top of the store (with drop-downs for Living Room and Bedroom), put the built-in **Contact us** page in the footer, and add the “Popular searches” links at the bottom of the footer, then check them on the store as a shopper. The other footer links go to the shop’s own pages (About Us, Shipping & Delivery…) and are added in section 7, right after those pages are created.',
  async run({ guide: g, admin, shopper, baseURL }) {
    /* ---------------------------------------------------------------- Main menu */
    g.part(
      '6.1 Main menu',
      'The main menu is the row of links under the logo. Each top item can have links inside it, which open as a drop-down when a shopper points at it. This is the menu we build:',
    );
    g.table(
      ['Top menu item', 'Goes to', 'Links inside the drop-down'],
      MENUS.main.map((m) => [m.label, m.link === 'Blog' ? 'The blog (all posts)' : `Collection ${m.link}`, m.children.length ? m.children.join(', ') : '—']),
    );

    await gotoPage(admin, '/admin');
    await g.click(admin.getByRole('complementary').getByRole('link', { name: 'Menus', exact: true }), 'In the left menu, click **Menus**.');
    await expect(admin).toHaveURL(/\/admin\/menus/);
    await expect(admin.getByRole('heading', { level: 1, name: 'Menus' })).toBeVisible();
    await expect(admin.getByRole('tab', { name: TAB.main, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(admin.getByText(HINT.main, { exact: true })).toBeVisible();
    for (const t of Object.values(TAB)) await expect(admin.getByRole('tab', { name: t, exact: true })).toBeVisible();
    g.expect(
      `The **Menus** screen opens on the **${TAB.main}** tab. There are four tabs: ${Object.values(TAB).map((t) => `**${t}**`).join(', ')}.`,
    );
    await clearIfNotEmpty(g, admin);

    const addTop = admin.getByRole('button', { name: '+ Add top menu item' });
    const start = await topItems(admin).count();
    for (const [i, top] of MENUS.main.entries()) {
      await g.click(addTop, `Click **+ Add top menu item** (below the list). A new empty item opens.`);
      const item = topItems(admin).nth(start + i);
      await expect(item).toBeVisible();
      await expect(labelInput(item)).toBeVisible();
      await fillItem(g, admin, item, top, { explainAutoLabel: i === 0 });

      for (const [ci, child] of top.children.entries()) {
        await g.click(
          item.getByRole('button', { name: '+ Add link inside' }).last(),
          `Click **+ Add link inside** at the bottom of the **${top.label}** box.`,
        );
        const c = childItems(item).nth(ci);
        await expect(c).toBeVisible();
        await fillItem(g, admin, c, { label: child, link: child });
      }

      if (top.children.length) {
        await expect.poll(() => labelsOf(childItems(item))).toEqual(top.children);
        g.expect(`**${top.children.join('** and **')}** are listed inside the **${top.label}** box.`);
      }
      if (i === 0) {
        // the "new column" box only exists for a heading-with-links that is not the first one in its drop-down
        await expect(item.getByText('Start a new column in the dropdown')).toHaveCount(0);
        g.note(
          'Each link inside becomes a line of the drop-down. A link inside can have links of its own; it then becomes a column heading, and from the second heading on a box **Start a new column in the dropdown** appears (untick it to stack that group under the previous one). Our drop-downs are simple lists, so that box does not appear here.',
        );
        // the open item is taller than the window: show it from its name down (the reloaded view below shows all of it)
        await scrollToStartOf(item);
        await g.shot(admin, 'Living Room filled in, with Sofas and Coffee Tables inside (not saved yet)');
      }
    }

    await expect.poll(() => labelsOf(topItems(admin))).toEqual(MENUS.main.map((m) => m.label));
    await expect(saveBar(admin)).toContainText('Unsaved changes');
    await saveMenu(g, admin);
    await expect(topItems(admin).first()).toContainText(pickedText(MENUS.main[0].link));
    await admin.evaluate(() => window.scrollTo(0, 0));
    await g.shot(admin, 'Main menu saved: five top menu items', { highlight: admin.getByText(SAVED) });

    g.step('Reload the page (press **F5**) to check that the menu was stored.');
    await gotoPage(admin, '/admin/menus?tab=main');
    await expect.poll(() => labelsOf(topItems(admin))).toEqual(MENUS.main.map((m) => m.label));
    g.expect(`The menu still lists, in this order: ${MENUS.main.map((m) => `**${m.label}**`).join(', ')}.`);
    const living = topItems(admin).nth(0);
    g.step(`Click **${MENUS.main[0].label}** to open it.`);
    await expand(living);
    await expect.poll(() => labelsOf(childItems(living))).toEqual(MENUS.main[0].children);
    for (const [k, child] of MENUS.main[0].children.entries()) await expect(childItems(living).nth(k)).toContainText(pickedText(child));
    g.expect(`Inside it are **${MENUS.main[0].children.join('** and **')}**, each showing the collection it links to (_${pickedText(MENUS.main[0].children[0])}_…).`);
    await g.shot(admin, 'After reloading: Living Room opened, Sofas and Coffee Tables inside', { highlight: living });

    /* ---------------------------------------------------------------- Footer About / Customer Support */
    g.part(
      '6.2 Footer “About” and “Customer Support”',
      'These two footer menus link to pages. Every shop has a built-in **Contact us** page with a contact form, so it goes into Footer “Customer Support” now. The shop’s own pages (About Us, Terms & Conditions, Shipping & Delivery, Returns & Exchanges, Privacy Policy) are created in section 7, which adds their links; the link box only offers pages that already exist, so here we only check that they are not there yet.',
    );
    await openTab(g, admin, 'about');
    g.expect(`The grey line under the tabs says: _${HINT.about}_`);

    await g.click(admin.getByRole('button', { name: '+ Add link', exact: true }), 'Click **+ Add link**.');
    const aboutItem = topItems(admin).last();
    await expect(labelInput(aboutItem)).toBeVisible();
    await g.click(aboutItem.getByRole('button', { name: 'Choose link' }).first(), 'Click **Choose link**.');
    const pop = linkPopover(admin);
    await expect(pop).toBeVisible();
    g.step('Type `About` in the search box.');
    await pop.getByRole('searchbox').fill('About');
    const nothing = pop.getByText('Nothing found. Try another word.');
    const aboutPage = pop.getByTestId('link-result').filter({ has: admin.getByText('About Us', { exact: true }) });
    await expect(nothing.or(aboutPage).first()).toBeVisible();
    await expect(pop.getByRole('tab', { name: 'Custom web address' })).toBeVisible();
    if (await nothing.isVisible()) {
      g.expect(
        'The box says **Nothing found. Try another word.**: the About Us page does not exist yet, so there is nothing to link to. (The box also has a **Custom web address** tab for typing an address by hand; we do not use it for the pages, see the note below.)',
      );
      await g.shot(admin, 'Footer “About”: no pages to link to yet', { highlight: pop });
    } else {
      g.note('The **About Us** page is already listed: this section was run again after section 7 created the pages.');
    }
    await g.click(pop.getByRole('button', { name: 'Close', exact: true }), 'Close the box with the **×** in its top right corner.');
    await expect(pop).toBeHidden();
    await g.click(saveBar(admin).getByRole('button', { name: 'Undo all changes' }), 'Click **Undo all changes** in the bar at the bottom to remove the empty link again.');
    await expect(saveBar(admin)).toContainText('All changes saved');
    await expect(saveBar(admin).getByRole('button', { name: 'Save menu' })).toBeDisabled();
    await expect(admin.getByText('This menu is empty.', { exact: true })).toBeVisible();
    g.expect('The empty link is gone (_This menu is empty._) and the bottom bar says **All changes saved**: nothing was changed.');

    await openTab(g, admin, 'support');
    g.expect(`The grey line under the tabs says: _${HINT.support}_`);
    const supportLabels = await labelsOf(topItems(admin));
    if (supportLabels.includes(CONTACT.label)) {
      await expect(topItems(admin).filter({ hasText: pickedText(CONTACT.link) }).first()).toBeVisible();
      g.note(`**${CONTACT.label}** is already in this menu from an earlier try of this section, so it is not added again.`);
    } else {
      await g.click(admin.getByRole('button', { name: '+ Add link', exact: true }), 'Click **+ Add link**. A new empty item opens.');
      const contactItem = topItems(admin).nth(supportLabels.length);
      await expect(labelInput(contactItem)).toBeVisible();
      await g.click(contactItem.getByRole('button', { name: 'Choose link' }).first(), 'Click **Choose link**.');
      const cpop = linkPopover(admin);
      await expect(cpop).toBeVisible();
      g.step('Type `Contact` in the search box.');
      await cpop.getByRole('searchbox').fill('Contact');
      const contactResult = cpop.getByTestId('link-result').filter({ has: admin.getByText(CONTACT.link, { exact: true }) });
      await expect(contactResult).toHaveCount(1);
      await expect(contactResult).toContainText('Built-in');
      await expect(cpop.getByText('Pages', { exact: true })).toBeVisible();
      g.expect(
        `Under **Pages** the box lists **${CONTACT.link}**, marked **Built-in**: the page comes with the website. It has a contact form (what customers send arrives in **Messages**) and shows the phone, email and address from **Settings**. It is not listed under **Pages** in the left menu, and there is nothing to write for it.`,
      );
      // outline the whole box: an outline around the result row would cover the small "Pages" title above it
      await g.shot(admin, 'Footer “Customer Support”: the built-in Contact us page in the link box', { highlight: cpop });
      await g.click(contactResult, `Click **${CONTACT.link}**.`);
      await expect(cpop).toBeHidden();
      await expect(labelInput(contactItem)).toHaveValue(CONTACT.label);
      await expect(linkValue(contactItem)).toHaveText(pickedText(CONTACT.link));
      g.expect(`The **Label** box fills in by itself with **${CONTACT.label}**, and the link box shows **${pickedText(CONTACT.link)}**.`);
      await saveMenu(g, admin);
    }
    g.step('Reload the page (press **F5**) to check that the link was stored.');
    await gotoPage(admin, '/admin/menus?tab=support');
    await expect.poll(() => labelsOf(topItems(admin))).toContain(CONTACT.label);
    await expect(topItems(admin).first()).toHaveAttribute('data-label', CONTACT.label);
    await expect(topItems(admin).first()).toContainText(pickedText(CONTACT.link));
    g.expect(`The tab lists **${CONTACT.label}** with _${pickedText(CONTACT.link)}_ under its name.`);
    await g.shot(admin, 'Footer “Customer Support” with Contact us, after reloading', {
      highlight: admin.getByRole('list', { name: 'Menu items' }),
    });
    g.note(
      `Section 7 comes back to these two tabs after creating the pages and picks them by name: **${MENUS.footerAbout.map((m) => m.label).join('** and **')}** under ${TAB.about}; **${MENUS.footerSupport.map((m) => m.label).join('**, **')}** under ${TAB.support}, after **${CONTACT.label}**. Pick pages by name instead of typing their web address in **Custom web address**: a page’s address is only fixed when the page is saved (a page called “Shipping & Delivery” gets the address \`shipping-and-delivery\`, for example), and a typed address that does not match stays a broken link.`,
    );

    /* ---------------------------------------------------------------- Popular searches */
    g.part(
      '6.3 Footer “Popular searches”',
      'Popular searches is a row of links at the very bottom of every page, in groups. Each group has a title (plain text) and its links.',
    );
    await openTab(g, admin, 'popular');
    g.expect(`The grey line under the tabs says: _${HINT.popular}_`);
    await clearIfNotEmpty(g, admin);

    const popStart = await topItems(admin).count();
    await g.click(admin.getByRole('button', { name: '+ Add group', exact: true }), 'Click **+ Add group**.');
    const group = topItems(admin).nth(popStart);
    await expect(labelInput(group)).toBeVisible();
    await g.form([{ label: 'Label (group title)', value: POPULAR_GROUP, locator: labelInput(group) }], 'Fill in the group:');
    await expect(group.getByText('Group titles are shown as plain text, without a link.')).toBeVisible();
    g.expect('Next to the label it says _Group titles are shown as plain text, without a link._');

    for (const [i, link] of MENUS.popular.entries()) {
      await g.click(
        group.getByRole('button', { name: '+ Add link inside' }).last(),
        `Click **+ Add link inside** at the bottom of the **${POPULAR_GROUP}** box.`,
      );
      const c = childItems(group).nth(i);
      await expect(c).toBeVisible();
      await fillItem(g, admin, c, link);
    }
    await expect.poll(() => labelsOf(childItems(group))).toEqual(MENUS.popular.map((p) => p.label));
    g.expect(`The group holds **${MENUS.popular.map((p) => p.label).join('**, **')}**.`);
    const custom = childItems(group).nth(MENUS.popular.findIndex((p) => p.label !== p.link));
    await scrollToEndOf(group);
    await g.shot(admin, 'Popular searches: “Office chairs” with its own label, not saved yet', { highlight: custom });

    await saveMenu(g, admin);
    await expect(topItems(admin).nth(popStart)).toContainText(`${MENUS.popular.length} links`);
    g.expect(`The group now shows **${POPULAR_GROUP}** with **${MENUS.popular.length} links** under its name.`);

    g.step('Reload the page (press **F5**).');
    await gotoPage(admin, '/admin/menus?tab=popular');
    await expect.poll(() => labelsOf(topItems(admin))).toEqual([POPULAR_GROUP]);
    g.step(`Click **${POPULAR_GROUP}** to open it.`);
    const savedGroup = topItems(admin).first();
    await expand(savedGroup);
    await expect.poll(() => labelsOf(childItems(savedGroup))).toEqual(MENUS.popular.map((p) => p.label));
    for (const [k, p] of MENUS.popular.entries()) await expect(childItems(savedGroup).nth(k)).toContainText(pickedText(p.link));
    g.expect(
      `The **${POPULAR_GROUP}** group is still there with its ${MENUS.popular.length} links: ${MENUS.popular.map((p) => `**${p.label}** (_${pickedText(p.link)}_)`).join(', ')}.`,
    );
    await g.shot(admin, 'After reloading: the Popular searches group and its three links', { highlight: savedGroup });

    /* ---------------------------------------------------------------- the store */
    g.part('6.4 Check the menus on the store', 'Now look at the store as a shopper.');
    await g.goto(shopper, '/', `In a browser window where you are **not** signed in (for example a private window), open the store home page **${baseURL}/**.`);
    const nav = shopper.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toBeVisible();
    await expect(nav.locator(':scope > ul > li > :first-child')).toHaveText(MENUS.main.map((m) => m.label));
    for (const m of MENUS.main) {
      const a = nav.getByRole('link', { name: m.label, exact: true });
      await expect(a).toHaveAttribute('href', hrefFor(m.link));
      await expect(a.locator('svg')).toHaveCount(m.children.length ? 1 : 0);
    }
    g.expect(
      `Under the logo the menu shows ${MENUS.main.map((m) => `**${m.label}**`).join(', ')}, in this order. ${MENUS.main
        .filter((m) => m.children.length)
        .map((m) => `**${m.label}**`)
        .join(' and ')} have a small arrow because they open a drop-down.`,
    );

    const first = nav.getByRole('link', { name: MENUS.main[0].label, exact: true });
    await shopper.mouse.move(1, 1); // away from the menu: a hovered item changes colour
    for (const m of MENUS.main) {
      const a = nav.getByRole('link', { name: m.label, exact: true });
      await expect(a).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      await expect(a).toHaveCSS('color', 'rgb(0, 0, 0)');
    }
    g.expect(`All ${MENUS.main.length} items look the same, black letters on white: the first item (**${MENUS.main[0].label}**) is not highlighted.`);
    await g.shot(shopper, 'Store header with the new main menu', { highlight: nav });

    g.step(`Point the mouse at **${MENUS.main[0].label}** in the menu (do not click).`);
    await first.hover();
    const firstLi = nav.locator(':scope > ul > li').filter({ has: shopper.getByRole('link', { name: MENUS.main[0].label, exact: true }) });
    const panel = firstLi.locator(':scope > div');
    for (const child of MENUS.main[0].children) {
      const a = panel.getByRole('link', { name: child, exact: true });
      await expect(a).toBeVisible();
      await expect(a).toHaveAttribute('href', hrefFor(child));
    }
    await expect(panel.getByRole('link')).toHaveText(MENUS.main[0].children);
    g.expect(`A drop-down opens under the menu with **${MENUS.main[0].children.join('** and **')}**.`);
    await g.shot(shopper, `${MENUS.main[0].label} drop-down on the store`, { highlight: panel });

    const firstChild = MENUS.main[0].children[0];
    await g.click(panel.getByRole('link', { name: firstChild, exact: true }), `Click **${firstChild}** in the drop-down.`);
    await expect(shopper).toHaveURL(new RegExp(`${escapeRe(hrefFor(firstChild))}$`));
    await expect(shopper.getByRole('heading', { level: 1 })).toHaveText(firstChild);
    await expect(shopper.getByRole('navigation', { name: 'breadcrumbs' }).locator('[aria-current="page"]')).toHaveText(firstChild);
    g.expect(`The **${firstChild}** collection page opens: the small trail at the top ends in **${firstChild}** and the address ends in \`${hrefFor(firstChild)}\`.`);
    await g.shot(shopper, `${firstChild} collection page, opened from the drop-down`, { fullPage: true });

    g.step('Scroll down to the very bottom of the page.');
    const seo = shopper.locator('footer + div section').filter({ hasText: POPULAR_GROUP });
    await seo.scrollIntoViewIfNeeded();
    await shopper.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(seo).toBeVisible();
    // the commas sit between the links, not inside them: each link's text is exactly its label
    await expect(seo.getByRole('link')).toHaveText(MENUS.popular.map((p) => p.label));
    for (const p of MENUS.popular) {
      await expect(seo.getByRole('link', { name: p.label, exact: true })).toHaveAttribute('href', hrefFor(p.link));
    }
    const popularRow = seo.getByRole('list');
    await expect(seo.getByText(POPULAR_GROUP, { exact: true })).toBeVisible();
    await expect(popularRow).toHaveText(MENUS.popular.map((p) => p.label).join(', '));
    g.expect(
      `Below the cream footer there is a line **${POPULAR_GROUP}** followed by the links, separated by commas: **${MENUS.popular.map((p) => p.label).join(', ')}**. Only the names are links, not the commas.`,
    );

    const aboutNav = shopper.getByRole('navigation', { name: FOOTER_HEADING.about, exact: true });
    const supportNav = shopper.getByRole('navigation', { name: FOOTER_HEADING.support, exact: true });
    await expect(aboutNav.getByRole('heading')).toHaveText(FOOTER_HEADING.about);
    await expect(supportNav.getByRole('heading')).toHaveText(FOOTER_HEADING.support);
    const contactLink = supportNav.getByRole('link', { name: CONTACT.label, exact: true });
    await expect(contactLink).toHaveAttribute('href', CONTACT.href);
    await expect(supportNav.getByRole('link').first()).toHaveText(CONTACT.label);
    const aboutLinks = await aboutNav.getByRole('link').count();
    g.expect(
      `In the cream footer, the columns for the two page menus are headed **${FOOTER_HEADING.about.toUpperCase()}** and **${FOOTER_HEADING.support.toUpperCase()}**, the names of their tabs in **Menus**. ` +
        `**${CONTACT.label}** is listed under **${FOOTER_HEADING.support.toUpperCase()}**${aboutLinks ? '' : `; **${FOOTER_HEADING.about.toUpperCase()}** is still empty, its links are added in section 7`}.`,
    );
    // outline the Customer Support column as well (the shot outlines the Popular searches row)
    await supportNav.evaluate((el: HTMLElement) => {
      el.style.outline = '3px solid #e11d48';
      el.style.outlineOffset = '3px';
    });
    await g.shot(shopper, 'Footer: Contact us under Customer Support, Popular searches at the bottom of the page', { highlight: popularRow });
    await supportNav.evaluate((el: HTMLElement) => (el.style.outline = ''));

    const footerLink = MENUS.popular[1];
    await g.click(seo.getByRole('link', { name: footerLink.label, exact: true }), `In **${POPULAR_GROUP}**, click **${footerLink.label}**.`);
    await expect(shopper).toHaveURL(new RegExp(`${escapeRe(hrefFor(footerLink.link))}$`));
    await expect(shopper.getByRole('heading', { level: 1 })).toHaveText(footerLink.link);
    await expect(shopper.getByRole('navigation', { name: 'breadcrumbs' }).locator('[aria-current="page"]')).toHaveText(footerLink.link);
    g.expect(`The **${footerLink.link}** collection page opens (the trail at the top ends in **${footerLink.link}**, the address ends in \`${hrefFor(footerLink.link)}\`).`);

    g.step(`Scroll down to the footer again.`);
    const contactFooterLink = shopper.getByRole('navigation', { name: FOOTER_HEADING.support, exact: true }).getByRole('link', { name: CONTACT.label, exact: true });
    await contactFooterLink.scrollIntoViewIfNeeded();
    await g.click(contactFooterLink, `Under **${FOOTER_HEADING.support.toUpperCase()}**, click **${CONTACT.label}**.`);
    await expect(shopper).toHaveURL(new RegExp(`${escapeRe(CONTACT.href)}$`));
    await expect(shopper.getByRole('heading', { level: 1 })).toHaveText('Contact Us');
    const main = shopper.locator('main');
    for (const field of ['Name', 'Email', 'Phone number', 'Comment']) await expect(main.getByLabel(field, { exact: true })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Send Message' })).toBeVisible();
    await expect(main.getByRole('link', { name: STORE.email, exact: true })).toHaveAttribute('href', `mailto:${STORE.email}`);
    await expect(main.getByRole('link', { name: STORE.phone, exact: true })).toHaveAttribute('href', `tel:${STORE.phone.replace(/[^\d+]/g, '')}`);
    for (const line of STORE.address.split('\n')) await expect(main.getByText(line)).toBeVisible();
    g.expect(
      `The **Contact Us** page opens at \`${CONTACT.href}\`: a form with **Name**, **Email**, **Phone number**, **Comment** and a **SEND MESSAGE** button, and on the right the email **${STORE.email}**, the phone **${STORE.phone}** and the address, as entered in **Settings** (section 1).`,
    );
    await g.shot(shopper, 'The built-in Contact us page, opened from the footer');
    g.note('Section 8 sends a message with this form as a customer; section 10 finds it in **Messages**.');
  },
};

export default section;
