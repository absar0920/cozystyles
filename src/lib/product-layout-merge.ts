/**
 * Product page layout saves: payload parsing, validation and the base/merge rule (docs/product-layouts/SPEC.md §3,
 * §5). Pure — every database lookup is passed in through `MergeContext` — so the actions, scripts and tests share it.
 *
 * The merge rule: a section starts from its base (stored row, copied row, snapshot entry or new defaults); owner
 * values are applied on top; derived values (ratios, image sizes, the Coalesce heading pair, pinned products) are
 * recomputed only when the owner changed their input. An untouched section therefore serialises to exactly the
 * stored bytes, and the save skips it.
 */
import { isRichTextEmpty, richTextToPlainText, sanitizeRichTextWith } from './rich-text/sanitize';
import { normalizeHref, validateHref } from './links';
import { isIconKey } from './product-layout-icons';
import { MAX_LAYOUT_NAME } from './product-layouts';
import {
  HEADING_SIZES,
  MAX_FEATURED_PER_LAYOUT,
  MAX_ICON_BLOCKS,
  MAX_SECTIONS,
  MAX_SLIDES,
  MAX_TESTIMONIALS,
  SECTION_KIND_COPY,
  SINGLETON_KINDS,
  fracOf,
  isSectionKind,
  newSectionDefaults,
  parseSectionData,
  ratioOf,
  sectionRefs,
  serializeSectionData,
  splitFirstWord,
  type FeaturedCollectionData,
  type HeadingSize,
  type ImageTextData,
  type LayoutSnapshot,
  type OverlayData,
  type SectionData,
  type SectionKind,
  type Slide,
  type SlideshowData,
  type SnapshotSection,
  type TestimonialSize,
} from './product-layout-sections';
import {
  MAX_AUTHOR,
  MAX_BODY_HTML,
  MAX_BUTTON_LABEL,
  MAX_DESCRIPTION,
  MAX_HEADING,
  MAX_ICON_TEXT,
  MAX_ICON_TITLE,
  MAX_OVERLAY_HEADING,
  MAX_OVERLAY_TEXT,
  MAX_QUOTE,
  MAX_SUBHEADING,
  cleanText,
  imageTextHeading,
  type DraftSection,
  type FeaturedValues,
  type IconsValues,
  type ImageTextValues,
  type LayoutDraft,
  type OverlayValues,
  type SectionBase,
  type SectionErrors,
  type SlideshowValues,
  type TestimonialsValues,
} from './product-layout-draft';

export const MAX_PAYLOAD_BYTES = 512 * 1024;
const GENERIC = 'Something went wrong. Please reload the page and try again.';

/** An owner mistake or a malformed payload: shown as a friendly message, never thrown to the error boundary. */
export class LayoutInputError extends Error {
  constructor(
    message: string,
    public field?: 'name' | 'description',
    public stale = false,
  ) {
    super(message);
  }
}

/* -------------------------------------------------------------------------------------- payload parse */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => {
  if (typeof v !== 'string') throw new LayoutInputError(GENERIC);
  return v;
};
const bool = (v: unknown): boolean => {
  if (typeof v !== 'boolean') throw new LayoutInputError(GENERIC);
  return v;
};
const int = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw new LayoutInputError(GENERIC);
  return v;
};
const arr = (v: unknown, max: number, tooMany: string): unknown[] => {
  if (!Array.isArray(v)) throw new LayoutInputError(GENERIC);
  if (v.length > max) throw new LayoutInputError(tooMany);
  return v;
};
const key = (v: unknown): string => {
  const k = str(v);
  if (!k || k.length > 80) throw new LayoutInputError(GENERIC);
  return k;
};
const headingSize = (v: unknown): HeadingSize => {
  if (!(HEADING_SIZES as readonly unknown[]).includes(v)) throw new LayoutInputError(GENERIC);
  return v as HeadingSize;
};

function parseBase(v: unknown): SectionBase {
  if (!isObj(v)) throw new LayoutInputError(GENERIC);
  switch (v.from) {
    case 'stored':
    case 'copy':
      return { from: v.from, id: int(v.id) };
    case 'previous':
    case 'original':
      return { from: v.from, index: int(v.index) };
    case 'new':
      return { from: 'new' };
    default:
      throw new LayoutInputError(GENERIC);
  }
}

function parseValues(kind: SectionKind, v: unknown): DraftSection['values'] {
  if (!isObj(v)) throw new LayoutInputError(GENERIC);
  switch (kind) {
    case 'overlay':
      return { image: str(v.image), subheading: str(v.subheading), heading: str(v.heading), headingClass: headingSize(v.headingClass) } satisfies OverlayValues;
    case 'imageText': {
      const b = v.button;
      return {
        image: str(v.image),
        heading: str(v.heading),
        headingStyle: v.headingStyle === 'narrow' ? 'narrow' : 'standard',
        headingClass: headingSize(v.headingClass),
        imageFirst: bool(v.imageFirst),
        size: v.size === 'large' ? 'large' : 'medium',
        center: bool(v.center),
        disableBottom: bool(v.disableBottom),
        button: b == null ? null : isObj(b) ? { label: str(b.label), href: str(b.href) } : (() => { throw new LayoutInputError(GENERIC); })(),
      } satisfies ImageTextValues;
    }
    case 'icons':
      return {
        blocks: arr(v.blocks, MAX_ICON_BLOCKS, `An icons row can have up to ${MAX_ICON_BLOCKS} icons.`).map((b) => {
          if (!isObj(b)) throw new LayoutInputError(GENERIC);
          return { key: key(b.key), icon: isIconKey(b.icon) ? b.icon : 'delivery', title: str(b.title), text: str(b.text) };
        }),
      } satisfies IconsValues;
    case 'testimonials': {
      const size: TestimonialSize = v.size === 'text-medium' || v.size === 'text-large' ? v.size : 'text-small';
      return {
        subheading: str(v.subheading),
        heading: str(v.heading),
        size,
        items: arr(v.items, MAX_TESTIMONIALS, `Customer quotes can have up to ${MAX_TESTIMONIALS} quotes.`).map((t) => {
          if (!isObj(t)) throw new LayoutInputError(GENERIC);
          return { key: key(t.key), quote: str(t.quote), author: str(t.author) };
        }),
      } satisfies TestimonialsValues;
    }
    case 'slideshow':
      return {
        slides: arr(v.slides, MAX_SLIDES, `A slideshow can have up to ${MAX_SLIDES} slides.`).map((s) => {
          if (!isObj(s)) throw new LayoutInputError(GENERIC);
          return { key: key(s.key), desktop: str(s.desktop), mobile: str(s.mobile) };
        }),
      } satisfies SlideshowValues;
    case 'featuredCollection': {
      const limit = v.limit === 4 || v.limit === 8 || v.limit === 12 ? v.limit : v.limit === null ? null : 8;
      return { heading: str(v.heading), collectionId: v.collectionId == null ? null : int(v.collectionId), limit } satisfies FeaturedValues;
    }
    default:
      return {};
  }
}

/** Strict parse of a draft (types checked, unknown keys dropped, count limits first). Throws `LayoutInputError`. */
export function parseLayoutDraft(raw: unknown): LayoutDraft {
  try {
    if (JSON.stringify(raw ?? null).length > MAX_PAYLOAD_BYTES) throw new LayoutInputError('This layout is too big to save. Remove some sections or text.');
  } catch (e) {
    if (e instanceof LayoutInputError) throw e;
    throw new LayoutInputError(GENERIC);
  }
  if (!isObj(raw)) throw new LayoutInputError(GENERIC);
  const sectionsRaw = arr(raw.sections, MAX_SECTIONS, `A layout can have up to ${MAX_SECTIONS} sections.`);
  const keys = new Set<string>();
  const sections: DraftSection[] = sectionsRaw.map((s) => {
    if (!isObj(s) || !isSectionKind(s.kind)) throw new LayoutInputError(GENERIC);
    const k = key(s.key);
    if (keys.has(k)) throw new LayoutInputError(GENERIC);
    keys.add(k);
    const kind = s.kind;
    return { key: k, kind, base: parseBase(s.base), hidden: bool(s.hidden), bodyHtml: typeof s.bodyHtml === 'string' ? s.bodyHtml : '', values: parseValues(kind, s.values) } as DraftSection;
  });
  for (const kind of SINGLETON_KINDS) {
    if (sections.filter((s) => s.kind === kind).length > 1) {
      const name = SECTION_KIND_COPY[kind].name.replace(/\s*\(automatic\)$/, '');
      // "“You may also like”" already carries its quotes
      throw new LayoutInputError(`A layout can have only one ${name.startsWith('“') ? name : `“${name}”`} section.`);
    }
  }
  if (sections.filter((s) => s.kind === 'featuredCollection').length > MAX_FEATURED_PER_LAYOUT) {
    throw new LayoutInputError(`A layout can have up to ${MAX_FEATURED_PER_LAYOUT} “Products from a collection” sections.`);
  }
  return { name: str(raw.name), description: str(raw.description), sections };
}

/** Invisible "format" characters (zero-width space/joiners, word joiner, BOM, soft hyphen, direction marks…). */
const INVISIBLE = /\p{Cf}/gu;

/**
 * A layout name or "What it's for" line: `cleanText`, then invisible characters removed and every kind of space
 * (including the no-break spaces that come with text pasted from a web page or Word) turned into one plain space,
 * so a name that looks blank IS blank. Unlike section text, these labels never need U+00A0 to control wrapping.
 */
export function cleanLabel(s: string): string {
  return cleanText(s, false).replace(INVISIBLE, '').replace(/\s+/gu, ' ').trim();
}

/** Name and "What it's for" checks; returns the cleaned values. */
export function cleanLayoutName(name: string, description: string): { name: string; description: string } {
  const n = cleanLabel(name);
  if (!n) throw new LayoutInputError('Please give the layout a name.', 'name');
  if (n.length > MAX_LAYOUT_NAME) throw new LayoutInputError(`Keep the name under ${MAX_LAYOUT_NAME} characters.`, 'name');
  const d = cleanLabel(description);
  if (d.length > MAX_DESCRIPTION) throw new LayoutInputError(`Keep this under ${MAX_DESCRIPTION} characters.`, 'description');
  return { name: n, description: d };
}

/* ------------------------------------------------------------------------------------------- merging */

export type StoredRow = { id: number; kind: string; hidden: boolean; bodyHtml: string; data: string; collectionId: number | null };

export type MergeContext = {
  /** rows a `stored` / `copy` base may point at (this layout's, or the source layout's for "save as new") */
  rows: Map<number, StoredRow>;
  /** whether `stored` bases are allowed (false for "save as new": they are treated as copies) */
  storedAllowed: boolean;
  previous: LayoutSnapshot | null;
  original: LayoutSnapshot | null;
  /** `/uploads/…` URLs that have an Upload row → their pixel size */
  uploads: Map<string, { width: number; height: number }>;
  /** existing collections by id */
  collections: Map<number, { handle: string }>;
};

export type MergedSection = {
  key: string;
  kind: SectionKind;
  /** the row updated in place, or null to create one */
  storedId: number | null;
  hidden: boolean;
  bodyHtml: string;
  data: string;
  refs: string;
  collectionId: number | null;
};

const IMAGE_RE = /^\/(?:uploads\/|images\/pdp\/)[A-Za-z0-9._~\-/]+$/;
const OFF = { headings: false, lists: false, align: false, color: false, images: false, youtube: false } as const;

function tooLong(n: number) {
  return `Keep this under ${n} characters.`;
}

/** Every `/uploads/` URL a draft mentions as a photo (to look up their Upload rows in one query). */
export function draftImageUrls(draft: LayoutDraft): string[] {
  const out = new Set<string>();
  for (const s of draft.sections) {
    if (s.kind === 'overlay' || s.kind === 'imageText') out.add((s.values as OverlayValues).image);
    if (s.kind === 'slideshow') for (const sl of (s.values as SlideshowValues).slides) out.add(sl.desktop).add(sl.mobile);
  }
  return [...out].filter((u) => u.startsWith('/uploads/'));
}

export function draftCollectionIds(draft: LayoutDraft): number[] {
  return [...new Set(draft.sections.flatMap((s) => (s.kind === 'featuredCollection' && (s.values as FeaturedValues).collectionId != null ? [(s.values as FeaturedValues).collectionId!] : [])))];
}

type Base = { kind: SectionKind; data: string; bodyHtml: string; collectionId: number | null; storedId: number | null };

function resolveBase(s: DraftSection, ctx: MergeContext): Base {
  const stale = () => new LayoutInputError('This layout changed; please reload.', undefined, true);
  const b = s.base;
  if (b.from === 'new') {
    const d = newSectionDefaults(s.kind);
    return { kind: s.kind, data: serializeSectionData(s.kind, d.data), bodyHtml: d.bodyHtml, collectionId: null, storedId: null };
  }
  if (b.from === 'stored' || b.from === 'copy') {
    const row = ctx.rows.get(b.id);
    if (!row || row.kind !== s.kind) throw stale();
    return { kind: s.kind, data: row.data, bodyHtml: row.bodyHtml, collectionId: row.collectionId, storedId: b.from === 'stored' && ctx.storedAllowed ? row.id : null };
  }
  const snap = b.from === 'previous' ? ctx.previous : ctx.original;
  const entry: SnapshotSection | undefined = snap?.sections[b.index];
  if (!entry || entry.kind !== s.kind) throw stale();
  return { kind: s.kind, data: entry.data, bodyHtml: entry.bodyHtml, collectionId: entry.collectionId, storedId: null };
}

/** Applies one draft section to its base. Field errors go into `errors`; returns null when there are any. */
function mergeSection(s: DraftSection, base: Base, ctx: MergeContext, errors: Record<string, string>): Omit<MergedSection, 'key' | 'storedId' | 'hidden'> | null {
  const kind = s.kind;
  const baseData = parseSectionData(kind, base.data).data;
  let collectionId: number | null = base.collectionId;

  /** A changed photo must be an upload with a known size; a bundled photo only when the base already had it. */
  const photo = (url: string, field: string, baseUrls: string[], required: boolean): { width: number | null; height: number | null } | null => {
    if (!url) {
      if (required) errors[field] = 'Please add a photo.';
      return null;
    }
    if (!IMAGE_RE.test(url) || url.includes('..') || url.includes('%') || url.length > 500) {
      errors[field] = 'Please upload the photo again.';
      return null;
    }
    if (url.startsWith('/uploads/')) {
      const u = ctx.uploads.get(url);
      if (!u) {
        errors[field] = 'Please upload the photo again.';
        return null;
      }
      return { width: u.width, height: u.height };
    }
    if (!baseUrls.includes(url)) {
      errors[field] = 'Please upload the photo again.';
      return null;
    }
    return { width: null, height: null };
  };

  const text = (raw: string, baseVal: string | null | undefined, field: string, max: number, opts: { required?: string; multiline?: boolean } = {}): string => {
    const v = raw === (baseVal ?? '') ? raw : cleanText(raw, !!opts.multiline);
    if (opts.required && !v.trim()) errors[field] = opts.required;
    else if (v.length > max) errors[field] = tooLong(max);
    return v;
  };

  let bodyHtml = '';
  if (kind === 'overlay' || kind === 'imageText') {
    if (s.bodyHtml === base.bodyHtml) bodyHtml = base.bodyHtml;
    else {
      const cleaned = s.bodyHtml.length > 200_000 ? '' : sanitizeRichTextWith(s.bodyHtml, OFF);
      bodyHtml = isRichTextEmpty(cleaned) ? '' : cleaned;
      if (s.bodyHtml.length > 200_000 || bodyHtml.length > MAX_BODY_HTML) errors.body = 'This text is too long.';
    }
    if (kind === 'overlay' && richTextToPlainText(bodyHtml).length > MAX_OVERLAY_TEXT) errors.body = `Keep the text under ${MAX_OVERLAY_TEXT} characters.`;
  }

  let data: SectionData;
  switch (kind) {
    case 'overlay': {
      const v = s.values as OverlayValues;
      const b = baseData as OverlayData;
      const d: OverlayData = { ...b, headingClass: v.headingClass };
      if (v.image !== b.image) {
        const dims = photo(v.image, 'image', [b.image], true);
        d.image = v.image;
        d.imageWidth = dims?.width ?? null;
        d.imageHeight = dims?.height ?? null;
      } else if (!v.image) errors.image = 'Please add a photo.';
      d.heading = text(v.heading, b.heading, 'heading', MAX_OVERLAY_HEADING, { required: 'Please add a heading.' });
      const sub = text(v.subheading, b.subheading, 'subheading', MAX_SUBHEADING);
      d.subheading = sub === (b.subheading ?? '') ? b.subheading : sub || null;
      data = d;
      break;
    }
    case 'imageText': {
      const v = s.values as ImageTextValues;
      const b = baseData as ImageTextData;
      const d: ImageTextData = {
        ...b,
        headingClass: v.headingClass,
        imageFirst: v.imageFirst,
        size: v.size,
        center: v.center,
        disableBottom: v.disableBottom,
      };
      if (v.image !== b.image) {
        const dims = photo(v.image, 'image', [b.image], true);
        d.image = v.image;
        d.imageWidth = dims?.width ?? null;
        d.imageHeight = dims?.height ?? null;
        if (dims?.width && dims.height) d.ratio = ratioOf(dims.width, dims.height);
      } else if (!v.image) errors.image = 'Please add a photo.';
      const was = imageTextHeading(b);
      if (v.heading !== was.heading || v.headingStyle !== was.headingStyle) {
        const t = text(v.heading, null, 'heading', MAX_HEADING);
        if (v.headingStyle === 'narrow' && t) {
          d.condensed = true;
          d.heading = null;
          d.headingThin = splitFirstWord(t);
        } else {
          d.condensed = false;
          d.heading = t;
          d.headingThin = null;
        }
      }
      const hasHeading = !!(d.headingThin ? d.headingThin.join('') : d.heading)?.trim();
      if (!hasHeading && !bodyHtml) errors.heading = 'Add a heading or some text.';
      if (v.button) {
        const label = text(v.button.label, b.button?.label, 'buttonLabel', MAX_BUTTON_LABEL, { required: 'Please add the button text.' });
        let href = v.button.href;
        if (href !== (b.button?.href ?? null)) {
          href = normalizeHref(href);
          const err = validateHref(href, { allowEmpty: true });
          if (err) errors.buttonHref = err;
        }
        d.button = { href, label };
      } else d.button = null;
      data = d;
      break;
    }
    case 'icons': {
      const v = s.values as IconsValues;
      if (!v.blocks.length) errors.blocks = 'Add at least one icon.';
      data = {
        blocks: v.blocks.map((bl) => ({
          icon: bl.icon,
          title: text(bl.title, null, `blocks.${bl.key}.title`, MAX_ICON_TITLE, { required: 'Please add a title.' }),
          text: text(bl.text, null, `blocks.${bl.key}.text`, MAX_ICON_TEXT, { multiline: true }),
        })),
      };
      break;
    }
    case 'testimonials': {
      const v = s.values as TestimonialsValues;
      const b = baseData as { subheading: string | null };
      if (!v.items.length) errors.items = 'Add at least one quote.';
      const sub = text(v.subheading, b.subheading, 'subheading', MAX_SUBHEADING);
      data = {
        subheading: sub === (b.subheading ?? '') ? b.subheading : sub || null,
        heading: text(v.heading, null, 'heading', MAX_HEADING, { required: 'Please add a heading.' }),
        size: v.size,
        items: v.items.map((t) => ({
          quote: text(t.quote, null, `items.${t.key}.quote`, MAX_QUOTE, { required: 'Please add the quote.', multiline: true }),
          author: text(t.author, null, `items.${t.key}.author`, MAX_AUTHOR, { required: "Please add the customer's name." }),
        })),
      };
      break;
    }
    case 'slideshow': {
      const v = s.values as SlideshowValues;
      const b = baseData as SlideshowData;
      if (!v.slides.length) errors.slides = 'Add at least one slide.';
      const baseUrls = b.slides.flatMap((x) => [x.desktop, x.mobile ?? '']).filter(Boolean);
      data = {
        slides: v.slides.map((sl): Slide => {
          const same = b.slides.find((x) => x.desktop === sl.desktop);
          let desktop: Pick<Slide, 'desktopWidth' | 'desktopHeight' | 'desktopRatio'>;
          if (same) desktop = { desktopWidth: same.desktopWidth, desktopHeight: same.desktopHeight, desktopRatio: same.desktopRatio };
          else {
            const dims = photo(sl.desktop, `slides.${sl.key}.desktop`, baseUrls, true);
            desktop = {
              desktopWidth: dims?.width ?? null,
              desktopHeight: dims?.height ?? null,
              desktopRatio: dims?.width && dims.height ? fracOf(dims.width, dims.height) : 0.385,
            };
          }
          let mobile: Pick<Slide, 'mobile' | 'mobileWidth' | 'mobileHeight' | 'mobileRatio'> = { mobile: null, mobileWidth: null, mobileHeight: null, mobileRatio: null };
          if (sl.mobile) {
            const sameM = b.slides.find((x) => x.mobile === sl.mobile);
            if (sameM) mobile = { mobile: sl.mobile, mobileWidth: sameM.mobileWidth, mobileHeight: sameM.mobileHeight, mobileRatio: sameM.mobileRatio };
            else {
              const dims = photo(sl.mobile, `slides.${sl.key}.mobile`, baseUrls, false);
              mobile = {
                mobile: sl.mobile,
                mobileWidth: dims?.width ?? null,
                mobileHeight: dims?.height ?? null,
                mobileRatio: dims?.width && dims.height ? fracOf(dims.width, dims.height) : null,
              };
            }
          }
          return { desktop: sl.desktop, ...desktop, ...mobile };
        }),
      };
      break;
    }
    case 'featuredCollection': {
      const v = s.values as FeaturedValues;
      const b = baseData as FeaturedCollectionData;
      const d: FeaturedCollectionData = { ...b, heading: text(v.heading, b.heading, 'heading', MAX_HEADING, { required: 'Please add a heading.' }) };
      const picked = v.collectionId != null ? ctx.collections.get(v.collectionId) : undefined;
      if (v.collectionId == null || !picked) {
        errors.collection = v.collectionId == null && base.collectionId == null && b.collection ? 'The collection was deleted — pick another.' : 'Please choose a collection.';
      } else if (v.collectionId === base.collectionId) {
        d.limit = v.limit === null && b.limit !== null ? b.limit : v.limit;
      } else {
        collectionId = v.collectionId;
        d.collection = picked.handle;
        d.handles = [];
        d.limit = v.limit ?? 8;
      }
      if (v.collectionId != null && picked) collectionId = v.collectionId;
      data = d;
      break;
    }
    default:
      data = {};
  }

  if (Object.keys(errors).length) return null;
  const serialized = serializeSectionData(kind, data);
  const parsed = parseSectionData(kind, serialized).data;
  return { kind, bodyHtml, data: serialized, refs: sectionRefs(kind, parsed, bodyHtml), collectionId: kind === 'featuredCollection' ? collectionId : null };
}

/**
 * Validates and merges every section of a draft. Throws `LayoutInputError` for structural problems (a base that
 * doesn't belong to the layout → stale); field problems come back in `errors` keyed by section key.
 */
export function mergeLayoutDraft(draft: LayoutDraft, ctx: MergeContext): { sections: MergedSection[]; errors: SectionErrors } {
  const errors: SectionErrors = {};
  const sections: MergedSection[] = [];
  const usedStored = new Set<number>();
  for (const s of draft.sections) {
    const base = resolveBase(s, ctx);
    // the same stored row can be updated only once; a second claim becomes a copy
    const storedId = base.storedId != null && !usedStored.has(base.storedId) ? base.storedId : null;
    if (storedId != null) usedStored.add(storedId);
    const e: Record<string, string> = {};
    const merged = mergeSection(s, base, ctx, e);
    if (!merged) {
      errors[s.key] = e;
      continue;
    }
    sections.push({ key: s.key, storedId, hidden: s.hidden, ...merged });
  }
  return { sections, errors };
}

/** Snapshot sections (position order) of merged sections. */
export function mergedToSnapshot(sections: MergedSection[]): SnapshotSection[] {
  return sections.map((s) => ({ kind: s.kind, hidden: s.hidden, bodyHtml: s.bodyHtml, data: s.data, collectionId: s.collectionId }));
}
