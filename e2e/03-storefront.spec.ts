import { test, expect, type Page } from '@playwright/test';
import { newContext, shot, watchErrors } from './helpers';

// Tests run in file order on one worker; the cart lives in localStorage of the shared context.
test.describe.configure({ mode: 'default' });

let page: Page;
let errors: string[];

test.beforeAll(async ({ browser }) => {
  page = await (await newContext(browser)).newPage();
  errors = watchErrors(page);
});

test.afterEach(() => {
  expect(errors, 'no uncaught page errors or 5xx responses').toEqual([]);
});

const header = () => page.locator('header').first();
const footer = () => page.locator('footer').first();

test('home: announcement, hero slider, products and categories from the admin', async () => {
  await page.goto('/');
  await expect(page.getByText('Winter Sale — Flat 20% off on all sofas!')).toBeVisible();

  const hero = page.getByRole('region', { name: 'Featured promotions' });
  await expect(hero.getByRole('heading', { name: 'Winter Living Sale' })).toBeVisible();
  await expect(hero.getByRole('link', { name: 'Shop Living Room' })).toHaveAttribute('href', '/collections/living-room');
  await expect(hero.getByRole('button', { name: /Go to slide/ })).toHaveCount(2); // inactive banner is hidden
  await hero.getByRole('button', { name: 'Next slide' }).click();
  await expect(hero.getByRole('heading', { name: 'Sleep Like Royalty' })).toBeVisible();
  await expect(page.getByText('Hidden Draft Banner')).toHaveCount(0);

  await expect(page.getByText('Office Upgrade')).toBeVisible(); // promo strip 1

  // Hot products: only the two products flagged "hot" in the admin.
  const hot = page.getByRole('region', { name: 'Hot selling products' });
  await expect(hot.getByRole('link', { name: 'Alexa Sofa Chair', exact: true })).toBeVisible();
  await expect(hot.getByRole('link', { name: 'Alpen King Size Bed', exact: true })).toBeVisible();
  await expect(hot.getByRole('link', { name: 'Aeon Manager Chair', exact: true })).toHaveCount(0);
  await expect(page.getByText('Secret Prototype Table')).toHaveCount(0); // draft product

  // Featured collections → "Shop by Category"
  for (const name of ['Living Room', 'Sofas', 'Bedroom', 'Office Chairs']) {
    await expect(page.getByRole('link', { name: new RegExp(`^${name}.*Shop Now`) })).toBeVisible();
  }

  await expect(page.getByRole('region', { name: 'Customer rating' })).toContainText(/4\.8\s*out of 5/);
  await expect(page.getByText('(1,200+ happy customers)')).toBeVisible();
  await shot(page, '20-home');
});

test('header and footer: menus, contact details and social links from the admin', async () => {
  await page.goto('/');
  const nav = header();
  for (const label of ['Living Room', 'Bedroom', 'Office', 'All Products']) {
    await expect(nav.getByRole('link', { name: new RegExp(`^${label}`) }).first()).toBeVisible();
  }
  await expect(nav.getByText('NEW', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Clearance/ })).toHaveCount(0); // disabled item

  // Dropdown: hover a department, click its child.
  await nav.getByRole('link', { name: /^Living Room/ }).first().hover();
  await nav.getByRole('link', { name: 'Sofas', exact: true }).first().click();
  await expect(page).toHaveURL(/\/collections\/sofas$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sofas' })).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Track Order' }).first()).toBeVisible(); // top bar

  const foot = footer();
  for (const label of ['About Us', 'Blog', 'Privacy Policy', 'Shipping Policy', 'Track Your Order', 'Sofas', 'King Size Beds']) {
    await expect(foot.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(foot.getByText('+92-42-111-203-203')).toBeVisible();
  await expect(foot.getByText('info@interwood.pk')).toBeVisible();
  await expect(foot.getByText('12-KM Ferozepur Road, Lahore, Pakistan')).toBeVisible();
  for (const [name, href] of [
    ['Facebook', 'https://www.facebook.com/interwood'],
    ['Instagram', 'https://www.instagram.com/interwood'],
    ['YouTube', 'https://www.youtube.com/@interwood'],
    ['LinkedIn', 'https://www.linkedin.com/company/interwood'],
  ]) {
    await expect(foot.getByRole('link', { name: new RegExp(name, 'i') })).toHaveAttribute('href', href);
  }
  await expect(page.getByRole('link', { name: /whatsapp/i }).first()).toHaveAttribute('href', /9242111203203/);
  await shot(page, '21-footer');
});

test('collections index and a department page', async () => {
  await page.goto('/collections');
  for (const name of ['Living Room', 'Bedroom', 'Office Chairs']) {
    await expect(page.getByRole('link', { name: new RegExp(name) }).first()).toBeVisible();
  }
  await shot(page, '22-collections-index');

  await page.goto('/collections/living-room');
  await expect(page.getByRole('heading', { level: 1, name: 'Living Room' })).toBeVisible();
  await expect(page.getByText('Sofas, centre tables and accent chairs for your lounge.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alexa Sofa Chair', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Antonin Sofa', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Secret Prototype Table' })).toHaveCount(0);
  await shot(page, '23-collection-living');
});

test('collection sorting and price filter', async () => {
  await page.goto('/collections/all');
  await expect(page.getByRole('link', { name: 'Alpen King Size Bed', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Secret Prototype Table' })).toHaveCount(0);

  const sort = page.getByLabel('Sort by');
  await sort.selectOption({ label: 'Price: Low to High' });
  await page.waitForURL(/sort=/);
  const titles = await page.locator('main').getByRole('link').filter({ hasText: /^(Alexa Sofa Chair|Antonin Sofa|Aeon Manager Chair|Alpen King Size Bed)$/ }).allInnerTexts();
  expect(titles[0]).toBe('Aeon Manager Chair'); // Rs. 36,000 is the cheapest
  expect(titles.at(-1)).toBe('Alpen King Size Bed');
  await shot(page, '24-collection-all-sorted');

  await page.goto('/collections/all?min=40000&max=100000');
  await expect(page.getByRole('link', { name: 'Alexa Sofa Chair', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alpen King Size Bed', exact: true })).toHaveCount(0);
});

test('search finds products by name', async () => {
  await page.goto('/');
  const box = header().getByRole('searchbox').or(header().getByPlaceholder(/search/i)).first();
  await box.fill('sofa');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=sofa/);
  await expect(page.getByRole('link', { name: 'Antonin Sofa', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alexa Sofa Chair', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alpen King Size Bed', exact: true })).toHaveCount(0);
  await shot(page, '25-search');

  await page.goto('/search?q=prototype');
  await expect(page.getByRole('link', { name: 'Secret Prototype Table' })).toHaveCount(0);
});

test('product page: variants switch price and SKU, gallery, description', async () => {
  await page.goto('/products/antonin-sofa');
  await expect(page).toHaveTitle('Antonin Sofa | Interwood');
  await expect(page.getByRole('heading', { level: 1, name: 'Antonin Sofa' })).toBeVisible();
  await expect(page.getByText('Rs. 120,000').first()).toBeVisible();
  await expect(page.getByText('SKU: ANT-3')).toBeVisible();

  await page.getByRole('button', { name: '2-Seater' }).click();
  await expect(page.getByText('Rs. 85,000').first()).toBeVisible();
  await expect(page.getByText('SKU: ANT-2')).toBeVisible();
  await expect(page.getByText('Rs. 140,000')).toHaveCount(0); // 2-Seater has no compare-at price

  await page.getByRole('tab', { name: 'View image 2' }).click();
  await expect(page.getByRole('tab', { name: 'View image 2' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Modern sofa available as a 3-seater or 2-seater.')).toBeVisible();
  await shot(page, '26-product-antonin');

  // A product with no reviews shouldn't claim a star rating.
  await expect(page.getByRole('region', { name: 'Customer Reviews' }).getByText('4.9')).toHaveCount(0);
});

test('product cards: discount and stock badges match the product page', async () => {
  await page.goto('/collections/sofas');
  const antonin = page.locator('a', { hasText: 'Antonin Sofa' }).first();
  // Card shows the 2-Seater price (Rs. 85,000); that variant has no compare-at price, so no "-39%" badge.
  await expect(page.getByText('-39% OFF')).toHaveCount(0);
  await expect(antonin).toBeVisible();

  await page.goto('/collections/office-chairs');
  // Inventory 0 is "Made to Order" (still purchasable) on the product page; the card should agree.
  await expect(page.getByText('Sold Out')).toHaveCount(0);
  await expect(page.getByText('Made to Order').first()).toBeVisible();
});

test('cart: add from product page, quick add, update quantity, remove', async () => {
  await page.goto('/products/alexa-sofa-chair');
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: 'Add to Cart' }).first().click();
  await expect(header().getByText('2', { exact: true })).toBeVisible(); // cart badge

  await page.goto('/products/antonin-sofa');
  await page.getByRole('button', { name: '2-Seater' }).click();
  await page.getByRole('button', { name: 'Add to Cart' }).first().click();

  await page.goto('/collections/office-chairs');
  await page.getByRole('button', { name: 'Add to Cart' }).first().click();

  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
  await expect(page.getByText('Alexa Sofa Chair').first()).toBeVisible();
  await expect(page.getByText('2-Seater').first()).toBeVisible();
  await expect(page.getByText('Aeon Manager Chair').first()).toBeVisible();
  // 2 × 45,000 + 85,000 + 36,000 = 211,000
  await expect(page.getByText('Rs. 211,000').first()).toBeVisible();
  await shot(page, '27-cart');

  const aeon = page.locator('li, article, tr, div').filter({ hasText: 'Aeon Manager Chair' }).filter({ has: page.getByRole('button', { name: /remove/i }) }).last();
  await aeon.getByRole('button', { name: /remove/i }).click();
  await expect(page.getByText('Aeon Manager Chair')).toHaveCount(0);
  await expect(page.getByText('Rs. 175,000').first()).toBeVisible();
});

test('checkout: validation, then a cash-on-delivery order', async () => {
  await page.goto('/cart');
  await page.getByRole('link', { name: /checkout/i }).first().click();
  await expect(page).toHaveURL(/\/checkout$/);

  await page.getByRole('button', { name: /Place Order/ }).click();
  await expect(page.getByText(/full name/i).filter({ hasNot: page.locator('label') }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);

  await page.getByLabel(/Full Name/).fill('Ayesha Khan');
  await page.getByLabel(/^Phone/).fill('12345');
  await page.getByLabel(/Complete Address/).fill('House 12, Street 4, DHA Phase 5');
  await page.getByLabel(/^City/).selectOption('Lahore');
  await page.getByRole('button', { name: /Place Order/ }).click();
  await expect(page.getByText(/Enter a valid Pakistani mobile number/).first()).toBeVisible();

  await page.getByLabel(/^Phone/).fill('0300 1234567');
  await page.getByLabel(/^Email/).fill('ayesha@example.com');
  await page.getByLabel(/Order Notes/).fill('Please call before delivery.');
  // Subtotal 175,000 ≥ free shipping threshold 100,000 → free delivery.
  await expect(page.getByText('Rs. 175,000').first()).toBeVisible();
  await shot(page, '28-checkout');
  await page.getByRole('button', { name: /Place Order/ }).click();

  await expect(page).toHaveURL(/\/checkout\/success\?order=IW-\d+/);
  await expect(page.getByText(/IW-\d{6}/).first()).toBeVisible();
  await shot(page, '29-order-success');
  const orderNumber = new URL(page.url()).searchParams.get('order')!;
  test.info().annotations.push({ type: 'order', description: orderNumber });

  // The cart is emptied after placing the order.
  await page.goto('/cart');
  await expect(page.getByText('Your cart is empty')).toBeVisible();

  // Track it with the order number and phone.
  await page.goto('/track');
  await page.getByLabel('Order Number').fill(orderNumber);
  await page.getByLabel('Phone Number').fill('03001234567');
  await page.getByRole('button', { name: 'Track Order' }).click();
  await expect(page.getByText(/pending|order placed|received/i).first()).toBeVisible();
  await shot(page, '30-track');
});

test('checkout: shipping fee applies below the free-shipping threshold', async () => {
  await page.goto('/products/aeon-manager-chair');
  await page.getByRole('button', { name: 'Add to Cart' }).first().click();
  await page.goto('/checkout');
  // 36,000 subtotal < 100,000 threshold → Rs. 2,500 delivery, total Rs. 38,500.
  await expect(page.getByText('Rs. 2,500').first()).toBeVisible();
  await expect(page.getByText('Rs. 38,500').first()).toBeVisible();
  await page.getByLabel(/Full Name/).fill('Bilal Ahmed');
  await page.getByLabel(/^Phone/).fill('03211234567');
  await page.getByLabel(/Complete Address/).fill('Flat 3, Block B, Gulshan-e-Iqbal');
  await page.getByLabel(/^City/).selectOption('Karachi');
  await page.getByLabel(/^Province/).selectOption('Sindh');
  await page.getByText('Bank Transfer').first().click();
  await page.getByRole('button', { name: /Place Order/ }).click();
  await expect(page).toHaveURL(/\/checkout\/success\?order=IW-\d+/);
  await shot(page, '29b-order-success-with-shipping');
});

test('track: wrong phone does not reveal an order', async () => {
  await page.goto('/track');
  await page.getByLabel('Order Number').fill('IW-100001');
  await page.getByLabel('Phone Number').fill('03009999999');
  await page.getByRole('button', { name: 'Track Order' }).click();
  await expect(page.getByText(/not found|couldn.t find|no order/i).first()).toBeVisible();
  await expect(page.getByText('Ayesha Khan')).toHaveCount(0);
});

test('static pages: privacy policy, about us, draft page and SEO title', async () => {
  await page.goto('/');
  await footer().getByRole('link', { name: 'Privacy Policy', exact: true }).click();
  await expect(page).toHaveURL(/\/pages\/privacy-policy$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Information we collect' })).toBeVisible();
  await expect(page.getByText('We collect your name, phone number and delivery address to fulfil orders.')).toBeVisible();
  await shot(page, '31-privacy-policy');

  await footer().getByRole('link', { name: 'About Us', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Crafted in Pakistan since 1974' })).toBeVisible();
  await expect(page).toHaveTitle(/About Interwood/);

  // Unpublished page linked from the footer → 404.
  const res = await page.goto('/pages/shipping-policy');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('contact page: customer sends a message', async () => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Contact Us' }).first().click();
  await expect(page).toHaveURL(/\/pages\/contact$/);
  await page.getByLabel(/Full Name/).fill('Hamza Ali');
  await page.getByLabel(/Email Address/).fill('hamza@example.com');
  await page.getByLabel(/Phone Number/).fill('03331234567');
  await page.getByLabel(/Subject/).selectOption({ label: 'Sales' });
  await page.getByRole('textbox', { name: /^Message/ }).fill('Do you make wardrobes in custom sizes? I need a 7ft one.');
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page.getByText(/thank|received|sent/i).first()).toBeVisible();
  await shot(page, '32-contact-sent');
});

test('blog: list and read a post', async () => {
  await page.goto('/');
  await footer().getByRole('link', { name: 'Blog', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('link', { name: /How to Choose the Right Sofa/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'How to Choose the Right Sofa' })).toBeVisible();
  await expect(page.getByText('Measure your room first.')).toBeVisible();
  await shot(page, '33-blog-post');
});

test('404 page for unknown products and collections', async () => {
  for (const url of ['/products/does-not-exist', '/collections/does-not-exist']) {
    const res = await page.goto(url);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  }
});

test('page titles are not duplicated', async () => {
  for (const url of ['/products/alexa-sofa-chair', '/collections/sofas', '/track', '/pages/privacy-policy', '/cart', '/checkout']) {
    await page.goto(url);
    const title = await page.title();
    expect.soft(title, `${url} title`).not.toMatch(/Interwood \| Interwood/);
    expect.soft(title, `${url} title`).not.toBe('Interwood — Pakistan’s Largest Furniture Manufacturer');
  }
});
