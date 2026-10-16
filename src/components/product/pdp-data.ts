/**
 * Server-side data for the product detail page.
 *
 * - `getLayoutSections(key)`: the visible below-the-fold sections of a product page layout (overlay,
 *   image-with-text, icons, testimonials, recommendations, reviews…), read from `ProductLayout` /
 *   `ProductLayoutSection` (docs/product-layouts/SPEC.md §6). Which layout a product uses is `Product.layout`.
 * - `getLayoutSectionsForPreview(token)`: the same for an admin's unsaved "Preview changes" snapshot.
 * - card queries for "You may also like" and the "Products from a collection" rows.
 */
import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { CATALOG_CARD_SELECT, toCatalogCard, type CatalogCard } from '@/components/catalog/catalog-data';
import { sanitizeRichText } from '@/lib/rich-text/sanitize';
import { DEFAULT_LAYOUT_KEY } from '@/lib/product-layouts';
import {
  isSectionKind,
  parseSectionData,
  parseSnapshot,
  type FeaturedCollectionData,
  type FeaturedLimit,
  type IconBlock,
  type IconsData,
  type ImageTextData,
  type OverlayData,
  type SlideshowData,
  type TestimonialsData,
  type SectionKind,
  type Slide,
} from '@/lib/product-layout-sections';

export type OverlaySection = {
  kind: 'overlay';
  id: number;
  image: string;
  subheading: string | null;
  heading: string;
  headingClass: string;
  html: string;
};
export type ImageTextSection = {
  kind: 'imageText';
  id: number;
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
  /** `href` "" = no link (rendered as "#"). */
  button: { href: string; label: string } | null;
  condensed: boolean;
};
export type IconsSection = { kind: 'icons'; id: number; blocks: IconBlock[] };
export type TestimonialsSection = {
  kind: 'testimonials';
  id: number;
  subheading: string | null;
  heading: string;
  size: string;
  items: { quote: string; author: string }[];
};
export type SlideshowSection = { kind: 'slideshow'; id: number; slides: Slide[] };
export type FeaturedCollectionSection = {
  kind: 'featuredCollection';
  id: number;
  heading: string;
  /** Handle of the referenced collection (the `collectionId` relation). */
  collection: string;
  /** "Pinned first" sort order only. */
  handles: string[];
  limit: FeaturedLimit | null;
};
export type PdpSection =
  | OverlaySection
  | ImageTextSection
  | IconsSection
  | TestimonialsSection
  | SlideshowSection
  | FeaturedCollectionSection
  | { kind: 'recommendations'; id: number }
  | { kind: 'reviews'; id: number };

type SectionRow = { id: number; kind: string; bodyHtml: string; data: string; collectionHandle: string | null };

const warned = new Set<string>();
function warnOnce(msg: string) {
  if (warned.has(msg)) return;
  warned.add(msg);
  console.warn(msg);
}

/** A stored row → the renderer's section, or null when it can't be shown (incomplete, deleted collection). */
function toPdpSection(row: SectionRow, where: string): PdpSection | null {
  if (!isSectionKind(row.kind)) {
    warnOnce(`product layout ${where}: section ${row.id} has an unknown kind "${row.kind}", skipped`);
    return null;
  }
  const kind: SectionKind = row.kind;
  const { data, complete } = parseSectionData(kind, row.data);
  if (!complete) {
    warnOnce(`product layout ${where}: ${kind} section ${row.id} is incomplete, skipped`);
    return null;
  }
  const id = row.id;
  switch (kind) {
    case 'overlay': {
      const d = data as OverlayData;
      return { kind, id, image: d.image, subheading: d.subheading, heading: d.heading, headingClass: d.headingClass, html: sanitizeRichText(row.bodyHtml) };
    }
    case 'imageText': {
      const d = data as ImageTextData;
      return {
        kind,
        id,
        size: d.size,
        imageFirst: d.imageFirst,
        center: d.center,
        disableBottom: d.disableBottom,
        image: d.image,
        ratio: d.ratio,
        headingClass: d.headingClass,
        heading: d.heading,
        headingThin: d.headingThin,
        html: sanitizeRichText(row.bodyHtml),
        button: d.button,
        condensed: d.condensed,
      };
    }
    case 'icons':
      return { kind, id, blocks: (data as IconsData).blocks };
    case 'testimonials': {
      const d = data as TestimonialsData;
      return { kind, id, subheading: d.subheading, heading: d.heading, size: d.size, items: d.items };
    }
    case 'slideshow':
      return { kind, id, slides: (data as SlideshowData).slides };
    case 'featuredCollection': {
      if (!row.collectionHandle) return null; // collection deleted: never show pinned products under an orphaned heading
      const d = data as FeaturedCollectionData;
      return { kind, id, heading: d.heading, collection: row.collectionHandle, handles: d.handles, limit: d.limit };
    }
    default:
      return { kind, id };
  }
}

const SECTION_SELECT = {
  id: true,
  kind: true,
  bodyHtml: true,
  data: true,
  collection: { select: { handle: true } },
} satisfies Prisma.ProductLayoutSectionSelect;

async function visibleSections(key: string): Promise<PdpSection[] | null> {
  const layout = await prisma.productLayout.findUnique({
    where: { key },
    select: { sections: { where: { hidden: false }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: SECTION_SELECT } },
  });
  if (!layout) return null;
  return layout.sections
    .map((s) => toPdpSection({ id: s.id, kind: s.kind, bodyHtml: s.bodyHtml, data: s.data, collectionHandle: s.collection?.handle ?? null }, key))
    .filter((s): s is PdpSection => !!s);
}

/** Visible sections of a layout, in order. Unknown key → "default"; missing "default" → []. One query (+1 fallback). */
export const getLayoutSections = cache(async (key: string): Promise<PdpSection[]> => {
  const sections = await visibleSections(key);
  if (sections) return sections;
  if (key !== DEFAULT_LAYOUT_KEY) return (await visibleSections(DEFAULT_LAYOUT_KEY)) ?? [];
  return [];
});

/**
 * Sections of an admin's unsaved preview (`ProductLayoutPreview`, SPEC §6.2), or null when the token is unknown or
 * expired. Only call this after checking for an admin session.
 */
export async function getLayoutSectionsForPreview(token: string): Promise<{ layoutId: number; sections: PdpSection[] } | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const row = await prisma.productLayoutPreview.findUnique({ where: { token }, select: { layoutId: true, sections: true, expiresAt: true } });
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  const snap = parseSnapshot(row.sections);
  if (!snap) return null;
  const ids = [...new Set(snap.sections.map((s) => s.collectionId).filter((id): id is number => id != null))];
  const handles = new Map(
    (ids.length ? await prisma.collection.findMany({ where: { id: { in: ids } }, select: { id: true, handle: true } }) : []).map((c) => [c.id, c.handle]),
  );
  // Preview sections have no row ids; negative ids keep React keys unique.
  const sections = snap.sections
    .map((s, i) => (s.hidden ? null : toPdpSection({ id: -(i + 1), kind: s.kind, bodyHtml: s.bodyHtml, data: s.data, collectionHandle: s.collectionId != null ? (handles.get(s.collectionId) ?? null) : null }, 'preview')))
    .filter((s): s is PdpSection => !!s);
  return { layoutId: row.layoutId, sections };
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

/**
 * "Products from a collection" rows: the collection's ACTIVE products except `excludeId`, pinned `handles` first
 * (sort order only), then by id; at most `limit` cards when set.
 */
export async function getFeaturedCards(section: FeaturedCollectionSection, excludeId?: number): Promise<CatalogCard[]> {
  const rows = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      collections: { some: { handle: section.collection } },
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
    },
    select: cardSelect,
  });
  const pos = new Map(section.handles.map((h, i) => [h, i]));
  rows.sort((a, b) => (pos.get(a.handle) ?? 999) - (pos.get(b.handle) ?? 999) || a.id - b.id);
  return (section.limit ? rows.slice(0, section.limit) : rows).map((r) => toCatalogCard(r));
}
