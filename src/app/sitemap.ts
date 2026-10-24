import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { DESIGNED_PAGE_ALIASES, DESIGNED_PAGES_WITHOUT_CONTENT, pagePublicPath } from '@/lib/page-kinds';
import { RESERVED_COLLECTION_HANDLES } from '@/components/catalog/constants';
import { siteOrigin } from '@/lib/site-url';

/**
 * /sitemap.xml: every page of the shop with something on it — home, collections that have published products,
 * published products (with their photos), published pages and blog posts — at its canonical address. Built per
 * request (a build never needs the database, and a change in the admin shows here at once). robots.txt points to
 * it on the live shop.
 *
 * Left out on purpose: drafts and hidden pages; empty collections ("No products found" pages count as errors for
 * search engines); search results, blog tag lists and the empty legacy /blogs/blog; addresses that only redirect
 * (/collections/frontpage, /collections/all-1, /blogs, the order-tracking page); designed pages with no content
 * of their own and second addresses of the same page (DESIGNED_PAGE_ALIASES).
 */
export const dynamic = 'force-dynamic';

const MAX_IMAGES_PER_PRODUCT = 10;

async function origin(): Promise<string> {
  const fromEnv = siteOrigin();
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  return `${h.get('x-forwarded-proto') ?? 'http'}://${host}`;
}

/** Absolute, percent-encoded (new URL) and XML-escaped (Next.js writes the URLs into the XML as they are). */
function xmlUrl(base: string, pathOrUrl: string): string {
  return new URL(pathOrUrl, base).href.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await origin();
  const [products, collections, pages, contactRow] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: { handle: true, updatedAt: true, images: { select: { src: true }, orderBy: { position: 'asc' }, take: MAX_IMAGES_PER_PRODUCT } },
      orderBy: { id: 'asc' },
    }),
    prisma.collection.findMany({
      where: { handle: { notIn: [...RESERVED_COLLECTION_HANDLES] }, products: { some: { status: 'ACTIVE' } } },
      select: { handle: true },
      orderBy: { id: 'asc' },
    }),
    prisma.page.findMany({ where: { published: true }, select: { handle: true, kind: true, updatedAt: true }, orderBy: { id: 'asc' } }),
    prisma.page.findUnique({ where: { handle: 'contact' }, select: { published: true, kind: true } }),
  ]);

  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];
  const add = (path: string, extra: Omit<MetadataRoute.Sitemap[number], 'url'> = {}) => {
    if (seen.has(path)) return;
    seen.add(path);
    entries.push({ url: xmlUrl(base, path), ...extra });
  };

  add('/');
  add('/collections');
  if (products.length) add('/collections/all'); // every published product, also without any collection rows
  for (const c of collections) add(`/collections/${c.handle}`);

  for (const p of products) {
    add(`/products/${p.handle}`, {
      lastModified: p.updatedAt,
      ...(p.images.length ? { images: p.images.map((i) => xmlUrl(base, i.src)) } : {}),
    });
  }

  // the built-in Contact us page answers even without a row; a hidden row hides it
  if (!contactRow || (contactRow.published && contactRow.kind !== 'BLOG')) add('/pages/contact');
  const posts = pages.filter((p) => p.kind === 'BLOG');
  const published = new Set(pages.map((p) => p.handle));
  for (const p of pages) {
    if (p.kind === 'BLOG') continue;
    if (p.kind === 'DESIGNED' && DESIGNED_PAGES_WITHOUT_CONTENT.includes(p.handle)) continue;
    const aliasOf = p.kind === 'DESIGNED' ? DESIGNED_PAGE_ALIASES[p.handle] : undefined;
    if (aliasOf && published.has(aliasOf)) continue; // listed under its main address
    add(pagePublicPath(p), { lastModified: p.updatedAt });
  }
  if (posts.length) add('/blogs/news');
  for (const p of posts) add(pagePublicPath(p), { lastModified: p.updatedAt });

  return entries;
}
