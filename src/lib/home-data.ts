import 'server-only';
import { prisma } from '@/lib/db';
import { cardPrice, toCard } from '@/lib/queries';
import { CARD_SWATCH_SELECT, buildCardSwatches } from '@/lib/card-swatches';
import type { CarouselProduct } from '@/components/home/ProductCarousel';
import type { CategoryTile } from '@/components/home/CategoryTiles';

/**
 * Home page data that the owner controls from the admin:
 * - Hot Selling Products: published products ticked "Best seller" (the star in Admin → Products).
 * - Shop by Category: the Collections page cards (Admin → Collections → Arrange Collections page) that have a photo.
 * - The scrolling strip and the text block at the bottom: Admin → Settings → Home page.
 */

/** Most products / category tiles one home row shows. */
export const HOME_ROW_LIMIT = 24;

/** Settings keys of Admin → Settings → Home page. */
export const HOME_SETTING_KEYS = ['homeStrip', 'homeTextHeading', 'homeText'] as const;

/**
 * "Hot Selling Products": published best sellers, in the Products list's order (most recently changed first, so a
 * product the owner has just starred comes first), at most HOME_ROW_LIMIT. Empty → the row is hidden.
 */
export async function getHotSellingProducts(): Promise<CarouselProduct[]> {
  const rows = await prisma.product.findMany({
    where: { hot: true, status: 'ACTIVE' },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: HOME_ROW_LIMIT,
    select: {
      id: true,
      handle: true,
      title: true,
      hot: true,
      rating: true,
      reviewCount: true,
      productType: true,
      variants: { orderBy: { position: 'asc' }, select: { price: true, compareAtPrice: true, status: true } },
      ...CARD_SWATCH_SELECT,
    },
  });
  return rows.map((row) => ({
    ...toCard({ ...row, images: row.images.slice(0, 1).map((im) => ({ src: im.src, alt: '' })) }),
    hoverImage: row.images[1]?.src ?? null,
    // the same variant as the price and the struck-through price (like every other product card)
    salePercent: cardPrice(row.variants).salePercent,
    showRating: row.reviewCount > 0,
    swatches: buildCardSwatches(row),
  }));
}

/**
 * "Shop by Category": the cards of the store's Collections page, in the same order, keeping those with a cover
 * photo (each collection once), at most HOME_ROW_LIMIT. Empty → the row is hidden.
 */
export async function getCategoryTiles(): Promise<CategoryTile[]> {
  const cards = await prisma.collectionIndexCard.findMany({
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    include: { collection: { select: { handle: true, title: true, image: true } } },
  });
  const seen = new Set<string>();
  const tiles: CategoryTile[] = [];
  for (const c of cards) {
    const handle = c.collection?.handle ?? c.systemHandle;
    const image = c.collection?.image ?? c.systemImage;
    if (!handle || !image || seen.has(handle)) continue;
    seen.add(handle);
    tiles.push({ handle, title: c.collection?.title ?? c.systemTitle ?? '', image });
    if (tiles.length === HOME_ROW_LIMIT) break;
  }
  return tiles;
}

/** The scrolling strip's messages: one per line of the setting, blank lines dropped. Empty → no strip. */
export function stripMessages(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
