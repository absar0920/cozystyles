import { expect, type Locator, type Page } from '@playwright/test';
import type { Ctx, Section } from '../context';
import { chooseFiles, expectImagesLoaded, type Guide } from '../guide';
import { BLOG_POSTS, MENUS, PAGES } from '../data';

/**
 * Section 7: text pages (About Us + the four policies) and two blog posts, written in the admin's rich-text editor,
 * linked from the two footer menus (Footer “Customer Support” already starts with the built-in Contact us page from
 * section 6), then checked as a shopper sees them (pages, footer, blog, post, tag page).
 * Pages are found by title and their real web address is read from the admin ("View on store"); it must be the
 * address the Web address box showed before saving (the admin never changes it silently).
 */

/** Extra content for the About Us page (the other pages are one paragraph: PAGES[i].body). */
const ABOUT = {
  heading: 'Our story',
  subheading: 'Why customers choose us',
  bullets: [
    'Solid wood frames, kiln-dried and hand-joined',
    'Free delivery and installation in Lahore, Karachi and Islamabad',
    'Every order confirmed with you on WhatsApp',
  ],
  seoTitle: 'Our story: furniture made in Lahore',
  seoDescription: 'Cozy Furnitures designs and builds solid wood furniture for Pakistani homes in its own Lahore workshop.',
};

/** Blog post dates (BLOG_POSTS has none): the first post is the newer one, so it is listed first. */
const POST_DATES = [
  { iso: '2026-10-12', said: '12 October 2026', admin: '12 Oct 2026', card: 'October 12 2026', article: 'Oct 12, 2026' },
  { iso: '2026-10-05', said: '5 October 2026', admin: '5 Oct 2026', card: 'October 05 2026', article: 'Oct 05, 2026' },
];

const SAVED = 'Saved. The store is updated.';
/** Footer column headings on the store: the names of the two tabs in Menus (the CSS shows them in capitals). */
const FOOTER_HEADING = { about: 'About', support: 'Customer Support' };
const CONTACT = MENUS.footerContact;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactly = (s: string) => new RegExp(`^${escapeRe(s)}$`);

const sidebarLink = (page: Page, name: string) => page.getByRole('complementary').getByRole('link', { name, exact: true });
const saveBar = (page: Page) => page.getByTestId('save-bar');
const editor = (page: Page) => page.getByTestId('rich-text-editor').getByRole('textbox');
const toolbarButton = (page: Page, name: string) =>
  page.getByTestId('rich-text-editor').getByRole('toolbar', { name: 'Formatting' }).getByRole('button', { name, exact: true });
const visibleSwitch = (page: Page) => page.getByRole('switch', { name: 'Visible on the store' });
const viewOnStore = (page: Page) => page.getByRole('main').getByRole('link', { name: 'View on store', exact: true });
const advanced = (page: Page) => page.locator('summary').filter({ hasText: 'Advanced' });

/**
 * Screenshot of a whole admin form. A full-page capture of the admin draws the fixed sidebar and the bottom save bar
 * where the window happened to be scrolled (mid-form), so instead the window is made as tall as the form for the
 * shot (like a very tall screen) and then set back.
 */
async function formShot(g: Guide, page: Page, caption: string, opts: { highlight?: Locator } = {}) {
  const size = page.viewportSize() ?? { width: 1440, height: 900 };
  const height = () => page.evaluate(() => document.documentElement.scrollHeight);
  try {
    await page.setViewportSize({ width: size.width, height: Math.max(size.height, await height()) });
    const h = await height(); // the layout can grow once more after the resize
    if (h > (page.viewportSize()?.height ?? 0)) await page.setViewportSize({ width: size.width, height: h });
    await page.evaluate(() => window.scrollTo(0, 0));
    await g.shot(page, caption, opts);
  } finally {
    await page.setViewportSize(size);
  }
}

/** Opens the collapsible "Advanced" card (if closed) so the Web address field shows. */
async function openAdvanced(g: Guide, page: Page, md: string) {
  const details = page.locator('details').filter({ has: advanced(page) });
  if ((await details.getAttribute('open')) === null) await g.click(advanced(page), md);
  else g.step(md);
  await expect(page.locator('#web-address')).toBeVisible();
}

/**
 * The grey text in front of the Web address box ("cozystyle.pk/pages/"): the shop's own domain (NEXT_PUBLIC_SITE_URL,
 * set when the website is installed), never the old website's name cozyfurnitures.pk. Section 2 explains it and
 * records a finding if it differs from the address the store runs at; here it is only checked and shown.
 */
async function checkAddressPrefix(page: Page, baseURL: string, path: string): Promise<string> {
  const prefix = ((await page.locator('#web-address').locator('xpath=..').innerText()) || '').trim();
  expect(prefix, 'grey text in front of the Web address box').toMatch(new RegExp(`^[a-z0-9.-]+(:\\d+)?${escapeRe(path)}$`, 'i'));
  if (!/(^|\.)cozyfurnitures\.pk$/.test(new URL(baseURL).hostname)) expect(prefix).not.toContain('cozyfurnitures.pk');
  return prefix;
}

/** The address a person would guess from a title ("About Us" → about-us), as the admin shows it before saving. */
const guessAddress = (title: string) =>
  title
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Top-level rows of the menu being edited (footer menus have one level). */
const menuItems = (page: Page) => page.locator('[aria-label="Menu items"] > [data-testid="sortable-item"] > [data-testid="menu-item"]');
/** The row's clickable header: label + where it links ("Page · About Us", "Missing page … — pick another"). */
const menuItemHeader = (item: Locator) => item.locator(':scope > div > button[aria-expanded]');

/** The store address of the item being edited, read from its "View on store" link. */
async function storeAddress(page: Page, prefix: RegExp): Promise<string> {
  await expect(viewOnStore(page)).toHaveAttribute('href', prefix);
  return (await viewOnStore(page).getAttribute('href')) ?? '';
}

/** Opens the item's link picker, searches `search` and picks the page called `title`. */
async function pickPage(page: Page, item: Locator, search: string, title: string) {
  await item.getByRole('button', { name: 'Choose link' }).click();
  const pop = page.getByTestId('link-picker-popover').last();
  await pop.getByRole('searchbox').fill(search);
  await pop.getByTestId('link-result').filter({ hasText: exactly(title) }).first().click();
  await expect(pop).toBeHidden();
  await expect(item.getByTestId('link-picker-value')).toHaveText(`Page · ${title}`);
}

/**
 * Fills one footer menu tab with links to pages. Items already in the tab (e.g. added by section 6) are kept;
 * one whose link no longer finds its page (⚠ "Missing page … pick another") gets the page chosen again.
 */
async function fillFooterTab(g: Guide, page: Page, tabName: string, entries: { label: string; link: string }[]) {
  const tab = page.getByRole('tab', { name: tabName, exact: true });
  await g.click(tab, `Click the **${tabName}** tab.`);
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  const addLink = page.getByRole('button', { name: '+ Add link', exact: true });
  await expect(addLink).toBeVisible();

  const current = await menuItems(page).evaluateAll((els) =>
    els.map((el) => ({
      label: el.getAttribute('data-label') ?? '',
      text: (el.querySelector(':scope > div > button[aria-expanded]') as HTMLElement | null)?.innerText ?? '',
    })),
  );
  if (current.length) g.step(`Look at what the tab already has: ${current.map((h) => `**${h.label || 'New item'}**`).join(', ')}.`);
  else {
    await expect(page.getByText('This menu is empty.', { exact: true })).toBeVisible();
    g.step('The tab is still empty (_This menu is empty._).');
  }

  const pickRow = (e: { link: string }, item: Locator) => ({
    label: 'Link',
    value: `click **Choose link**, type \`${e.link}\` in the search box and click **${e.link}** under _Pages_`,
    kind: 'click' as const,
    act: () => pickPage(page, item, e.link, e.link),
  });
  /** the rows that must link to their page after saving (added or repaired here) */
  const linked: { item: Locator; link: string }[] = [];
  const kept: Locator[] = [];
  for (const e of entries) {
    const existing = current.find((h) => h.label === e.label || h.text.includes(`Page · ${e.link}`));
    if (existing) {
      const item = menuItems(page).and(page.locator(`[data-label="${existing.label.replace(/"/g, '\\"')}"]`)).first();
      if (!/pick another/i.test(existing.text)) {
        g.note(`**${existing.label}** is already in this menu, so it is not added again.`);
        kept.push(item);
        continue;
      }
      // its link points at a page address that does not exist: choose the real page
      await g.click(
        menuItemHeader(item),
        `**${existing.label}** is already in this menu, but its link shows ⚠ _Missing page … pick another_. Click **${existing.label}** to open it.`,
      );
      await g.form([pickRow(e, item)], 'Choose the page again:');
      linked.push({ item, link: e.link });
      continue;
    }
    const before = await menuItems(page).count();
    await g.click(addLink, 'Click **+ Add link**. A new item opens.');
    await expect(menuItems(page)).toHaveCount(before + 1);
    const item = menuItems(page).nth(before);
    await g.form([{ label: 'Label', value: e.label, locator: item.getByRole('textbox', { name: 'Label' }) }, pickRow(e, item)]);
    linked.push({ item, link: e.link });
  }

  if (linked.length) {
    await g.click(saveBar(page).getByRole('button', { name: 'Save menu' }), 'Click **Save menu** at the bottom of the screen.');
    await expect(page.getByText(SAVED)).toBeVisible();
  }
  for (const { item, link } of linked) await expect(menuItemHeader(item)).toContainText(`Page · ${link}`);
  for (const item of kept) await expect(item).toBeVisible();
  const labels = await menuItems(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-label') ?? ''));
  expect(labels).toEqual(expect.arrayContaining(entries.map((e) => e.label)));
  g.expect(
    `${linked.length ? `**${SAVED}** appears and the` : 'The'} tab lists ${entries.map((e) => `**${e.label}**`).join(', ')}` +
      (linked.length ? ', each new link showing _Page ·_ and the page name under its label.' : '.'),
  );
}

const section: Section = {
  id: '07',
  title: '7. Pages and blog posts',
  intro:
    'The About Us page, the four policy pages and two blog posts are written in the admin with the same text editor. ' +
    'The pages are then linked from the two footer menus (Footer “Customer Support” already has the built-in **Contact us** page from section 6), ' +
    'and everything is checked on the store as a customer sees it.',

  async run({ guide: g, admin: page, shopper, baseURL }: Ctx) {
    const [about, ...otherPages] = PAGES;
    /** page title → store address (/pages/…), read from the admin after saving */
    const pageAddress = new Map<string, string>();
    /** post title → store address (/blogs/news/…) */
    const postAddress = new Map<string, string>();

    /* ------------------------------------------------------------ About Us, in detail */
    g.part(
      'Create the About Us page',
      'Text pages are written in a simple editor: no code. The toolbar buttons make headings and lists. ' +
        'The first page is shown in detail; the other four are made the same way.',
    );
    await g.click(sidebarLink(page, 'Pages'), 'In the left menu, click **Pages**.');
    await expect(page.getByRole('heading', { level: 1, name: 'Pages' })).toBeVisible();
    await g.click(page.getByRole('link', { name: 'New page' }), 'Click **New page** (top right).');
    await expect(page.getByRole('heading', { level: 1, name: 'New page' })).toBeVisible();
    await expect(editor(page)).toBeVisible(); // the editor appears once the page is ready

    await g.form(
      [
        { label: 'Title', value: about.title, locator: page.locator('#page-title') },
        {
          label: 'Content: click into the white box, click the **Heading** button in the toolbar, then type',
          value: ABOUT.heading,
          kind: 'type',
          act: async () => {
            await editor(page).click();
            await toolbarButton(page, 'Heading').click();
            await page.keyboard.type(ABOUT.heading);
          },
        },
        {
          label: 'Content: press **Enter**, then type',
          value: about.body,
          kind: 'type',
          act: async () => {
            await page.keyboard.press('Enter');
            await page.keyboard.type(about.body);
          },
        },
        {
          label: 'Content: press **Enter**, click the **Subheading** button, then type',
          value: ABOUT.subheading,
          kind: 'type',
          act: async () => {
            await page.keyboard.press('Enter');
            await toolbarButton(page, 'Subheading').click();
            await page.keyboard.type(ABOUT.subheading);
          },
        },
        {
          label: 'Content: press **Enter**, click the **Bullet list** button, then type the three lines (press **Enter** after the first two)',
          value: ABOUT.bullets,
          kind: 'type',
          act: async () => {
            await page.keyboard.press('Enter');
            await toolbarButton(page, 'Bullet list').click();
            for (const [i, line] of ABOUT.bullets.entries()) {
              if (i > 0) await page.keyboard.press('Enter');
              await page.keyboard.type(line);
            }
          },
        },
        { label: 'SEO title (under _Search engine listing_)', value: ABOUT.seoTitle, locator: page.getByLabel('SEO title') },
        { label: 'SEO description', value: ABOUT.seoDescription, locator: page.getByLabel('SEO description') },
        {
          label: 'Visible on the store',
          value: '',
          kind: 'check',
          act: async () => {
            await expect(visibleSwitch(page)).toHaveAttribute('aria-checked', 'true'); // on by default
          },
        },
      ],
      'Fill in the page exactly as follows (the editor rows are done in this order, in the **Content** box):',
    );
    const box = editor(page);
    await expect(box.locator('h2')).toHaveText(ABOUT.heading);
    await expect(box.locator('h3')).toHaveText(ABOUT.subheading);
    await expect(box.locator('ul > li')).toHaveText(ABOUT.bullets);
    await expect(box).toContainText(about.body);
    g.expect('The editor shows a large heading, the paragraph, a smaller subheading and a list with three bullet points.');

    await openAdvanced(g, page, 'Scroll down and click **Advanced** to see the web address made from the title.');
    const webAddress = page.locator('#web-address');
    const guessed = guessAddress(about.title);
    await expect(webAddress).toHaveValue(guessed);
    const addressShownBefore = await webAddress.inputValue();
    const prefix = await checkAddressPrefix(page, baseURL, '/pages/');
    g.expect(
      `The **Web address** field shows **${addressShownBefore}**. In front of it the grey text shows the shop's own address followed by ` +
        `**/pages/**: \`${prefix}\` (the domain the website was installed with, as in the collection form in section 2).`,
    );
    await formShot(g, page, 'About Us page filled in, before saving', { highlight: webAddress.locator('xpath=..') });

    await g.click(saveBar(page).getByRole('button', { name: 'Create page' }), 'At the bottom of the screen, click **Create page**.');
    await expect(page).toHaveURL(/\/admin\/pages\/\d+\?created=1/, { timeout: 30_000 });
    await expect(page.getByText('Page created', { exact: true })).toBeVisible();
    await expect(page.getByText('To let customers find this page, add it to a menu.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: about.title })).toBeVisible();
    g.expect('The page reopens with the notice **Page created** — _To let customers find this page, add it to a menu._ (done below, in the footer menus).');

    const aboutPath = await storeAddress(page, /^\/pages\/[a-z0-9-]+$/);
    const aboutHandle = aboutPath.replace('/pages/', '');
    // the address shown before saving is the one saved: nothing on this shop uses /pages/about-us yet
    expect(aboutHandle, 'web address saved for About Us').toBe(addressShownBefore);
    pageAddress.set(about.title, aboutPath);
    await openAdvanced(g, page, 'Scroll down and click **Advanced** again to see the web address the page was saved with.');
    await expect(webAddress).toHaveValue(aboutHandle);
    g.expect(
      `The saved web address is **${aboutHandle}**, exactly what the box showed before saving: the page is at **${aboutPath}** on the store ` +
        '(the **View on store** link at the top opens it).',
    );
    g.note(
      'The admin never changes a web address by itself. It refuses one only when another page already uses it (or it is kept for the ' +
        'built-in **Contact us** page, /pages/contact): **Create page** then shows a red message under **Web address**, and you choose another.',
    );
    await formShot(g, page, `About Us saved: Page created, web address ${aboutHandle}`, { highlight: page.locator('div:has(> #web-address)') });

    /* ------------------------------------------------------------ the other four pages */
    g.part('Create the four policy pages');
    g.step(
      'For each page in the table below: click **All pages** (top left), then **New page**; type the **Title**; click into the ' +
        '**Content** box and type the text; leave the search engine fields empty (the title is used) and **Visible on the store** on; ' +
        'click **Create page**.',
    );
    const rows: string[][] = [];
    for (const p of otherPages) {
      await page.getByRole('link', { name: 'All pages' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Pages' })).toBeVisible();
      await page.getByRole('link', { name: 'New page' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'New page' })).toBeVisible();
      await expect(editor(page)).toBeVisible();
      await page.locator('#page-title').fill(p.title);
      await editor(page).click();
      await page.keyboard.type(p.body);
      await expect(editor(page)).toContainText(p.body);
      await expect(visibleSwitch(page)).toHaveAttribute('aria-checked', 'true');
      await saveBar(page).getByRole('button', { name: 'Create page' }).click();
      await expect(page).toHaveURL(/\/admin\/pages\/\d+\?created=1/, { timeout: 30_000 });
      await expect(page.getByText('To let customers find this page, add it to a menu.')).toBeVisible();
      const path = await storeAddress(page, /^\/pages\/[a-z0-9-]+$/);
      expect(path, `store address of ${p.title}`).toBe(`/pages/${guessAddress(p.title)}`);
      pageAddress.set(p.title, path);
      rows.push([p.title, '`' + p.body + '`', path]);
    }
    g.table(['Title', 'Content (type exactly)', 'Address on the store (made from the title)'], rows);
    g.expect(
      'After each **Create page**, the page reopens with **Page created** and _To let customers find this page, add it to a menu._ ' +
        'Each page gets the address made from its title (an **&** becomes **and**), as its **Web address** box showed.',
    );

    await g.click(page.getByRole('link', { name: 'All pages' }), 'Click **All pages**.');
    const pageRows = page.getByTestId('page-row');
    for (const p of PAGES) {
      const row = pageRows.filter({ has: page.getByRole('link', { name: p.title, exact: true }) }).first();
      await expect(row).toBeVisible();
      await expect(row).toContainText('Text page');
      await expect(row).toContainText('Published');
    }
    g.expect('The list shows all five pages as **Text page**, each **Published** (visible on the store).');
    await g.shot(page, 'The five pages in the Pages list');

    /* ------------------------------------------------------------ blog posts */
    g.part(
      'Write two blog posts',
      'Blog posts have their own date, author, featured photo and tags. Each tag gets its own page on the blog.',
    );
    await g.click(sidebarLink(page, 'Blog posts'), 'In the left menu, click **Blog posts**.');
    await expect(page.getByRole('heading', { level: 1, name: 'Blog posts' })).toBeVisible();

    for (const [i, post] of BLOG_POSTS.entries()) {
      const date = POST_DATES[i] ?? POST_DATES[POST_DATES.length - 1];
      if (i > 0) await g.click(page.getByRole('link', { name: 'All blog posts' }), 'Click **All blog posts** (top left).');
      await g.click(page.getByRole('link', { name: 'New post' }), `Click **New post** (top right) for the post “${post.title}”.`);
      await expect(page.getByRole('heading', { level: 1, name: 'New blog post' })).toBeVisible();
      await expect(editor(page)).toBeVisible();
      const upload = page.getByTestId('image-upload');
      const tags = page.getByRole('textbox', { name: 'Tags' });

      await g.form([
        { label: 'Title', value: post.title, locator: page.locator('#post-title') },
        {
          label: 'Date (click the calendar and pick the day)',
          value: date.said,
          act: async () => {
            await page.locator('#post-date').fill(date.iso);
            await expect(page.locator('#post-date')).toHaveValue(date.iso);
          },
        },
        {
          label: 'Author',
          value: post.author,
          act: async () => {
            await page.locator('#post-author').fill(post.author);
            await page.locator('#post-author').press('Tab'); // closes the suggestions list of earlier authors
          },
        },
        {
          label: 'Featured photo',
          value: post.photo,
          kind: 'upload',
          button: 'Upload photo',
          act: async () => {
            await chooseFiles(upload.getByRole('button', { name: 'Upload photo' }), [post.photo]);
            await expect(upload.locator('img')).toHaveAttribute('src', /^\/uploads\//, { timeout: 60_000 });
          },
        },
        {
          label: 'Content: click into the white box and type',
          value: post.body,
          kind: 'type',
          act: async () => {
            await editor(page).click();
            await page.keyboard.type(post.body);
          },
        },
        {
          label: 'Content: press **Enter**, click the **Subheading** button, then type',
          value: post.subheading,
          kind: 'type',
          act: async () => {
            await page.keyboard.press('Enter');
            await toolbarButton(page, 'Subheading').click();
            await page.keyboard.type(post.subheading);
          },
        },
        {
          label: 'Content: press **Enter**, then type',
          value: post.subheadingBody,
          kind: 'type',
          act: async () => {
            await page.keyboard.press('Enter');
            await page.keyboard.type(post.subheadingBody);
          },
        },
        {
          label: 'Tags (type one tag, press **Enter**, then the next)',
          value: post.tags,
          kind: 'type',
          act: async () => {
            for (const t of post.tags) {
              await tags.fill(t);
              await tags.press('Enter');
              await expect(page.getByRole('button', { name: `Remove ${t}`, exact: true })).toBeVisible();
            }
          },
        },
        {
          label: 'Visible on the store',
          value: '',
          kind: 'check',
          act: async () => {
            await expect(visibleSwitch(page)).toHaveAttribute('aria-checked', 'true');
          },
        },
      ]);
      await expect(editor(page).locator('h3')).toHaveText(post.subheading);
      g.expect(
        `The photo preview appears under **Featured photo**, the subheading is shown bigger in the editor, and the tags show as ${post.tags
          .map((t) => `**${t}**`)
          .join(' and ')} chips.`,
      );
      if (i === 0) {
        await openAdvanced(g, page, 'Scroll down and click **Advanced** to see the post’s web address, made from its title.');
        await expect(page.locator('#web-address')).toHaveValue(guessAddress(post.title));
        const blogPrefix = await checkAddressPrefix(page, baseURL, '/blogs/news/');
        g.expect(`**Web address** shows **${guessAddress(post.title)}**, after the grey \`${blogPrefix}\`: blog posts are under **/blogs/news/** on the store.`);
        await formShot(g, page, `Blog post “${post.title}” filled in, before saving`);
      }

      await g.click(saveBar(page).getByRole('button', { name: 'Create post' }), 'Click **Create post** at the bottom of the screen.');
      await expect(page).toHaveURL(/\/admin\/blog\/\d+\?created=1/, { timeout: 30_000 });
      await expect(page.getByText('Blog post created.')).toBeVisible();
      postAddress.set(post.title, await storeAddress(page, /^\/blogs\/news\/[a-z0-9-]+$/));
      expect(postAddress.get(post.title), `store address of ${post.title}`).toBe(`/blogs/news/${guessAddress(post.title)}`);
      g.expect(`The post reopens with **Blog post created.** It will be at **${postAddress.get(post.title)}** on the store.`);
    }

    await g.click(page.getByRole('link', { name: 'All blog posts' }), 'Click **All blog posts**.');
    const blogRows = page.getByTestId('blog-row');
    await expect(blogRows).toHaveCount(BLOG_POSTS.length);
    for (const [i, post] of BLOG_POSTS.entries()) {
      // newest first: the posts are created newest-first, so the list order is the BLOG_POSTS order
      const row = blogRows.nth(i);
      await expect(row.getByRole('link', { name: post.title, exact: true })).toBeVisible();
      await expect(row).toContainText(`${(POST_DATES[i] ?? POST_DATES[POST_DATES.length - 1]).admin} · ${post.author}`);
      await expect(row).toContainText('Published');
      for (const t of post.tags) await expect(row).toContainText(t);
      await expect(row.locator('img')).toHaveAttribute('src', /^\/uploads\//);
    }
    await expectImagesLoaded(page, '[data-testid=blog-row] img');
    g.expect('Both posts are listed, newest first, with their photo, date, author, tags and **Published**.');
    await g.shot(page, 'The two blog posts in the admin list');

    /* ------------------------------------------------------------ footer menus */
    g.part(
      'Link the pages from the footer',
      'A new page is only found by customers once a menu links to it. The pages go into the two footer menus: About Us and the terms ' +
        `under Footer “About”, the three customer-service pages under Footer “Customer Support”, after the **${CONTACT.label}** link added in section 6.`,
    );
    await g.click(sidebarLink(page, 'Menus'), 'In the left menu, click **Menus**.');
    await expect(page.getByRole('heading', { level: 1, name: 'Menus' })).toBeVisible();

    await fillFooterTab(g, page, 'Footer “About”', MENUS.footerAbout);
    await g.shot(page, 'Footer “About” menu with About Us and Terms & Conditions', { highlight: page.getByRole('list', { name: 'Menu items' }) });

    await fillFooterTab(g, page, 'Footer “Customer Support”', MENUS.footerSupport);
    const supportOrder = [CONTACT.label, ...MENUS.footerSupport.map((e) => e.label)];
    await expect.poll(() => menuItems(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-label') ?? ''))).toEqual(supportOrder);
    await expect(menuItemHeader(menuItems(page).first())).toContainText(`Page · ${CONTACT.link} (Built-in)`);
    g.expect(`**${CONTACT.label}** (the built-in contact page, added in section 6) stays first; the three policy pages follow it.`);
    await g.shot(page, 'Footer “Customer Support” menu: Contact us, then the three policy pages', { highlight: page.getByRole('list', { name: 'Menu items' }) });

    /* ------------------------------------------------------------ the shopper's view */
    g.part('Check the pages, footer and blog on the store', 'Done in a separate browser window that is not signed in, like a customer.');
    await g.goto(shopper, '/', 'Open the store home page **/** and scroll to the very bottom.');
    const aboutNav = shopper.getByRole('navigation', { name: FOOTER_HEADING.about, exact: true });
    const supportNav = shopper.getByRole('navigation', { name: FOOTER_HEADING.support, exact: true });
    const footerLink = (label: string) =>
      MENUS.footerAbout.some((e) => e.label === label)
        ? aboutNav.getByRole('link', { name: label, exact: true })
        : supportNav.getByRole('link', { name: label, exact: true });
    await expect(aboutNav.getByRole('heading')).toHaveText(FOOTER_HEADING.about);
    await expect(supportNav.getByRole('heading')).toHaveText(FOOTER_HEADING.support);
    // the links in the order of their menu tab: Contact us (section 6) first under Customer Support
    await expect(aboutNav.getByRole('link')).toHaveText(MENUS.footerAbout.map((e) => e.label));
    await expect(supportNav.getByRole('link')).toHaveText([CONTACT.label, ...MENUS.footerSupport.map((e) => e.label)]);
    await expect(supportNav.getByRole('link', { name: CONTACT.label, exact: true })).toHaveAttribute('href', CONTACT.href);
    for (const e of [...MENUS.footerAbout, ...MENUS.footerSupport]) {
      await expect(footerLink(e.label)).toHaveAttribute('href', pageAddress.get(e.link)!);
    }
    g.expect(
      `The footer column **${FOOTER_HEADING.about.toUpperCase()}** lists ${MENUS.footerAbout.map((e) => `**${e.label}**`).join(' and ')}, and the column ` +
        `**${FOOTER_HEADING.support.toUpperCase()}** lists **${CONTACT.label}**, ${MENUS.footerSupport.map((e) => `**${e.label}**`).join(', ')}: ` +
        'each column has the name of its tab in **Menus** and its links in the same order (the footer is in the next screenshot, at the bottom of the About Us page).',
    );

    await g.click(footerLink(MENUS.footerAbout[0].label), `In the footer, click **${MENUS.footerAbout[0].label}**.`);
    await expect(shopper).toHaveURL(new RegExp(`${escapeRe(aboutPath)}$`));
    const main = shopper.getByRole('main');
    const text = main.locator('.sf-text-body');
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(about.title);
    await expect(text.locator('h2')).toHaveText(ABOUT.heading);
    await expect(text).toContainText(about.body);
    await expect(text.locator('h3')).toHaveText(ABOUT.subheading);
    await expect(text.locator('ul > li')).toHaveText(ABOUT.bullets);
    await expect(shopper).toHaveTitle(`${ABOUT.seoTitle} - Cozy Furnitures`);
    await expect(shopper.locator('meta[name="description"]')).toHaveAttribute('content', ABOUT.seoDescription);
    g.expect(
      `The About Us page opens at **${aboutPath}**, the address shown in the admin. At the top is the page’s **Title**, **${about.title}**, as the page heading; ` +
        `below it the content: the heading **${ABOUT.heading}**, the paragraph, the subheading **${ABOUT.subheading}** and the three bullet points. ` +
        `The browser tab shows the SEO title _${ABOUT.seoTitle} - Cozy Furnitures_.`,
    );
    await g.shot(shopper, 'About Us page on the store, the footer links below it', { fullPage: true });

    g.step('Using the footer links, open each of the other pages:');
    const visited: string[][] = [];
    for (const p of otherPages) {
      const entry = [...MENUS.footerAbout, ...MENUS.footerSupport].find((e) => e.link === p.title);
      const expected = pageAddress.get(p.title)!;
      if (entry) {
        await footerLink(entry.label).click();
      } else {
        await shopper.goto(expected);
      }
      await expect(shopper).toHaveURL(new RegExp(`${escapeRe(expected)}$`));
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(p.title);
      await expect(main.locator('.sf-text-body')).toHaveText(p.body);
      visited.push([entry ? `click **${entry.label}** in the footer` : `open **${expected}**`, expected, `**${p.title}**`, p.body]);
    }
    g.table(['Do this', 'Address that opens', 'Heading', 'Text on the page'], visited);
    g.expect('Each footer link opens its page: the page’s title as the heading, then the text typed in the admin.');

    // A page written as one paragraph (no Heading in the editor) still opens with its title as the heading.
    const plain = otherPages[0];
    const plainEntry = [...MENUS.footerAbout, ...MENUS.footerSupport].find((e) => e.link === plain.title);
    const plainPath = pageAddress.get(plain.title)!;
    if (plainEntry) await g.click(footerLink(plainEntry.label), `In the footer, click **${plainEntry.label}** again and look at the top of the page.`);
    else await g.goto(shopper, plainPath, `Open **${plainPath}** and look at the top of the page.`);
    await expect(shopper).toHaveURL(new RegExp(`${escapeRe(plainPath)}$`));
    await expect(main.getByRole('heading')).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(plain.title);
    await expect(main.locator('.sf-text-body')).toHaveText(plain.body);
    await expect(shopper).toHaveTitle(`${plain.title} - Cozy Furnitures`);
    g.expect(
      `The page was written as one paragraph, without a heading in **Content**, and still opens with its title **${plain.title}** as the heading, ` +
        `above the paragraph. The browser tab shows _${plain.title} - Cozy Furnitures_.`,
    );
    await g.shot(shopper, `${plain.title} on the store: the title above the text`, { highlight: main.locator('.sf-tpl-page .container-iw') });
    g.note(
      'The **Title** of a page is always shown as its heading on the store, so the **Content** does not need to repeat it. ' +
        'If the content starts with a heading that is exactly the title, the store shows it only once.',
    );

    /* blog */
    await g.goto(shopper, '/blogs', 'Open the blog at **/blogs**.');
    await expect(shopper).toHaveURL(/\/blogs\/news$/);
    await expect(shopper.getByRole('heading', { level: 1, name: 'Blog Posts' })).toBeVisible();
    const cards = shopper.locator('.blog-post');
    for (const [i, post] of BLOG_POSTS.entries()) {
      const card = cards.filter({ has: shopper.locator('h5', { hasText: exactly(post.title) }) });
      await expect(card).toHaveCount(1);
      await expect(card.locator('img')).toHaveAttribute('src', /^\/uploads\//);
      await expect(card.locator('aside')).toHaveText(new RegExp(escapeRe((POST_DATES[i] ?? POST_DATES[0]).card), 'i'));
    }
    const order = (await cards.locator('h5').allTextContents()).map((t) => t.trim());
    expect(order.indexOf(BLOG_POSTS[0].title)).toBeLessThan(order.indexOf(BLOG_POSTS[1].title));
    await expectImagesLoaded(shopper, '.blog-post img');
    g.expect(
      `The page redirects to **/blogs/news** (“Blog Posts”) and shows both posts with their featured photo and date, ` +
        `the newer one (**${BLOG_POSTS[0].title}**) first.`,
    );
    const excerpt = cards.filter({ has: shopper.locator('h5', { hasText: exactly(BLOG_POSTS[0].title) }) }).locator('.post-excerpt');
    // the subheading ends with a full stop in the preview, so it does not run into the next sentence
    await expect(excerpt).toContainText(`${BLOG_POSTS[0].body} ${BLOG_POSTS[0].subheading}. ${BLOG_POSTS[0].subheadingBody}`);
    g.expect(
      `Under each title a short preview of the post reads as whole sentences: the subheading gets a full stop, e.g. ` +
        `“…${BLOG_POSTS[0].body.split(' ').slice(-3).join(' ')} **${BLOG_POSTS[0].subheading}.** ${BLOG_POSTS[0].subheadingBody.split(' ').slice(0, 4).join(' ')}…”.`,
    );
    await g.shot(shopper, 'Blog page with the two posts', { fullPage: true });

    const first = BLOG_POSTS[0];
    const firstCard = cards.filter({ has: shopper.locator('h5', { hasText: exactly(first.title) }) });
    await g.click(firstCard.locator('h5').getByRole('link', { name: first.title }), `Click the title **${first.title}**.`);
    await expect(shopper).toHaveURL(new RegExp(`${escapeRe(postAddress.get(first.title)!)}$`));
    const article = shopper.locator('#blog-post-detail');
    await expect(article.locator('h1')).toHaveText(first.title);
    await expect(article.locator('time')).toHaveText(new RegExp(escapeRe(POST_DATES[0].article), 'i'));
    await expect(article.locator('aside').filter({ hasText: new RegExp(`^${escapeRe(first.author)}$`, 'i') })).toBeVisible();
    await expect(article.locator('img[src^="/uploads/"]').first()).toBeVisible();
    await expectImagesLoaded(shopper, '#blog-post-detail img[src^="/uploads/"]');
    await expect(article.locator('.post-content')).toContainText(first.body);
    await expect(article.locator('.post-content h3')).toHaveText(first.subheading);
    await expect(article.locator('.post-content')).toContainText(first.subheadingBody);
    for (const t of first.tags) await expect(article.locator('footer').getByRole('link', { name: t, exact: true })).toBeVisible();
    g.expect(
      `The post shows the date **${POST_DATES[0].article}** and the author **${first.author}** above the title, the featured photo, ` +
        `the text with the subheading **${first.subheading}**, and under it **Tags:** ${first.tags.map((t) => `**${t}**`).join(', ')}.`,
    );
    await g.shot(shopper, `Blog post “${first.title}” on the store`, { fullPage: true });

    const tag = first.tags[first.tags.length - 1];
    const tagLink = article.locator('footer').getByRole('link', { name: tag, exact: true });
    await expect(tagLink).toHaveAttribute('href', /^\/blogs\/news\/tagged\/[a-z0-9-]+$/);
    const tagPath = (await tagLink.getAttribute('href')) ?? '';
    await g.click(tagLink, `Under the post, next to **Tags:**, click **${tag}**.`);
    await expect(shopper).toHaveURL(new RegExp(`${escapeRe(tagPath)}$`));
    const crumbs = shopper.getByRole('navigation', { name: 'breadcrumbs' });
    await expect(crumbs).toContainText(new RegExp(`Home\\s*/?\\s*News\\s*/?\\s*${escapeRe(tag)}`));
    await expect(cards.filter({ has: shopper.locator('h5', { hasText: exactly(first.title) }) })).toHaveCount(1);
    for (const other of BLOG_POSTS.filter((p) => !p.tags.includes(tag))) {
      await expect(cards.filter({ has: shopper.locator('h5', { hasText: exactly(other.title) }) })).toHaveCount(0);
    }
    g.expect(`The tag page opens at **${tagPath}** (Home / News / ${tag}) and lists only the posts tagged **${tag}**.`);
    await g.shot(shopper, `Tag page “${tag}”`, { fullPage: true });
  },
};

export default section;
