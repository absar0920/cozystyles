/**
 * Product page layout sections: shared types and pure helpers (docs/product-layouts/SPEC.md §2.1, §3).
 *
 * A `ProductLayoutSection` row stores its kind-specific fields as JSON in `data` (never shown to the owner), its rich
 * text in `bodyHtml`, and a derived `refs` column (image URLs + link pathnames, one per line) for reference checks.
 *
 * No `server-only`: imported by the storefront loader, the admin actions, the migration, the seed and tests.
 *
 * **Byte-stable round trip:** `serializeSectionData(kind, parseSectionData(kind, s).data) === s` for every `s` that
 * `serializeSectionData` produced. `parseSectionData` never trims or rewrites strings (U+00A0 and `\n` survive) and
 * builds every object in one fixed key order, which `serializeSectionData` keeps.
 */
import { hrefPathname } from './links';
import { extractHrefs, extractUploadUrls } from './rich-text/urls';
import { DEFAULT_ICON, isIconKey, type IconKey } from './product-layout-icons';

export const SECTION_KINDS = [
  'overlay',
  'imageText',
  'icons',
  'testimonials',
  'slideshow',
  'featuredCollection',
  'recommendations',
  'reviews',
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** Kinds offered by "Add section". Product reviews are not part of this store, so they can't be added. */
export const ADDABLE_KINDS: readonly SectionKind[] = SECTION_KINDS.filter((k) => k !== 'reviews');

export const AUTOMATIC_KINDS: readonly SectionKind[] = ['recommendations', 'reviews'];
/** At most one of each per layout. */
export const SINGLETON_KINDS: readonly SectionKind[] = ['recommendations', 'reviews'];
export const MAX_SECTIONS = 20;
export const MAX_FEATURED_PER_LAYOUT = 4;
export const MAX_ICON_BLOCKS = 8;
export const MAX_TESTIMONIALS = 20;
export const MAX_SLIDES = 6;

export function isSectionKind(v: unknown): v is SectionKind {
  return typeof v === 'string' && (SECTION_KINDS as readonly string[]).includes(v);
}

export type HeadingSize = 'h2' | 'h3' | 'h4';
export const HEADING_SIZES: readonly HeadingSize[] = ['h2', 'h3', 'h4'];

export type OverlayData = {
  image: string;
  imageWidth: number | null;
  imageHeight: number | null;
  subheading: string | null;
  heading: string;
  headingClass: HeadingSize;
};
export type ImageTextData = {
  image: string;
  imageWidth: number | null;
  imageHeight: number | null;
  /** image height / width × 100 (derived from the photo; legacy values kept until the photo changes). */
  ratio: number;
  size: 'medium' | 'large';
  imageFirst: boolean;
  center: boolean;
  disableBottom: boolean;
  headingClass: HeadingSize;
  heading: string | null;
  /** Coalesce headings: [thin word, rest] e.g. ["living", " reimagined"]. */
  headingThin: [string, string] | null;
  condensed: boolean;
  /** `href` "" = no link (rendered as "#"). */
  button: { href: string; label: string } | null;
};
export type IconBlock = { icon: IconKey; title: string; text: string };
export type IconsData = { blocks: IconBlock[] };
export type TestimonialSize = 'text-small' | 'text-medium' | 'text-large';
export type TestimonialsData = {
  subheading: string | null;
  heading: string;
  size: TestimonialSize;
  items: { quote: string; author: string }[];
};
export type Slide = {
  desktop: string;
  desktopWidth: number | null;
  desktopHeight: number | null;
  /** height / width of the computer photo (full precision). */
  desktopRatio: number;
  mobile: string | null;
  mobileWidth: number | null;
  mobileHeight: number | null;
  mobileRatio: number | null;
};
export type SlideshowData = { slides: Slide[] };
export type FeaturedLimit = 4 | 8 | 12;
export type FeaturedCollectionData = {
  heading: string;
  /** Handle snapshot, informational ONLY — never a fallback (the `collectionId` column is the reference). */
  collection: string | null;
  /** "Pinned first" sort order only; never adds products. */
  handles: string[];
  /** null = no limit (migrated sections only). */
  limit: FeaturedLimit | null;
};
export type EmptyData = Record<string, never>;

export type SectionDataMap = {
  overlay: OverlayData;
  imageText: ImageTextData;
  icons: IconsData;
  testimonials: TestimonialsData;
  slideshow: SlideshowData;
  featuredCollection: FeaturedCollectionData;
  recommendations: EmptyData;
  reviews: EmptyData;
};
export type SectionData = SectionDataMap[SectionKind];

/* ------------------------------------------------------------------------------------------ helpers */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const posNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const dim = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);
const headingSize = (v: unknown, fallback: HeadingSize): HeadingSize =>
  (HEADING_SIZES as readonly unknown[]).includes(v) ? (v as HeadingSize) : fallback;

/** imageText ratio: height / width × 100, rounded to 4 decimals (matches every migrated value). */
export function ratioOf(w: number, h: number): number {
  return Math.round((h / w) * 100 * 1e4) / 1e4;
}

/** Slideshow ratio: height / width, full precision (like 700/450). */
export function fracOf(w: number, h: number): number {
  return h / w;
}

/** "comfort reimagined" → ["comfort", " reimagined"]; one word → [word, ""]. */
export function splitFirstWord(text: string): [string, string] {
  const i = text.indexOf(' ');
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i)];
}

/* ---------------------------------------------------------------------------------------- per kind */

function parseOverlay(o: Obj): { data: OverlayData; complete: boolean } {
  const data: OverlayData = {
    image: str(o.image),
    imageWidth: dim(o.imageWidth),
    imageHeight: dim(o.imageHeight),
    subheading: strOrNull(o.subheading),
    heading: str(o.heading),
    headingClass: headingSize(o.headingClass, 'h3'),
  };
  return { data, complete: !!data.image && !!data.heading };
}

function parseImageText(o: Obj): { data: ImageTextData; complete: boolean } {
  const imageWidth = dim(o.imageWidth);
  const imageHeight = dim(o.imageHeight);
  const thin = Array.isArray(o.headingThin) && o.headingThin.length === 2 && o.headingThin.every((x) => typeof x === 'string')
    ? ([o.headingThin[0], o.headingThin[1]] as [string, string])
    : null;
  const b = isObj(o.button) ? { href: str(o.button.href), label: str(o.button.label) } : null;
  const data: ImageTextData = {
    image: str(o.image),
    imageWidth,
    imageHeight,
    ratio: posNum(o.ratio) ?? (imageWidth && imageHeight ? ratioOf(imageWidth, imageHeight) : 100),
    size: o.size === 'large' ? 'large' : 'medium',
    imageFirst: bool(o.imageFirst, true),
    center: bool(o.center, false),
    disableBottom: bool(o.disableBottom, false),
    headingClass: headingSize(o.headingClass, 'h3'),
    heading: strOrNull(o.heading),
    headingThin: thin,
    condensed: bool(o.condensed, false),
    button: b,
  };
  return { data, complete: !!data.image };
}

function parseIcons(o: Obj): { data: IconsData; complete: boolean } {
  const blocks = (Array.isArray(o.blocks) ? o.blocks : []).filter(isObj).map(
    (b): IconBlock => ({ icon: isIconKey(b.icon) ? b.icon : DEFAULT_ICON, title: str(b.title), text: str(b.text) }),
  );
  return { data: { blocks }, complete: blocks.length > 0 };
}

function parseTestimonials(o: Obj): { data: TestimonialsData; complete: boolean } {
  const items = (Array.isArray(o.items) ? o.items : []).filter(isObj).map((t) => ({ quote: str(t.quote), author: str(t.author) }));
  const size: TestimonialSize = o.size === 'text-medium' || o.size === 'text-large' ? o.size : 'text-small';
  const data: TestimonialsData = { subheading: strOrNull(o.subheading), heading: str(o.heading), size, items };
  return { data, complete: !!data.heading && items.length > 0 };
}

function parseSlide(s: Obj): Slide {
  const desktopWidth = dim(s.desktopWidth);
  const desktopHeight = dim(s.desktopHeight);
  const mobile = strOrNull(s.mobile) || null;
  const mobileWidth = dim(s.mobileWidth);
  const mobileHeight = dim(s.mobileHeight);
  return {
    desktop: str(s.desktop),
    desktopWidth,
    desktopHeight,
    desktopRatio: posNum(s.desktopRatio) ?? (desktopWidth && desktopHeight ? fracOf(desktopWidth, desktopHeight) : 0.385),
    mobile,
    mobileWidth,
    mobileHeight,
    mobileRatio: mobile ? (posNum(s.mobileRatio) ?? (mobileWidth && mobileHeight ? fracOf(mobileWidth, mobileHeight) : null)) : null,
  };
}

function parseSlideshow(o: Obj): { data: SlideshowData; complete: boolean } {
  // The pre-database shape was a single slide's fields at the top level.
  const raw = Array.isArray(o.slides) ? o.slides : typeof o.desktop === 'string' ? [o] : [];
  const slides = raw.filter(isObj).map(parseSlide).filter((s) => !!s.desktop);
  return { data: { slides }, complete: slides.length > 0 };
}

function parseFeatured(o: Obj): { data: FeaturedCollectionData; complete: boolean } {
  const limit = o.limit === 4 || o.limit === 8 || o.limit === 12 ? o.limit : null;
  const data: FeaturedCollectionData = {
    heading: str(o.heading),
    collection: strOrNull(o.collection),
    handles: (Array.isArray(o.handles) ? o.handles : []).filter((h): h is string => typeof h === 'string'),
    limit,
  };
  return { data, complete: !!data.heading };
}

/**
 * Parses a stored `data` string. Never throws: unreadable JSON or wrong types fall back to defaults, and
 * `complete` is false when a field the renderer needs (photo, heading, at least one block/quote/slide) is missing.
 */
export function parseSectionData<K extends SectionKind>(kind: K, json: string): { data: SectionDataMap[K]; complete: boolean };
export function parseSectionData(kind: SectionKind, json: string): { data: SectionData; complete: boolean } {
  let o: Obj = {};
  try {
    const v: unknown = JSON.parse(json || '{}');
    if (isObj(v)) o = v;
  } catch {
    // fall through with {}
  }
  switch (kind) {
    case 'overlay':
      return parseOverlay(o);
    case 'imageText':
      return parseImageText(o);
    case 'icons':
      return parseIcons(o);
    case 'testimonials':
      return parseTestimonials(o);
    case 'slideshow':
      return parseSlideshow(o);
    case 'featuredCollection':
      return parseFeatured(o);
    default:
      return { data: {}, complete: true };
  }
}

/**
 * The stored `data` string. Re-runs the parser's normaliser so the key order and defaults are always the same,
 * whatever object is passed in (stable output for equal content).
 */
export function serializeSectionData(kind: SectionKind, data: SectionData): string {
  return JSON.stringify(parseSectionData(kind, JSON.stringify(data)).data);
}

/** The images a section shows (in order), from its parsed data. */
export function sectionImages(kind: SectionKind, data: SectionData): string[] {
  switch (kind) {
    case 'overlay':
    case 'imageText':
      return [(data as OverlayData | ImageTextData).image].filter(Boolean);
    case 'slideshow':
      return (data as SlideshowData).slides.flatMap((s) => [s.desktop, s.mobile ?? '']).filter(Boolean);
    default:
      return [];
  }
}

const isInternal = (href: string) => href.startsWith('/') && !href.startsWith('//');

/**
 * The `refs` column value: "\n" + lines.join("\n") + "\n" of the image URLs and internal link pathnames found in
 * `data` and `bodyHtml` ("" when none). Delimited so `contains` searches match whole lines.
 */
export function sectionRefs(kind: SectionKind, data: SectionData, bodyHtml: string): string {
  const lines = new Set<string>();
  for (const img of sectionImages(kind, data)) lines.add(img);
  if (kind === 'imageText') {
    const href = (data as ImageTextData).button?.href ?? '';
    if (isInternal(href)) lines.add(hrefPathname(href));
  }
  for (const url of extractUploadUrls(bodyHtml)) lines.add(url);
  for (const href of extractHrefs(bodyHtml)) if (isInternal(href)) lines.add(hrefPathname(href));
  lines.delete('');
  return lines.size ? `\n${[...lines].join('\n')}\n` : '';
}

/** `contains` needles for a path in the `refs` column (whole line, or followed by a query / hash). */
export function refsNeedles(pathOrUrl: string): string[] {
  return [`\n${pathOrUrl}\n`, `\n${pathOrUrl}?`, `\n${pathOrUrl}#`];
}

/** Defaults for a section added with "+ Add section". */
export function newSectionDefaults(kind: SectionKind, opts: { headingClass?: HeadingSize } = {}): { bodyHtml: string; data: SectionData } {
  switch (kind) {
    case 'overlay':
      return { bodyHtml: '', data: { image: '', imageWidth: null, imageHeight: null, subheading: null, heading: '', headingClass: 'h3' } };
    case 'imageText':
      return {
        bodyHtml: '',
        data: {
          image: '',
          imageWidth: null,
          imageHeight: null,
          ratio: 100,
          size: 'medium',
          imageFirst: true,
          center: false,
          disableBottom: false,
          headingClass: opts.headingClass ?? 'h4',
          heading: '',
          headingThin: null,
          condensed: false,
          button: null,
        },
      };
    case 'icons':
      return { bodyHtml: '', data: { blocks: [{ icon: DEFAULT_ICON, title: '', text: '' }] } };
    case 'testimonials':
      return { bodyHtml: '', data: { subheading: null, heading: '', size: 'text-small', items: [{ quote: '', author: '' }] } };
    case 'slideshow':
      return {
        bodyHtml: '',
        data: {
          slides: [
            { desktop: '', desktopWidth: null, desktopHeight: null, desktopRatio: 0.385, mobile: null, mobileWidth: null, mobileHeight: null, mobileRatio: null },
          ],
        },
      };
    case 'featuredCollection':
      return { bodyHtml: '', data: { heading: '', collection: null, handles: [], limit: 8 } };
    default:
      return { bodyHtml: '', data: {} };
  }
}

/** Owner-facing names and "Add section" descriptions (SPEC §9.4). */
export const SECTION_KIND_COPY: Record<SectionKind, { name: string; description: string }> = {
  overlay: { name: 'Big photo with text', description: 'A full-width photo with a heading and text on top.' },
  imageText: { name: 'Photo and text', description: 'A photo beside a heading, text and an optional button.' },
  icons: { name: 'Icons row', description: 'Small icons with a title and a line of text, on a cream band.' },
  testimonials: { name: 'Customer quotes', description: 'A dark band with quotes from customers that slide by.' },
  slideshow: { name: 'Wide photo slideshow', description: 'One or more full-width photos, with separate phone photos.' },
  featuredCollection: { name: 'Products from a collection', description: 'A row of product cards from a collection you choose.' },
  recommendations: { name: '“You may also like” (automatic)', description: 'Four similar products, chosen automatically.' },
  reviews: { name: 'Customer reviews (not shown on the store)', description: 'Product reviews are switched off for this store.' },
};

/* ---------------------------------------------------------------------------------------- snapshots */

/** One section inside a snapshot (`previousVersion`, `originalVersion`, `ProductLayoutPreview.sections`). */
export type SnapshotSection = { kind: SectionKind; hidden: boolean; bodyHtml: string; data: string; collectionId: number | null };
export type LayoutSnapshot = { v: 1; name: string; description: string; sections: SnapshotSection[] };

export function serializeSnapshot(s: { name: string; description: string; sections: SnapshotSection[] }): string {
  const snap: LayoutSnapshot = {
    v: 1,
    name: s.name,
    description: s.description,
    sections: s.sections.map((x) => ({ kind: x.kind, hidden: x.hidden, bodyHtml: x.bodyHtml, data: x.data, collectionId: x.collectionId })),
  };
  return JSON.stringify(snap);
}

/** Never throws; null for unreadable input. Sections of an unknown kind are dropped. */
export function parseSnapshot(json: string | null | undefined): LayoutSnapshot | null {
  if (!json) return null;
  try {
    const v: unknown = JSON.parse(json);
    if (!isObj(v) || v.v !== 1 || !Array.isArray(v.sections)) return null;
    return {
      v: 1,
      name: str(v.name),
      description: str(v.description),
      sections: v.sections.filter(isObj).flatMap((x): SnapshotSection[] =>
        isSectionKind(x.kind)
          ? [{ kind: x.kind, hidden: x.hidden === true, bodyHtml: str(x.bodyHtml), data: str(x.data, '{}'), collectionId: Number.isInteger(x.collectionId) ? (x.collectionId as number) : null }]
          : [],
      ),
    };
  } catch {
    return null;
  }
}
