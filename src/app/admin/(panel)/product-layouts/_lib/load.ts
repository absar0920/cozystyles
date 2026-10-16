import 'server-only';
import { prisma } from '@/lib/db';
import { resolveLinkTargets, findBrokenLinks, type BrokenLink } from '@/lib/link-targets';
import type { LinkTarget } from '@/lib/links';
import { PROTECTED_LAYOUT_KEYS } from '@/lib/product-layouts';
import {
  isSectionKind,
  parseSectionData,
  parseSnapshot,
  type ImageTextData,
  type LayoutSnapshot,
  type OverlayData,
  type SectionKind,
  type SlideshowData,
} from '@/lib/product-layout-sections';
import {
  sectionWarnings,
  summarizeSections,
  valuesFromData,
  type DraftSection,
  type ImageTextValues,
  type LayoutDraft,
  type LayoutSummaryData,
  type SectionBase,
} from '@/lib/product-layout-draft';

/** Server loaders for the product page layouts admin (SPEC product-layouts §9). */

export type ImageMeta = Record<string, { w: number; h: number }>;

/** A layout as offered by pickers (Move dialog, "Start from", product editor dropdown). */
export type LayoutChoice = { id: number; key: string; name: string; description: string; usedBy: number; drafts: number; summary: LayoutSummaryData };

export type LayoutEditorData = {
  layout: {
    id: number;
    key: string;
    name: string;
    description: string;
    updatedAt: string;
    usedBy: number;
    drafts: number;
    /** when the last save happened (the layout's updatedAt), if "Undo last save" is possible */
    lastSavedAt: string | null;
    isProtected: boolean;
  };
  draft: LayoutDraft;
  previous: LayoutDraft | null;
  original: LayoutDraft | null;
  imageMeta: ImageMeta;
  collections: Record<number, { title: string; products: number }>;
  linkTargets: Record<string, LinkTarget>;
  brokenLinks: Record<string, BrokenLink[]>;
  previewProduct: { id: number; title: string; handle: string } | null;
  layouts: LayoutChoice[];
};

type Row = { id: number; kind: string; hidden: boolean; bodyHtml: string; data: string; collectionId: number | null };

/** Product counts per layout key: all statuses, plus drafts separately. */
export async function layoutUsage(): Promise<Map<string, { total: number; drafts: number }>> {
  const rows = await prisma.product.groupBy({ by: ['layout', 'status'], _count: { _all: true } });
  const out = new Map<string, { total: number; drafts: number }>();
  for (const r of rows) {
    const u = out.get(r.layout) ?? { total: 0, drafts: 0 };
    u.total += r._count._all;
    if (r.status === 'DRAFT') u.drafts += r._count._all;
    out.set(r.layout, u);
  }
  return out;
}

function rowSummary(rows: Row[]): LayoutSummaryData {
  return summarizeSections(
    rows.filter((r) => isSectionKind(r.kind)).map((r) => {
      const kind = r.kind as SectionKind;
      const w = sectionWarnings(kind, valuesFromData(kind, parseSectionData(kind, r.data).data, r.collectionId));
      return { kind, hidden: r.hidden, ...w };
    }),
  );
}

/** Every layout (list order) with used-by counts and its live contents summary. */
export async function loadLayoutChoices(): Promise<LayoutChoice[]> {
  const [layouts, usage] = await Promise.all([
    prisma.productLayout.findMany({
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        sections: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, kind: true, hidden: true, bodyHtml: true, data: true, collectionId: true } },
      },
    }),
    layoutUsage(),
  ]);
  return layouts.map((l) => ({
    id: l.id,
    key: l.key,
    name: l.name,
    description: l.description,
    usedBy: usage.get(l.key)?.total ?? 0,
    drafts: usage.get(l.key)?.drafts ?? 0,
    summary: rowSummary(l.sections),
  }));
}

function draftSection(kind: SectionKind, key: string, base: SectionBase, row: { hidden: boolean; bodyHtml: string; data: string; collectionId: number | null }): DraftSection {
  return { key, kind, base, hidden: row.hidden, bodyHtml: row.bodyHtml, values: valuesFromData(kind, parseSectionData(kind, row.data).data, row.collectionId) } as DraftSection;
}

/** A snapshot as editor sections (bases point into the snapshot). Collections deleted since then are cleared. */
function snapshotDraft(snap: LayoutSnapshot | null, from: 'previous' | 'original', liveCollections: Set<number>): LayoutDraft | null {
  if (!snap) return null;
  return {
    name: snap.name,
    description: snap.description,
    sections: snap.sections.map((s, index) =>
      draftSection(s.kind, `${from[0]}-${index}`, { from, index }, { ...s, collectionId: s.collectionId != null && liveCollections.has(s.collectionId) ? s.collectionId : null }),
    ),
  };
}

function addImageMeta(meta: ImageMeta, kind: string, data: string) {
  if (!isSectionKind(kind)) return;
  const d = parseSectionData(kind, data).data;
  if (kind === 'overlay' || kind === 'imageText') {
    const o = d as OverlayData | ImageTextData;
    if (!o.image) return;
    if (o.imageWidth && o.imageHeight) meta[o.image] = { w: o.imageWidth, h: o.imageHeight };
    else if (kind === 'imageText') meta[o.image] = { w: 100, h: (d as ImageTextData).ratio };
  }
  if (kind === 'slideshow') {
    for (const s of (d as SlideshowData).slides) {
      meta[s.desktop] = s.desktopWidth && s.desktopHeight ? { w: s.desktopWidth, h: s.desktopHeight } : { w: 1000, h: Math.round(s.desktopRatio * 1000) };
      if (s.mobile) meta[s.mobile] = s.mobileWidth && s.mobileHeight ? { w: s.mobileWidth, h: s.mobileHeight } : { w: 1000, h: Math.round((s.mobileRatio ?? s.desktopRatio) * 1000) };
    }
  }
}

/** Everything the layout editor needs. */
export async function loadLayoutEditorData(id: number): Promise<LayoutEditorData | null> {
  const layout = await prisma.productLayout.findUnique({
    where: { id },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      updatedAt: true,
      previousVersion: true,
      originalVersion: true,
      sections: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, kind: true, hidden: true, bodyHtml: true, data: true, collectionId: true } },
    },
  });
  if (!layout) return null;

  const rows = layout.sections.filter((r) => isSectionKind(r.kind));
  const previousSnap = parseSnapshot(layout.previousVersion);
  const originalSnap = parseSnapshot(layout.originalVersion);
  const allCollectionIds = [
    ...new Set(
      [...rows, ...(previousSnap?.sections ?? []), ...(originalSnap?.sections ?? [])].map((r) => r.collectionId).filter((x): x is number => x != null),
    ),
  ];

  const [usage, collections, choices] = await Promise.all([
    layoutUsage(),
    allCollectionIds.length
      ? prisma.collection.findMany({ where: { id: { in: allCollectionIds } }, select: { id: true, title: true, _count: { select: { products: true } } } })
      : Promise.resolve([]),
    loadLayoutChoices(),
  ]);
  const live = new Set(collections.map((c) => c.id));

  const draft: LayoutDraft = {
    name: layout.name,
    description: layout.description,
    sections: rows.map((r) => draftSection(r.kind as SectionKind, `s-${r.id}`, { from: 'stored', id: r.id }, r)),
  };

  const imageMeta: ImageMeta = {};
  for (const r of rows) addImageMeta(imageMeta, r.kind, r.data);
  for (const s of [...(previousSnap?.sections ?? []), ...(originalSnap?.sections ?? [])]) addImageMeta(imageMeta, s.kind, s.data);

  const all = [...draft.sections];
  const previous = snapshotDraft(previousSnap, 'previous', live);
  const original = snapshotDraft(originalSnap, 'original', live);
  for (const d of [previous, original]) if (d) all.push(...d.sections);

  const hrefs = all.flatMap((s) => (s.kind === 'imageText' && (s.values as ImageTextValues).button?.href ? [(s.values as ImageTextValues).button!.href] : []));
  const [linkTargets, broken] = await Promise.all([
    hrefs.length ? resolveLinkTargets(hrefs) : Promise.resolve({}),
    Promise.all(draft.sections.map(async (s) => [s.key, s.bodyHtml ? await findBrokenLinks(s.bodyHtml) : []] as const)),
  ]);

  const u = usage.get(layout.key) ?? { total: 0, drafts: 0 };
  const previewProduct =
    (await prisma.product.findFirst({ where: { layout: layout.key, status: 'ACTIVE' }, orderBy: { id: 'asc' }, select: { id: true, title: true, handle: true } })) ??
    (await prisma.product.findFirst({ where: { layout: layout.key }, orderBy: { id: 'asc' }, select: { id: true, title: true, handle: true } }));

  return {
    layout: {
      id: layout.id,
      key: layout.key,
      name: layout.name,
      description: layout.description,
      updatedAt: layout.updatedAt.toISOString(),
      usedBy: u.total,
      drafts: u.drafts,
      lastSavedAt: previousSnap ? layout.updatedAt.toISOString() : null,
      isProtected: PROTECTED_LAYOUT_KEYS.includes(layout.key),
    },
    draft,
    previous,
    original,
    imageMeta,
    collections: Object.fromEntries(collections.map((c) => [c.id, { title: c.title.replace(/&amp;/g, '&'), products: c._count.products }])),
    linkTargets,
    brokenLinks: Object.fromEntries(broken.filter(([, b]) => b.length)),
    previewProduct,
    layouts: choices,
  };
}
