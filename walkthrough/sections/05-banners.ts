import { devices, expect, type Locator, type Page } from '@playwright/test';
import type { Section } from '../context';
import { BANNERS, COLLECTIONS } from '../data';
import { chooseFiles, expectImagesLoaded, gotoPage } from '../guide';

/**
 * 5. Home banners — the slider at the top of the home page (tests/admin/banner.spec.ts, README "Home banners").
 * Every banner in data.ts BANNERS is added through the inline form on /admin/banners: computer photo, optional
 * phone photo, a collection picked with the link picker, a name and the "Show on the store" switch. The shopper
 * then sees exactly the switched-on slides, in list order, each linking to its collection.
 */

type Banner = (typeof BANNERS)[number];

const SAVED = 'Saved. The home page is updated.';
const NAME_LABEL = 'Name (only for you and screen readers)';
const FORM_HINT = "Save or cancel the banner you're editing first.";

const visible = BANNERS.filter((b) => b.visible);
const hidden = BANNERS.filter((b) => !b.visible);

function handleOf(title: string): string {
  const c = COLLECTIONS.find((x) => x.title === title);
  if (!c) throw new Error(`data.ts: banner link "${title}" is not a collection in COLLECTIONS`);
  return c.handle;
}

const exact = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const saveBar = (page: Page) => page.getByTestId('save-bar');
const bannerForm = (page: Page) => page.getByTestId('banner-form');
const cards = (page: Page) => page.getByTestId('banner-card');
/** The list card whose name is exactly `name` (the name paragraph carries it as its title attribute). */
const cardOf = (page: Page, name: string) => cards(page).filter({ has: page.locator(`p[title="${name}"]`) });
const addBannerButton = (page: Page) => page.getByRole('button', { name: '+ Add banner' });
const saveNewButton = (page: Page) => saveBar(page).getByRole('button', { name: 'Add banner', exact: true });

/** A result under the "Collections" heading of the open link picker (never a product or page with the same words). */
const collectionResult = (pop: Locator, title: string) =>
  pop
    .getByText('Collections', { exact: true })
    .locator('xpath=following-sibling::ul[1]')
    .getByTestId('link-result')
    .filter({ hasText: exact(title) });

/** Click "Upload photo" in one ImageUpload box, pick the file, wait for the preview; returns the stored /uploads/ address. */
async function uploadPhoto(box: Locator, file: string): Promise<string> {
  await chooseFiles(box.getByRole('button', { name: 'Upload photo' }), [file]);
  const img = box.getByTestId('image-upload-preview').locator('img');
  await expect(img).toHaveAttribute('src', /^\/uploads\//, { timeout: 60_000 });
  await expect(box.getByRole('button', { name: 'Replace' })).toBeVisible();
  await expect(box.getByRole('alert')).toHaveCount(0);
  return (await img.getAttribute('src')) ?? '';
}

/** Open the link picker, search for the collection and pick it under "Collections". */
async function pickCollection(page: Page, form: Locator, title: string) {
  const picker = form.getByTestId('link-picker');
  await picker.getByRole('button', { name: 'Choose link' }).click();
  const pop = page.getByRole('dialog', { name: 'Choose a link' });
  await expect(pop).toBeVisible();
  await pop.getByRole('searchbox').fill(title);
  // the "Home" shortcut disappears once the search for this word has answered
  await expect(pop.getByTestId('link-result').filter({ hasText: /^Home$/ })).toHaveCount(0);
  await collectionResult(pop, title).first().click();
  await expect(pop).toBeHidden();
  await expect(picker.getByTestId('link-picker-value')).toHaveText(`Collection · ${title}`);
}

/** From now on, note every scroll position of the page (to see where the page ends up after a save). */
const recordScroll = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __scrollLog?: number[] };
    if (!w.__scrollLog) window.addEventListener('scroll', () => w.__scrollLog?.push(Math.round(window.scrollY)), { passive: true });
    w.__scrollLog = [];
  });

/**
 * After a save the page scrolls to the banner just added and stays there. (The first run found it sliding down to
 * the new banner and then jumping back to the top, when the unsaved-changes guard stepped back in the browser
 * history a moment after the save.) Call recordScroll() before clicking the save button.
 */
async function expectSavedBannerInView(page: Page, name: string) {
  const card = cardOf(page, name);
  const inView = () =>
    card.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    });
  await expect.poll(inView, { message: `"${name}" is scrolled into view after saving`, timeout: 10_000 }).toBe(true);
  // give the history step and any late scroll time to happen, then check the page did not slide back up
  await page.waitForTimeout(1500);
  const { log, y } = await page.evaluate(() => ({
    log: (window as unknown as { __scrollLog?: number[] }).__scrollLog ?? [],
    y: Math.round(window.scrollY),
  }));
  const peak = Math.max(0, ...log);
  expect(y, `the page stays at "${name}" after saving (scroll positions: ${log.join(', ')})`).toBeGreaterThanOrEqual(peak - 20);
  expect(await inView(), `"${name}" is still in view after saving`).toBe(true);
}

/** Add one banner with the inline form (undocumented steps: the caller documents them as a table). */
async function addBanner(page: Page, b: Banner, beforeSave?: (form: Locator) => Promise<void>): Promise<string> {
  await addBannerButton(page).click();
  const form = bannerForm(page);
  await expect(form.getByRole('heading', { name: 'New banner' })).toBeVisible();
  // while the form is open the list cannot be reordered
  await expect(cards(page).first().getByTestId('drag-handle')).toBeDisabled();
  await expect(page.getByText(FORM_HINT)).toBeVisible();

  const uploads = form.getByTestId('image-upload');
  const desktop = await uploadPhoto(uploads.nth(0), b.desktop);
  if (b.phone) await uploadPhoto(uploads.nth(1), b.phone);
  await pickCollection(page, form, b.link);
  await form.getByRole('textbox', { name: NAME_LABEL }).fill(b.name);
  const sw = form.getByRole('switch', { name: 'Show on the store' });
  if ((await sw.getAttribute('aria-checked')) !== String(b.visible)) await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', String(b.visible));
  await beforeSave?.(form);

  await recordScroll(page);
  await saveNewButton(page).click();
  await expect(page.getByText(SAVED)).toBeVisible();
  await expect(form).toHaveCount(0);
  const card = cardOf(page, b.name);
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(`Link: Collection · ${b.link}`);
  await expect(card).toContainText(b.visible ? 'Shown on the store' : 'Hidden');
  await expect(card.locator('img').first()).toHaveAttribute('src', desktop);
  await expectSavedBannerInView(page, b.name);
  return desktop;
}

/**
 * Resume safety net (not part of the guide): a re-run of this section on the same database first removes the
 * banners an earlier attempt created, through the same Delete button an owner would use. On a fresh store
 * there is nothing to remove.
 */
async function removeLeftovers(page: Page) {
  for (const b of BANNERS) {
    const card = cardOf(page, b.name);
    for (let n = await card.count(); n > 0; n--) {
      await card.first().getByTestId('confirm-delete').click();
      await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete permanently' }).click();
      await expect(card).toHaveCount(n - 1);
    }
  }
}

const section: Section = {
  id: '05',
  title: '5. Home banners',
  intro:
    'Home banners are the big photos that slide at the top of the home page. We add four banners (one with its own phone photo, one switched off) and check that shoppers see exactly the three switched-on slides, each opening its collection.',
  async run(ctx) {
    const { guide: g, admin, shopper } = ctx;
    const [first, ...rest] = BANNERS;
    if (!first.phone) throw new Error('data.ts: the first banner is the one documented with a phone photo');

    /* ---------------------------------------------------------------------------------- the first banner */
    g.part('Add the first banner, step by step', `The first banner, **${first.name}**, gets a computer photo, a separate phone photo and a link to the **${first.link}** collection.`);

    await g.click(admin.getByRole('complementary').getByRole('link', { name: 'Home banners', exact: true }), 'In the left menu, click **Home banners**.');
    await expect(admin).toHaveURL(/\/admin\/banners$/);
    await expect(admin.getByRole('heading', { level: 1, name: 'Home banners' })).toBeVisible();
    await removeLeftovers(admin);
    await expect(cards(admin)).toHaveCount(0);
    await expect(admin.getByText('No banners yet. Add one to show a slide at the top of the home page.')).toBeVisible();
    await expect(admin.getByText('0 banners · 0 shown on the store')).toBeVisible();
    g.expect('The **Home banners** page opens. A new store has none yet: it says **No banners yet** and **0 banners · 0 shown on the store**.');
    await g.shot(admin, 'Home banners page of a new store: no banners yet', { highlight: addBannerButton(admin) });

    await g.click(addBannerButton(admin), 'Click **+ Add banner**.');
    const form = bannerForm(admin);
    await expect(form.getByRole('heading', { name: 'New banner' })).toBeVisible();
    await expect(form.getByRole('switch', { name: 'Show on the store' })).toHaveAttribute('aria-checked', 'true');
    g.expect('A **New banner** form opens at the top of the page. **Show on the store** is already switched on.');

    const uploads = form.getByTestId('image-upload');
    let firstDesktop = '';
    let firstPhone = '';
    await g.form(
      [
        { label: 'Computer photo', kind: 'upload', button: 'Upload photo', value: first.desktop, act: async () => void (firstDesktop = await uploadPhoto(uploads.nth(0), first.desktop)) },
        { label: 'Phone photo (optional)', kind: 'upload', button: 'Upload photo', value: first.phone, act: async () => void (firstPhone = await uploadPhoto(uploads.nth(1), first.phone!)) },
      ],
      'Add the two photos. Wait for each one to finish uploading before the next:',
    );
    g.expect('Each photo appears in its box, with **Replace** and **Remove** buttons under it.');

    const picker = form.getByTestId('link-picker');
    // bring the Link box to the middle of the screen so the window opens under it (and stays in the screenshot)
    await picker.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await g.click(picker.getByRole('button', { name: 'Choose link' }),'Under **Link**, click the box that says **No link** (with **Change** on the right).');
    const pop = admin.getByRole('dialog', { name: 'Choose a link' });
    await expect(pop).toBeVisible();
    await expect(pop.getByRole('tab', { name: 'This store' })).toHaveAttribute('aria-selected', 'true');
    g.expect('A small **Choose a link** window opens, with **This store** selected at the top.');

    g.step(`Type \`${first.link}\` in the search box.`);
    await pop.getByRole('searchbox').fill(first.link);
    await expect(pop.getByTestId('link-result').filter({ hasText: /^Home$/ })).toHaveCount(0);
    const result = collectionResult(pop, first.link);
    await expect(result).toHaveCount(1);
    g.expect(`**${first.link}** is listed under **Collections**.`);
    await g.shot(admin, `Choose a link: searching "${first.link}" finds the collection`, { highlight: result });

    await g.click(result, `Under **Collections**, click **${first.link}**.`);
    await expect(pop).toBeHidden();
    await expect(picker.getByTestId('link-picker-value')).toHaveText(`Collection · ${first.link}`);
    g.expect(`The window closes and the **Link** box now reads **Collection · ${first.link}**.`);

    const sw = form.getByRole('switch', { name: 'Show on the store' });
    await g.form(
      [
        { label: NAME_LABEL, value: first.name, locator: form.getByRole('textbox', { name: NAME_LABEL }) },
        { label: 'Show on the store', kind: 'none', value: 'On', act: async () => expect(sw).toHaveAttribute('aria-checked', 'true') },
      ],
      'Fill in the rest of the form:',
    );
    await expect(saveBar(admin)).toContainText('Unsaved changes');
    await expect(saveNewButton(admin)).toBeEnabled();
    g.expect('The bar at the bottom of the screen says **Unsaved changes** and has the **Add banner** button.');
    await form.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await g.shot(admin, `New banner form filled in for "${first.name}", before saving`, { highlight: form });

    await recordScroll(admin);
    await g.click(saveNewButton(admin), 'In the bar at the bottom of the screen, click **Add banner**.');
    await expect(admin.getByText(SAVED)).toBeVisible();
    await expect(form).toHaveCount(0);
    const firstCard = cardOf(admin, first.name);
    await expect(firstCard).toHaveCount(1);
    await expect(firstCard).toContainText('#1');
    await expect(firstCard).toContainText(`Link: Collection · ${first.link}`);
    await expect(firstCard).toContainText('Shown on the store');
    await expect(firstCard.locator('img').nth(0)).toHaveAttribute('src', firstDesktop);
    await expect(firstCard.locator('img').nth(1)).toHaveAttribute('src', firstPhone);
    await expect(firstCard.getByText('Phone', { exact: true })).toBeVisible();
    await expect(admin.getByText('1 banner · 1 shown on the store')).toBeVisible();
    await expectSavedBannerInView(admin, first.name);
    g.expect(
      `A green message **${SAVED}** appears and the form closes. The list shows banner **#1 ${first.name}** with both photos (**Computer** and **Phone**), **Link: Collection · ${first.link}** and **Shown on the store**.`,
    );
    await g.shot(admin, `"${first.name}" saved: first banner in the list`, { highlight: firstCard });

    /* ---------------------------------------------------------------------------------- the other banners */
    g.part(
      `Add the other ${rest.length} banners`,
      'Add these banners the same way, one at a time, in this order. They have no phone photo, so phones show their computer photo.',
    );
    g.table(
      ['Name', 'Computer photo', 'Phone photo', 'Link: search for and pick the collection', 'Show on the store'],
      rest.map((b) => [
        `\`${b.name}\``,
        `\`${b.desktop}\``,
        b.phone ? `\`${b.phone}\`` : '_(leave empty)_',
        `\`${b.link}\``,
        b.visible ? 'On _(leave as is)_' : '**Off**: click the switch',
      ]),
    );
    g.step('Click **+ Add banner**.');
    g.step('Under **Computer photo**, click **Upload photo** and choose the photo from the table. Wait until it appears in the box.');
    g.step('Leave **Phone photo (optional)** empty.');
    g.step('Under **Link**, click the box that says **No link**, type the collection name from the table in the search box, and click that name under **Collections**.');
    g.step(`Type the name from the table into **${NAME_LABEL}**.`);
    const restHidden = rest.filter((b) => !b.visible);
    if (restHidden.length)
      g.step(
        `Only for ${restHidden.map((b) => `**${b.name}**`).join(', ')}: click the **Show on the store** switch so it turns grey (off). The banner is kept, ready for later, but shoppers do not see it.`,
      );
    g.step(`Click **Add banner** in the bar at the bottom and wait for **${SAVED}**`);

    for (const b of rest) {
      await addBanner(
        admin,
        b,
        b.visible
          ? undefined
          : async (f) => {
              const off = f.getByRole('switch', { name: 'Show on the store' });
              // keep the switch and its hint clear of the save bar at the bottom of the screen
              await off.evaluate((el) => el.scrollIntoView({ block: 'center' }));
              await g.shot(admin, `"${b.name}": Show on the store switched off; the list below is locked until you save`, { highlight: off });
            },
      );
    }
    g.expect(
      `After each **Add banner** click, **${SAVED}** appears and the new banner is added at the end of the list, showing **Link: Collection · …** with the collection you picked.`,
    );
    g.expect(
      `After each save the page scrolls by itself to the banner you just added (once the list is longer than the screen) and stays there, so you can check the new banner without scrolling.`,
    );
    g.expect(`While a banner form is open, the list's drag handles and arrows are greyed out and the page says **${FORM_HINT}**`);

    /* ---------------------------------------------------------------------------------- the list */
    g.part('Check the list and the order', 'The home page shows the banners in the order of this list. We keep the order as it is.');
    g.step('Scroll the page so you can see the whole list of banners.');
    // the count line above the list and all four cards fit on one screen
    await cards(admin)
      .first()
      .evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 140, behavior: 'instant' }));
    await expect.poll(() => cards(admin).first().evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(200);
    await expect(cards(admin).locator('p[title]')).toHaveText(BANNERS.map((b) => b.name));
    await expect(admin.getByText(`${plural(BANNERS.length, 'banner')} · ${visible.length} shown on the store`)).toBeVisible();
    for (const b of visible) await expect(cardOf(admin, b.name)).toContainText('Shown on the store');
    for (const b of BANNERS) await expect(cardOf(admin, b.name).getByText(b.phone ? 'Phone' : 'Phone: same', { exact: true })).toBeVisible();
    for (const b of hidden) {
      const card = cardOf(admin, b.name);
      await expect(card).toContainText('Hidden');
      await expect(card.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
      await expect(card).toContainText('Off');
    }
    const all = cards(admin);
    await expect(all.nth(1).getByTestId('drag-handle')).toBeEnabled();
    await expect(all.first().getByRole('button', { name: 'Move up' })).toBeDisabled();
    await expect(all.first().getByRole('button', { name: 'Move down' })).toBeEnabled();
    await expect(all.last().getByRole('button', { name: 'Move down' })).toBeDisabled();
    await expect(all.last().getByRole('button', { name: 'Move up' })).toBeEnabled();
    g.expect(
      `The list shows the ${BANNERS.length} banners in the order they were added: ${BANNERS.map((b, i) => `**#${i + 1} ${b.name}**`).join(', ')}. Above the list: **${plural(BANNERS.length, 'banner')} · ${visible.length} shown on the store**.`,
    );
    g.expect(
      `${hidden.map((b) => `**${b.name}**`).join(', ')} says **Hidden** and its switch is **Off**; the others say **Shown on the store**.`,
    );
    g.expect(
      `Under the small phone picture, ${BANNERS.filter((b) => b.phone).map((b) => `**${b.name}**`).join(', ')} says **Phone**; the banners without a phone photo say **Phone: same** (phones show their computer photo).`,
    );
    g.expect(
      "Each banner has a drag handle (the dotted grip on its left) and **Move up** / **Move down** arrows on its right. The first banner's up arrow and the last banner's down arrow are greyed out.",
    );
    g.note('To change the order, drag a banner by its handle (or use the arrows), then click **Save order** in the bar that appears at the bottom. The small switch on each row turns a banner on or off straight away.');
    await g.shot(admin, `All ${BANNERS.length} banners in order: drag handle (outlined) on the left, arrows on the right`, {
      highlight: all.nth(1).getByTestId('drag-handle'),
    });

    /* ---------------------------------------------------------------------------------- the store */
    g.part('See the banners on the store', 'Now look at the home page as a shopper.');
    const slider = shopper.locator('section[aria-roledescription="carousel"][aria-label="Featured"]');
    const slides = slider.locator('[aria-roledescription="slide"]');
    g.step(`In a browser window where you are **not** signed in (for example a private window), open the store's home page **${ctx.baseURL}/**.`);
    // reload if the first load still shows an older copy of the page
    await expect(async () => {
      await gotoPage(shopper, '/');
      await expect(slides).toHaveCount(visible.length, { timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    for (const [i, b] of visible.entries()) {
      await expect(slides.nth(i)).toHaveAttribute('aria-label', `${i + 1} of ${visible.length}`);
      const link = slides.nth(i).locator('a');
      await expect(link).toHaveAttribute('aria-label', b.name);
      await expect(link).toHaveAttribute('href', `/collections/${handleOf(b.link)}`);
    }
    for (const b of hidden) await expect(shopper.locator(`a[aria-label="${b.name}"]`)).toHaveCount(0);
    await expect(slider.getByRole('button', { name: /^Go to slide \d+$/ })).toHaveCount(visible.length);
    await expect(slides.nth(0).locator('img')).toHaveAttribute('src', firstDesktop);
    await expectImagesLoaded(shopper, 'section[aria-roledescription="carousel"][aria-label="Featured"] img');
    g.expect(
      `At the top of the home page a slider shows exactly **${visible.length}** slides, in the order of the list: ${visible.map((b) => `**${b.name}**`).join(', ')}, with ${visible.length} dots at the bottom. All their photos load.`,
    );
    g.expect(`${hidden.map((b) => `**${b.name}**`).join(', ')} is not on the store, because its **Show on the store** switch is off.`);
    // a mouse resting on the slider pauses it, so the shot never catches two slides half-way through a fade
    await slider.hover();
    await g.shot(shopper, 'Home page with the banner slider at the top', { fullPage: true });

    // The suggested shape is 1200 × 462; a photo of another shape is cropped by the slider (object-fit: cover).
    const fit = await slides.nth(0).locator('img').evaluate((img: HTMLImageElement) => {
      const r = img.getBoundingClientRect();
      return { nw: img.naturalWidth, nh: img.naturalHeight, bw: r.width, bh: r.height };
    });
    const shown = fit.nw / fit.nh / (fit.bw / fit.bh);
    if (fit.nw > 0 && fit.bh > 0 && shown < 0.9) {
      g.finding(
        'issue',
        'Banner photos of the wrong shape are cropped without a warning',
        `The computer photo of **${first.name}** (\`${first.desktop}\`) is ${fit.nw} × ${fit.nh}, not the recommended 1200 × 462 shape. The banner form accepted it without any warning, and its preview shows the whole photo (with empty space at the sides). On the store the slider fills a ${Math.round(fit.bw)} × ${Math.round(fit.bh)} area, so only about ${Math.round(shown * 100)}% of the photo's height is visible: the top and bottom are cut off. Text placed near the top or bottom of such a photo (the page advises "Put your text inside the image") would be lost. Suggestion: warn when a photo's shape is far from 1200 × 462, or show the real crop in the form's preview.`,
      );
    }

    const firstSlide = slides.nth(0);
    await g.click(
      slider.getByRole('button', { name: 'Go to slide 1' }),
      'Point at the slider (it stops changing while the mouse is over it) and click the **first** of the dots at the bottom of the photo.',
    );
    await expect(firstSlide).not.toHaveAttribute('aria-hidden', 'true');
    await expect(slider.getByRole('button', { name: 'Go to slide 1' })).toHaveAttribute('aria-current', 'true');
    g.expect(`The first slide, **${first.name}**, is shown and its dot is filled in.`);
    await g.shot(shopper, `The slider on its first slide, "${first.name}"`, { clip: slider });

    await g.click(firstSlide.locator('a'), 'Click the big photo.');
    const firstHandle = handleOf(first.link);
    await expect(shopper).toHaveURL(new RegExp(`/collections/${firstHandle}/?(\\?.*)?$`));
    await expect(shopper.getByRole('heading', { level: 1, name: first.link })).toBeAttached();
    const crumbs = shopper.getByRole('navigation', { name: 'breadcrumbs' });
    await expect(crumbs).toBeVisible();
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText(first.link);
    await expect(crumbs).toContainText(/Home\s*\/\s*Shop\s*\//);
    g.expect(
      `The **${first.link}** collection page opens: the line at the top reads _Home / Shop / ${first.link}_ and the address ends in \`/collections/${firstHandle}\`.`,
    );
    await g.shot(shopper, `Clicking the first slide opens the ${first.link} collection`, { fullPage: true, highlight: crumbs });

    /* ---------------------------------------------------------------------------------- on a phone */
    g.part('The phone photo', `On a phone, **${first.name}** uses its own tall phone photo; the other slides use their computer photo.`);
    const phoneContext = await ctx.newContext({ ...devices['Pixel 7'] });
    try {
      const phone = await phoneContext.newPage();
      g.step(`On a phone, open the store's home page **${ctx.baseURL}/**.`);
      await gotoPage(phone, '/');
      const pSlider = phone.locator('section[aria-roledescription="carousel"][aria-label="Featured"]');
      const pSlides = pSlider.locator('[aria-roledescription="slide"]');
      await expect(pSlides).toHaveCount(visible.length);
      await expect(pSlides.nth(0).locator('source[media="(max-width: 767px)"]')).toHaveAttribute('srcset', firstPhone);
      await expect.poll(() => pSlides.nth(0).locator('img').evaluate((img: HTMLImageElement) => img.currentSrc)).toContain(firstPhone);
      for (let i = 1; i < visible.length; i++) await expect(pSlides.nth(i).locator('source')).toHaveCount(0);
      g.expect(
        `The slider shows the same ${visible.length} slides. The first one, **${first.name}**, shows the phone photo (\`${first.phone}\`) instead of the computer photo; ${visible
          .slice(1)
          .map((b) => `**${b.name}**`)
          .join(' and ')} show their computer photo.`,
      );
      // hold the slider on its first slide for the screenshot (the dot also restarts the 7-second timer)
      await pSlider.hover().catch(() => {});
      const dot1 = pSlider.getByRole('button', { name: 'Go to slide 1' });
      await dot1.click();
      await expect(dot1).toHaveAttribute('aria-current', 'true');
      await expect(pSlides.nth(0)).toHaveAttribute('aria-hidden', 'false');
      await expect
        .poll(() => pSlides.nth(0).locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
        .toBe(true);
      await g.shot(phone, `On a phone, "${first.name}" shows its phone photo`);
    } finally {
      await phoneContext.close();
    }
  },
};

export default section;
