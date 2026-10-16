/**
 * Product page layout editor: the draft shapes shared by the admin editor (client) and the save actions (server),
 * plus pure helpers (docs/product-layouts/SPEC.md §3, §9.3). No `server-only`.
 *
 * A draft carries **only owner-controllable values** per section. Derived and hidden legacy values (ratios, image
 * sizes, Coalesce heading pairs, pinned product order…) never travel through the browser: the server starts from the
 * section's `base` (§3) and applies these values on top (the merge rule).
 */
import {
  AUTOMATIC_KINDS,
  SECTION_KIND_COPY,
  type FeaturedCollectionData,
  type FeaturedLimit,
  type HeadingSize,
  type IconsData,
  type ImageTextData,
  type OverlayData,
  type SectionData,
  type SectionKind,
  type SlideshowData,
  type TestimonialSize,
  type TestimonialsData,
} from './product-layout-sections';
import type { IconKey } from './product-layout-icons';

/** Where a section in a save payload starts from (SPEC §3 "The base of a section"). */
export type SectionBase =
  | { from: 'stored'; id: number }
  | { from: 'copy'; id: number }
  | { from: 'previous'; index: number }
  | { from: 'original'; index: number }
  | { from: 'new' };

export type HeadingStyle = 'standard' | 'narrow';

export type OverlayValues = { image: string; subheading: string; heading: string; headingClass: HeadingSize };
export type ImageTextValues = {
  image: string;
  heading: string;
  headingStyle: HeadingStyle;
  headingClass: HeadingSize;
  imageFirst: boolean;
  size: 'medium' | 'large';
  center: boolean;
  disableBottom: boolean;
  button: { label: string; href: string } | null;
};
export type IconBlockValues = { key: string; icon: IconKey; title: string; text: string };
export type IconsValues = { blocks: IconBlockValues[] };
export type QuoteValues = { key: string; quote: string; author: string };
export type TestimonialsValues = { subheading: string; heading: string; size: TestimonialSize; items: QuoteValues[] };
/** `mobile` '' = none. */
export type SlideValues = { key: string; desktop: string; mobile: string };
export type SlideshowValues = { slides: SlideValues[] };
export type FeaturedValues = { heading: string; collectionId: number | null; limit: FeaturedLimit | null };
export type AutomaticValues = Record<string, never>;

export type DraftValuesMap = {
  overlay: OverlayValues;
  imageText: ImageTextValues;
  icons: IconsValues;
  testimonials: TestimonialsValues;
  slideshow: SlideshowValues;
  featuredCollection: FeaturedValues;
  recommendations: AutomaticValues;
  reviews: AutomaticValues;
};
export type DraftValues = DraftValuesMap[SectionKind];

export type DraftSection<K extends SectionKind = SectionKind> = {
  /** stable client key: `s-<id>` for stored rows, random for new ones */
  key: string;
  kind: K;
  base: SectionBase;
  hidden: boolean;
  /** rich text (overlay, imageText); '' otherwise */
  bodyHtml: string;
  values: DraftValuesMap[K];
};

export type LayoutDraft = { name: string; description: string; sections: DraftSection[] };

/** The save / preview payload. `updatedAt` is the layout's ISO timestamp the editor started from. */
export type SaveLayoutInput = { layoutId: number; updatedAt: string; draft: LayoutDraft };

/** Per-section field errors, keyed by the section's client key, then by field name. */
export type SectionErrors = Record<string, Record<string, string>>;

export type LayoutActionError =
  | { ok: false; code: 'INVALID'; error: string; sectionErrors?: SectionErrors; field?: 'name' | 'description' }
  | { ok: false; code: 'STALE'; error: string };

/* ---------------------------------------------------------------------------------------------- limits */

export const MAX_OVERLAY_HEADING = 80;
export const MAX_SUBHEADING = 60;
export const MAX_HEADING = 120;
export const MAX_BUTTON_LABEL = 30;
export const MAX_ICON_TITLE = 40;
export const MAX_ICON_TEXT = 200;
export const MAX_QUOTE = 600;
export const MAX_AUTHOR = 60;
export const MAX_OVERLAY_TEXT = 600;
export const MAX_BODY_HTML = 6000;
export const MAX_DESCRIPTION = 160;

export const HEADING_SIZE_OPTIONS: { value: HeadingSize; label: string }[] = [
  { value: 'h2', label: 'Extra large' },
  { value: 'h3', label: 'Large' },
  { value: 'h4', label: 'Medium' },
];
export const QUOTE_SIZE_OPTIONS: { value: TestimonialSize; label: string }[] = [
  { value: 'text-small', label: 'Small' },
  { value: 'text-medium', label: 'Medium' },
  { value: 'text-large', label: 'Large' },
];

/* ------------------------------------------------------------------------------------- data → values */

/** "Narrow letters, first word light" iff the stored section has both `condensed` and a heading pair. */
export function imageTextHeading(d: ImageTextData): { heading: string; headingStyle: HeadingStyle } {
  const narrow = d.condensed && !!d.headingThin;
  return { heading: d.heading ?? (d.headingThin ? d.headingThin.join('') : ''), headingStyle: narrow ? 'narrow' : 'standard' };
}

/**
 * The owner-visible values of a stored section. Nested keys are positional (`b0`, `q0`, `sl0`), so the same stored
 * data always gives the same values.
 */
export function valuesFromData(kind: SectionKind, data: SectionData, collectionId: number | null): DraftValues {
  switch (kind) {
    case 'overlay': {
      const d = data as OverlayData;
      return { image: d.image, subheading: d.subheading ?? '', heading: d.heading, headingClass: d.headingClass };
    }
    case 'imageText': {
      const d = data as ImageTextData;
      return {
        image: d.image,
        ...imageTextHeading(d),
        headingClass: d.headingClass,
        imageFirst: d.imageFirst,
        size: d.size,
        center: d.center,
        disableBottom: d.disableBottom,
        button: d.button ? { label: d.button.label, href: d.button.href } : null,
      };
    }
    case 'icons':
      return { blocks: (data as IconsData).blocks.map((b, i) => ({ key: `b${i}`, icon: b.icon, title: b.title, text: b.text })) };
    case 'testimonials': {
      const d = data as TestimonialsData;
      return { subheading: d.subheading ?? '', heading: d.heading, size: d.size, items: d.items.map((t, i) => ({ key: `q${i}`, quote: t.quote, author: t.author })) };
    }
    case 'slideshow':
      return { slides: (data as SlideshowData).slides.map((s, i) => ({ key: `sl${i}`, desktop: s.desktop, mobile: s.mobile ?? '' })) };
    case 'featuredCollection': {
      const d = data as FeaturedCollectionData;
      return { heading: d.heading, collectionId, limit: d.limit };
    }
    default:
      return {};
  }
}

/* ------------------------------------------------------------------------------------------ comparing */

/** Values without the client-only nested keys, for "did the owner change anything" comparisons. */
export function comparableValues(kind: SectionKind, v: DraftValues): unknown {
  switch (kind) {
    case 'icons':
      return (v as IconsValues).blocks.map(({ icon, title, text }) => ({ icon, title, text }));
    case 'testimonials': {
      const t = v as TestimonialsValues;
      return { ...t, items: t.items.map(({ quote, author }) => ({ quote, author })) };
    }
    case 'slideshow':
      return (v as SlideshowValues).slides.map(({ desktop, mobile }) => ({ desktop, mobile }));
    default:
      return v;
  }
}

export function sameSectionContent(a: DraftSection, b: DraftSection): boolean {
  return (
    a.kind === b.kind &&
    a.bodyHtml === b.bodyHtml &&
    JSON.stringify(comparableValues(a.kind, a.values)) === JSON.stringify(comparableValues(b.kind, b.values))
  );
}

/** "Photo and text 2" (the number only when the layout has more than one of that kind). Indexed by section key. */
export function sectionLabels(sections: { key: string; kind: SectionKind }[]): Map<string, string> {
  const totals = new Map<SectionKind, number>();
  for (const s of sections) totals.set(s.kind, (totals.get(s.kind) ?? 0) + 1);
  const seen = new Map<SectionKind, number>();
  const out = new Map<string, string>();
  for (const s of sections) {
    const n = (seen.get(s.kind) ?? 0) + 1;
    seen.set(s.kind, n);
    const name = shortKindName(s.kind);
    out.set(s.key, (totals.get(s.kind) ?? 0) > 1 ? `${name} ${n}` : name);
  }
  return out;
}

/** Kind name without the "(automatic)" suffix, for chips and change lists. */
export function shortKindName(kind: SectionKind): string {
  return SECTION_KIND_COPY[kind].name.replace(/\s*\(automatic\)$/, '');
}

/**
 * What changed between the saved layout and the editor, removals and hides first (SPEC §9.3 save warning).
 * `usedBy` feeds the reviews line.
 */
export function describeChanges(before: LayoutDraft, after: LayoutDraft, usedBy: number): string[] {
  const lines: string[] = [];
  const beforeLabels = sectionLabels(before.sections);
  const afterLabels = sectionLabels(after.sections);
  const afterByKey = new Map(after.sections.map((s) => [s.key, s]));
  const beforeByKey = new Map(before.sections.map((s) => [s.key, s]));
  const list = (keys: string[], labels: Map<string, string>) => keys.map((k) => labels.get(k) ?? '').join(', ');

  const removed = before.sections.filter((s) => !afterByKey.has(s.key)).map((s) => s.key);
  const hidden = after.sections.filter((s) => beforeByKey.has(s.key) && !beforeByKey.get(s.key)!.hidden && s.hidden).map((s) => s.key);
  const added = after.sections.filter((s) => !beforeByKey.has(s.key)).map((s) => s.key);
  const edited = after.sections.filter((s) => beforeByKey.has(s.key) && !sameSectionContent(beforeByKey.get(s.key)!, s)).map((s) => s.key);
  const shown = after.sections.filter((s) => beforeByKey.has(s.key) && beforeByKey.get(s.key)!.hidden && !s.hidden).map((s) => s.key);

  if (removed.length) lines.push(`Removed: ${list(removed, beforeLabels)}`);
  if (hidden.length) lines.push(`Hidden: ${list(hidden, afterLabels)}`);
  const hadReviews = before.sections.some((s) => s.kind === 'reviews' && !s.hidden);
  const hasReviews = after.sections.some((s) => s.kind === 'reviews' && !s.hidden);
  if (hadReviews && !hasReviews) lines.push(`Customers can't see or write reviews on ${productsPhrase(usedBy, 'these')}`);
  if (added.length) lines.push(`Added: ${list(added, afterLabels)}`);
  if (edited.length) lines.push(`Edited: ${list(edited, afterLabels)}`);
  if (shown.length) lines.push(`Shown again: ${list(shown, afterLabels)}`);
  const commonBefore = before.sections.map((s) => s.key).filter((k) => afterByKey.has(k));
  const commonAfter = after.sections.map((s) => s.key).filter((k) => beforeByKey.has(k));
  if (commonBefore.join('\n') !== commonAfter.join('\n')) lines.push('Order changed');
  if (before.name.trim() !== after.name.trim() || before.description.trim() !== after.description.trim()) lines.push('Name changed');
  if (after.sections.some((s) => s.base.from === 'previous')) lines.push('Goes back to the version from before the last save');
  if (after.sections.some((s) => s.base.from === 'original')) lines.push('Goes back to the original design');
  return lines;
}

/** "247 products", "1 product"; `these` → "these 247 products" / "this product". */
export function productsPhrase(n: number, these?: 'these'): string {
  if (these) return n === 1 ? 'this product' : `these ${n} products`;
  return `${n} product${n === 1 ? '' : 's'}`;
}

/* ------------------------------------------------------------------------------------------- summaries */

/** One chip of a layout's live contents summary ("Photo and text ×3"). */
export type SummaryChip = { kind: SectionKind; count: number; hidden: boolean };
export type LayoutSummaryData = { chips: SummaryChip[]; deadButton: boolean; deletedCollection: boolean };

/** Chips for consecutive sections of the same kind and visibility, plus the two warning tags (SPEC §9.2). */
export function summarizeSections(rows: { kind: SectionKind; hidden: boolean; deadButton?: boolean; deletedCollection?: boolean }[]): LayoutSummaryData {
  const chips: SummaryChip[] = [];
  for (const r of rows) {
    const last = chips[chips.length - 1];
    if (last && last.kind === r.kind && last.hidden === r.hidden) last.count++;
    else chips.push({ kind: r.kind, count: 1, hidden: r.hidden });
  }
  return {
    chips,
    deadButton: rows.some((r) => !r.hidden && r.deadButton),
    deletedCollection: rows.some((r) => r.deletedCollection),
  };
}

/** Warning flags of one section (for summaries and section rows). */
export function sectionWarnings(kind: SectionKind, values: DraftValues): { deadButton: boolean; deletedCollection: boolean } {
  return {
    deadButton: kind === 'imageText' && !!(values as ImageTextValues).button && !(values as ImageTextValues).button!.href,
    deletedCollection: kind === 'featuredCollection' && (values as FeaturedValues).collectionId == null,
  };
}

export const isAutomaticKind = (kind: SectionKind) => AUTOMATIC_KINDS.includes(kind);

/** First words of a section, for its summary row. */
export function sectionSummaryText(kind: SectionKind, values: DraftValues, plainBody: string): string {
  const cut = (s: string) => (s.length > 80 ? `${s.slice(0, 79).trimEnd()}…` : s);
  switch (kind) {
    case 'overlay':
    case 'imageText': {
      const v = values as OverlayValues | ImageTextValues;
      return cut(v.heading.trim() || plainBody.trim() || 'No heading yet');
    }
    case 'icons': {
      const titles = (values as IconsValues).blocks.map((b) => b.title.trim()).filter(Boolean);
      return titles.length ? cut(titles.join(' · ')) : 'No icons yet';
    }
    case 'testimonials': {
      const t = values as TestimonialsValues;
      const n = t.items.length;
      return cut(`${t.heading.trim() || 'No heading yet'} · ${n} quote${n === 1 ? '' : 's'}`);
    }
    case 'slideshow': {
      const n = (values as SlideshowValues).slides.length;
      return `${n} slide${n === 1 ? '' : 's'}`;
    }
    case 'featuredCollection':
      return cut((values as FeaturedValues).heading.trim() || 'No heading yet');
    case 'recommendations':
      return 'Filled in automatically: 4 products similar to the one being viewed.';
    case 'reviews':
      return "Shows the product's customer reviews and the Write a review button.";
  }
}

/** First photo of a section (thumbnail). */
export function sectionThumb(kind: SectionKind, values: DraftValues): string | null {
  if (kind === 'overlay' || kind === 'imageText') return (values as OverlayValues).image || null;
  if (kind === 'slideshow') return (values as SlideshowValues).slides[0]?.desktop || null;
  return null;
}

/* ------------------------------------------------------------------------------------- text cleaning */

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Server text rule (SPEC §5): trim, strip control characters, and (single-line fields) turn line breaks and tabs into
 * a space. Never uses `\s` (U+00A0 controls wrapping and must survive byte for byte).
 */
export function cleanText(s: string, multiline: boolean): string {
  const t = s.replace(/\r\n?/g, '\n').replace(CONTROL, '');
  return (multiline ? t : t.replace(/[\r\n\t]+/g, ' ')).replace(/^[ \t\n]+|[ \t\n]+$/g, '');
}

/** The heading pair stored for "Narrow letters, first word light". */
export { splitFirstWord } from './product-layout-sections';

/** Default heading size for a new photo-and-text section: the one most used by this layout's ones, else Medium. */
export function preferredImageTextHeading(sections: DraftSection[]): HeadingSize {
  const counts = new Map<HeadingSize, number>();
  for (const s of sections) if (s.kind === 'imageText') {
    const h = (s.values as ImageTextValues).headingClass;
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  let best: HeadingSize = 'h4';
  let bestN = 0;
  for (const [h, n] of counts) if (n > bestN || (n === bestN && h === 'h4')) {
    best = h;
    bestN = n;
  }
  return best;
}
