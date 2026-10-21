import { test, expect, type Page } from '@playwright/test';
import { adminNav, loginAsAdmin, newContext, shot, submit, watchErrors } from './helpers';

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

type NewBanner = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  image: string;
  mobileImage?: string;
  location?: string;
  position: string;
  active?: boolean;
};

async function createBanner(b: NewBanner) {
  await adminNav(page, 'Banners');
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create banner' }) });
  await form.getByLabel('Headline').fill(b.title);
  await form.getByLabel('Subtitle').fill(b.subtitle);
  await form.getByLabel('CTA label').fill(b.ctaLabel);
  await form.getByLabel('CTA link').fill(b.href);
  await form.getByLabel('Desktop image URL').fill(b.image);
  if (b.mobileImage) await form.getByLabel('Mobile image URL').fill(b.mobileImage);
  if (b.location) await form.getByLabel('Location').selectOption({ label: b.location });
  await form.getByLabel('Position').fill(b.position);
  await form.getByLabel(/^Active/).setChecked(b.active ?? true);
  await form.getByRole('button', { name: 'Create banner' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Banner saved. Storefront updated.')).toBeVisible();
}

test('banners: hero slides and a promo strip', async () => {
  await createBanner({ title: 'Winter Living Sale', subtitle: 'Up to 20% off sofas and accent chairs', ctaLabel: 'Shop Living Room', href: '/collections/living-room', image: '/images/banners/home-01.png', mobileImage: '/images/banners/home-03.webp', position: '0' });
  await createBanner({ title: 'Sleep Like Royalty', subtitle: 'King size beds, crafted in solid wood', ctaLabel: 'Shop Bedroom', href: '/collections/bedroom', image: '/images/banners/home-02.webp', position: '1' });
  await createBanner({ title: 'Hidden Draft Banner', subtitle: 'Should never be visible', ctaLabel: 'Nope', href: '/', image: '/images/banners/home-04.webp', position: '2', active: false });
  await createBanner({ title: 'Office Upgrade', subtitle: 'Ergonomic chairs for long workdays', ctaLabel: 'Shop Office Chairs', href: '/collections/office-chairs', image: '/images/banners/home-05.webp', location: 'Home — Promo strip 1', position: '0' });

  await expect(page.getByRole('heading', { name: /Home — Hero slider\s*3/ })).toBeVisible();
  await shot(page, '10-banners');
});

test('banners: validation requires a desktop image', async () => {
  await adminNav(page, 'Banners');
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create banner' }) });
  await form.getByLabel('Headline').fill('No Image Banner');
  await form.getByRole('button', { name: 'Create banner' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /Home — Hero slider\s*3/ })).toBeVisible();
  await expect(page.getByText('Banner saved. Storefront updated.')).toHaveCount(0);
  await expect(page.locator('input[name="title"][value="No Image Banner"]')).toHaveCount(0);
});

type NewMenuItem = { label: string; href: string; badge?: string; position: string; parent?: string; enabled?: boolean };

async function addMenuItems(location: string, items: NewMenuItem[]) {
  await adminNav(page, 'Menus');
  await page.getByRole('link', { name: new RegExp(`^${location}`) }).click();
  for (const item of items) {
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add item' }) });
    await form.getByLabel('Label').fill(item.label);
    await form.getByLabel('Link').fill(item.href);
    if (item.badge) await form.getByLabel('Badge').fill(item.badge);
    await form.getByLabel('Position').fill(item.position);
    if (item.parent) await form.getByLabel('Parent').selectOption({ label: item.parent });
    await form.getByLabel(/^Enabled/).setChecked(item.enabled ?? true);
    await form.getByRole('button', { name: 'Add item' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Menu saved. Storefront navigation updated.')).toBeVisible();
    await expect(page.locator('summary').filter({ hasText: item.href }).first()).toBeVisible();
  }
}

test('menus: main navigation with nested items and badges', async () => {
  await addMenuItems('Main navigation', [
    { label: 'Living Room', href: '/collections/living-room', position: '0' },
    { label: 'Sofas', href: '/collections/sofas', position: '0', parent: 'Living Room' },
    { label: 'Bedroom', href: '/collections/bedroom', position: '1' },
    { label: 'King Size Beds', href: '/collections/king-size-beds', position: '0', parent: 'Bedroom' },
    { label: 'Office', href: '/collections/office-chairs', position: '2', badge: 'NEW' },
    { label: 'All Products', href: '/collections/all', position: '3' },
    { label: 'Clearance', href: '/collections/clearance', position: '4', badge: 'SALE', enabled: false },
  ]);
  await shot(page, '11-menus-main');
});

test('menus: top bar and footer columns', async () => {
  await addMenuItems('Top bar', [
    { label: 'Track Order', href: '/track', position: '0' },
    { label: 'Contact Us', href: '/pages/contact', position: '1' },
  ]);
  await addMenuItems('Footer — column 1', [
    { label: 'About Us', href: '/pages/about-us', position: '0' },
    { label: 'Blog', href: '/blogs', position: '1' },
  ]);
  await addMenuItems('Footer — column 2', [
    { label: 'Privacy Policy', href: '/pages/privacy-policy', position: '0' },
    { label: 'Shipping Policy', href: '/pages/shipping-policy', position: '1' },
    { label: 'Track Your Order', href: '/track', position: '2' },
  ]);
  await addMenuItems('Footer — column 3', [
    { label: 'Sofas', href: '/collections/sofas', position: '0' },
    { label: 'King Size Beds', href: '/collections/king-size-beds', position: '1' },
  ]);
});

type NewPage = { title: string; handle?: string; body: string; seoTitle?: string; seoDescription?: string; published?: boolean; blog?: boolean };

async function createPage(p: NewPage) {
  await adminNav(page, 'Pages');
  await page.getByRole('link', { name: 'New page' }).click();
  await page.getByLabel('Title', { exact: true }).fill(p.title);
  if (p.handle) await page.getByLabel('Handle').fill(p.handle);
  await page.getByLabel('Body (HTML)').fill(p.body);
  if (p.seoTitle) await page.getByLabel('SEO title').fill(p.seoTitle);
  if (p.seoDescription) await page.getByLabel('SEO description').fill(p.seoDescription);
  await page.getByLabel('Published').setChecked(p.published ?? true);
  await page.getByLabel('Blog post').setChecked(p.blog ?? false);
  await submit(page, 'Create page');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(p.title);
}

test('pages: about, privacy policy, contact, a draft and a blog post', async () => {
  await createPage({
    title: 'About Us',
    handle: 'about-us',
    body: '<h2>Crafted in Pakistan since 1974</h2><p>Interwood designs and manufactures furniture for homes and offices.</p>',
    seoTitle: 'About Interwood',
    seoDescription: 'The story of Pakistan’s largest furniture manufacturer.',
  });
  await createPage({
    title: 'Privacy Policy',
    body: '<h2>Information we collect</h2><p>We collect your name, phone number and delivery address to fulfil orders.</p><h2>How we use it</h2><p>Only to process and deliver your order.</p>',
  });
  await createPage({ title: 'Contact', handle: 'contact', body: '<p>Call us or send a message using the form below.</p>' });
  await createPage({ title: 'Shipping Policy', body: '<p>Draft — free delivery nationwide.</p>', published: false });
  await createPage({
    title: 'How to Choose the Right Sofa',
    body: '<p>Measure your room first. Then think about seating capacity, fabric and frame.</p>',
    blog: true,
  });

  await adminNav(page, 'Pages');
  await expect(page.getByRole('row', { name: /Privacy Policy \/pages\/privacy-policy/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Shipping Policy/ })).toContainText(/draft/i);
  await shot(page, '12-pages-list');
});
