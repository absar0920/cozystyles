/**
 * Server-side data for the product detail page (live Habitat `product` templates).
 *
 * - `templateFor(handle)`: the below-the-fold sections of the live product template the product
 *   uses (overlay, image-with-text, icons, testimonials, recommendations, reviews…), extracted
 *   from interwood.pk into `data/templates.json`; `data/product-templates.json` maps handle →
 *   template suffix (absent = default template).
 * - `variantImageIndex(handle)`: SKU → gallery index of the variant's featured image, so the
 *   gallery opens on / jumps to the selected variant's photo like live.
 * - `preOrderSkus(handle)`: variants live sells as pre-order.
 * - card queries for "You may also like" and the cushion featured collections.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { toCatalogCard, type CatalogCard } from '@/components/catalog/catalog-data';
import swatchColors from '@/components/catalog/swatch-colors.json';
import templatesJson from './data/templates.json';
import productTemplates from './data/product-templates.json';
import variantImages from './data/variant-images.json';
import preorderVariants from './data/preorder-variants.json';

export type OverlaySection = {
  kind: 'overlay';
  image: string;
  subheading: string | null;
  heading: string;
  headingClass: string;
  html: string;
};
export type ImageTextSection = {
  kind: 'imageText';
  size: 'medium' | 'large';
  imageFirst: boolean;
  center: boolean;
  disableBottom: boolean;
  image: string;
  /** image height / width × 100 */
  ratio: number;
  headingClass: string;
  heading: string | null;
  /** Coalesce headings: [thin word, rest] e.g. ["living", " reimagined"]. */
  headingThin: [string, string] | null;
  html: string;
  button: { href: string; label: string } | null;
  condensed: boolean;
};
export type IconsSection = { kind: 'icons'; blocks: { title: string; text: string }[] };
export type TestimonialsSection = {
  kind: 'testimonials';
  subheading: string | null;
  heading: string;
  size: string;
  items: { quote: string; author: string }[];
};
export type SlideshowSection = {
  kind: 'slideshow';
  desktop: string;
  mobile: string;
  desktopRatio: number;
  mobileRatio: number;
};
export type FeaturedCollectionSection = {
  kind: 'featuredCollection';
  heading: string;
  collection: string | null;
  handles: string[];
};
export type PdpSection =
  | OverlaySection
  | ImageTextSection
  | IconsSection
  | TestimonialsSection
  | SlideshowSection
  | FeaturedCollectionSection
  | { kind: 'recommendations' }
  | { kind: 'reviews' };

const TEMPLATES = templatesJson as unknown as Record<string, PdpSection[]>;
const HANDLE_TEMPLATES = productTemplates as Record<string, string>;
const VARIANT_IMAGES = variantImages as Record<string, Record<string, number>>;
const PREORDER_VARIANTS = preorderVariants as Record<string, string[]>;
export const SWATCH_COLORS = swatchColors as Record<string, string>;

export function templateFor(handle: string): PdpSection[] {
  const suffix = HANDLE_TEMPLATES[handle];
  return TEMPLATES[suffix && TEMPLATES[suffix] ? suffix : 'default'] ?? TEMPLATES.default;
}

export function variantImageIndex(handle: string): Record<string, number> {
  return VARIANT_IMAGES[handle] ?? {};
}

/**
 * SKUs sold through the live ReStock "preorder" selling plan (`selling_plan_allocations` in
 * /products/<handle>.js): the buy box shows PRE-ORDER + "What is Pre-Order?" for them.
 */
export function preOrderSkus(handle: string): string[] {
  return PREORDER_VARIANTS[handle] ?? [];
}

/** Live swatch colour for a colour option value (fallback: CSS colour keyword, else grey). */
export function swatchColor(name: string): string {
  return SWATCH_COLORS[name] ?? (/^[a-z]+$/i.test(name) ? name.toLowerCase() : '#ccc');
}

export function tagList(tags: string): string[] {
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

const cardSelect = {
  id: true,
  handle: true,
  title: true,
  hot: true,
  rating: true,
  reviewCount: true,
  productType: true,
  tags: true,
  options: true,
  images: { orderBy: { position: 'asc' as const }, take: 2, select: { src: true } },
  variants: {
    orderBy: { position: 'asc' as const },
    select: { price: true, compareAtPrice: true, inventory: true },
  },
} satisfies Prisma.ProductSelect;

/**
 * "You may also like" (live: Shopify recommendations, 4 cards). Products sharing the most
 * specific collections come first; ties keep best-sellers first.
 */
export async function getRecommendations(productId: number, collectionHandles: string[], limit = 4): Promise<CatalogCard[]> {
  const where: Prisma.ProductWhereInput = {
    id: { not: productId },
    status: 'ACTIVE',
    ...(collectionHandles.length ? { collections: { some: { handle: { in: collectionHandles } } } } : { hot: true }),
  };
  const rows = await prisma.product.findMany({
    where,
    take: 40,
    orderBy: [{ hot: 'desc' }, { id: 'asc' }],
    select: { ...cardSelect, collections: { select: { handle: true } } },
  });
  const wanted = new Set(collectionHandles);
  const scored = rows
    .map((r) => ({ r, shared: r.collections.filter((c) => wanted.has(c.handle)).length }))
    .sort((a, b) => b.shared - a.shared);
  return scored.slice(0, limit).map(({ r }) => toCatalogCard(r));
}

/** Featured-collection carousels (decor-cushions template): live product order, then the rest of the collection. */
export async function getFeaturedCards(section: FeaturedCollectionSection): Promise<CatalogCard[]> {
  const rows = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { handle: { in: section.handles } },
        ...(section.collection ? [{ collections: { some: { handle: section.collection } } }] : []),
      ],
    },
    select: cardSelect,
  });
  const pos = new Map(section.handles.map((h, i) => [h, i]));
  rows.sort((a, b) => (pos.get(a.handle) ?? 999) - (pos.get(b.handle) ?? 999) || a.id - b.id);
  return rows.map((r) => toCatalogCard(r));
}
