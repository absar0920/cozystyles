import 'server-only';
import { prisma } from '@/lib/db';
import { hrefPathname } from '@/lib/links';
import { refsNeedles } from '@/lib/product-layout-sections';

/**
 * How many places link to any of `hrefs` (matched on the pathname; query and hash ignored).
 * Used by delete confirmations. `exclude` skips the row being deleted in the rich-text count.
 */
export async function countLinkReferences(
  hrefs: string[],
  exclude?: { productId?: number; pageId?: number; collectionId?: number },
): Promise<{ menuItems: number; banners: number; settings: number; richText: number }> {
  const paths = [...new Set(hrefs.map(hrefPathname))].filter((p) => p && p !== '/');
  if (!paths.length) return { menuItems: 0, banners: 0, settings: 0, richText: 0 };
  const matches = (value: string | null | undefined) => !!value && paths.includes(hrefPathname(value.trim()));

  const [menuItems, banners, settings] = await Promise.all([
    prisma.menuItem.findMany({ where: { OR: paths.map((p) => ({ href: { startsWith: p } })) }, select: { href: true } }),
    prisma.banner.findMany({ where: { OR: paths.map((p) => ({ href: { startsWith: p } })) }, select: { href: true } }),
    prisma.siteSetting.findMany({ where: { OR: paths.map((p) => ({ value: { startsWith: p } })) }, select: { value: true } }),
  ]);

  const needles = paths.flatMap((p) => [`href="${p}"`, `href="${p}?`, `href="${p}#`]);
  const anyNeedle = needles.map((n) => ({ contains: n }));
  const [products, pages, collections, layoutSections] = await Promise.all([
    prisma.product.count({
      where: { OR: anyNeedle.map((c) => ({ bodyHtml: c })), ...(exclude?.productId ? { id: { not: exclude.productId } } : {}) },
    }),
    prisma.page.count({
      where: { OR: anyNeedle.map((c) => ({ bodyHtml: c })), ...(exclude?.pageId ? { id: { not: exclude.pageId } } : {}) },
    }),
    prisma.collection.count({
      where: { OR: anyNeedle.map((c) => ({ description: c })), ...(exclude?.collectionId ? { id: { not: exclude.collectionId } } : {}) },
    }),
    // product page layout sections: links in their text, or a button link / text link in the delimited `refs` lines
    prisma.productLayoutSection.count({
      where: {
        OR: [
          ...anyNeedle.map((c) => ({ bodyHtml: c })),
          ...paths.flatMap(refsNeedles).map((n) => ({ refs: { contains: n } })),
        ],
      },
    }),
  ]);

  return {
    menuItems: menuItems.filter((m) => matches(m.href)).length,
    banners: banners.filter((b) => matches(b.href)).length,
    settings: settings.filter((s) => matches(s.value)).length,
    // includes links in product page layouts
    richText: products + pages + collections + layoutSections,
  };
}
