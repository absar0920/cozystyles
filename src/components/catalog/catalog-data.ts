/**
 * Server-side data for the catalog listing pages (/collections/[handle], /search): the live
 * Shopify-style facets (availability + price), sort orders, discount-tag filter, page slicing and
 * the extra card data the live product card shows (hover image, badges, NEW, stars, swatches).
 *
 * The catalog is small (< 1k products), so the match set is loaded once with light fields and
 * filtered / sorted in JS; only the visible page is loaded with full card data.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { displayPrice, type ProductCardData } from '@/lib/queries';
import type { CardSwatch, ProductCardExtras } from './ProductCard';
import liveCardData from './live-card-data.json';
import swatchColors from './swatch-colors.json';
import swatchVariants from './swatch-variants.json';
import liveSearchOrder from './live-search-order.json';
import liveSoldOut from './live-sold-out.json';
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

const LIVE_RATINGS = liveCardData.ratings as Record<string, number>;
const LIVE_IMAGE_RATIOS = liveCardData.imageRatios as Record<string, number>;
/** Live status bar text per product (driven by a Shopify metafield there; null = no bar). */
const LIVE_STATUSES = liveCardData.statuses as Record<string, string | null>;
/** Products whose every live variant is unavailable: live shows a "Sold Out" bar (scripts/fidelity/catalog.ts). */
const LIVE_SOLD_OUT = new Set(liveSoldOut as string[]);
const SWATCH_COLORS = swatchColors as Record<string, string>;
const COLOR_OPTION = /^colou?rs?$/i;
/** Per product: colour value → image position of its swatch variant + the `.active` colour (scripts/fidelity/catalog.ts). */
const SWATCH_VARIANTS = swatchVariants as Record<string, { active: string | null; images: Record<string, number> }>;
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
  variants: { price: number; inventory: number }[];
};

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
            Number(LIVE_SOLD_OUT.has(a.handle)) - Number(LIVE_SOLD_OUT.has(b.handle)) ||
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

const fullSelect = {
  id: true,
  handle: true,
  title: true,
  hot: true,
  rating: true,
  reviewCount: true,
  productType: true,
  tags: true,
  options: true,
  images: { orderBy: { position: 'asc' as const }, select: { src: true, position: true } },
  variants: {
    orderBy: { position: 'asc' as const },
    select: { price: true, compareAtPrice: true, inventory: true },
  },
} satisfies Prisma.ProductSelect;

type FullRow = Prisma.ProductGetPayload<{ select: typeof fullSelect }>;
/** Card input: image positions are optional (other callers select only `src`; swatch images then fall back to null). */
type CardRow = Omit<FullRow, 'images'> & { images: { src: string; position?: number }[] };

/**
 * Card swatch = one per value of the colour option. `image` is the photo live swaps the card to when
 * the swatch is clicked (`data-srcset`); `active` mirrors live `.product-card-swatch.active`, which is
 * set only on the swatch whose image is the product's featured image (Cooper, Prodotti, Apex… ring one;
 * Majestic, Erin, Como… ring none).
 */
export type CatalogSwatch = CardSwatch & { active: boolean; image: string | null };

function swatchesFor(handle: string, optionsJson: string, images: CardRow['images']): CatalogSwatch[] {
  try {
    const opts = JSON.parse(optionsJson) as { name?: string; values?: string[] }[];
    if (!Array.isArray(opts)) return [];
    const idx = opts.findIndex((o) => o?.name && COLOR_OPTION.test(o.name.trim()));
    if (idx < 0) return [];
    const live = SWATCH_VARIANTS[handle];
    return (opts[idx].values ?? []).map((name) => {
      const pos = live?.images[name];
      return {
        name,
        color: SWATCH_COLORS[name] ?? (CSS_NAME.test(name) ? name.toLowerCase() : '#ccc'),
        active: live?.active === name,
        image: (pos != null ? images.find((im) => im.position === pos)?.src : undefined) ?? null,
      };
    });
  } catch {
    return [];
  }
}
const CSS_NAME = /^[a-z]+$/i;

export function toCatalogCard(p: CardRow): CatalogCard {
  const vs = p.variants;
  const price = displayPrice(vs.map((v) => v.price)) ?? 0;
  const priceOnRequest = price === 0;
  // Shopify `product.compare_at_price` = the lowest compare-at among variants that have one
  // (Concordia Triton: 46,200/66,000 + 68,950/98,500 → "Rs.46,200 Rs.66,000"); shown only above the price.
  const compares = vs.map((v) => v.compareAtPrice).filter((c): c is number => c != null && c > 0);
  const minCompare = compares.length ? Math.min(...compares) : null;
  const compareAtPrice = priceOnRequest || minCompare == null || minCompare <= price ? null : minCompare;
  // Live sale circle = the biggest per-variant discount, not min price vs max compare-at.
  const pcts = vs
    .filter((v) => v.compareAtPrice != null && v.compareAtPrice > v.price && v.price > 0)
    .map((v) => Math.round((((v.compareAtPrice as number) - v.price) / (v.compareAtPrice as number)) * 100));
  const inventory = vs.length ? Math.max(...vs.map((v) => v.inventory)) : 0;
  const tags = tagList(p.tags);
  const liveRating = LIVE_RATINGS[p.handle];
  const liveRatio = LIVE_IMAGE_RATIOS[p.handle];
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
    rating: liveRating ?? p.rating,
    // Live shows Judge.me stars for every product with a live rating; some of those have no local
    // review rows yet, so count at least one so the card's `reviewCount > 0` guard lets them through.
    reviewCount: liveRating != null ? Math.max(1, p.reviewCount) : p.reviewCount,
    productType: p.productType,
    inventory,
    salePercent: pcts.length ? Math.max(...pcts) : null,
    statusLabel:
      p.handle in LIVE_STATUSES
        ? LIVE_STATUSES[p.handle]
        : LIVE_SOLD_OUT.has(p.handle)
          ? 'Sold Out'
          : inventory > 0
            ? 'Ready to ship'
            : 'Pre-Order',
    isNew: tags.includes('New Arrivals'),
    limitedEdition: tags.includes('limited-edition'),
    // Live only shows Judge.me stars for products that actually have reviews there (= have a live rating).
    showRating: liveRating != null,
    swatches: swatchesFor(p.handle, p.options, p.images),
    imageRatio: liveRatio ? liveRatio / 100 : undefined,
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
    variants: { select: { price: true, inventory: true } },
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
    const tag = `discount=${filters.discount}`;
    set = set.filter((r) => tagList(r.tags).includes(tag));
  }
  if (filters.min != null || filters.max != null) {
    const lo = filters.min ?? 0;
    const hi = filters.max ?? Number.MAX_SAFE_INTEGER;
    set = set.filter((r) => r.variants.some((v) => v.price >= lo && v.price <= hi));
  }
  const inStock = (r: LightRow) => r.variants.some((v) => v.inventory > 0);
  const outOfStock = (r: LightRow) => r.variants.length === 0 || r.variants.some((v) => v.inventory <= 0);
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

  const full = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, select: fullSelect }) : [];
  const byId = new Map(full.map((p) => [p.id, p]));
  const items = ids.map((id) => byId.get(id)).filter((p): p is FullRow => p != null).map(toCatalogCard);

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
