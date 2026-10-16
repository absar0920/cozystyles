import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { cardStatusLabel, isAvailable } from '@/lib/variant-status';

export type MenuNode = {
  id: number;
  label: string;
  href: string;
  /** MAIN level-2 headings: false = stacked under the previous group in the same mega-menu column. */
  newColumn: boolean;
  children: MenuNode[];
};

export type PriceRange = { min: number; max: number } | null;

export async function getSettingsMap(): Promise<Record<string, string>> {
  const rows = await prisma.siteSetting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function getMenu(location: string): Promise<MenuNode[]> {
  const items = await prisma.menuItem.findMany({
    where: { location },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  });
  // Hidden items are dropped. A dropdown heading (below the top level) whose links are all hidden is dropped
  // too, so it never turns into a plain link in its own column.
  const build = (parentId: number | null, depth: number): MenuNode[] =>
    items
      .filter((i) => i.parentId === parentId && i.enabled)
      .flatMap((i) => {
        const children = build(i.id, depth + 1);
        const hadChildren = items.some((c) => c.parentId === i.id);
        if (depth > 0 && hadChildren && children.length === 0) return [];
        return [{ id: i.id, label: i.label, href: i.href, newColumn: i.newColumn, children }];
      });
  return build(null, 0);
}

/** Home slideshow banners (the only banner location), in display order. */
export async function getBanners() {
  return prisma.banner.findMany({ where: { active: true }, orderBy: [{ position: 'asc' }, { id: 'asc' }] });
}

export type ProductCardData = {
  id: number;
  handle: string;
  title: string;
  price: number;
  priceOnRequest?: boolean;
  compareAtPrice: number | null;
  image: string | null;
  hot: boolean;
  rating: number;
  reviewCount: number;
  productType: string;
  /** Some variant is not SOLD_OUT. */
  available: boolean;
  /** Card status bar (cardStatusLabel): 'Ready to ship' | 'Pre-Order' | 'Sold Out' | null (no bar). */
  statusLabel: string | null;
};

const cardSelect = {
  id: true,
  handle: true,
  title: true,
  hot: true,
  rating: true,
  reviewCount: true,
  productType: true,
  images: { orderBy: { position: 'asc' as const }, take: 1, select: { src: true, alt: true } },
  variants: { orderBy: { position: 'asc' as const }, select: { price: true, compareAtPrice: true, status: true } },
} satisfies Prisma.ProductSelect;

type CardRaw = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

/** Display price: min over variants with price > 0; null when every variant is 0 (design/request items). */
export function displayPrice(prices: number[]): number | null {
  const positive = prices.filter((p) => p > 0);
  return positive.length ? Math.min(...positive) : null;
}

export function toCard(p: CardRaw): ProductCardData & { compareAtPrice: number | null; priceOnRequest: boolean } {
  const vs = p.variants;
  const price = displayPrice(vs.map((v) => v.price)) ?? 0;
  const priceOnRequest = price === 0;
  const compares = vs.map((v) => v.compareAtPrice).filter((c): c is number => c != null && c > price);
  const compareAtPrice = priceOnRequest ? null : compares.length ? Math.max(...compares) : null;
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    price,
    priceOnRequest,
    compareAtPrice,
    image: p.images[0]?.src ?? null,
    hot: p.hot,
    rating: p.rating,
    reviewCount: p.reviewCount,
    productType: p.productType,
    available: vs.some((v) => isAvailable(v.status)),
    statusLabel: cardStatusLabel(vs.map((v) => v.status)),
  };
}

export type ProductListParams = {
  collectionHandle?: string;
  q?: string;
  sort?: string;
  page?: number;
  perPage?: number;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
};

export type ProductListResult = {
  items: ReturnType<typeof toCard>[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
};

const MAX_PRICE_FILTER = 10_000_000;

export async function listProducts(params: ProductListParams): Promise<ProductListResult> {
  const requestedPage = Math.max(1, params.page ?? 1);
  const perPage = Math.min(48, Math.max(1, params.perPage ?? 24));
  const clampPrice = (n: number) => Math.min(MAX_PRICE_FILTER, Math.max(0, n));
  const minPrice = params.minPrice != null ? clampPrice(params.minPrice) : undefined;
  const maxPrice = params.maxPrice != null ? clampPrice(params.maxPrice) : undefined;
  const where: Prisma.ProductWhereInput = { status: 'ACTIVE' };

  if (params.collectionHandle) {
    where.collections = { some: { handle: params.collectionHandle } };
  }
  if (params.q) {
    const q = params.q.trim();
    where.OR = [
      { title: { contains: q } },
      { productType: { contains: q } },
      { tags: { contains: q } },
      { bodyHtml: { contains: q } },
    ];
  }
  if (minPrice != null || maxPrice != null || params.inStockOnly) {
    // ONE `price` object — spreading `price` twice would silently drop minPrice when maxPrice is also set
    where.variants = {
      some: {
        price: {
          ...(minPrice != null ? { gte: minPrice } : {}),
          ...(maxPrice != null ? { lte: maxPrice } : {}),
        },
        ...(params.inStockOnly ? { status: { not: 'SOLD_OUT' } } : {}),
      },
    };
  }

  const total = await prisma.product.count({ where });
  // Clamp AFTER computing total so a huge ?page= can never overflow skip/slice (int64 500s)
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / perPage)));

  let rows;
  if (params.sort === 'price-asc' || params.sort === 'price-desc') {
    // Prisma can't order by a variant aggregate; sort in JS over the full match set (catalog < 1k)
    const all = await prisma.product.findMany({
      where,
      select: { id: true, variants: { select: { price: true } } },
    });
    // Same purchasable-variant price logic as toCard so sort order matches displayed prices
    const priced = all.map((p) => ({
      id: p.id,
      min: displayPrice(p.variants.map((v) => v.price)) ?? Infinity,
    }));
    priced.sort((a, b) => (params.sort === 'price-asc' ? a.min - b.min : b.min - a.min));
    const pageIds = priced.slice((page - 1) * perPage, page * perPage).map((p) => p.id);
    const byId = await prisma.product.findMany({ where: { id: { in: pageIds } }, select: cardSelect });
    const order = new Map(pageIds.map((id, i) => [id, i]));
    rows = byId.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  } else {
    let orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ hot: 'desc' }, { id: 'asc' }];
    switch (params.sort) {
      case 'newest':
        orderBy = [{ createdAt: 'desc' }];
        break;
      case 'title-asc':
        orderBy = [{ title: 'asc' }];
        break;
      case 'title-desc':
        orderBy = [{ title: 'desc' }];
        break;
      case 'created-asc':
        orderBy = [{ createdAt: 'asc' }];
        break;
      case 'best-selling':
      default:
        break;
    }
    rows = await prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: cardSelect,
    });
  }

  return {
    items: rows.map(toCard),
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Product page data: options with their values (and swatches), photos with their "Shows" tag, variants. */
export async function getProductByHandle(handle: string) {
  return prisma.product.findUnique({
    where: { handle },
    include: {
      images: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        include: { optionValue: { select: { id: true, value: true, optionId: true } } },
      },
      variants: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      productOptions: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        include: { values: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } },
      },
      collections: { select: { handle: true, title: true } },
    },
  });
}

export async function getPageByHandle(handle: string) {
  return prisma.page.findUnique({ where: { handle } });
}

export async function getReviewsForProduct(productId: number) {
  return prisma.review.findMany({ where: { productId, approved: true }, orderBy: { createdAt: 'desc' }, take: 20 });
}
