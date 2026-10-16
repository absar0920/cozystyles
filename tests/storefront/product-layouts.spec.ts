import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

/**
 * Product pages render their layout from the database (docs/product-layouts/SPEC.md §13.4). Everything expected
 * is read from the visible `ProductLayoutSection` rows rather than written here as literals, so the spec keeps
 * passing after the owner edits a layout.
 */

const prisma = new PrismaClient();
test.afterAll(async () => {
  await prisma.$disconnect();
});

/** Representative ACTIVE product per layout (SPEC §14.1). */
const PRODUCTS: Record<string, string> = {
  default: 'dawn-manager-chair',
  'coalesce-living': 'linea-arm-chair',
  'decor-cushions': 'cynosure-cushion-cover',
  'blank-template-no-section': 'oryn-2-5-seater-curved-sofa-2',
};

type Rendered = { kind: string; headings: string[]; icons: number; imgs: { src: string; cls: string }[] };

/** The sections under the product block, each classified by its root element's class signature. */
async function renderedSections(page: Page): Promise<Rendered[]> {
  return page.evaluate(() => {
    const main = document.querySelector('main')!;
    const kids = [...main.children].filter((k) => k.tagName !== 'SCRIPT').slice(2) as HTMLElement[];
    const kindOf = (el: HTMLElement): string => {
      const c = el.className;
      if (el.id === 'reviews' || el.querySelector(':scope > #reviews')) return 'reviews';
      if (c.includes('border-t') && c.includes('border-line')) return 'recommendations';
      if (c.includes('bg-cream')) return 'icons';
      if (c.includes('overflow-hidden') && c.includes('text-cream')) return 'testimonials';
      if (c.includes('min-h-[500px]')) return 'overlay';
      if (c.includes('flow-root')) return 'imageText';
      if (c.includes('mt-[30px]')) return el.querySelector('h2') ? 'featuredCollection' : 'slideshow';
      return `unknown:${c.slice(0, 40)}`;
    };
    const text = (e: Element) => ((e as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim();
    return kids.map((el) => ({
      kind: kindOf(el),
      headings: [...el.querySelectorAll('h2, h3')].map(text),
      icons: el.className.includes('bg-cream') ? el.querySelectorAll('h6').length : 0,
      imgs: [...el.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src') ?? '', cls: i.className })),
    }));
  });
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

for (const [key, handle] of Object.entries(PRODUCTS)) {
  test(`${key}: sections, order and content come from the database`, async ({ page }) => {
    const product = await prisma.product.findUnique({ where: { handle }, select: { layout: true, status: true } });
    test.skip(!product || product.status !== 'ACTIVE' || product.layout !== key, `${handle} no longer uses ${key}`);
    const layout = await prisma.productLayout.findUniqueOrThrow({
      where: { key },
      select: { sections: { where: { hidden: false }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { kind: true, data: true, collectionId: true } } },
    });
    // featured rows whose collection is gone are skipped by the store
    const rows = layout.sections.filter((r) => r.kind !== 'featuredCollection' || r.collectionId != null);

    await page.goto(`/products/${handle}`);
    await expect(page.locator('main')).toBeVisible();
    const got = await renderedSections(page);
    expect(got.map((g) => g.kind)).toEqual(rows.map((r) => r.kind));

    const headingOf = (kind: string, d: Record<string, unknown>): string | null => {
      if (kind === 'imageText') return d.headingThin ? (d.headingThin as string[]).join('') : ((d.heading as string | null) ?? '');
      if (kind === 'overlay' || kind === 'testimonials' || kind === 'featuredCollection') return d.heading as string;
      return null;
    };
    let firstChecked = false;
    for (const [i, r] of rows.entries()) {
      const d = JSON.parse(r.data) as Record<string, unknown>;
      const g = got[i];
      const h = headingOf(r.kind, d);
      if (h) {
        expect(g.headings.map(norm), `${r.kind} #${i}`).toContain(norm(h));
        if (!firstChecked) {
          expect(norm(got.find((x) => x.headings.length)!.headings[0])).toBe(norm(h));
          firstChecked = true;
        }
      }
      if (r.kind === 'icons') expect(g.icons).toBe((d.blocks as unknown[]).length);
      if (r.kind === 'imageText' || r.kind === 'overlay') expect(g.imgs[0]?.src).toBe(d.image);
      if (r.kind === 'slideshow') {
        const slides = d.slides as { desktop: string; mobile: string | null }[];
        if (slides.length === 1) {
          expect(g.imgs.find((x) => x.cls.includes('md:block'))?.src).toBe(slides[0].desktop);
          expect(g.imgs.find((x) => x.cls.includes('md:hidden'))?.src).toBe(slides[0].mobile ?? slides[0].desktop);
        } else {
          for (const s of slides) expect(g.imgs.map((x) => x.src)).toContain(s.desktop);
        }
      }
    }
    if (rows.length === 0) expect(got).toEqual([]);
  });
}
