/**
 * Server-side data for the product detail page (live Habitat `product` templates).
 *
 * - `templateFor(layout)`: the below-the-fold sections of the product's page layout (overlay,
 *   image-with-text, icons, testimonials, recommendations, reviews…), extracted from interwood.pk into
 *   `data/templates.json`. Which layout a product uses is `Product.layout` (admin "Page layout").
 * - card queries for "You may also like" and the cushion featured collections.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { CATALOG_CARD_SELECT, toCatalogCard, type CatalogCard } from '@/components/catalog/catalog-data';
import templatesJson from './data/templates.json';

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

/** Sections of a page layout (src/lib/product-layouts.ts keys); unknown → the standard layout. */
export function templateFor(layout: string): PdpSection[] {
  return TEMPLATES[layout] ?? TEMPLATES.default;
}

const cardSelect = CATALOG_CARD_SELECT;

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
