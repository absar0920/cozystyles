import { test, expect, devices, type Browser, type Locator, type Page } from '@playwright/test';
import { chooseFiles, Guide, readPart, samplePath } from './guide';

/**
 * Full manual-test walkthrough, recorded as docs/walkthrough/README.md with screenshots.
 * Starts from an EMPTY database that contains only the admin login, and builds the whole
 * store through the admin UI, then shops it as a customer, then operates it as the admin.
 *
 *   npm run docs:walkthrough
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@cozyfurnitures.pk';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'CozyAdmin@2026';

const g = new Guide();
let admin: Page;
let shopper: Page;

async function ctx(browser: Browser) {
  return browser.newContext({ baseURL: 'http://localhost:3100', viewport: { width: 1440, height: 900 } });
}

/** Click a control that runs a server action and wait for the round-trip (documented as a step when `md` is given). */
async function act(control: Locator, md?: string) {
  const done = admin.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname.startsWith('/admin'));
  if (md) await g.click(control, md);
  else await control.click();
  await done;
  await admin.waitForLoadState('networkidle');
}

/** Click an admin sidebar link and wait for the new page to settle. */
async function sidebar(label: string) {
  const link = admin.getByRole('navigation').getByRole('link', { name: new RegExp(`^${label}\\b`) }).first();
  const href = (await link.getAttribute('href'))!;
  g.step(`In the left sidebar, click **${label}**.`);
  await link.click();
  await admin.waitForURL((u) => u.pathname === href);
  await admin.waitForLoadState('networkidle');
}

/** Click a submit button and wait for the server action to finish. */
async function save(page: Page, name: string | RegExp, label?: string) {
  const done = page.waitForResponse((r) => r.request().method() === 'POST');
  g.step(`Click **${label ?? name}**.`);
  await page.getByRole('button', { name }).first().click();
  await done;
  await page.waitForLoadState('networkidle');
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(15 * 60_000);

test('walkthrough: build and test the whole store from an empty database', async ({ browser }) => {
  admin = await (await ctx(browser)).newPage();
  shopper = await (await ctx(browser)).newPage();

  /* ================================================================ 1. EMPTY STORE */
  g.section(
    '1. First look at the empty store',
    'The database is empty except for the admin login, so the storefront has no products, menus, banners or pages yet. Nothing breaks: each area shows a sensible empty state.',
  );
  g.part('1.1 Storefront with no data');
  await g.goto(shopper, '/', 'Open the storefront home page: `http://localhost:3000/`.');
  g.expect('The header, the yellow "FREE Nationwide Delivery!" marquee, the trust strip, the rating banner and the footer all render. There is no hero banner, no product rows and no menu links yet.');
  await g.shot(shopper, 'Empty storefront home page', { fullPage: true });

  await g.goto(shopper, '/collections/all', 'Open **All Products**: `http://localhost:3000/collections/all`.');
  g.expect('An empty-state message instead of a product grid.');
  await g.shot(shopper, 'Empty product listing');

  g.part('1.2 Admin login');
  await g.goto(admin, '/admin', 'Open the admin panel: `http://localhost:3000/admin`.');
  g.expect('You are redirected to **/admin/login**; every /admin page requires a login.');
  await expect(admin).toHaveURL(/\/admin\/login$/);
  await g.shot(admin, 'Admin login page');

  await g.form(
    [
      { label: 'Email', value: ADMIN_EMAIL, locator: admin.getByLabel('Email') },
      { label: 'Password', value: 'wrong-password', locator: admin.getByLabel('Password') },
    ],
    'First try a **wrong** password:',
  );
  await g.click(admin.getByRole('button', { name: /sign in/i }), 'Click **Sign in to Dashboard**.');
  await expect(admin.getByText(/invalid|incorrect/i).first()).toBeVisible();
  g.expect('An "invalid email or password" error; you stay on the login page.');
  await g.shot(admin, 'Wrong password is rejected');

  await g.form(
    [
      { label: 'Email', value: ADMIN_EMAIL, locator: admin.getByLabel('Email') },
      { label: 'Password', value: ADMIN_PASSWORD, locator: admin.getByLabel('Password') },
    ],
    'Now sign in with the real credentials (from `.env`):',
  );
  await g.click(admin.getByRole('button', { name: /sign in/i }), 'Click **Sign in to Dashboard**.');
  await expect(admin.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await admin.waitForLoadState('networkidle');
  g.expect('The **Dashboard** opens with every counter at 0 and "No orders yet".');
  await g.shot(admin, 'Empty admin dashboard');

  /* ================================================================ 2. SETTINGS */
  g.section(
    '2. Store settings',
    'Settings hold the contact details, social links, delivery charges and rating summary used across the storefront. Changes go live immediately.',
  );
  await sidebar('Settings');
  const settings: [string, string][] = [
    ['Announcement Bar (top of every page)', 'Winter Sale — Flat 20% off on all sofas!'],
    ['Phone', '+92-42-111-203-203'],
    ['WhatsApp Number', '9242111203203'],
    ['Customer Care Email', 'info@interwood.pk'],
    ['Complaints Email', 'complaints@interwood.pk'],
    ['Head Office Address', '12-KM Ferozepur Road, Lahore, Pakistan'],
    ['Facebook', 'https://www.facebook.com/interwood'],
    ['Instagram', 'https://www.instagram.com/interwood'],
    ['YouTube', 'https://www.youtube.com/@interwood'],
    ['LinkedIn', 'https://www.linkedin.com/company/interwood'],
    ['Shipping Fee (Rs.)', '2500'],
    ['Free Shipping Threshold (Rs.)', '100000'],
    ['Overall Rating', '4.8'],
    ['Rating Count Label', '1,200+ happy customers'],
  ];
  await g.form(settings.map(([label, value]) => ({ label, value, locator: admin.getByLabel(label) })));
  g.note('Delivery rule: orders **below Rs. 100,000** pay a flat **Rs. 2,500**; orders at or above it get free delivery & installation. We test both later.');
  await g.shot(admin, 'Settings form filled in', { fullPage: true });
  await save(admin, 'Save Settings');
  await expect(admin.getByText('Settings saved successfully — the storefront has been updated.')).toBeVisible();
  g.expect('A green "Settings saved successfully — the storefront has been updated." banner.');
  await g.shot(admin, 'Settings saved');

  await g.goto(shopper, '/', 'Switch to the storefront tab and reload the home page.');
  await expect(shopper.getByText('Winter Sale — Flat 20% off on all sofas!')).toBeVisible();
  g.expect('The announcement bar at the very top now reads "Winter Sale — Flat 20% off on all sofas!" and the phone number appears top-right. Scroll to the footer: phone, email, address and the four social icons are shown, and a green WhatsApp button floats bottom-right.');
  await g.shot(shopper, 'Announcement bar and phone from settings', { highlight: shopper.getByText('Winter Sale — Flat 20% off on all sofas!') });
  await g.shot(shopper, 'Footer contact details and social links from settings', { clip: shopper.locator('footer') });

  /* ================================================================ 3. COLLECTIONS */
  g.section(
    '3. Collections (categories)',
    'Collections group products. They can be nested (a **parent** department such as Living Room with **child** categories such as Sofas). "Featured on homepage" collections become the **Shop by Category** tiles and get a product row on the home page, ordered by **Position**.',
  );
  type Col = { title: string; handle?: string; description: string; image: string; parent?: string; kind: string; position: string; nav: boolean; featured: boolean };
  const collections: Col[] = [
    { title: 'Living Room', description: 'Sofas, coffee tables and accent chairs for your lounge.', image: '/images/collections/living.jpg', kind: 'Room', position: '1', nav: true, featured: true },
    { title: 'Sofas', description: 'Two, three and five seater sofas in fabric and leather.', image: '/images/collections/conte.webp', parent: 'Living Room', kind: 'Category', position: '1', nav: true, featured: true },
    { title: 'Coffee Tables', description: 'Centre and coffee tables in solid wood and glass.', image: '/images/collections/antonin.webp', parent: 'Living Room', kind: 'Category', position: '2', nav: true, featured: false },
    { title: 'Bedroom', description: 'Beds, bedside tables and dressing tables.', image: '/images/collections/bedroom.jpg', kind: 'Room', position: '2', nav: true, featured: true },
    { title: 'Beds', description: 'King and queen size beds crafted in solid wood.', image: '/images/collections/king-size-beds.jpg', parent: 'Bedroom', kind: 'Category', position: '1', nav: true, featured: false },
    { title: 'Bedside Tables', description: 'Matching side tables with storage drawers.', image: '/images/collections/bed-side-tables.jpg', parent: 'Bedroom', kind: 'Category', position: '2', nav: true, featured: false },
    { title: 'Office Chairs', description: 'Ergonomic manager, executive and visitor chairs.', image: '/images/collections/office-chairs.webp', kind: 'Category', position: '3', nav: true, featured: true },
    { title: 'Sale', description: 'Limited-time offers across the range.', image: '/images/collections/furniture.jpg', kind: 'Helper', position: '9', nav: false, featured: false },
  ];
  for (const [i, c] of collections.entries()) {
    g.part(`3.${i + 1} Create the “${c.title}” collection`);
    await sidebar('Collections');
    await g.click(admin.getByRole('link', { name: /new collection/i }), 'Click **+ New collection** (top right).');
    await g.form([
      { label: 'Title', value: c.title, locator: admin.getByLabel('Title') },
      { label: 'Handle (URL slug)', value: '', locator: admin.getByLabel('Handle (URL slug)') },
      { label: 'Description', value: c.description, locator: admin.getByLabel('Description') },
      { label: 'Image', value: c.image, kind: 'upload', button: 'Upload image', locator: admin.getByRole('button', { name: 'Upload image', exact: true }), uploadedInto: admin.getByPlaceholder(/images\/collections/) },
      { label: 'Parent collection', value: c.parent ?? '— None (top level) —', locator: admin.getByLabel('Parent collection'), kind: 'select' },
      { label: 'Kind', value: c.kind, locator: admin.getByLabel('Kind'), kind: 'select' },
      { label: 'Position', value: c.position, locator: admin.getByLabel('Position') },
      { label: 'Show in navigation', value: c.nav ? '✓ checked' : '☐ unchecked', locator: admin.getByLabel('Show in navigation'), kind: c.nav ? 'check' : 'uncheck' },
      { label: 'Featured on homepage', value: c.featured ? '✓ checked' : '☐ unchecked', locator: admin.getByLabel('Featured on homepage'), kind: c.featured ? 'check' : 'uncheck' },
    ]);
    if (i === 0) {
      g.note('Leave **Handle** empty — it is generated from the title (“Living Room” → `living-room`). **Upload image** opens your file picker; the sample photos used in this guide are in the project’s `public/images/` folder. You can also drag a photo onto the square preview. After the upload the URL field fills in by itself (`/uploads/collections/…webp`) and the preview shows the photo.');
      await g.shot(admin, 'New collection form filled in', { fullPage: true });
    }
    await save(admin, /create collection/i, 'Create collection');
    await expect(admin.getByText('Collection saved successfully.')).toBeVisible();
    if (i === 0) {
      g.expect('"Collection saved successfully." and you stay on the collection’s edit page.');
      await g.shot(admin, 'Collection saved');
    }
  }
  g.part('3.9 Check the collection list');
  await sidebar('Collections');
  await expect(admin.getByText('8 collections')).toBeVisible();
  g.expect('**8 collections**. Children show their parent (Sofas → Living Room). “Sale” is not in the navigation. Product counts are 0 for now.');
  await g.shot(admin, 'Collections list', { fullPage: true });

  /* ================================================================ 4. PRODUCTS */
  g.section(
    '4. Products',
    'Each product has basics, an HTML description, one or more **variants** (each with its own price, compare-at price, SKU and stock), **images** and the **collections** it belongs to. Prices are whole rupees. A variant with **inventory 0** is sold as **Made to Order** (still purchasable). **Hot product** puts it in the home page “Hot Selling Products” row. **Draft** products are hidden from the store.',
  );
  type Variant = { title: string; sku: string; option1?: string; price: string; compareAt?: string; inventory: string };
  type Prod = { title: string; status?: string; type: string; tags: string; hot?: boolean; body: string; options?: string; variants: Variant[]; images: [string, string][]; collections: string[] };
  const products: Prod[] = [
    {
      title: 'Alexa Sofa Chair', type: 'Sofa Chair', tags: 'living, accent, velvet', hot: true,
      body: '<p>A plush accent chair with solid wood legs.</p>\n<ul><li>Fabric: premium velvet</li><li>Frame: kiln-dried wood</li><li>Size: 30" W x 32" D x 34" H</li></ul>',
      variants: [{ title: 'Default Title', sku: 'ALX-01', price: '45000', compareAt: '52000', inventory: '12' }],
      images: [['/images/products/alexa-sofa-chair-1.jpg', 'Alexa Sofa Chair front'], ['/images/products/alexa-sofa-chair-2.jpg', 'Alexa Sofa Chair side']],
      collections: ['Living Room', 'Sofas', 'Sale'],
    },
    {
      title: 'Antonin Sofa', type: 'Sofa', tags: 'living, sofa', hot: true,
      body: '<p>A modern sofa with deep seats and tapered brass-finish legs, available as a 3-seater or 2-seater.</p>',
      options: '[{"name":"Size","values":["3-Seater","2-Seater"]}]',
      variants: [
        { title: '3-Seater', sku: 'ANT-3', option1: '3-Seater', price: '120000', compareAt: '140000', inventory: '5' },
        { title: '2-Seater', sku: 'ANT-2', option1: '2-Seater', price: '85000', inventory: '8' },
      ],
      images: [['/images/products/antonin-sofa-1.jpg', 'Antonin Sofa'], ['/images/products/antonin-sofa-2.webp', 'Antonin Sofa detail'], ['/images/products/antonin-sofa-3.webp', 'Antonin Sofa side']],
      collections: ['Living Room', 'Sofas'],
    },
    {
      title: 'Antonin Center Table', type: 'Center Table', tags: 'living, table',
      body: '<p>Solid wood centre table that matches the Antonin sofa range.</p>',
      variants: [{ title: 'Default Title', sku: 'ANT-CT', price: '32000', inventory: '10' }],
      images: [['/images/products/antonin-center-table-1.jpg', 'Antonin Center Table'], ['/images/products/antonin-center-table-2.jpg', 'Antonin Center Table top']],
      collections: ['Living Room', 'Coffee Tables'],
    },
    {
      title: 'Alpen King Size Bed', type: 'Bed', tags: 'bedroom, bed, king', hot: true,
      body: '<p>Solid wood king size bed with an upholstered headboard.</p>\n<p><strong>Mattress size:</strong> 78" x 72"</p>',
      variants: [{ title: 'Default Title', sku: 'ALP-K', price: '150000', compareAt: '175000', inventory: '3' }],
      images: [['/images/products/alpen-bed-1.jpg', 'Alpen King Size Bed'], ['/images/products/alpen-bed-2.png', 'Alpen bed headboard']],
      collections: ['Bedroom', 'Beds'],
    },
    {
      title: 'Aura Bedside Table', type: 'Bedside Table', tags: 'bedroom, storage',
      body: '<p>Two-drawer bedside table with soft-close runners.</p>',
      variants: [{ title: 'Default Title', sku: 'AURA-BT', price: '18500', inventory: '20' }],
      images: [['/images/products/aura-bedside-table-1.jpg', 'Aura Bedside Table'], ['/images/products/aura-bedside-table-2.jpg', 'Aura Bedside Table open']],
      collections: ['Bedroom', 'Bedside Tables'],
    },
    {
      title: 'Aeon Manager Chair', type: 'Chair', tags: 'office, ergonomic',
      body: '<p>High-back manager chair with lumbar support and tilt lock.</p>',
      variants: [{ title: 'Black', sku: 'AEON-BLK', price: '38500', inventory: '0' }],
      images: [['/images/products/aeon-manager-chair-black-1.jpg', 'Aeon Manager Chair']],
      collections: ['Office Chairs'],
    },
    {
      title: 'Apex Manager Chair', type: 'Chair', tags: 'office, ergonomic, headrest',
      body: '<p>Mesh-back manager chair, available with or without a headrest.</p>',
      options: '[{"name":"Headrest","values":["With Headrest","Without Headrest"]}]',
      variants: [
        { title: 'With Headrest', sku: 'APX-HR', option1: 'With Headrest', price: '42000', compareAt: '48000', inventory: '6' },
        { title: 'Without Headrest', sku: 'APX-NO', option1: 'Without Headrest', price: '37000', compareAt: '42000', inventory: '9' },
      ],
      images: [['/images/products/apex-manager-chair-with-headrest-1.jpg', 'Apex chair with headrest'], ['/images/products/apex-manager-chair-without-headrest-1.jpg', 'Apex chair without headrest']],
      collections: ['Office Chairs'],
    },
    {
      title: 'Prototype Dining Table', status: 'Draft', type: 'Dining Table', tags: 'draft',
      body: '<p>Not ready for sale yet.</p>',
      variants: [{ title: 'Default Title', sku: 'PROTO-DT', price: '99000', inventory: '1' }],
      images: [['/images/products/arbour-dining-table-set-1.jpg', 'Prototype dining table']],
      collections: ['Living Room'],
    },
  ];

  g.part('4.1 What the browser checks before saving');
  await sidebar('Products');
  await g.click(admin.getByRole('link', { name: /new product/i }).first(), 'Click **+ New product**.');
  await g.form([{ label: 'Title', value: 'Test Without Price', locator: admin.getByLabel(/^Title/) }], 'Type only a title and leave the variant price empty:');
  await g.click(admin.getByRole('button', { name: 'Create product' }), 'Click **Create product**.');
  await expect(admin.getByLabel('Variant 1 price')).toHaveJSProperty('validity.valueMissing', true);
  g.expect('The form is **not** submitted: the browser highlights the empty **Price (PKR)** box ("Please fill out this field") and everything you typed is kept. Negative or non-numeric prices (e.g. `-500`) are blocked the same way.');
  await g.shot(admin, 'Missing price blocked by the browser', { highlight: admin.getByLabel('Variant 1 price') });

  for (const [i, p] of products.entries()) {
    g.part(`4.${i + 2} Create “${p.title}”${p.status === 'Draft' ? ' (draft)' : ''}`);
    await sidebar('Products');
    await g.click(admin.getByRole('link', { name: /new product/i }).first(), 'Click **+ New product**.');
    await g.form(
      [
        { label: 'Title', value: p.title, locator: admin.getByLabel(/^Title/) },
        { label: 'Status', value: p.status ?? 'Active (visible in store)', locator: admin.getByLabel('Status'), kind: 'select' },
        { label: 'Product type', value: p.type, locator: admin.getByLabel('Product type') },
        { label: 'Tags', value: p.tags, locator: admin.getByLabel('Tags') },
        { label: 'Hot product (shows the star badge)', value: p.hot ? '✓ checked' : '☐ unchecked', locator: admin.getByLabel(/Hot product/), kind: p.hot ? 'check' : 'uncheck' },
        { label: 'Description (HTML)', value: p.body, locator: admin.getByPlaceholder('<p>Product description in HTML…</p>') },
        ...(p.options ? [{ label: 'Options (JSON) — right column', value: p.options, locator: admin.locator('textarea[name="options"]') }] : []),
      ],
      '**Basics** (the Handle fills itself from the title):',
    );

    g.step(p.variants.length > 1 ? `**Variants** — the first row already exists; click **+ Add variant** for each extra row:` : '**Variants** — one row is already there:');
    g.text('\n   | # | Title | SKU | Option 1 | Price (PKR) | Compare at | Inventory |\n   |---|---|---|---|---|---|---|');
    for (const [vi, v] of p.variants.entries()) {
      const n = vi + 1;
      if (vi > 0) await admin.getByRole('button', { name: 'Add variant' }).click();
      await admin.getByLabel(`Variant ${n} title`).fill(v.title);
      await admin.getByLabel(`Variant ${n} SKU`).fill(v.sku);
      if (v.option1) await admin.getByLabel(`Variant ${n} option 1`).fill(v.option1);
      await admin.getByLabel(`Variant ${n} price`).fill(v.price);
      if (v.compareAt) await admin.getByLabel(`Variant ${n} compare-at price`).fill(v.compareAt);
      await admin.getByLabel(`Variant ${n} inventory`).fill(v.inventory);
      g.text(`   | ${n} | \`${v.title}\` | \`${v.sku}\` | ${v.option1 ? '`' + v.option1 + '`' : '—'} | \`${v.price}\` | ${v.compareAt ? '`' + v.compareAt + '`' : '—'} | \`${v.inventory}\` |`);
    }
    g.text('');

    g.step(
      p.images.length > 1
        ? '**Images** — click **Upload images**, select these files together (hold ⌘/Ctrl to pick several), then replace each row’s alt text:'
        : '**Images** — click **Upload images**, choose this file, then replace the alt text:',
    );
    g.text('\n   | # | File to choose | Alt text |\n   |---|---|---|');
    await chooseFiles(admin.getByRole('button', { name: 'Upload images' }), p.images.map(([src]) => samplePath(src)));
    await expect(admin.getByLabel(`Image ${p.images.length} source`)).toHaveValue(/^\/uploads\/products\//);
    for (const [ii, [src, alt]] of p.images.entries()) {
      await admin.getByLabel(`Image ${ii + 1} alt text`).fill(alt);
      g.text(`   | ${ii + 1} | \`${samplePath(src)}\` | \`${alt}\` |`);
    }
    g.text('');

    g.step(`**Collections** (right column) — tick: ${p.collections.map((c) => `**${c}**`).join(', ')}.`);
    for (const c of p.collections) await admin.getByRole('checkbox', { name: c, exact: true }).check();

    if (i === 1) {
      g.note('A product with options (here **Size**) needs the Options JSON plus one variant per value, with the value in **Option 1**. The storefront shows these as buttons.');
      await g.shot(admin, 'Product form with two variants, images and collections', { fullPage: true });
    }
    await save(admin, 'Create product');
    await expect(admin.getByText('Product saved successfully.')).toBeVisible();
    if (i === 0) {
      g.expect('"Product saved successfully." — you are now on the product’s edit page.');
      await g.shot(admin, 'Product saved');
    }
  }
  g.part('4.10 Check the product list');
  await sidebar('Products');
  await expect(admin.getByText('8 products in the catalog')).toBeVisible();
  g.expect('**8 products**. Hot products have a filled star, the Prototype Dining Table is **DRAFT**, and products with several variants show a price range (Antonin Sofa: Rs. 85,000 – Rs. 120,000).');
  await g.shot(admin, 'Product list', { fullPage: true });

  g.part('4.11 Edit a product');
  await g.click(admin.getByRole('row', { name: /Aura Bedside Table/ }).getByRole('link', { name: 'Edit' }), 'On the **Aura Bedside Table** row, click **Edit**.');
  await g.form([
    { label: 'Variant 1 → Price (PKR)', value: '17500', locator: admin.getByLabel('Variant 1 price') },
    { label: 'Variant 1 → Compare at', value: '19500', locator: admin.getByLabel('Variant 1 compare-at price') },
  ], 'Put it on offer:');
  await save(admin, 'Save product');
  await expect(admin.getByText('Product saved successfully.')).toBeVisible();
  await admin.reload();
  await expect(admin.getByLabel('Variant 1 price')).toHaveValue('17500');
  g.expect('Saved; after a reload the price is 17500 and compare-at 19500. The storefront will show **Rs. 17,500**, a struck-through **Rs. 19,500** and a **-10% OFF** badge.');

  g.part('4.12 Product counts on collections');
  await sidebar('Collections');
  await expect(admin.getByRole('row', { name: /^Living Room/ })).toContainText('4');
  g.expect('Living Room 4 (incl. the draft), Sofas 2, Coffee Tables 1, Bedroom 2, Beds 1, Bedside Tables 1, Office Chairs 2, Sale 1.');
  await g.shot(admin, 'Collections with product counts', { fullPage: true });

  /* ================================================================ 5. BANNERS */
  g.section(
    '5. Banners',
    'Banners appear on the home page. **Home — Hero slider** banners rotate at the top; **Promo strip 1** sits under the trust strip and **Promo strip 2** under the rating banner. Inactive banners are hidden.',
  );
  type Ban = { title: string; subtitle: string; cta: string; href: string; image: string; mobile?: string; location: string; position: string; overlay: string; active: boolean };
  const banners: Ban[] = [
    { title: 'Winter Living Sale', subtitle: 'Up to 20% off sofas and accent chairs', cta: 'Shop Living Room', href: '/collections/living-room', image: '/images/collections/living.jpg', mobile: '/images/products/antonin-sofa-1.jpg', location: 'Home — Hero slider', position: '0', overlay: '45', active: true },
    { title: 'Sleep Like Royalty', subtitle: 'King size beds, crafted in solid wood', cta: 'Shop Bedroom', href: '/collections/bedroom', image: '/images/collections/bedroom.jpg', location: 'Home — Hero slider', position: '1', overlay: '45', active: true },
    { title: 'Coming Soon: Dining', subtitle: 'Hidden until it is activated', cta: 'Preview', href: '/', image: '/images/collections/dining.jpg', location: 'Home — Hero slider', position: '2', overlay: '20', active: false },
    { title: 'Office Upgrade', subtitle: 'Ergonomic chairs for long workdays', cta: 'Shop Office Chairs', href: '/collections/office-chairs', image: '/images/products/apex-manager-chair-with-headrest-1.jpg', location: 'Home — Promo strip 1', position: '0', overlay: '50', active: true },
    { title: 'Free Delivery Over Rs. 100,000', subtitle: 'Delivery & installation included on bigger orders', cta: 'Browse All', href: '/collections/all', image: '/images/collections/furniture.jpg', location: 'Home — Promo strip 2', position: '0', overlay: '65', active: true },
  ];
  for (const [i, b] of banners.entries()) {
    g.part(`5.${i + 1} Banner “${b.title}”${b.active ? '' : ' (inactive)'}`);
    await sidebar('Banners');
    const form = admin.locator('form').filter({ has: admin.getByRole('button', { name: 'Create banner' }) });
    await g.form(
      [
        { label: 'Headline', value: b.title, locator: form.getByLabel('Headline') },
        { label: 'Subtitle', value: b.subtitle, locator: form.getByLabel('Subtitle') },
        { label: 'CTA label', value: b.cta, locator: form.getByLabel('CTA label') },
        { label: 'CTA link', value: b.href, locator: form.getByLabel('CTA link') },
        { label: 'Desktop image', value: b.image, kind: 'upload', button: 'Upload image', locator: form.getByRole('button', { name: 'Desktop image URL preview — click or drop to upload' }), uploadedInto: form.getByLabel('Desktop image URL', { exact: true }) },
        ...(b.mobile
          ? [{ label: 'Mobile image', value: b.mobile, kind: 'upload' as const, button: 'Upload image', locator: form.getByRole('button', { name: 'Mobile image URL preview — click or drop to upload' }), uploadedInto: form.getByLabel('Mobile image URL', { exact: true }) }]
          : [{ label: 'Mobile image', value: '', locator: form.getByLabel('Mobile image URL', { exact: true }), kind: 'none' as const }]),
        { label: 'Location', value: b.location, locator: form.getByLabel('Location'), kind: 'select' },
        { label: 'Position', value: b.position, locator: form.getByLabel('Position') },
        { label: 'Text colour', value: '#ffffff (default, leave as is)', locator: form.getByLabel('Text colour'), kind: 'none' },
        { label: 'Overlay', value: b.overlay, locator: form.getByLabel('Overlay') },
        { label: 'Active (visible on the storefront)', value: b.active ? '✓ checked' : '☐ unchecked', locator: form.getByLabel(/^Active/), kind: b.active ? 'check' : 'uncheck' },
      ],
      'Use the **Add a banner** form at the top of the page:',
    );
    if (i === 0) {
      g.note('**Overlay** darkens the left side of the image behind the white text (0–90%). Use a higher value on light photos, otherwise the headline is hard to read.');
      await g.shot(admin, 'Add a banner form filled in', { fullPage: true });
    }
    await save(admin, 'Create banner');
    await expect(admin.getByText('Banner saved. Storefront updated.')).toBeVisible();
  }
  g.expect('"Banner saved. Storefront updated." after each. Below the form, banners are grouped by location: **Hero slider (3)** with one marked **Inactive**, **Promo strip 1 (1)**, **Promo strip 2 (1)**. Each has Deactivate/Delete buttons and an inline edit form.');
  await g.shot(admin, 'Banners grouped by location', { fullPage: true });

  /* ================================================================ 6. MENUS */
  g.section(
    '6. Menus',
    'Five menus: **Main navigation** (the dark bar under the logo; items can have one level of children that open as a dropdown), **Top bar** (small links top-right) and **Footer — column 1/2/3**. Pick the menu with the pill tabs, then add links with the form.',
  );
  type Item = { label: string; href: string; badge?: string; position: string; parent?: string; enabled?: boolean };
  const menus: [string, string, Item[]][] = [
    ['Main navigation', 'Main navigation', [
      { label: 'Living Room', href: '/collections/living-room', position: '0' },
      { label: 'Sofas', href: '/collections/sofas', position: '0', parent: 'Living Room' },
      { label: 'Coffee Tables', href: '/collections/coffee-tables', position: '1', parent: 'Living Room' },
      { label: 'Bedroom', href: '/collections/bedroom', position: '1' },
      { label: 'Beds', href: '/collections/beds', position: '0', parent: 'Bedroom' },
      { label: 'Bedside Tables', href: '/collections/bedside-tables', position: '1', parent: 'Bedroom' },
      { label: 'Office', href: '/collections/office-chairs', position: '2', badge: 'NEW' },
      { label: 'All Products', href: '/collections/all', position: '3' },
      { label: 'Sale', href: '/collections/sale', position: '4', badge: 'SALE' },
      { label: 'Clearance', href: '/collections/sale', position: '5', enabled: false },
    ]],
    ['Top bar', 'Top bar', [
      { label: 'Track Order', href: '/track', position: '0' },
      { label: 'Contact Us', href: '/pages/contact', position: '1' },
    ]],
    ['Footer — column 1', 'Footer column 1 (“About”)', [
      { label: 'About Us', href: '/pages/about-us', position: '0' },
      { label: 'Blog', href: '/blogs', position: '1' },
      { label: 'Contact Us', href: '/pages/contact', position: '2' },
    ]],
    ['Footer — column 2', 'Footer column 2 (“Customer Support”)', [
      { label: 'FAQs', href: '/pages/faqs', position: '0' },
      { label: 'Shipping & Delivery', href: '/pages/shipping-delivery', position: '1' },
      { label: 'Returns & Exchanges', href: '/pages/returns-exchanges', position: '2' },
      { label: 'Privacy Policy', href: '/pages/privacy-policy', position: '3' },
      { label: 'Terms & Conditions', href: '/pages/terms-conditions', position: '4' },
      { label: 'Track Your Order', href: '/track', position: '5' },
    ]],
    ['Footer — column 3', 'Footer column 3 (“Shop”)', [
      { label: 'Sofas', href: '/collections/sofas', position: '0' },
      { label: 'Beds', href: '/collections/beds', position: '1' },
      { label: 'Office Chairs', href: '/collections/office-chairs', position: '2' },
      { label: 'Sale', href: '/collections/sale', position: '3' },
    ]],
  ];
  for (const [mi, [tab, title, items]] of menus.entries()) {
    g.part(`6.${mi + 1} ${title}`);
    await sidebar('Menus');
    await g.click(admin.getByRole('link', { name: new RegExp(`^${tab}`) }), `Click the **${tab}** tab.`);
    await admin.waitForLoadState('networkidle');
    g.step('Add each link below with the **Add a link** form (fill the row, click **+ Add item**, repeat). Leave Badge empty and Parent as "— Top level —" unless listed:');
    g.text('\n   | Label | Link | Badge | Position | Parent | Enabled |\n   |---|---|---|---|---|---|');
    for (const it of items) {
      const form = admin.locator('form').filter({ has: admin.getByRole('button', { name: 'Add item' }) });
      await form.getByLabel('Label').fill(it.label);
      await form.getByLabel('Link').fill(it.href);
      await form.getByLabel('Badge').fill(it.badge ?? '');
      await form.getByLabel('Position').fill(it.position);
      await form.getByLabel('Parent').selectOption({ label: it.parent ?? '— Top level —' });
      await form.getByLabel(/^Enabled/).setChecked(it.enabled ?? true);
      const done = admin.waitForResponse((r) => r.request().method() === 'POST');
      await form.getByRole('button', { name: 'Add item' }).click();
      await done;
      await admin.waitForLoadState('networkidle');
      // React clears the form once the save completes; wait for that before typing the next link.
      await expect(form.getByLabel('Label')).toHaveValue('');
      await expect(admin.getByText('Menu saved. Storefront navigation updated.')).toBeVisible();
      g.text(`   | \`${it.label}\` | \`${it.href}\` | ${it.badge ? '`' + it.badge + '`' : '—'} | \`${it.position}\` | ${it.parent ?? '— Top level —'} | ${it.enabled === false ? '☐ **unchecked**' : '✓'} |`);
    }
    g.text('');
    if (mi === 0) {
      g.note('“Clearance” is added **disabled** on purpose — it must not appear on the storefront.');
      await g.shot(admin, 'Main navigation menu tree', { fullPage: true });
    }
  }

  /* ================================================================ 7. PAGES */
  g.section(
    '7. Pages and blog posts',
    'Pages are rich HTML content served at `/pages/<handle>`. The page with handle **contact** automatically gets the contact form underneath. Ticking **Blog post** publishes it in the blog at `/blogs/news/<handle>` instead. Unpublished pages return 404.',
  );
  type Pg = { title: string; handle?: string; body: string; photo?: string; seoTitle?: string; seoDesc?: string; published?: boolean; blog?: boolean };
  const pages: Pg[] = [
    { title: 'About Us', handle: 'about-us', photo: '/images/collections/living.jpg', seoTitle: 'About Interwood — Pakistan’s Largest Furniture Manufacturer', seoDesc: 'Our story: crafting furniture in Pakistan since 1974.', body: '<h2>Crafted in Pakistan since 1974</h2>\n<p>Interwood designs and manufactures furniture for homes and offices across Pakistan.</p>\n<h2>Our promise</h2>\n<ul><li>Solid, kiln-dried wood</li><li>Free delivery &amp; installation on orders over Rs. 100,000</li><li>1-year manufacturing warranty</li></ul>' },
    { title: 'Contact', handle: 'contact', body: '<p>Call <strong>+92-42-111-203-203</strong> (Mon–Sat, 9am–9pm) or send us a message using the form below.</p>' },
    { title: 'Privacy Policy', body: '<h2>Information we collect</h2>\n<p>We collect your name, phone number, email and delivery address to process your order.</p>\n<h2>How we use it</h2>\n<p>Only to confirm, deliver and support your order. We never sell your data.</p>\n<h2>Contact</h2>\n<p>Questions? Email info@interwood.pk.</p>' },
    { title: 'Terms & Conditions', handle: 'terms-conditions', body: '<h2>Orders</h2>\n<p>All orders are confirmed by phone before production.</p>\n<h2>Pricing</h2>\n<p>Prices are in Pakistani Rupees and include sales tax.</p>' },
    { title: 'Shipping & Delivery', handle: 'shipping-delivery', body: '<h2>Delivery charges</h2>\n<p>Free delivery &amp; installation on orders of Rs. 100,000 or more. A flat Rs. 2,500 applies below that.</p>\n<h2>Timelines</h2>\n<p>Ready-to-ship items: 5–7 working days. Made-to-order items: 3–4 weeks.</p>' },
    { title: 'Returns & Exchanges', handle: 'returns-exchanges', body: '<p>Report any damage within 48 hours of delivery and we will repair or replace the item.</p>' },
    { title: 'FAQs', handle: 'faqs', body: '<h2>Do you deliver nationwide?</h2>\n<p>Yes, to every city in Pakistan.</p>\n<h2>Can I pay cash on delivery?</h2>\n<p>Yes — COD, bank transfer, card and installments are available.</p>' },
    { title: 'Careers', handle: 'careers', body: '<p>Draft — job openings coming soon.</p>', published: false },
    { title: 'How to Choose the Right Sofa', blog: true, body: '<p>Measure your room first, then think about seating capacity, fabric and frame.</p>\n<h2>1. Measure twice</h2>\n<p>Leave at least 18 inches between the sofa and the coffee table.</p>\n<h2>2. Pick a durable fabric</h2>\n<p>Velvet and tightly woven fabrics last longest in busy homes.</p>' },
    { title: 'Bedroom Ideas for Small Spaces', blog: true, body: '<p>A king bed can work in a small room — keep side tables slim and use wall-mounted lighting.</p>' },
  ];
  for (const [i, p] of pages.entries()) {
    g.part(`7.${i + 1} ${p.blog ? 'Blog post' : 'Page'} “${p.title}”${p.published === false ? ' (unpublished)' : ''}`);
    await sidebar('Pages');
    await g.click(admin.getByRole('link', { name: 'New page' }), 'Click **New page**.');
    await g.form([
      { label: 'Title', value: p.title, locator: admin.getByLabel('Title', { exact: true }) },
      { label: 'Handle', value: p.handle ?? '', locator: admin.getByLabel('Handle') },
      { label: 'Body (HTML)', value: p.body, locator: admin.getByLabel('Body (HTML)') },
      { label: 'SEO title', value: p.seoTitle ?? '', locator: admin.getByLabel('SEO title') },
      { label: 'SEO description', value: p.seoDesc ?? '', locator: admin.getByLabel('SEO description') },
      { label: 'Published', value: p.published === false ? '☐ unchecked' : '✓ checked', locator: admin.getByLabel('Published'), kind: p.published === false ? 'uncheck' : 'check' },
      { label: 'Blog post', value: p.blog ? '✓ checked' : '☐ unchecked', locator: admin.getByLabel('Blog post'), kind: p.blog ? 'check' : 'uncheck' },
    ]);
    if (p.photo) {
      g.step(`Click at the very end of the **Body (HTML)** text, then click **Insert image** (under the body box) and choose \`${samplePath(p.photo)}\`.`);
      await admin.getByLabel('Body (HTML)').press('ControlOrMeta+End');
      await chooseFiles(admin.getByRole('button', { name: 'Insert image' }), [samplePath(p.photo)]);
      await expect(admin.getByLabel('Body (HTML)')).toHaveValue(/<img src="\/uploads\/pages\/[^"]+" alt="Living"[^>]*\/>$/);
      g.expect('The photo is uploaded and an `<img src="/uploads/pages/…webp" alt="Living" …/>` tag appears at the cursor. You can edit its `alt` text right in the HTML.');
    }
    if (i === 0) await g.shot(admin, 'New page form filled in', { fullPage: true });
    await save(admin, 'Create page');
    await expect(admin.getByRole('heading', { level: 1 })).toContainText(p.title);
    if (i === 0) {
      g.expect('The page is created and its edit screen shows the public URL (here `/pages/about-us`).');
      await g.shot(admin, 'Page saved with its public URL');
    }
  }
  g.part('7.11 Check the page list');
  await sidebar('Pages');
  g.expect('10 rows. Each shows its public URL, type (Page / Blog post) and status. Careers is **Draft**; Privacy Policy got the handle `privacy-policy` automatically.');
  await expect(admin.getByRole('row', { name: /Careers/ })).toContainText(/draft/i);
  await g.shot(admin, 'Pages list', { fullPage: true });

  /* ================================================================ 8. STOREFRONT */
  g.section(
    '8. Shopping as a customer',
    'Use a **different browser or a private window** for this part so you are not logged in as admin (the cart is stored in the browser).',
  );
  g.part('8.1 Home page');
  await g.goto(shopper, '/', 'Open `http://localhost:3000/`.');
  const hero = shopper.getByRole('region', { name: 'Featured promotions' });
  await expect(hero.getByRole('heading', { name: 'Winter Living Sale' })).toBeVisible();
  await expect(hero.getByRole('button', { name: /Go to slide/ })).toHaveCount(2);
  await expect(shopper.getByText('Office Upgrade')).toBeVisible();
  await expect(shopper.getByRole('region', { name: 'Hot selling products' }).getByRole('link', { name: 'Aura Bedside Table', exact: true })).toHaveCount(0);
  g.expect(`From top to bottom:
   - announcement bar, header with the **main navigation** (Living Room ▾, Bedroom ▾, Office **NEW**, All Products, Sale **SALE** — no “Clearance”);
   - **hero slider** with 2 slides (the inactive “Coming Soon: Dining” is hidden);
   - **Office Upgrade** promo strip;
   - **Hot Selling Products**: only Alexa Sofa Chair, Antonin Sofa and Alpen King Size Bed (the hot ones);
   - **Shop by Category** tiles: Living Room, Sofas, Bedroom, Office Chairs (the featured collections);
   - rating banner **4.8 out of 5 (1,200+ happy customers)**, then the **Free Delivery Over Rs. 100,000** promo strip;
   - one product row per featured collection; the draft product never appears.`);
  await g.shot(shopper, 'Home page built entirely from the admin', { fullPage: true });
  await g.click(hero.getByRole('button', { name: 'Next slide' }), 'In the hero, click the **›** arrow.');
  await expect(hero.getByRole('heading', { name: 'Sleep Like Royalty' })).toBeVisible();
  g.expect('The slide changes to **Sleep Like Royalty** (slides also auto-rotate every 5 seconds).');
  await g.shot(shopper, 'Second hero slide');

  g.part('8.2 Navigation dropdown');
  const nav = shopper.locator('header').first();
  g.step('Hover **Living Room** in the dark navigation bar.');
  await nav.getByRole('link', { name: /^Living Room/ }).first().hover();
  await expect(nav.getByRole('link', { name: 'Coffee Tables', exact: true }).first()).toBeVisible();
  g.expect('A dropdown shows **Sofas** and **Coffee Tables**.');
  await g.shot(shopper, 'Main navigation dropdown', { highlight: nav.getByRole('link', { name: 'Coffee Tables', exact: true }).first() });
  await g.click(nav.getByRole('link', { name: 'Sofas', exact: true }).first(), 'Click **Sofas**.');
  await expect(shopper).toHaveURL(/\/collections\/sofas$/);
  await shopper.waitForLoadState('networkidle');
  g.expect('The **Sofas** collection: breadcrumb, title, description, a Filter & Sort bar and 2 products (Alexa Sofa Chair, Antonin Sofa). The Antonin card shows **Rs. 85,000** (cheapest size) with no discount badge, because the 2-Seater has no compare-at price.');
  await g.shot(shopper, 'Sofas collection page', { fullPage: true });

  g.part('8.3 Sort and filter');
  await g.goto(shopper, '/collections/all', 'Click **All Products** in the navigation.');
  await expect(shopper.getByRole('link', { name: 'Prototype Dining Table' })).toHaveCount(0);
  await g.click(shopper.getByLabel('Sort by'), 'Open **Sort by** and choose **Price: Low to High**.');
  await shopper.getByLabel('Sort by').selectOption({ label: 'Price: Low to High' });
  await shopper.waitForURL(/sort=price-asc/);
  await shopper.waitForLoadState('networkidle');
  g.expect('7 products (not the draft), cheapest first: Aura Bedside Table (Rs. 17,500), Antonin Center Table (Rs. 32,000), Apex Manager Chair (Rs. 37,000)… Alpen King Size Bed (Rs. 150,000) last. Aeon Manager Chair carries a **Made to Order** badge.');
  await g.shot(shopper, 'All products sorted by price', { fullPage: true });
  await g.form([
    { label: 'Price — Min', value: '30000', locator: shopper.getByLabel('Minimum price in rupees') },
    { label: 'Price — Max', value: '50000', locator: shopper.getByLabel('Maximum price in rupees') },
  ], 'In the filter bar, enter a price range:');
  await g.click(shopper.getByRole('button', { name: 'Apply' }).or(shopper.locator('form').getByRole('button', { name: /apply|filter/i })).first(), 'Click **Apply**.');
  await shopper.waitForURL(/min=30000/);
  await shopper.waitForLoadState('networkidle');
  await expect(shopper.getByRole('link', { name: 'Alpen King Size Bed', exact: true })).toHaveCount(0);
  g.expect('Only products with a price between Rs. 30,000 and Rs. 50,000: Alexa Sofa Chair, Antonin Center Table, Aeon Manager Chair, Apex Manager Chair.');
  await g.shot(shopper, 'Price filter applied', { fullPage: true });

  g.part('8.4 Search');
  const box = nav.getByPlaceholder(/search/i).first();
  await g.form([{ label: 'Search box (header)', value: 'chair', locator: box }], 'Type in the header search box:');
  g.step('Press **Enter**.');
  await box.press('Enter');
  await expect(shopper).toHaveURL(/\/search\?q=chair/);
  await shopper.waitForLoadState('networkidle');
  g.expect('Results for “chair”: Alexa Sofa Chair, Aeon Manager Chair, Apex Manager Chair.');
  await g.shot(shopper, 'Search results for chair', { fullPage: true });

  g.part('8.5 Product page');
  await g.goto(shopper, '/products/antonin-sofa', 'Open the **Antonin Sofa** (click it in any listing).');
  await expect(shopper).toHaveTitle('Antonin Sofa | Interwood');
  g.expect('Gallery with 3 images and thumbnails; title, “No reviews yet” link, price **Rs. 120,000** with **Rs. 140,000** struck through and **-14% OFF**; SKU **ANT-3**, **In Stock — Only 5 left**; Size buttons; quantity; **Add to Cart** / **Buy Now**; Description / Delivery & Returns / Warranty accordions; Customer Reviews; “You May Also Like”. The browser tab reads “Antonin Sofa | Interwood”.');
  await g.shot(shopper, 'Antonin Sofa product page', { fullPage: true });
  await g.click(shopper.getByRole('button', { name: '2-Seater' }), 'Click the **2-Seater** size button.');
  await expect(shopper.getByText('SKU: ANT-2')).toBeVisible();
  g.expect('Price changes to **Rs. 85,000** with no discount, SKU **ANT-2**, “Only 8 left”.');
  await g.shot(shopper, 'Variant switched to 2-Seater', { highlight: shopper.getByText('Rs. 85,000').first() });
  await g.click(shopper.getByRole('tab', { name: 'View image 2' }), 'Click the second thumbnail under the main image.');
  g.expect('The main image switches (hover the main image on desktop to zoom).');

  await g.goto(shopper, '/products/aeon-manager-chair', 'Open **Aeon Manager Chair**.');
  await expect(shopper.getByText('Made to Order').first()).toBeVisible();
  g.expect('Stock shows **Made to Order** (inventory 0) and it can still be added to the cart.');
  await g.shot(shopper, 'Made to Order product', { highlight: shopper.getByText('Made to Order').first() });

  g.part('8.6 Cart');
  await g.goto(shopper, '/products/alexa-sofa-chair', 'Open **Alexa Sofa Chair**.');
  await g.click(shopper.getByRole('button', { name: 'Increase quantity' }), 'Click **+** once (quantity 2).');
  await g.click(shopper.getByRole('button', { name: 'Add to Cart' }).first(), 'Click **Add to Cart**.');
  await expect(nav.getByText('2', { exact: true })).toBeVisible();
  g.expect('The cart icon in the header shows **2**.');
  await g.shot(shopper, 'Cart badge after adding to cart', { highlight: nav.getByRole('link', { name: 'Cart' }) });
  await g.goto(shopper, '/products/antonin-sofa', 'Open **Antonin Sofa**.');
  await g.click(shopper.getByRole('button', { name: '2-Seater' }), 'Choose **2-Seater**.');
  await g.click(shopper.getByRole('button', { name: 'Add to Cart' }).first(), 'Click **Add to Cart**.');
  await g.goto(shopper, '/collections/bedside-tables', 'Open **Bedroom ▸ Bedside Tables**.');
  await g.click(shopper.getByRole('button', { name: 'Add to Cart' }).first(), 'On the **Aura Bedside Table** card, click **Add to Cart** (quick add, without opening the product).');
  await g.goto(shopper, '/cart', 'Click the **cart icon** in the header.');
  await expect(shopper.getByText('Rs. 192,500').first()).toBeVisible();
  g.expect('3 lines: Alexa Sofa Chair ×2 (Rs. 90,000), Antonin Sofa **2-Seater** ×1 (Rs. 85,000), Aura Bedside Table ×1 (Rs. 17,500). Subtotal **Rs. 192,500**, “You save” shows the discount, **Delivery & Installation: FREE** (over Rs. 100,000).');
  await g.shot(shopper, 'Cart with three products', { fullPage: true });
  await g.click(shopper.getByRole('button', { name: 'Remove Aura Bedside Table from cart' }), 'Click the trash icon on **Aura Bedside Table**.');
  await expect(shopper.getByText('Rs. 175,000').first()).toBeVisible();
  g.expect('The line disappears and the subtotal becomes **Rs. 175,000**. (The − / + buttons change quantities the same way.)');

  g.part('8.7 Checkout — validation');
  await g.click(shopper.getByRole('link', { name: 'Proceed to checkout' }), 'Click **Checkout**.');
  await expect(shopper).toHaveURL(/\/checkout$/);
  await g.click(shopper.getByRole('button', { name: /Place Order/ }), 'Without filling anything, click **Place Order (Cash on Delivery)**.');
  await expect(shopper.getByText('Please correct the highlighted fields below.')).toBeVisible();
  g.expect('Nothing is submitted. Required fields turn red with messages, and the summary shows “Please correct the highlighted fields below.”');
  await g.shot(shopper, 'Checkout validation errors', { fullPage: true });
  await g.form([{ label: 'Phone', value: '12345', locator: shopper.getByLabel(/^Phone/) }], 'Type an invalid phone:');
  await g.click(shopper.getByRole('button', { name: /Place Order/ }), 'Click **Place Order** again.');
  await expect(shopper.getByText(/Enter a valid Pakistani mobile number/)).toBeVisible();
  g.expect('“Enter a valid Pakistani mobile number, e.g. 0300 1234567 or +923001234567.”');

  g.part('8.8 Order 1 — cash on delivery, free delivery');
  await g.form([
    { label: 'Full Name', value: 'Ayesha Khan', locator: shopper.getByLabel(/Full Name/) },
    { label: 'Phone', value: '0300 1234567', locator: shopper.getByLabel(/^Phone/) },
    { label: 'Email (optional)', value: 'ayesha@example.com', locator: shopper.getByLabel(/^Email/) },
    { label: 'Complete Address', value: 'House 12, Street 4, DHA Phase 5', locator: shopper.getByLabel(/Complete Address/) },
    { label: 'City', value: 'Lahore', locator: shopper.getByLabel(/^City/), kind: 'select' },
    { label: 'Province', value: 'Punjab', locator: shopper.getByLabel(/^Province/), kind: 'select' },
    { label: 'Order Notes (optional)', value: 'Please call before delivery.', locator: shopper.getByLabel(/Order Notes/) },
  ]);
  g.step('Leave the payment method on **Cash on Delivery**.');
  g.expect('Order Summary: Alexa Sofa Chair ×2, Antonin Sofa 2-Seater ×1, Subtotal Rs. 175,000, Delivery & Installation **FREE**, Total **Rs. 175,000**.');
  await g.shot(shopper, 'Checkout filled in, free delivery', { fullPage: true });
  await g.click(shopper.getByRole('button', { name: /Place Order/ }), 'Click **Place Order (Cash on Delivery)**.');
  await expect(shopper).toHaveURL(/\/checkout\/success\?order=IW-\d+/);
  const order1 = new URL(shopper.url()).searchParams.get('order')!;
  await shopper.waitForLoadState('networkidle');
  g.expect(`The **Thank You!** page with order number **${order1}** and the next steps. The cart icon is empty again.`);
  await g.shot(shopper, 'Order confirmation page');

  g.part('8.9 Order 2 — bank transfer, below the free-delivery threshold');
  await g.goto(shopper, '/products/apex-manager-chair', 'Open **Apex Manager Chair**.');
  await g.click(shopper.getByRole('button', { name: 'Without Headrest' }), 'Choose **Without Headrest** (Rs. 37,000).');
  await g.click(shopper.getByRole('button', { name: 'Add to Cart' }).first(), 'Click **Add to Cart**.');
  await g.goto(shopper, '/checkout', 'Open the cart and click **Checkout**.');
  await expect(shopper.getByText('Rs. 2,500').first()).toBeVisible();
  await expect(shopper.getByText('Rs. 39,500').first()).toBeVisible();
  g.expect('Subtotal Rs. 37,000, Delivery & Installation **Rs. 2,500**, Total **Rs. 39,500**, and the hint “Add Rs. 63,000 more for free delivery & installation.”');
  await g.shot(shopper, 'Delivery fee applied below the threshold', { highlight: shopper.getByText('Rs. 2,500').first() });
  await g.form([
    { label: 'Full Name', value: 'Bilal Ahmed', locator: shopper.getByLabel(/Full Name/) },
    { label: 'Phone', value: '03211234567', locator: shopper.getByLabel(/^Phone/) },
    { label: 'Email (optional)', value: '', locator: shopper.getByLabel(/^Email/) },
    { label: 'Complete Address', value: 'Flat 3, Block B, Gulshan-e-Iqbal', locator: shopper.getByLabel(/Complete Address/) },
    { label: 'City', value: 'Karachi', locator: shopper.getByLabel(/^City/), kind: 'select' },
    { label: 'Province', value: 'Sindh', locator: shopper.getByLabel(/^Province/), kind: 'select' },
  ]);
  await g.click(shopper.getByText('Bank Transfer').first(), 'Under payment, choose **Bank Transfer**.');
  await g.click(shopper.getByRole('button', { name: /Place Order/ }), 'Click **Place Order**.');
  await expect(shopper).toHaveURL(/\/checkout\/success\?order=IW-\d+/);
  const order2 = new URL(shopper.url()).searchParams.get('order')!;
  g.expect(`Confirmation page for order **${order2}**.`);

  g.part('8.10 Track an order');
  await g.goto(shopper, '/track', 'Click **Track Order** in the top bar.');
  await g.form([
    { label: 'Order Number', value: order1, locator: shopper.getByLabel('Order Number') },
    { label: 'Phone Number', value: '03009999999', locator: shopper.getByLabel('Phone Number') },
  ], 'Try a **wrong phone number** first:');
  await g.click(shopper.getByRole('button', { name: 'Track Order' }), 'Click **Track Order**.');
  await expect(shopper.getByText(/not found|couldn.t find|no order/i).first()).toBeVisible();
  g.expect('“No order found for these details. Please check your order number and phone number.” — an order is only shown when the number and phone match.');
  await g.form([{ label: 'Phone Number', value: '0300 1234567', locator: shopper.getByLabel('Phone Number') }], 'Correct the phone:');
  await g.click(shopper.getByRole('button', { name: 'Track Order' }), 'Click **Track Order**.');
  await expect(shopper.getByText('Order Placed').first()).toBeVisible();
  g.expect('The order with a status timeline at **Order Placed** (Order Confirmed → In Production → Shipped → Delivered & Installed are still ahead).');
  await g.shot(shopper, 'Order tracking — order placed', { fullPage: true });

  g.part('8.11 Contact form and newsletter');
  await g.click(nav.getByRole('link', { name: 'Contact Us' }).first(), 'Click **Contact Us** in the top bar.');
  await expect(shopper).toHaveURL(/\/pages\/contact$/);
  await g.form([
    { label: 'Full Name', value: 'Hamza Ali', locator: shopper.getByLabel(/Full Name/) },
    { label: 'Email Address', value: 'hamza@example.com', locator: shopper.getByLabel(/Email Address/) },
    { label: 'Phone Number', value: '03331234567', locator: shopper.getByLabel(/Phone Number/) },
    { label: 'Subject', value: 'Sales', locator: shopper.getByLabel(/Subject/), kind: 'select' },
    { label: 'Message', value: 'Do you make wardrobes in custom sizes? I need a 7ft one.', locator: shopper.getByRole('textbox', { name: /^Message/ }) },
  ], 'Below the page text, fill in **Send Us a Message**:');
  await g.shot(shopper, 'Contact page with the form filled in', { fullPage: true });
  await g.click(shopper.getByRole('button', { name: /send/i }), 'Click **Send Message**.');
  await expect(shopper.getByText('Thank you, your message is on its way!')).toBeVisible();
  g.expect('“Thank you, your message is on its way!”');
  const footer = shopper.locator('footer');
  await g.form([{ label: 'Newsletter — Your email address (footer)', value: 'sara@example.com', locator: footer.getByPlaceholder('Your email address') }], 'Scroll to the footer newsletter box:');
  await g.click(footer.getByRole('button', { name: 'Subscribe' }), 'Click **Subscribe**.');
  await expect(footer.getByText('Subscribed!')).toBeVisible();
  g.expect('“Subscribed!” — the sign-up arrives in the admin **Messages** inbox.');

  g.part('8.12 Write a product review');
  await g.goto(shopper, '/products/alexa-sofa-chair', 'Open **Alexa Sofa Chair** and scroll to **Customer Reviews**.');
  await g.click(shopper.getByRole('button', { name: 'Write a Review' }), 'Click **Write a Review**.');
  await g.click(shopper.getByRole('button', { name: '4 stars' }), 'Click the **4th star**.');
  await g.form([
    { label: 'Your name', value: 'Sana Malik', locator: shopper.getByLabel(/Your name/) },
    { label: 'Title', value: 'Comfy and well made', locator: shopper.getByLabel('Title') },
    { label: 'Your review', value: 'Very comfortable chair, the velvet feels premium and delivery was quick.', locator: shopper.getByLabel(/Your review/) },
  ]);
  await g.shot(shopper, 'Review form filled in', { highlight: shopper.locator('form').filter({ hasText: 'Write a Review' }) });
  await g.click(shopper.getByRole('button', { name: 'Submit Review' }), 'Click **Submit Review**.');
  await expect(shopper.getByText(/will appear once it.s approved/)).toBeVisible();
  g.expect('“Thank you! Your review has been submitted and will appear once it’s approved.” Reload — the review is **not** shown yet.');

  g.part('8.13 Content pages, blog and 404');
  await g.click(footer.getByRole('link', { name: 'Privacy Policy', exact: true }), 'In the footer (Customer Support), click **Privacy Policy**.');
  await expect(shopper.getByRole('heading', { name: 'Information we collect' })).toBeVisible();
  await shopper.waitForLoadState('networkidle');
  g.expect('`/pages/privacy-policy` with breadcrumb, title and formatted headings. The same works for FAQs, Shipping & Delivery, Returns & Exchanges, Terms & Conditions and About Us.');
  await g.shot(shopper, 'Privacy Policy page', { fullPage: true });
  await g.goto(shopper, '/pages/careers', 'Open the unpublished page: `http://localhost:3000/pages/careers`.');
  await expect(shopper.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  g.expect('The **404 – Page not found** page with a search box and helpful links.');
  await g.shot(shopper, '404 page for an unpublished page');
  await g.click(shopper.locator('footer').getByRole('link', { name: 'Blog', exact: true }), 'In the footer (About), click **Blog**.');
  await expect(shopper).toHaveURL(/\/blogs$/);
  await shopper.waitForLoadState('networkidle');
  g.expect('**News & Stories** listing both posts, newest first.');
  await g.shot(shopper, 'Blog listing', { fullPage: true });
  await g.click(shopper.getByRole('link', { name: /How to Choose the Right Sofa/ }).first(), 'Click **How to Choose the Right Sofa**.');
  await expect(shopper.getByRole('heading', { level: 1, name: 'How to Choose the Right Sofa' })).toBeVisible();
  await shopper.waitForLoadState('networkidle');
  g.expect('The full article at `/blogs/news/how-to-choose-the-right-sofa`.');
  await g.shot(shopper, 'Blog post', { fullPage: true });

  /* ================================================================ 9. ADMIN OPERATIONS */
  g.section('9. Running the store as the admin', 'Back in the admin tab.');
  g.part('9.1 Dashboard');
  await sidebar('Dashboard');
  await admin.reload();
  await expect(admin.getByRole('link', { name: /Total Orders 2/ })).toBeVisible();
  g.expect('Total Orders **2**, Revenue **Rs. 214,500** (175,000 + 39,500), Products 7 active, Pending Orders **2**, New Messages **2**, and both orders under Recent Orders. The sidebar shows badges next to Orders and Messages.');
  await g.shot(admin, 'Dashboard with orders and messages', { fullPage: true });

  g.part('9.2 Process order 1 through to delivery');
  await sidebar('Orders');
  await g.shot(admin, 'Orders list', { fullPage: true });
  await g.click(admin.getByRole('row', { name: /Ayesha Khan/ }).getByRole('link').first(), `Click order **${order1}** (Ayesha Khan).`);
  await expect(admin.getByRole('heading', { level: 1, name: order1 })).toBeVisible();
  g.expect('Items with quantities and line totals, customer details with call/email links, address, the customer’s note, payment method and totals.');
  await g.shot(admin, 'Order detail', { fullPage: true });
  for (const [status, label, note] of [
    ['CONFIRMED', 'Confirmed', 'Confirmed on phone with Ayesha.'],
    ['SHIPPED', 'Shipped', 'Dispatched with TCS.'],
  ] as const) {
    await g.form([
      { label: 'Order status', value: label, locator: admin.getByLabel('Order status'), kind: 'select' },
      { label: 'Admin notes', value: note, locator: admin.getByLabel('Admin notes') },
    ], `Set the status to **${label}**:`);
    await save(admin, 'Save changes');
    await expect(admin.getByLabel('Order status')).toHaveValue(status);
  }
  g.expect('After each save the status badge updates and a timestamped line such as `[2026-…] status CONFIRMED → SHIPPED` is appended to the internal notes.');
  await g.shot(admin, 'Order marked as shipped', { fullPage: true });
  await g.goto(shopper, '/track', 'In the shopper tab, track order 1 again (same number and phone).');
  await shopper.getByLabel('Order Number').fill(order1);
  await shopper.getByLabel('Phone Number').fill('0300 1234567');
  await shopper.getByRole('button', { name: 'Track Order' }).click();
  await expect(shopper.getByText(/shipped/i).first()).toBeVisible();
  await expect(shopper.getByText('Dispatched with TCS')).toHaveCount(0);
  g.expect('The timeline has advanced to **Shipped**. Admin notes are never shown to the customer.');
  await g.shot(shopper, 'Customer sees the order as shipped', { fullPage: true });
  await g.form([{ label: 'Order status', value: 'Delivered', locator: admin.getByLabel('Order status'), kind: 'select' }], 'Back in the admin, finish the order:');
  await save(admin, 'Save changes');
  await expect(admin.getByLabel('Order status')).toHaveValue('DELIVERED');

  g.part('9.3 Cancel order 2');
  await sidebar('Orders');
  await g.click(admin.getByRole('row', { name: /Bilal Ahmed/ }).getByRole('link').first(), `Open order **${order2}** (Bilal Ahmed).`);
  await expect(admin.getByText('Rs. 2,500').first()).toBeVisible();
  g.expect('Delivery **Rs. 2,500** and Total **Rs. 39,500** — exactly what checkout showed.');
  await g.form([
    { label: 'Order status', value: 'Cancelled', locator: admin.getByLabel('Order status'), kind: 'select' },
    { label: 'Admin notes', value: 'Customer cancelled by phone.', locator: admin.getByLabel('Admin notes') },
  ]);
  await save(admin, 'Save changes');
  await sidebar('Orders');
  g.expect('The list shows one **DELIVERED** and one **CANCELLED** order. Use the status pills above the table to filter.');
  await g.shot(admin, 'Orders after processing', { fullPage: true });

  g.part('9.4 Messages inbox');
  await sidebar('Messages');
  g.expect('Two **NEW** messages: Hamza Ali (Sales) and the newsletter sign-up.');
  await g.click(admin.getByRole('row', { name: /Hamza Ali/ }).getByRole('link', { name: 'Expand message' }), 'On **Hamza Ali**, click **View**.');
  await expect(admin.getByText('Do you make wardrobes in custom sizes? I need a 7ft one.')).toBeVisible();
  g.expect('The full message with **Mark as Read**, **Mark as Closed**, **Delete** and **Reply by email →**.');
  await g.shot(admin, 'Message opened', { fullPage: true });
  await save(admin, 'Mark as Read');
  await save(admin, 'Mark as Closed');
  await expect(admin.getByRole('link', { name: /Closed 1/ })).toBeVisible();
  g.expect('The status pills update: **New 1**, **Closed 1**.');

  g.part('9.5 Approve the review');
  await sidebar('Reviews');
  const reviewRow = admin.getByRole('row', { name: /Sana Malik/ });
  await expect(reviewRow).toContainText('Alexa Sofa Chair');
  g.expect('Sana Malik’s 4-star review with an amber **Pending** status.');
  await g.shot(admin, 'Pending review', { fullPage: true });
  await act(reviewRow.getByRole('button', { name: /pending/i }), 'Click **Pending** to approve it.');
  await expect(admin.getByRole('row', { name: /Sana Malik/ }).getByRole('button', { name: /approved/i })).toBeVisible();
  g.expect('The status turns green **Approved** (click again to unapprove).');
  await g.goto(shopper, '/products/alexa-sofa-chair', 'In the shopper tab, open **Alexa Sofa Chair** again.');
  await expect(shopper.getByRole('region', { name: 'Customer Reviews' }).getByText('Comfy and well made')).toBeVisible();
  g.expect('Stars **(1)** under the title; Customer Reviews shows **4.0 — Based on 1 review** and the review itself.');
  await g.shot(shopper, 'Approved review on the product page', { clip: shopper.getByRole('region', { name: 'Customer Reviews' }) });

  g.part('9.6 Hide a product, then delete the draft');
  await sidebar('Products');
  await g.click(admin.getByRole('row', { name: /Antonin Center Table/ }).getByRole('link', { name: 'Edit' }), 'Edit **Antonin Center Table**.');
  await g.form([{ label: 'Status', value: 'Draft', locator: admin.getByLabel('Status'), kind: 'select' }]);
  await save(admin, 'Save product');
  expect((await shopper.goto('/products/antonin-center-table'))?.status()).toBe(404);
  g.expect('In the shopper tab, `/products/antonin-center-table` is now a 404 and the product is gone from listings. Set it back to **Active** and save to restore it.');
  await admin.getByLabel('Status').selectOption({ label: 'Active (visible in store)' });
  await save(admin, 'Save product');
  await sidebar('Products');
  admin.once('dialog', (d) => d.accept());
  await act(admin.getByRole('row', { name: /Prototype Dining Table/ }).getByRole('button', { name: /delete/i }), 'On **Prototype Dining Table**, click the trash icon and confirm the browser dialog.');
  await expect(admin.getByText('7 products in the catalog')).toBeVisible();
  g.expect('The product is deleted: **7 products in the catalog**.');

  g.part('9.7 Rename a collection, disable a menu link, deactivate a banner, unpublish a page');
  await sidebar('Collections');
  await g.click(admin.getByRole('row', { name: /^Office Chairs/ }).getByRole('link', { name: /edit/i }).first(), 'Edit **Office Chairs**.');
  await g.form([{ label: 'Title', value: 'Office Seating', locator: admin.getByLabel('Title') }]);
  await save(admin, /save collection/i, 'Save collection');
  await shopper.goto('/collections/office-chairs');
  await expect(shopper.getByRole('heading', { level: 1, name: 'Office Seating' })).toBeVisible();
  g.expect('`/collections/office-chairs` now shows the title **Office Seating** (the URL handle stays the same).');

  await sidebar('Menus');
  await g.click(admin.locator('summary').filter({ hasText: '/collections/all' }), 'In **Main navigation**, click the **All Products** row to expand it.');
  const item = admin.locator('details[open]');
  await g.form([{ label: 'Enabled (visible)', value: '☐ unchecked', locator: item.getByLabel(/^Enabled/), kind: 'uncheck' }]);
  await save(admin, 'Save item');
  await shopper.goto('/');
  await expect(shopper.locator('header').getByRole('link', { name: 'All Products', exact: true })).toHaveCount(0);
  g.expect('**All Products** disappears from the storefront navigation.');

  await sidebar('Banners');
  await act(admin.getByRole('button', { name: 'Deactivate' }).nth(1), 'Click **Deactivate** on **Sleep Like Royalty**.');
  await shopper.goto('/');
  await expect(shopper.getByRole('region', { name: 'Featured promotions' }).getByText('Sleep Like Royalty')).toHaveCount(0);
  g.expect('The hero slider now has a single slide.');

  await sidebar('Pages');
  await act(admin.getByRole('row', { name: /About Us/ }).getByRole('button', { name: 'Unpublish' }), 'On **About Us**, click **Unpublish**.');
  expect((await shopper.goto('/pages/about-us'))?.status()).toBe(404);
  g.expect('`/pages/about-us` returns 404 until you click **Publish** again.');
  await act(admin.getByRole('row', { name: /About Us/ }).getByRole('button', { name: 'Publish' }));
  g.step('Click **Publish** to bring it back.');
  await g.shot(admin, 'Pages list after publishing again', { fullPage: true });

  g.part('9.8 Change a setting');
  await sidebar('Settings');
  await g.form([{ label: 'Announcement Bar (top of every page)', value: 'Free delivery on orders over Rs. 100,000!', locator: admin.getByLabel('Announcement Bar (top of every page)') }]);
  await save(admin, 'Save Settings');
  await shopper.goto('/');
  await expect(shopper.getByText('Free delivery on orders over Rs. 100,000!')).toBeVisible();
  g.expect('The storefront announcement bar changes immediately.');
  await g.shot(shopper, 'Final storefront home page', { fullPage: true });

  g.part('9.9 Sign out');
  await g.click(admin.getByRole('button', { name: 'Sign out' }), 'Click **Sign out** (bottom of the sidebar).');
  await expect(admin).toHaveURL(/\/admin\/login/);
  await admin.goto('/admin/orders');
  await expect(admin).toHaveURL(/\/admin\/login/);
  g.expect('Back on the login page; opening any /admin URL redirects to login again.');

  /* ================================================================ 10. MOBILE */
  g.section('10. On a phone', 'Open the storefront on a phone, or use your browser’s device toolbar (e.g. Chrome DevTools → iPhone 13).');
  const phone = await (await browser.newContext({ ...devices['iPhone 13'], baseURL: 'http://localhost:3100' })).newPage();
  await g.goto(phone, '/', 'Open the home page.');
  g.expect('Portrait hero (mobile image), stacked sections, and a hamburger menu instead of the navigation bar. No sideways scrolling.');
  await g.shot(phone, 'Mobile home page');
  await g.click(phone.getByRole('button', { name: 'Open menu' }), 'Tap the **☰** menu.');
  await g.click(phone.getByRole('button', { name: 'Toggle Living Room' }), 'Tap the arrow next to **Living Room**.');
  await expect(phone.locator('header').getByRole('link', { name: 'Contact Us' }).filter({ visible: true })).toBeVisible();
  g.expect('The drawer lists the main navigation (Living Room expanded to Sofas / Coffee Tables), then the **Top bar** links (Track Order, Contact Us) and a tap-to-call phone button.');
  await g.shot(phone, 'Mobile menu drawer');
  await g.click(phone.getByRole('link', { name: 'Sofas', exact: true }).filter({ visible: true }).first(), 'Tap **Sofas**.');
  await expect(phone).toHaveURL(/\/collections\/sofas$/);
  await phone.waitForLoadState('networkidle');
  await g.shot(phone, 'Mobile collection page');
  await g.click(phone.getByRole('link', { name: 'Antonin Sofa', exact: true }).first(), 'Tap **Antonin Sofa**.');
  await expect(phone.getByRole('heading', { level: 1, name: 'Antonin Sofa' })).toBeVisible();
  await phone.waitForLoadState('networkidle');
  await g.shot(phone, 'Mobile product page');

  g.write(readPart('preamble.md'), readPart('appendix.md'));
});
