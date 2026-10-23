import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

/**
 * Lasting DOM parity (docs/product-layouts/SPEC.md §13.6, §14). For one representative product per migrated
 * layout, the `outerHTML` of the fixed sections (big photo, photo and text, icons, slideshow, quotes; product cards
 * and reviews excluded) at 1440px must equal the capture taken before the layouts moved into the database
 * (`tests/fixtures/product-layouts-dom/<key>.html`, byte for byte from that capture).
 *
 * The only markup changes the move was allowed to make (SPEC §6.3 items 4–5: `h-[500px]` → `min-h-[500px]`,
 * `md:h-[650px]` → `md:min-h-[650px]`, the added `[overflow-wrap:anywhere]` tokens) are undone on the live markup
 * before comparing. A layout that has been saved through the admin (`previousVersion` set) is skipped, so owner
 * edits never fail this spec.
 */

const prisma = new PrismaClient();
test.afterAll(async () => {
  await prisma.$disconnect();
});

const PRODUCTS: Record<string, string> = {
  default: 'dawn-manager-chair',
  'living-products': 'camden-l-shape-sofa-cum-bed',
  sofas: 'jasper-sofa-2-seater',
  'bedroom-products': 'bedside-table-candy-in-pine-grey-and-red-colour',
  'bed-sets': 'sydney-single-bed-in-dark-grey-jute-with-light-oak',
  'dining-products': 'dining-chair-elba',
  'study-products': 'millie-study-desk',
  'kids-products': 'wilson-bunk-bed-yellow-grey',
  'office-products': 'apex-manager-chair-with-headrest',
  'wardrobes-products': 'iris-wardrobe',
  'kitchens-products': 'laundry-detergent-basket',
  'door-products': 'reno',
  'decor-products': 'cushion-filling',
  'decor-cushions': 'cynosure-cushion-cover',
  'coalesce-living': 'linea-arm-chair',
  'coalesce-dining': 'arbour-dining-table-set',
  'coalesce-bedroom': 'linea-dresser-2-0',
  'blank-template-no-section': 'oryn-2-5-seater-curved-sofa-2',
};

const FIXTURES = path.resolve(__dirname, '../fixtures/product-layouts-dom');
const undoAllowed = (s: string) => s.replaceAll(' [overflow-wrap:anywhere]', '').replaceAll('md:min-h-[650px]', 'md:h-[650px]').replaceAll('min-h-[500px]', 'h-[500px]');
const T = new Date('2026-01-01T10:00:00Z');
/**
 * The class next/font gives a font (here Barlow Condensed) is a bundler-made name: `__className_3aabff` with
 * webpack (the fixtures), `barlow_condensed_…-module__…__className` with Turbopack. Both sides use one placeholder.
 */
const sameFontClass = (s: string) => s.replace(/\b__className_[a-z0-9]+\b|\b[\w-]+-module__[\w-]+__className\b/g, '__className_FONT');

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });

for (const [key, handle] of Object.entries(PRODUCTS)) {
  test(`${key}: fixed sections match the original markup`, async ({ page }) => {
    const layout = await prisma.productLayout.findUnique({ where: { key }, select: { previousVersion: true } });
    test.skip(!layout, `layout ${key} no longer exists`);
    test.skip(layout!.previousVersion != null, `layout ${key} was edited in the admin, so it no longer has to match the original`);
    const product = await prisma.product.findUnique({ where: { handle }, select: { layout: true, status: true } });
    test.skip(!product || product.status !== 'ACTIVE' || product.layout !== key, `${handle} no longer uses ${key}`);
    const file = path.join(FIXTURES, `${key}.html`);
    expect(existsSync(file), file).toBe(true);

    // same capture settings as the original: frozen clock (quotes on the first slide), every lazy photo loaded
    await page.clock.install({ time: T });
    await page.clock.pauseAt(new Date(T.getTime() + 1000));
    await page.goto(`/products/${handle}`, { waitUntil: 'load' });
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += 450) await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.evaluate(async () => {
      window.scrollTo(0, 0);
      document.querySelectorAll('img').forEach((i) => (i.loading = 'eager'));
      await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))));
      await document.fonts.ready;
    });

    const html = await page.evaluate(() => {
      const main = document.querySelector('main')!;
      const kids = [...main.children].filter((k) => k.tagName !== 'SCRIPT').slice(2) as HTMLElement[];
      const fixed = (el: HTMLElement) => {
        const c = el.className;
        if (el.id === 'reviews' || (c.includes('border-t') && c.includes('border-line'))) return false;
        if (c.includes('mt-[30px]') && !c.includes('min-h-') && el.querySelector('h2')) return false; // products from a collection
        return true;
      };
      return kids.filter(fixed).map((k) => k.outerHTML).join('\n');
    });
    expect(sameFontClass(undoAllowed(html))).toBe(sameFontClass(readFileSync(file, 'utf8')));
  });
}
