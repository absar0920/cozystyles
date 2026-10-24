import { expect, test, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { envValue } from '../helpers/env';
import { robotsRules, ROBOTS_DISALLOW, searchIndexing } from '../../src/lib/seo';
import { DESIGNED_PAGE_ALIASES, DESIGNED_PAGES_WITHOUT_CONTENT } from '../../src/lib/page-kinds';
import { COLLECTION_PER_PAGE, RESERVED_COLLECTION_HANDLES } from '../../src/components/catalog/constants';

/**
 * Search engines: /sitemap.xml lists exactly what a customer can open (checked against the database), every listed
 * address opens, robots.txt fits the deployment (the live shop only), and pages name their clean address as
 * canonical.
 */

const prisma = new PrismaClient();
const ORIGIN = (() => {
  try {
    return new URL(envValue('NEXT_PUBLIC_SITE_URL') ?? '').origin;
  } catch {
    return null;
  }
})();
const stamp = Date.now();
const DRAFT = { handle: `e2e-sitemap-draft-${stamp}`, title: `E2E Sitemap Draft ${stamp}` };
const HIDDEN = { handle: `e2e-sitemap-hidden-${stamp}`, title: `E2E Sitemap Hidden ${stamp}` };

test.beforeAll(async () => {
  await prisma.product.create({ data: { handle: DRAFT.handle, title: DRAFT.title, status: 'DRAFT' } });
  await prisma.page.create({ data: { handle: HIDDEN.handle, title: HIDDEN.title, kind: 'TEXT', published: false } });
});

test.afterAll(async () => {
  await prisma.product.deleteMany({ where: { handle: DRAFT.handle } });
  await prisma.page.deleteMany({ where: { handle: HIDDEN.handle } });
  await prisma.$disconnect();
});

const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

async function sitemap(request: APIRequestContext) {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('xml');
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => unescape(m[1]));
  const images = [...xml.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((m) => unescape(m[1]));
  return { xml, locs, images, paths: locs.map((u) => new URL(u).pathname) };
}

test('only the live shop is open to search engines', () => {
  expect(searchIndexing('https://cozystyle.pk')).toBe(true);
  expect(searchIndexing('https://staging.cozystyle.pk')).toBe(false);
  expect(searchIndexing('http://localhost:3000')).toBe(false);
  expect(searchIndexing(null)).toBe(false);
  expect(searchIndexing('https://staging.cozystyle.pk', 'on')).toBe(true);
  expect(searchIndexing('https://cozystyle.pk', 'off')).toBe(false);

  expect(robotsRules('https://cozystyle.pk')).toEqual({
    rules: { userAgent: '*', allow: '/', disallow: ROBOTS_DISALLOW },
    sitemap: 'https://cozystyle.pk/sitemap.xml',
  });
  expect(ROBOTS_DISALLOW).toEqual(expect.arrayContaining(['/admin', '/api/', '/search', '/*?*sort_by=', '/*?*filter.', '/*?*discount=']));
  expect(robotsRules('https://staging.cozystyle.pk')).toEqual({ rules: { userAgent: '*', disallow: '/' } });
});

test('robots.txt and the noindex tag fit this deployment', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  const home = await (await request.get('/')).text();
  const noindex = /<meta name="robots" content="noindex, nofollow"/.test(home);
  if (searchIndexing(ORIGIN)) {
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    expect(robots).toContain('Disallow: /admin');
    expect(noindex).toBe(false);
  } else {
    expect(robots).toMatch(/User-Agent: \*\s+Disallow: \/\s*$/i);
    expect(robots).not.toContain('Sitemap:');
    expect(noindex).toBe(true);
  }
});

test('the sitemap lists exactly the published pages of the shop', async ({ request }) => {
  const { locs, paths, images } = await sitemap(request);

  const [products, collections, pages] = await Promise.all([
    prisma.product.findMany({ where: { status: 'ACTIVE' }, select: { handle: true } }),
    // a collection with no published product only says "No products found"
    prisma.collection.findMany({ where: { products: { some: { status: 'ACTIVE' } } }, select: { handle: true } }),
    prisma.page.findMany({ where: { published: true }, select: { handle: true, kind: true } }),
  ]);
  const posts = pages.filter((p) => p.kind === 'BLOG');
  const published = new Set(pages.map((p) => p.handle));
  const listedPage = (p: { handle: string; kind: string }) =>
    p.kind === 'TEXT' ||
    (p.kind === 'DESIGNED' && !DESIGNED_PAGES_WITHOUT_CONTENT.includes(p.handle) && !published.has(DESIGNED_PAGE_ALIASES[p.handle] ?? ''));
  const contact = await prisma.page.findUnique({ where: { handle: 'contact' } });
  const expected = new Set([
    '/',
    '/collections',
    ...(products.length ? ['/collections/all'] : []),
    ...collections.filter((c) => !RESERVED_COLLECTION_HANDLES.includes(c.handle)).map((c) => `/collections/${c.handle}`),
    ...products.map((p) => `/products/${p.handle}`),
    ...(!contact || contact.published ? ['/pages/contact'] : []),
    ...pages.filter(listedPage).map((p) => `/pages/${p.handle}`),
    ...(posts.length ? ['/blogs/news'] : []),
    ...posts.map((p) => `/blogs/news/${p.handle.replace(/^news-/, '')}`),
  ]);

  expect(new Set(paths)).toEqual(expected);
  expect(paths).toHaveLength(expected.size); // no address twice
  expect(paths).not.toContain(`/products/${DRAFT.handle}`);
  expect(paths).not.toContain(`/pages/${HIDDEN.handle}`);
  // one host for every address: the shop's own (NEXT_PUBLIC_SITE_URL) when it is set
  expect(new Set(locs.map((u) => new URL(u).origin))).toEqual(new Set([ORIGIN ?? new URL(locs[0]).origin]));
  if (products.length) expect(images.length).toBeGreaterThan(0);
  for (const src of images.slice(0, 20)) {
    const res = await request.get(new URL(src).pathname);
    expect(res.status(), src).toBe(200);
  }
});

/** `n` addresses spread evenly over the list (first and last included). */
function spread<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
}

test('every address in the sitemap opens', async ({ request }) => {
  test.setTimeout(300_000);
  const { paths } = await sitemap(request);
  // every page and post; products and collections share one route each, so an even sample of them (the test
  // above already checks each listed one is published)
  const isProduct = (p: string) => p.startsWith('/products/');
  const isCollection = (p: string) => p.startsWith('/collections/') && p !== '/collections/all';
  const sample = [
    ...paths.filter((p) => !isProduct(p) && !isCollection(p)),
    ...spread(paths.filter(isCollection), 25),
    ...spread(paths.filter(isProduct), 25),
  ];
  const failed: string[] = [];
  for (let i = 0; i < sample.length; i += 8) {
    await Promise.all(
      sample.slice(i, i + 8).map(async (p) => {
        const res = await request.get(p, { maxRedirects: 0 });
        if (res.status() !== 200) failed.push(`${res.status()} ${p}`);
      }),
    );
  }
  expect(failed).toEqual([]);
});

test('pages name their clean address as canonical', async ({ request }) => {
  test.skip(!ORIGIN, 'canonical addresses need NEXT_PUBLIC_SITE_URL');
  const product = await prisma.product.findFirst({ where: { status: 'ACTIVE' }, select: { handle: true, variants: { select: { id: true }, take: 1 } } });
  test.skip(!product, 'no published product');
  const canonicalOf = async (path: string) =>
    (await (await request.get(path)).text()).match(/<link rel="canonical" href="([^"]+)"/)?.[1];

  // every WhatsApp order message links to ?variant=: that address is the product page itself
  expect(await canonicalOf(`/products/${product!.handle}?variant=${product!.variants[0]?.id ?? 1}`)).toBe(`${ORIGIN}/products/${product!.handle}`);
  expect(await canonicalOf('/collections/all?sort_by=price-ascending&filter.v.availability=1')).toBe(`${ORIGIN}/collections/all`);
  expect(await canonicalOf('/collections/all?discount=30&page=2')).toBe(`${ORIGIN}/collections/all`);
  // page 2 onwards lists other products; a number past the end shows (and names) the last page
  const total = await prisma.product.count({ where: { status: 'ACTIVE' } });
  const last = Math.max(1, Math.ceil(total / COLLECTION_PER_PAGE));
  if (last >= 2) expect(await canonicalOf('/collections/all?page=2')).toBe(`${ORIGIN}/collections/all?page=2`);
  expect(await canonicalOf('/collections/all?page=99999')).toBe(last > 1 ? `${ORIGIN}/collections/all?page=${last}` : `${ORIGIN}/collections/all`);
  expect(await canonicalOf('/pages/contact')).toBe(`${ORIGIN}/pages/contact`);
  expect(await canonicalOf('/collections')).toBe(`${ORIGIN}/collections`);
  expect(await canonicalOf('/')).toBe(ORIGIN);
  // the second address of the About Us page names the main one
  const [about, aboutUs] = await Promise.all(['about', 'about-us'].map((handle) => prisma.page.findUnique({ where: { handle } })));
  if (about?.published && about.kind === 'DESIGNED' && aboutUs?.published && aboutUs.kind === 'DESIGNED') {
    expect(await canonicalOf('/pages/about')).toBe(`${ORIGIN}/pages/about-us`);
  }
  // search results are never canonical pages of their own
  expect(await canonicalOf('/search?q=sofa')).toBeUndefined();
});
