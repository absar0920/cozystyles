/**
 * Server-side data for the catalog listing pages (/collections/[handle], /search): the live
 * Shopify-style facets (availability + price), sort orders, discount filter, page slicing and
 * the extra card data the live product card shows (hover image, badges, NEW, stars, swatches).
 * Everything comes from the database (variant status, swatches, photo tags, card photo ratio); only
 * the live search ranking snapshot stays in code.
 *
 * The catalog is small (< 1k products), so the match set is loaded once with light fields and
 * filtered / sorted in JS; only the visible page is loaded with full card data.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { cardPrice, displayPrice, type ProductCardData } from '@/lib/queries';
import { cardStatusLabel, isAvailable } from '@/lib/variant-status';
import { CARD_SWATCH_SELECT, buildCardSwatches } from '@/lib/card-swatches';
import type { CardSwatch, ProductCardExtras } from './ProductCard';
import liveSearchOrder from './live-search-order.json';
import type { CatalogFilters } from './filters';

export type CatalogCard = ProductCardData &
  ProductCardExtras & { compareAtPrice: number | null; priceOnRequest: boolean; swatches: CatalogSwatch[] };

export type CatalogResult = {
  items: CatalogCard[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
  /** Availability facet counts (with the other active filters applied). */
  inStockCount: number;
  outOfStockCount: number;
  /** "The highest price is Rs.…" — max variant price over the unfiltered set. */
  maxPrice: number;
};

/** Live card titles that differ from the product title (the live listing shows a shorter name). */
const CARD_TITLES: Record<string, string> = { 'moda-sofa-set': 'Moda Modular Sofa' };

/**
 * Live search result order (first 10 pages) for common queries, keyed by the lowercased query.
 * Shopify ranks by relevance + sales signals we don't have, so known queries replay the live order.
 */
const LIVE_SEARCH = liveSearchOrder as Record<string, string[]>;
/** Fallback popularity: a handle's best position over all snapshotted queries (lower = more popular). */
const LIVE_POPULARITY = (() => {
  const best = new Map<string, number>();
  for (const handles of Object.values(LIVE_SEARCH)) {
    handles.forEach((h, i) => best.set(h, Math.min(best.get(h) ?? Number.MAX_SAFE_INTEGER, i)));
  }
  return best;
})();
const popularity = (h: string) => LIVE_POPULARITY.get(h) ?? Number.MAX_SAFE_INTEGER;

type LightRow = {
  id: number;
  handle: string;
  title: string;
  productType: string;
  tags: string;
  hot: boolean;
  createdAt: Date;
  discountGroup: number | null;
  variants: { price: number; status: string }[];
};

/** Every variant is SOLD_OUT (or there are none). */
const soldOut = (r: LightRow) => !r.variants.some((v) => isAvailable(v.status));

function tagList(tags: string): string[] {
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function minPrice(r: LightRow): number {
  return displayPrice(r.variants.map((v) => v.price)) ?? 0;
}

/** Relevance for search: title hits outrank type / tag hits; ties keep catalogue order. */
function relevance(r: LightRow, terms: string[]): number {
  const title = r.title.toLowerCase();
  const type = r.productType.toLowerCase();
  const tags = r.tags.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (title.startsWith(t)) score += 12;
    else if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(title)) score += 10;
    else if (title.includes(t)) score += 6;
    if (type.includes(t)) score += 3;
    if (tags.includes(t)) score += 1;
  }
  return score;
}

function sortRows(rows: LightRow[], sort: string, opts: { order?: string[]; terms?: string[] }): LightRow[] {
  const pos = new Map((opts.order ?? []).map((h, i) => [h, i]));
  const manual = (a: LightRow, b: LightRow) =>
    (pos.get(a.handle) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.handle) ?? Number.MAX_SAFE_INTEGER) || a.id - b.id;
  const out = [...rows];
  switch (sort) {
    case 'best-selling':
      return out.sort((a, b) => Number(b.hot) - Number(a.hot) || manual(a, b));
    case 'title-ascending':
      return out.sort((a, b) => a.title.localeCompare(b.title) || a.id - b.id);
    case 'title-descending':
      return out.sort((a, b) => b.title.localeCompare(a.title) || a.id - b.id);
    case 'price-ascending':
      return out.sort((a, b) => minPrice(a) - minPrice(b) || manual(a, b));
    case 'price-descending':
      return out.sort((a, b) => minPrice(b) - minPrice(a) || manual(a, b));
    case 'created-ascending':
      return out.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
    case 'created-descending':
      return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);
    case 'relevance':
      if (opts.terms?.length) {
        const terms = opts.terms;
        const score = new Map(rows.map((r) => [r.id, relevance(r, terms)]));
        const live = new Map((LIVE_SEARCH[terms.join(' ')] ?? []).map((h, i) => [h, i]));
        const livePos = (r: LightRow) => live.get(r.handle) ?? Number.MAX_SAFE_INTEGER;
        return out.sort(
          (a, b) =>
            livePos(a) - livePos(b) ||
            // Shopify search lists unavailable products last ("Sold Out" cards end the live results).
            Number(soldOut(a)) - Number(soldOut(b)) ||
            (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0) ||
            popularity(a.handle) - popularity(b.handle) ||
            Number(b.hot) - Number(a.hot) ||
            a.id - b.id,
        );
      }
      return out.sort(manual);
    default:
      return out.sort(manual);
  }
}

/** Everything a catalog card needs (also used by the product page's "You may also like" rows). */
export const CATALOG_CARD_SELECT = {
  id: true,
  handle: true,
  title: true,
  hot: true,
  rating: true,
  reviewCount: true,
  productType: true,
  isNew: true,
  limitedEdition: true,
  cardImageRatio: true,
  ...CARD_SWATCH_SELECT,
  variants: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    select: { price: true, compareAtPrice: true, status: true },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof CATALOG_CARD_SELECT }>;

/**
 * Card swatch = one per value of the colour option. `image` is the photo tagged with that value (the one
 * live swaps the card to); `active` rings the swatch whose value the product's first photo shows.
 */
export type CatalogSwatch = CardSwatch & { active: boolean; image: string | null };

export function toCatalogCard(p: CardRow): CatalogCard {
  const vs = p.variants;
  // price, struck price and sale circle all come from the cheapest variant (see cardPrice)
  const { price, priceOnRequest, compareAtPrice, salePercent } = cardPrice(vs);
  const statuses = vs.map((v) => v.status);
  return {
    id: p.id,
    handle: p.handle,
    title: CARD_TITLES[p.handle] ?? p.title,
    price,
    priceOnRequest,
    compareAtPrice,
    image: p.images[0]?.src ?? null,
    hoverImage: p.images[1]?.src ?? null,
    hot: p.hot,
    rating: p.rating,
    reviewCount: p.reviewCount,
    productType: p.productType,
    available: statuses.some(isAvailable),
    salePercent,
    statusLabel: cardStatusLabel(statuses),
    isNew: p.isNew,
    limitedEdition: p.limitedEdition,
    // Judge.me stars show only for products that have reviews.
    showRating: p.reviewCount > 0,
    swatches: buildCardSwatches(p),
    imageRatio: p.cardImageRatio ?? undefined,
  };
}

export async function getCatalog(params: {
  collectionHandle?: string;
  /** Live manual ("Featured") order of handles. */
  productOrder?: string[];
  q?: string;
  filters: CatalogFilters;
  perPage: number;
  defaultSort: string;
  /** Infinite scroll: load pages 1..page in one go (no-JS / reload fallback). */
  cumulative?: boolean;
}): Promise<CatalogResult> {
  const { filters, perPage } = params;
  const where: Prisma.ProductWhereInput = { status: 'ACTIVE' };
  if (params.collectionHandle) where.collections = { some: { handle: params.collectionHandle } };

  const terms = (params.q ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (params.q != null) {
    if (!terms.length) return emptyResult(perPage);
    where.AND = terms.map((t) => ({
      OR: [{ title: { contains: t } }, { productType: { contains: t } }, { tags: { contains: t } }, { bodyHtml: { contains: t } }],
    }));
  }

  const lightSelect = {
    id: true,
    handle: true,
    title: true,
    productType: true,
    tags: true,
    hot: true,
    createdAt: true,
    discountGroup: true,
    variants: { select: { price: true, status: true } },
  } satisfies Prisma.ProductSelect;
  let rows: LightRow[] = await prisma.product.findMany({ where, select: lightSelect });
  let productOrder = params.productOrder;
  let sortTerms = terms;
  // Live search is typo-tolerant; a snapshotted query with no local keyword hits replays the live
  // result set. Anything else with no hits gets the live empty state.
  const liveHits = LIVE_SEARCH[terms.join(' ')];
  if (params.q != null && rows.length === 0 && liveHits?.length) {
    rows = await prisma.product.findMany({ where: { status: 'ACTIVE', handle: { in: liveHits } }, select: lightSelect });
    productOrder = liveHits;
    sortTerms = [];
  }

  const maxPrice = rows.reduce((m, r) => Math.max(m, ...r.variants.map((v) => v.price)), 0);

  // Discount (mobile drawer) + price facets first; availability counts are computed on that set.
  let set = rows;
  if (filters.discount) {
    set = set.filter((r) => r.discountGroup === Number(filters.discount));
  }
  if (filters.min != null || filters.max != null) {
    const lo = filters.min ?? 0;
    const hi = filters.max ?? Number.MAX_SAFE_INTEGER;
    set = set.filter((r) => r.variants.some((v) => v.price >= lo && v.price <= hi));
  }
  const inStock = (r: LightRow) => r.variants.some((v) => isAvailable(v.status));
  const outOfStock = (r: LightRow) => r.variants.length === 0 || r.variants.some((v) => !isAvailable(v.status));
  const inStockCount = set.filter(inStock).length;
  const outOfStockCount = set.filter(outOfStock).length;
  if (filters.availability.length) {
    const wantIn = filters.availability.includes('1');
    const wantOut = filters.availability.includes('0');
    set = set.filter((r) => (wantIn && inStock(r)) || (wantOut && outOfStock(r)));
  }

  const sorted = sortRows(set, filters.sort ?? params.defaultSort, { order: productOrder, terms: sortTerms });
  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(filters.page, pages);
  const from = params.cumulative ? 0 : (page - 1) * perPage;
  const ids = sorted.slice(from, page * perPage).map((r) => r.id);

  const full = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, select: CATALOG_CARD_SELECT }) : [];
  const byId = new Map(full.map((p) => [p.id, p]));
  const items = ids.map((id) => byId.get(id)).filter((p): p is CardRow => p != null).map(toCatalogCard);

  return { items, total, page, perPage, pages, inStockCount, outOfStockCount, maxPrice };
}

function emptyResult(perPage: number): CatalogResult {
  return { items: [], total: 0, page: 1, perPage, pages: 1, inStockCount: 0, outOfStockCount: 0, maxPrice: 0 };
}

/** Collection row + its live manual product order (stored by scripts/fidelity/catalog.ts). */
export async function getCatalogCollection(handle: string) {
  const c = await prisma.collection.findUnique({
    where: { handle },
    select: { id: true, handle: true, title: true, description: true, metafield: true },
  });
  if (!c) return null;
  let productOrder: string[] = [];
  try {
    const meta = JSON.parse(c.metafield || '{}');
    if (Array.isArray(meta?.productOrder)) productOrder = meta.productOrder.filter((h: unknown) => typeof h === 'string');
  } catch {
    /* malformed metafield → catalogue order */
  }
  return { ...c, productOrder };
}
