import { expect, type Page } from '@playwright/test';
import type { Ctx, Section } from '../context';
import { STORE } from '../data';

/** What the Settings page shows as the first line of a WhatsApp order when "Greeting (order button)" is empty. */
const DEFAULT_GREETING = "Hello Cozy Furnitures! I'd like to order this product:";
/** The text "Send test message" puts in WhatsApp. */
const TEST_MESSAGE = 'Test message from your Cozy Furnitures website admin.';
/** The text the floating WhatsApp button on the store sends. */
const GENERAL_QUESTION = 'Hello Cozy Furnitures! I have a question.';
/** Where the announcement button goes: the Sofas collection, created in section 2 (handle "sofas" in data.ts). */
const SOFAS_PATH = '/collections/sofas';
/** The WhatsApp website. Never actually opened during the test (requests are answered locally). */
const WA = /^https:\/\/wa\.me\//;

/** A white card on an admin edit page ("WhatsApp ordering", "Announcement bar", ...), found by its heading. */
const card = (page: Page, title: string) =>
  page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: title, exact: true }) }).last();

const section: Section = {
  id: '01',
  title: '1. Sign in and store settings',
  intro:
    'The shop starts brand new: the database has only its empty tables, so there are no products, collections, banners, menus or settings yet. ' +
    'In this section you look at the empty shop, sign in to the admin for the first time, fill in the store settings (WhatsApp number, announcement bar, contact details, social links) and check them on the shop.',
  async run(ctx: Ctx) {
    const { guide: g, admin: a, shopper: s, creds } = ctx;
    const site = ctx.baseURL.replace(/\/+$/, '');

    /* ------------------------------------------------------------ before you start */
    g.part('Before you start');
    g.table(
      ['What', 'Value'],
      [
        ['Shop web address', site],
        ['Admin sign-in page', `${site}/admin`],
        ['Admin email', creds.email],
        ['Admin password', creds.password],
        ['WhatsApp number used in this test', `${STORE.whatsapp} (a placeholder, not the shop's real number)`],
      ],
    );
    g.data('Shop web address', site);
    g.data('Admin sign-in page', `${site}/admin`);
    g.data('Admin email', creds.email);
    g.data('Admin password', creds.password);
    g.data(
      'WhatsApp test number',
      `${STORE.whatsapp} (stored as ${STORE.whatsappStored}). A placeholder for testing only: put the shop's real WhatsApp number in Settings before going live.`,
    );
    g.text(
      'Use two browser windows side by side: an **admin** window where you sign in, and a **shopper** window (for example a private / incognito window) where you are not signed in and see the shop exactly as a customer does.',
    );

    /* ------------------------------------------------------------ the empty shop */
    g.part('The empty shop', 'First look at the shop as a customer, before anything is set up.');
    await g.goto(s, '/', `In the **shopper** window, open the shop's home page: **${site}/**`);
    const header = s.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Cozy Furnitures home' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Search' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'My Account' })).toBeVisible();
    await expect(s.getByRole('region', { name: 'Announcement' })).toContainText('FREE Nationwide Delivery!');
    const seoHeading = s.getByRole('heading', { name: 'The Same Experience & Quality You Trust Online' });
    await expect(seoHeading).toBeVisible();
    await expect(s.getByRole('navigation', { name: 'Main navigation' }).getByRole('link')).toHaveCount(0);
    await expect(s.locator('main img')).toHaveCount(0);
    await expect(s.getByRole('heading', { name: 'Hot Selling Products' })).toHaveCount(0);
    await expect(s.getByRole('heading', { name: 'Shop by Category' })).toHaveCount(0);
    await expect(s.getByText('Our customer speaks for us')).toHaveCount(0);
    await expect(s.getByText(STORE.announcement)).toHaveCount(0);
    await expect(s.getByTestId('whatsapp-bubble')).toHaveCount(0);
    const footer = s.getByRole('contentinfo');
    await expect(footer.getByRole('heading', { name: 'Contact Info' })).toBeVisible();
    await expect(footer.getByText('Follow Us', { exact: true })).toBeVisible();
    await expect(footer.getByRole('navigation', { name: 'Information' }).getByRole('link')).toHaveCount(0);
    await expect(footer.getByRole('navigation', { name: 'User Area' }).getByRole('link')).toHaveCount(0);
    await expect(footer.locator('a[href^="tel:"], a[href^="mailto:"]')).toHaveCount(0);
    await expect(footer.getByRole('link', { name: /^(Facebook|Instagram|YouTube|LinkedIn)$/ })).toHaveCount(0);
    g.expect(
      'The home page opens but is nearly empty: the logo with the **Search** and **My Account** icons, a yellow scrolling strip **FREE Nationwide Delivery!** and a block of text. ' +
        'There is no menu, no banner picture, no products, no announcement and no WhatsApp button. The footer has the headings **Information**, **User Area**, **Contact Info** and **Follow Us** with nothing under them.',
    );
    await g.shot(s, 'The empty shop home page before any setup', { fullPage: true });
    g.note('Menus, banners, collections and products are added in the next sections of this guide.');

    await g.click(
      s.getByRole('switch', { name: 'Show more' }),
      'Scroll down to the text **The Same Experience & Quality You Trust Online** and click **Show more** under it.',
    );
    const seo = s.locator('section').filter({ has: seoHeading }).last();
    await expect(seo).toContainText('credit/debit cards and bank transfers');
    await expect(seo).toContainText('track your orders in real-time');
    await expect(seo).toContainText('augmented reality');
    await expect(s.getByRole('heading', { level: 1 })).toContainText('Largest Furniture Manufacturer');
    g.expect('The full text opens. It talks about a checkout with credit/debit cards and bank transfers, real-time order tracking and augmented-reality (AR) previews.');
    // Scroll the text to just below the sticky header, so the picture is not cut by it.
    await seo.evaluate((el) => {
      const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - headerBottom);
    });
    await g.shot(s, 'Built-in home page text after Show more', { clip: seoHeading.locator('xpath=..') });
    g.finding(
      'issue',
      'Home page text that cannot be changed in the admin',
      'Some home page content is built into the website and has no setting anywhere in the admin: ' +
        '(1) the yellow scrolling strip **FREE Nationwide Delivery!** (this is not the Announcement bar from Settings); ' +
        '(2) the text **The Same Experience & Quality You Trust Online**, which after **Show more** promises a checkout with credit/debit cards and bank transfers, real-time order tracking and augmented-reality previews. This shop takes orders on WhatsApp and offers none of these; ' +
        '(3) a hidden page title read by Google and screen readers: “Cozy Furnitures — Pakistan’s Largest Furniture Manufacturer. Bedroom, living, dining, office furniture, kitchens & wardrobes.” ' +
        'Ask the developer to rewrite or remove this text, or to make it editable.',
    );

    /* ------------------------------------------------------------ first sign-in */
    g.part('First sign-in to the admin');
    await g.goto(a, '/admin', `In the **admin** window, open **${site}/admin**.`);
    await expect(a).toHaveURL(/\/admin\/login/);
    await expect(a.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
    await expect(a.getByText('Sign in to manage your store')).toBeVisible();
    g.expect('You are sent to the sign-in page (**/admin/login**) titled **Admin Panel**, “Sign in to manage your store”.');
    g.note(
      'The very first sign-in creates the admin account. The website reads the admin email and password from two server settings (on Hostinger: the website\'s environment variables, listed below) and saves them as the admin account. ' +
        'This only happens while no admin account exists. After this first sign-in, changing those server settings does not change the password any more: use **Change password** in the admin instead.',
    );
    g.table(
      ['Server setting', 'Value in this test'],
      [
        ['`ADMIN_EMAIL`', creds.email],
        ['`ADMIN_PASSWORD`', creds.password],
      ],
    );
    await g.form([
      { label: 'Email address', value: creds.email, locator: a.getByLabel('Email address') },
      { label: 'Password', value: creds.password, locator: a.getByLabel('Password', { exact: true }) },
    ]);
    const signIn = a.getByRole('button', { name: 'Sign in to Dashboard' });
    await g.shot(a, 'Admin sign-in page filled in', { highlight: signIn });
    await g.click(signIn, 'Click **Sign in to Dashboard**.');
    await expect(a.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible({ timeout: 30_000 });
    await expect(a).toHaveURL(/\/admin\/?$/);
    const sidebar = a.getByRole('complementary');
    await expect(sidebar.getByText(creds.email)).toBeVisible();
    await expect(a.getByRole('link', { name: /^Published 0\b/ })).toBeVisible();
    await expect(a.getByRole('link', { name: /^Collections 0\b/ })).toBeVisible();
    const waWarning = a.getByRole('alert').filter({ hasText: 'WhatsApp ordering is off' });
    await expect(waWarning).toBeVisible();
    await expect(waWarning.getByRole('link', { name: 'Go to Settings' })).toBeVisible();
    g.expect(
      'The **Dashboard** opens, with your email at the bottom of the left menu. All counts are 0 (for example **Published 0** and **Collections 0**). ' +
        'A yellow box at the top says **WhatsApp ordering is off** with a **Go to Settings** button: until a WhatsApp number is saved, the store shows no WhatsApp buttons.',
    );
    await a.mouse.move(1435, 895); // the pointer left over from the sign-in click would show a card in its hover style
    await g.shot(a, 'Empty Dashboard with the WhatsApp ordering is off warning', { highlight: waWarning });

    /* ------------------------------------------------------------ WhatsApp */
    g.part('WhatsApp ordering', 'Customers order by sending a WhatsApp message, so the WhatsApp number is the most important setting.');
    await g.click(
      sidebar.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }),
      'In the left menu, click **Settings** (the last item).',
    );
    await expect(a).toHaveURL(/\/admin\/settings/);
    await expect(a.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    const emptyNumberNote = a.getByText('Leave empty to hide all WhatsApp buttons. Customers will not be able to order until you add a number.', { exact: true });
    const testLink = a.getByTestId('whatsapp-test-link');
    await expect(emptyNumberNote).toBeVisible();
    await expect(testLink).toHaveAttribute('aria-disabled', 'true');
    g.expect(
      'The **Settings** page opens. In the **WhatsApp ordering** box a note says “Leave empty to hide all WhatsApp buttons. Customers will not be able to order until you add a number.” and **Send test message** is greyed out.',
    );
    await g.form(
      [
        { label: 'WhatsApp number', value: STORE.whatsapp, locator: a.getByLabel('WhatsApp number') },
        { label: 'Greeting (order button)', value: '' },
        { label: 'Greeting (availability button)', value: '' },
        { label: 'Closing line', value: '' },
      ],
      'In the **WhatsApp ordering** box, fill in:',
    );
    await expect(emptyNumberNote).toBeHidden();
    await expect(testLink).toHaveAttribute('aria-disabled', 'false');
    await expect(a.getByTestId('whatsapp-preview')).toContainText(DEFAULT_GREETING);
    g.expect(
      `The yellow note disappears, **Send test message** can now be clicked, and the **Example message** on the right starts with “${DEFAULT_GREETING}”.`,
    );
    g.note('The three message lines are left empty on purpose: the grey example text shown in each box is then used. Product details (name, options, quantity, price, link) are always added to the message automatically.');
    await g.shot(a, 'WhatsApp number filled in', { highlight: card(a, 'WhatsApp ordering') });

    /* ------------------------------------------------------------ announcement bar */
    g.part('Announcement bar', 'The thin dark strip at the very top of every page of the shop, with an optional red button.');
    const ann = card(a, 'Announcement bar');
    await g.form(
      [
        { label: 'Text', value: STORE.announcement, locator: a.getByRole('textbox', { name: 'Text', exact: true }) },
        { label: 'Bar link (optional)', value: 'No link', kind: 'none' },
        { label: 'Button text (optional)', value: STORE.announcementButton, locator: a.getByLabel('Button text (optional)') },
      ],
      'Scroll down to the **Announcement bar** box and fill in:',
    );
    g.text(
      `The **Button link** says where the red **${STORE.announcementButton}** button goes. It should open the **Sofas** collection, but no collections exist yet (they are made in section 2), so type the address that collection will have.`,
    );
    const ctaPicker = ann.getByTestId('link-picker').filter({ hasText: 'Button link' });
    await g.click(ctaPicker.getByRole('button', { name: 'Choose link' }), 'Under **Button link**, click the box that says **No link** / **Change**.');
    const dialog = a.getByRole('dialog', { name: 'Choose a link' });
    await expect(dialog).toBeVisible();
    for (const shortcut of ['Home', 'All products', 'Collections page', 'Blog']) {
      await expect(dialog.getByTestId('link-result').filter({ hasText: shortcut }).first()).toBeVisible();
    }
    await expect(dialog.getByTestId('link-result')).toHaveCount(4);
    g.expect(
      'A **Choose a link** box opens. The **This store** tab only offers four shortcuts (**Home**, **All products**, **Collections page**, **Blog**), because the shop has no collections, products or pages yet.',
    );
    await g.click(dialog.getByRole('tab', { name: 'Custom web address' }), 'Click the **Custom web address** tab.');
    await g.form([{ label: 'Web address', value: SOFAS_PATH, locator: dialog.getByLabel('Web address') }], 'Type the address of the future Sofas collection:');
    await g.shot(a, 'Button link: the future Sofas collection address', { highlight: dialog });
    await g.click(dialog.getByRole('button', { name: 'Use this address' }), 'Click **Use this address**.');
    await expect(dialog).toBeHidden();
    const ctaValue = ctaPicker.getByTestId('link-picker-value');
    await expect(ctaValue).toContainText('sofas', { ignoreCase: true });
    const shownLink = (await ctaValue.innerText()).trim();
    const sofasMissing = /missing/i.test(shownLink);
    if (sofasMissing) {
      await expect(ctaValue).toHaveText('Missing collection “sofas” — pick another');
      g.expect('The box closes. **Button link** now shows **Missing collection “sofas” — pick another** in red.');
      g.note(
        'The red message is expected at this point: it only means the Sofas collection does not exist yet. The address is saved anyway. Section 2 creates the **Sofas** collection with exactly this web address, and from then on the button opens it without changing anything here.',
      );
    } else {
      g.expect(`The box closes. **Button link** now shows **${shownLink}**.`);
    }
    await expect(ann.getByText(STORE.announcement, { exact: true })).toBeVisible();
    await expect(ann.getByText(STORE.announcementButton, { exact: true })).toBeVisible();
    g.expect(`The **Preview** at the bottom of the box shows the dark bar with “${STORE.announcement}” and a red **${STORE.announcementButton}** button.`);
    // Bring the whole box above the Save bar fixed at the bottom of the screen.
    await ann.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16));
    await g.shot(a, 'Announcement bar filled in, with its preview', { clip: ann });

    /* ------------------------------------------------------------ contact, social, rating */
    g.part('Contact details, social links and store rating', 'These are shown in the footer at the bottom of every page.');
    await g.form(
      [
        { label: 'Phone', value: STORE.phone, locator: a.getByLabel('Phone', { exact: true }) },
        { label: 'Customer care email', value: STORE.email, locator: a.getByLabel('Customer care email') },
        { label: 'Complaints email', value: '' },
        { label: 'Address (two lines: press **Enter** after the first line)', value: STORE.address, locator: a.getByLabel('Address', { exact: true }) },
      ],
      'In the **Contact details** box, fill in:',
    );
    g.note('The footer shows the **Complaints email** when there is one, otherwise the **Customer care email**. Complaints email stays empty here, so customers see the customer care email.');
    await g.form(
      [
        { label: 'Facebook', value: STORE.facebook, locator: a.getByLabel('Facebook', { exact: true }) },
        { label: 'Instagram', value: STORE.instagram, locator: a.getByLabel('Instagram', { exact: true }) },
        { label: 'YouTube', value: '' },
        { label: 'LinkedIn', value: '' },
      ],
      'In the **Social links** box, type the full web addresses (starting with https://):',
    );
    await g.form(
      [
        { label: 'Store rating (out of 5)', value: '' },
        { label: 'Reviews text', value: '' },
      ],
      'Leave the **Store rating** box empty:',
    );
    await expect(a.getByLabel('Store rating (out of 5)')).toHaveValue('');
    await expect(a.getByLabel('Reviews text')).toHaveValue('');
    g.note(
      'The store rating stays empty because this shop has no customer reviews yet. Filling it in would switch on an **Our customer speaks for us** block on the home page. ' +
        'The grey **4.9** and **2,500+ verified reviews** inside the boxes (and the grey address in **Complaints email**) are only examples: those boxes are empty.',
    );
    g.finding(
      'issue',
      'Store rating switches on review cards that are not this shop\'s',
      'Settings → **Store rating** says it is “the score shown above the customer reviews on the home page”. This shop has no reviews, but filling in a rating switches on the **Our customer speaks for us** block, ' +
        'which shows a fixed set of 22 review cards built into the website: quotes about products such as the Callisto Computer Table and the Faith Sofa Cum Bed, which this shop does not sell. ' +
        'Each card links to that product\'s page (for example /products/callisto-computer-table), which does not exist in this shop, so a customer clicking it gets **Page not found**. ' +
        'Found in the website\'s code; the block was not switched on during this test. Leave the rating empty, or ask the developer to remove the block or connect it to real reviews.',
    );
    await expect(card(a, 'Contact details').locator('.text-red-600')).toHaveCount(0);
    await expect(card(a, 'Social links').locator('.text-red-600')).toHaveCount(0);
    const save = a.getByTestId('save-bar').getByRole('button', { name: 'Save settings' });
    await expect(save).toBeEnabled();
    g.expect('No box shows a red error, and the **Save settings** button at the bottom of the screen can be clicked.');
    // Viewport shot from the Contact details box down (a full-page shot would paint the fixed Save bar mid-page).
    await card(a, 'Contact details').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 8));
    await g.shot(a, 'Contact details, social links and empty store rating, before saving', { highlight: save });

    /* ------------------------------------------------------------ save and check */
    g.part('Save and check what was stored');
    await g.click(save, 'At the bottom of the screen, click **Save settings**.');
    const saved = a.getByRole('status').filter({ hasText: 'Saved. The store is updated.' });
    await expect(saved).toBeVisible({ timeout: 30_000 });
    await expect(a.getByText('WhatsApp ordering is off')).toHaveCount(0);
    g.expect('The message **Saved. The store is updated.** appears at the top of the form, and the yellow **WhatsApp ordering is off** warning disappears.');
    await g.shot(a, 'Settings saved', { highlight: saved });

    await g.goto(a, '/admin/settings', 'Reload the page (press **F5**) to see what was stored.');
    await expect(a.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(a.getByLabel('WhatsApp number')).toHaveValue(STORE.whatsapp);
    await expect(a.getByRole('textbox', { name: 'Text', exact: true })).toHaveValue(STORE.announcement);
    await expect(a.getByLabel('Button text (optional)')).toHaveValue(STORE.announcementButton);
    await expect(a.getByLabel('Phone', { exact: true })).toHaveValue(STORE.phone);
    await expect(a.getByLabel('Customer care email')).toHaveValue(STORE.email);
    await expect(a.getByLabel('Address', { exact: true })).toHaveValue(STORE.address);
    await expect(a.getByLabel('Facebook', { exact: true })).toHaveValue(STORE.facebook);
    await expect(a.getByLabel('Instagram', { exact: true })).toHaveValue(STORE.instagram);
    await expect(a.getByText('WhatsApp ordering is off')).toHaveCount(0);
    g.expect(`Everything you typed is still there, and the WhatsApp number shows exactly as you entered it: **${STORE.whatsapp}**. No WhatsApp warning at the top.`);

    // The WhatsApp website is answered locally: the test never opens WhatsApp or sends anything to the placeholder number.
    const adminContext = a.context();
    await adminContext.route(WA, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>WhatsApp</title><p>WhatsApp (not opened during the test)</p>' }),
    );
    try {
      const [waRequest, waTab] = await Promise.all([
        adminContext.waitForEvent('request', (r) => WA.test(r.url())),
        adminContext.waitForEvent('page'),
        g.click(testLink, 'Next to the WhatsApp number, click **Send test message**.'),
      ]);
      const waUrl = new URL(waRequest.url());
      await waTab.close();
      expect(`${waUrl.origin}${waUrl.pathname}`).toBe(`https://wa.me/${STORE.whatsappStored}`);
      expect(waUrl.searchParams.get('text')).toBe(TEST_MESSAGE);
    } finally {
      await adminContext.unroute(WA);
    }
    g.expect(
      `A new tab opens WhatsApp for the number **${STORE.whatsappStored}** with the message “${TEST_MESSAGE}”. ` +
        `${STORE.whatsappStored} is the same number written the international way (92 for Pakistan, without the first 0).`,
    );
    g.note(
      `During this recorded test the WhatsApp website was blocked, so nothing was sent to the placeholder number ${STORE.whatsapp}. With the shop's real number, this button opens WhatsApp (on a phone: the WhatsApp app) with the test message ready to send, a quick way to check the number is right.`,
    );

    /* ------------------------------------------------------------ the shop again */
    g.part('Check the shop', 'Now look at the shop again as a customer.');
    await g.goto(s, '/', 'In the **shopper** window, reload the home page (press **F5**).');
    const annText = s.getByText(STORE.announcement, { exact: true });
    await expect(annText).toBeVisible();
    const cta = s.getByRole('link', { name: STORE.announcementButton, exact: true });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', SOFAS_PATH);
    const bubble = s.getByTestId('whatsapp-bubble');
    await expect(bubble).toBeVisible();
    await expect(s.getByText('Our customer speaks for us')).toHaveCount(0);
    g.expect(
      `A dark announcement bar now runs across the very top: “${STORE.announcement}” with a red **${STORE.announcementButton}** button. ` +
        'A round WhatsApp button floats in the bottom-right corner. There is still no “Our customer speaks for us” block.',
    );
    await g.shot(s, 'Home page with the announcement bar and WhatsApp button', { fullPage: true, highlight: annText.locator('..') });

    await expect(footer.getByRole('link', { name: STORE.phone, exact: true })).toHaveAttribute('href', `tel:${STORE.phone.replace(/[^\d+]/g, '')}`);
    await expect(footer.getByRole('link', { name: STORE.email, exact: true })).toHaveAttribute('href', `mailto:${STORE.email}`);
    for (const line of STORE.address.split('\n')) await expect(footer.getByText(line, { exact: true })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Facebook', exact: true })).toHaveAttribute('href', STORE.facebook);
    await expect(footer.getByRole('link', { name: 'Instagram', exact: true })).toHaveAttribute('href', STORE.instagram);
    await expect(footer.getByRole('link', { name: /^(YouTube|LinkedIn)$/ })).toHaveCount(0);
    g.step('Scroll down to the footer.');
    g.expect(
      `Under **Contact Info** the footer shows the phone **${STORE.phone}**, the email **${STORE.email}** and the address on two lines. ` +
        'Under **Follow Us** there are exactly two icons, **Facebook** and **Instagram**, which open the addresses typed in Settings (no YouTube or LinkedIn icon, because those boxes were left empty).',
    );
    await g.shot(s, 'Footer with contact details and the Facebook and Instagram icons', { clip: footer });

    const bubbleHref = new URL((await bubble.getAttribute('href')) ?? '');
    expect(`${bubbleHref.origin}${bubbleHref.pathname}`).toBe(`https://wa.me/${STORE.whatsappStored}`);
    expect(bubbleHref.searchParams.get('text')).toBe(GENERAL_QUESTION);
    await s.evaluate(() => window.scrollTo(0, 0));
    g.step('Scroll back to the top. Point the mouse at the round WhatsApp button in the bottom-right corner, **without clicking it**: the browser shows the address it opens in the bottom-left corner of the window.');
    await bubble.hover();
    g.expect(`The button opens a WhatsApp chat with **${STORE.whatsappStored}** (the address starts with wa.me/${STORE.whatsappStored}) with the message “${GENERAL_QUESTION}” ready to send.`);
    g.note('Every click on a WhatsApp button in the shop is counted under **WhatsApp inquiries** in the admin, so it is not clicked here.');
    await g.shot(s, 'Floating WhatsApp button in the bottom-right corner', { highlight: bubble });

    if (sofasMissing) {
      await g.click(cta, `Click the red **${STORE.announcementButton}** button in the announcement bar.`);
      await expect(s).toHaveURL(new RegExp(`${SOFAS_PATH}$`));
      await expect(s.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
      await expect(s.getByText('The page you were looking for doesnt exist.')).toBeVisible();
      g.expect('For now it opens **Page not found**, because the Sofas collection does not exist yet.');
      g.note('This changes by itself once section 2 creates the **Sofas** collection.');
      g.finding('note', 'Typo on the “Page not found” page', 'The page reads “The page you were looking for **doesnt** exist.”: the apostrophe is missing (“doesn’t”).');
    }
  },
};

export default section;
