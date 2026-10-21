import { test, expect, type Page } from '@playwright/test';
import { ADMIN_EMAIL, adminNav, loginAsAdmin, newContext, shot, submit, watchErrors } from './helpers';

// Tests run in file order on one worker and build on each other's data; a failure restarts the
// worker (re-running beforeAll) but does not skip the rest, so every finding gets reported.
test.describe.configure({ mode: 'default' });

let page: Page;
let errors: string[];

test.beforeAll(async ({ browser }) => {
  page = await loginAsAdmin(await newContext(browser));
  errors = watchErrors(page);
});

test.afterEach(() => {
  expect(errors, 'no uncaught page errors or 5xx responses').toEqual([]);
});

test('admin area is protected and rejects a wrong password', async ({ browser }) => {
  const guest = await (await newContext(browser)).newPage();
  await guest.goto('/admin/products');
  await expect(guest).toHaveURL(/\/admin\/login$/);

  await guest.getByLabel('Email').fill(ADMIN_EMAIL);
  await guest.getByLabel('Password').fill('wrong-password');
  await guest.getByRole('button', { name: /sign in/i }).click();
  await expect(guest.getByText(/invalid|incorrect/i).first()).toBeVisible();
  await expect(guest).toHaveURL(/\/admin\/login/);
  await shot(guest, '01-login-error');
  await guest.context().close();
});

test('admin sees an empty dashboard after logging in', async () => {
  await adminNav(page, 'Dashboard');
  await expect(page.getByRole('link', { name: /Total Orders 0/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Products 0/ })).toBeVisible();
  await expect(page.getByText('No orders yet')).toBeVisible();
  await shot(page, '02-dashboard-empty');
});

test('settings: store contact details, shipping and ratings', async () => {
  await adminNav(page, 'Settings');
  const values: Record<string, string> = {
    'Announcement Bar (top of every page)': 'Winter Sale — Flat 20% off on all sofas!',
    Phone: '+92-42-111-203-203',
    'WhatsApp Number': '9242111203203',
    'Customer Care Email': 'info@interwood.pk',
    'Complaints Email': 'complaints@interwood.pk',
    'Head Office Address': '12-KM Ferozepur Road, Lahore, Pakistan',
    Facebook: 'https://www.facebook.com/interwood',
    Instagram: 'https://www.instagram.com/interwood',
    YouTube: 'https://www.youtube.com/@interwood',
    LinkedIn: 'https://www.linkedin.com/company/interwood',
    'Shipping Fee (Rs.)': '2500',
    'Free Shipping Threshold (Rs.)': '100000',
    'Overall Rating': '4.8',
    'Rating Count Label': '1,200+ happy customers',
  };
  for (const [label, value] of Object.entries(values)) await page.getByLabel(label).fill(value);
  await submit(page, 'Save Settings');
  await expect(page.getByText('Settings saved successfully — the storefront has been updated.')).toBeVisible();

  await page.reload();
  for (const [label, value] of Object.entries(values)) await expect(page.getByLabel(label)).toHaveValue(value);
  await shot(page, '03-settings-saved');
});

type NewCollection = {
  title: string;
  description: string;
  image: string;
  parent?: string;
  kind?: string;
  position: string;
  featured?: boolean;
  showInNav?: boolean;
};

async function createCollection(c: NewCollection) {
  await adminNav(page, 'Collections');
  await page.getByRole('link', { name: /new collection/i }).click();
  await page.getByLabel('Title').fill(c.title);
  await page.getByLabel('Description').fill(c.description);
  await page.getByPlaceholder(/images\/collections/).fill(c.image);
  if (c.parent) await page.getByLabel('Parent collection').selectOption({ label: c.parent });
  if (c.kind) await page.getByLabel('Kind').selectOption({ label: c.kind });
  await page.getByLabel('Position').fill(c.position);
  await page.getByLabel('Show in navigation').setChecked(c.showInNav ?? true);
  await page.getByLabel('Featured on homepage').setChecked(c.featured ?? false);
  await submit(page, /create collection/i);
  await expect(page.getByText('Collection saved successfully.')).toBeVisible();
}

test('collections: create a department → category tree', async () => {
  await createCollection({ title: 'Living Room', description: 'Sofas, centre tables and accent chairs for your lounge.', image: '/images/collections/living.jpg', kind: 'Room', position: '1', featured: true });
  await createCollection({ title: 'Sofas', description: 'Two, three and five seater sofas.', image: '/images/collections/conte.webp', parent: 'Living Room', position: '1', featured: true });
  await createCollection({ title: 'Bedroom', description: 'Beds, wardrobes and side tables.', image: '/images/collections/bedroom.jpg', kind: 'Room', position: '2', featured: true });
  await createCollection({ title: 'King Size Beds', description: 'Spacious king beds in solid wood.', image: '/images/collections/king-size-beds.jpg', parent: 'Bedroom', position: '1' });
  await createCollection({ title: 'Office Chairs', description: 'Ergonomic manager and visitor chairs.', image: '/images/collections/office-chairs.webp', position: '3', featured: true });

  await adminNav(page, 'Collections');
  await expect(page.getByText('5 collections')).toBeVisible();
  const sofasRow = page.getByRole('row', { name: /Sofas/ });
  await expect(sofasRow).toContainText('Living Room');
  await shot(page, '04-collections-list');
});

type NewProduct = {
  title: string;
  status?: 'Active (visible in store)' | 'Draft' | 'Archived';
  productType: string;
  tags: string;
  hot?: boolean;
  bodyHtml: string;
  variants: { title: string; sku: string; option1?: string; price: string; compareAt?: string; inventory: string }[];
  images: { src: string; alt: string }[];
  collections: string[];
  options?: string;
};

async function createProduct(p: NewProduct) {
  await adminNav(page, 'Products');
  await page.getByRole('link', { name: /new product/i }).first().click();
  await expect(page.getByRole('heading', { name: 'New product' })).toBeVisible();
  await page.getByLabel(/^Title/).fill(p.title);
  if (p.status) await page.getByLabel('Status').selectOption({ label: p.status });
  await page.getByLabel('Product type').fill(p.productType);
  await page.getByLabel('Tags').fill(p.tags);
  if (p.hot) await page.getByLabel(/Hot product/).check();
  await page.getByPlaceholder('<p>Product description in HTML…</p>').fill(p.bodyHtml);

  for (const [i, v] of p.variants.entries()) {
    const n = i + 1;
    if (i > 0) await page.getByRole('button', { name: 'Add variant' }).click();
    await page.getByLabel(`Variant ${n} title`).fill(v.title);
    await page.getByLabel(`Variant ${n} SKU`).fill(v.sku);
    if (v.option1) await page.getByLabel(`Variant ${n} option 1`).fill(v.option1);
    await page.getByLabel(`Variant ${n} price`).fill(v.price);
    if (v.compareAt) await page.getByLabel(`Variant ${n} compare-at price`).fill(v.compareAt);
    await page.getByLabel(`Variant ${n} inventory`).fill(v.inventory);
  }
  for (const [i, im] of p.images.entries()) {
    await page.getByRole('button', { name: 'Add image' }).click();
    await page.getByLabel(`Image ${i + 1} source`).fill(im.src);
    await page.getByLabel(`Image ${i + 1} alt text`).fill(im.alt);
  }
  for (const c of p.collections) await page.getByRole('checkbox', { name: c, exact: true }).check();
  if (p.options) await page.locator('textarea[name="options"]').fill(p.options);

  await submit(page, 'Create product');
  await expect(page.getByText('Product saved successfully.')).toBeVisible();
}

test('products: create a catalogue from the admin', async () => {
  await createProduct({
    title: 'Alexa Sofa Chair',
    productType: 'Sofa Chair',
    tags: 'living, accent',
    hot: true,
    bodyHtml: '<p>A plush accent chair with solid wood legs.</p><ul><li>Fabric: velvet</li><li>Frame: kiln-dried wood</li></ul>',
    variants: [{ title: 'Default Title', sku: 'ALX-01', price: '45000', compareAt: '52000', inventory: '12' }],
    images: [
      { src: '/images/products/alexa-sofa-chair-1.jpg', alt: 'Alexa Sofa Chair front' },
      { src: '/images/products/alexa-sofa-chair-2.jpg', alt: 'Alexa Sofa Chair side' },
    ],
    collections: ['Living Room', 'Sofas'],
  });

  await createProduct({
    title: 'Antonin Sofa',
    productType: 'Sofa',
    tags: 'living, sofa',
    bodyHtml: '<p>Modern sofa available as a 3-seater or 2-seater.</p>',
    options: '[{"name":"Size","values":["3-Seater","2-Seater"]}]',
    variants: [
      { title: '3-Seater', sku: 'ANT-3', option1: '3-Seater', price: '120000', compareAt: '140000', inventory: '5' },
      { title: '2-Seater', sku: 'ANT-2', option1: '2-Seater', price: '85000', inventory: '8' },
    ],
    images: [
      { src: '/images/products/antonin-sofa-1.jpg', alt: 'Antonin Sofa' },
      { src: '/images/products/antonin-sofa-2.webp', alt: 'Antonin Sofa detail' },
    ],
    collections: ['Living Room', 'Sofas'],
  });

  await createProduct({
    title: 'Aeon Manager Chair',
    productType: 'Chair',
    tags: 'office, ergonomic',
    bodyHtml: '<p>High-back manager chair with lumbar support.</p>',
    variants: [{ title: 'Black', sku: 'AEON-BLK', price: '38500', inventory: '0' }],
    images: [{ src: '/images/products/aeon-manager-chair-black-1.jpg', alt: 'Aeon Manager Chair' }],
    collections: ['Office Chairs'],
  });

  await createProduct({
    title: 'Alpen King Size Bed',
    productType: 'Bed',
    tags: 'bedroom, bed',
    hot: true,
    bodyHtml: '<p>Solid wood king bed with upholstered headboard.</p>',
    variants: [{ title: 'Default Title', sku: 'ALP-K', price: '150000', compareAt: '175000', inventory: '3' }],
    images: [
      { src: '/images/products/alpen-bed-1.jpg', alt: 'Alpen King Size Bed' },
      { src: '/images/products/alpen-bed-2.png', alt: 'Alpen bed headboard' },
    ],
    collections: ['Bedroom', 'King Size Beds'],
  });

  await createProduct({
    title: 'Secret Prototype Table',
    status: 'Draft',
    productType: 'Table',
    tags: 'draft',
    bodyHtml: '<p>Not ready yet.</p>',
    variants: [{ title: 'Default Title', sku: 'PROTO', price: '9999', inventory: '1' }],
    images: [{ src: '/images/products/antonin-center-table-1.jpg', alt: 'Prototype' }],
    collections: ['Living Room'],
  });

  await adminNav(page, 'Products');
  for (const t of ['Alexa Sofa Chair', 'Antonin Sofa', 'Aeon Manager Chair', 'Alpen King Size Bed', 'Secret Prototype Table']) {
    await expect(page.getByRole('row', { name: new RegExp(t) })).toBeVisible();
  }
  await shot(page, '05-products-list');
});

test('products: the browser blocks a product with no price and keeps what was typed', async () => {
  await adminNav(page, 'Products');
  await page.getByRole('link', { name: /new product/i }).first().click();
  await page.getByLabel(/^Title/).fill('Broken Product');
  await page.getByRole('button', { name: 'Create product' }).click();
  // Native validation stops the submit: still on the form, price flagged, nothing lost.
  await expect(page).toHaveURL(/\/admin\/products\/new$/);
  await expect(page.getByLabel('Variant 1 price')).toHaveJSProperty('validity.valueMissing', true);
  await expect(page.getByLabel(/^Title/)).toHaveValue('Broken Product');
  await shot(page, '06-product-validation');
});

test('products: a negative price is rejected', async () => {
  await adminNav(page, 'Products');
  await page.getByRole('link', { name: /new product/i }).first().click();
  await page.getByLabel(/^Title/).fill('Negative Price Product');
  await page.getByLabel('Variant 1 price').fill('-500');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page).toHaveURL(/\/admin\/products\/new$/);
  await expect(page.getByLabel('Variant 1 price')).toHaveJSProperty('validity.patternMismatch', true);
  await adminNav(page, 'Products');
  await expect(page.getByRole('row', { name: /Negative Price Product/ })).toHaveCount(0);
});

test('products: edit a product price and see it on the edit page', async () => {
  await adminNav(page, 'Products');
  await page.getByRole('row', { name: /Aeon Manager Chair/ }).getByRole('link', { name: 'Edit' }).click();
  await expect(page.getByLabel(/^Title/)).toHaveValue('Aeon Manager Chair');
  await page.getByLabel('Variant 1 price').fill('36000');
  await page.getByLabel('Variant 1 compare-at price').fill('41000');
  await submit(page, 'Save product');
  await expect(page.getByText('Product saved successfully.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Variant 1 price')).toHaveValue('36000');
  await expect(page.getByLabel('Variant 1 compare-at price')).toHaveValue('41000');
});

test('collections: product counts reflect the assignments', async () => {
  await adminNav(page, 'Collections');
  await expect(page.getByRole('row', { name: /^Sofas/ })).toContainText('2');
  await expect(page.getByRole('row', { name: /^Living Room/ })).toContainText('3');
  await expect(page.getByRole('row', { name: /^Office Chairs/ })).toContainText('1');
});
