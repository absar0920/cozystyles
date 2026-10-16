# Product page layouts — Implementation Spec

Repo: `/Users/mqrtxget/projects/personal/cozystyles` · branch `interwood-fidelity` · Next.js 15.5 App Router + TS +
Tailwind 3.4 + Prisma 6 / SQLite (`db push`, no migrations folder; the schema hard-codes `file:./dev.db`).

**Status: Implemented** (2026-10-16): phases A, B and C are done. Revision 2 of the spec after three reviews — see
§18 Review log. The user approved "the full version". Where the build differs from this text, see §19 Deviations;
`docs/product-layouts/NOTES.md` has the module map and the hand checks.

This spec makes the sections shown **below the product description** on every product page editable by the
non-technical owner. Today they come from 18 shared "page layouts" hard-coded in
`src/components/product/data/templates.json`; `Product.layout` only chooses one. After this work the layouts and
their sections live in the database, the owner edits them at **Admin → Product page layouts**, and the storefront
reads them from the database. Until someone edits a layout, the storefront must look **pixel-identical**.

It builds on Admin Easy Mode. Read `docs/admin-easy-mode/SPEC.md` §0 (ground rules), §3 (uploads), §4.3–§4.4
(admin primitives and shared components) and `docs/admin-easy-mode/FOUNDATION-NOTES.md` §2–§3 before you start.
Every rule there still applies, especially:

- No typed URL, raw HTML, JSON, position number or hex colour anywhere in the admin. Plain, friendly wording.
- Every admin screen works on a 390px (and 360px) phone: no horizontal page scroll, 40px tap targets.
- No `next build`. Dev server on `http://localhost:3100`. No state-changing git commands.
- Back up `prisma/dev.db` before the schema push and the migration. Never reseed the dev database.
- Modules imported by `scripts/`, `prisma/seed.ts` or `tests/` must not `import 'server-only'`.

Contents

1. Today's system (what exists, as read from the code)
2. Data model
3. Section kinds: every field → owner control, derived value or hidden legacy value
4. Ready-made icon set
5. Validation and sanitisation (server)
6. Storefront: reading layouts from the database
7. Migration, seed parity and frozen input
8. Images (bundled `/images/pdp` files and uploads)
9. Admin: routes, pages, components and wording
10. Rules: duplicate, rename, delete, move products, used-by counts and warnings
11. Product editor "Page layout" dropdown
12. Phones
13. Playwright tests
14. Pixel-parity verification plan (before/after screenshots of all 18 layouts)
15. Implementation plan: (A) foundation, (B) admin editor, (C) tests + README
16. Decisions
17. Risks and edge cases
18. Review log
19. Deviations (as built)

---------------------------------------------------------------------------------------------------------------------

## 1. Today's system

| Piece | File | What it does |
|---|---|---|
| Layout list | `src/lib/product-layouts.ts` | `PRODUCT_LAYOUTS` (18 × `{key,label,help}`), `isProductLayout`, `layoutLabel`. Imported by the product editor, `actions/products.ts`, `products/_lib/load.ts` and `scripts/migrate-admin-easy-mode.ts` (step `product-layouts`). |
| Section content | `src/components/product/data/templates.json` | `Record<layoutKey, PdpSection[]>`, 2 024 lines. |
| Types + loader | `src/components/product/pdp-data.ts` | `PdpSection` union, `templateFor(layout)` (unknown → `default`), `getRecommendations`, `getFeaturedCards`. |
| Renderers | `src/components/product/TemplateSections.tsx` | `ImageWithTextOverlay`, `ImageWithText`, `TextWithIcons`, `Slideshow`, `CardRow`, `StaticSection`, `HEADING` scale, Barlow Condensed for Coalesce. |
| Testimonials | `src/components/product/TestimonialsCarousel.tsx` | client carousel (autoplay 5 s, ×3 clones, dots). |
| Reviews | `src/components/product/JudgeReviews.tsx` | automatic. |
| Product page | `src/app/(store)/products/[handle]/page.tsx` | `force-dynamic`; `templateFor(product.layout)` → maps sections (recommendations → `CardRow` "You may also like", featuredCollection → `CardRow`, reviews → `JudgeReviews`, others → `StaticSection`). |
| Trust icons | `src/components/product/icons.tsx` | 4 exact live SVGs (20×20, `fill=currentColor`), chosen **by block index** (`TRUST_ICONS[i]`). |
| Product field | `Product.layout String @default("default")` | key of a layout. |
| Admin dropdown | `products/_components/ProductEditor.tsx` ≈ line 533 | `<Select>` over `PRODUCT_LAYOUTS`, help text under it. Save validates with `isProductLayout`, else `'default'`. |

### 1.1 The 18 layouts (section order) and how many products use each (dev DB, 2026-10-16; all ACTIVE)

| Key | Current label | Products | Sections |
|---|---|---|---|
| `office-products` | Office furniture | 247 | overlay, imageText, icons, imageText, imageText, testimonials, recommendations, reviews |
| `default` | General furniture (standard) | 142 | overlay, imageText ×3, testimonials, recommendations, reviews |
| `living-products` | Living room | 45 | overlay, imageText, icons, imageText ×2, testimonials, recommendations, reviews |
| `bedroom-products` | Bedroom | 41 | same as living |
| `door-products` | Doors | 31 | … testimonials, recommendations (no reviews) |
| `dining-products` | Dining | 31 | same as living |
| `decor-cushions` | Cushions | 26 | featuredCollection ×2, overlay, imageText, icons, imageText ×2, testimonials, reviews |
| `bed-sets` | Bed sets | 24 | same as living |
| `kitchens-products` | Kitchens | 22 | … testimonials, recommendations (no reviews) |
| `sofas` | Sofas | 21 | same as living |
| `wardrobes-products` | Wardrobes | 15 | same as living |
| `coalesce-living` | Coalesce — living | 15 | recommendations, slideshow, imageText ×3, icons, testimonials, reviews |
| `study-products` | Study | 12 | same as living (testimonials "Testimonials", `text-medium`, 3 placeholder quotes) |
| `decor-products` | Decor accessories | 12 | same as living |
| `coalesce-bedroom` | Coalesce — bedroom | 7 | as coalesce-living |
| `coalesce-dining` | Coalesce — dining | 2 | as coalesce-living |
| `kids-products` | Kids | 1 | same as living |
| `blank-template-no-section` | Simple (only "You may also like") | 1 | recommendations |

### 1.2 Field facts that drive the design (measured, not assumed)

- **Every `imageText.ratio` equals the image's natural height/width × 100** (rounded to 4 decimals), e.g.
  `1268×1028 → 81.0726`, `1920×600 → 31.25` (the office/kitchen/door/wardrobe "1320_x_600" files are really
  1920×600, and their "1920_x_600" overlay files are really 1320×600 — the stored ratios follow the real pixels).
  So deriving the ratio from the image is exactly today's behaviour.
- **Slideshow ratios are not exact:** stored `desktopRatio 0.385` vs natural `739/1920 = 0.38490`; `mobileRatio
  1.5555…` = `700/450` exact. The stored legacy value must be kept until the photo is replaced (§3.5).
- **Overlay ignores ratio** (fixed 500/650px band, `object-cover`).
- **HTML bodies** use only `<p>`, `<br>` and `<a href="/collections/coalesce-…">explore now</a>` (Coalesce). Running
  them through `sanitizeRichText` changes 13 of 48 distinct strings, **serialisation only** (`<br>` → `<br />`,
  `&` → `&amp;`): the DOM is identical, so storing sanitised HTML keeps pixel parity (verified with
  `<scratchpad>/san-test.ts`).
- **Headings** never contain `\n` today; **icon texts** do (`\n` → `<br>`). **Every one of the 64 icon blocks** (all
  16 icons sections) contains 1–3 U+00A0 non-breaking spaces mid-string (e.g. "cities in Pakistan"); none at either
  end. They control line wrapping and must survive a save byte-for-byte (§5). No quote contains `\n` (0 of 115).
- **Overlay band** is a fixed `h-[500px] md:h-[650px] overflow-hidden`; `ImageWithText` always renders its `<h3 mb-5>`
  even when the heading is empty. Both are changed in §6.3.
- **Rich-text toolbar** (`rich-text/Toolbar.tsx`) offers Bold, Italic, Underline, Heading, Subheading, bullet and
  numbered lists, Link, Align left/centre/right, Text colour, photo, YouTube, Undo/Redo. The PDP body `<div>`s have
  no `.rte` class, so lists would render without bullets (Tailwind reset).
- **`headingThin`** (`["comfort"," reimagined"]` etc.) and **`condensed: true`** occur together and only on the 3
  Coalesce imageText sections. `heading` is `null` there.
- **`headingClass`** is `h3` or `h4` (renderer also supports `h2`). **Testimonials `size`** is `text-small` or
  `text-medium` (renderer also supports `text-large`). **`subheading`** of testimonials is always `null`; overlay
  subheading is `"Your dream home"` only on `default`.
- **Buttons** exist only on `default` (2× `{href:"#", label:"Learn more"}`).
- **featuredCollection** = `{heading, collection, handles[]}`; `handles` pins a live product order first, then the rest
  of the collection (`getFeaturedCards`, which today ORs `handle in handles` with the collection — so pinned products
  would show even outside the collection). Both pinned products (`cushion-filling`, `cushion-filling-1`) are ACTIVE
  and **in** the `cushion-filling` collection, so using `handles` for ordering only gives the same cards (§3.6).
  `getFeaturedCards` has no `take`: `cushions` shows 30 cards; `office` / `best-selling-collection` /
  `new-collection` have ~250 products each.
- Icon blocks are always 4 with the same titles; the icon is picked by **position**, not stored.
- `TextWithIcons` uses `key={b.title}` (would collide if the owner gives two blocks the same title).

---------------------------------------------------------------------------------------------------------------------

## 2. Data model

Additive only (`npx prisma db push`, never `--force-reset`). Append to `prisma/schema.prisma`:

```prisma
/// A shared "page layout": the sections shown below the description on every product that uses it.
/// `key` is what Product.layout stores. It never changes after creation (renaming changes `name` only).
model ProductLayout {
  id               Int                    @id @default(autoincrement())
  key              String                 @unique // "default", "office-products", "sofas-copy-2" … (≤ 60 chars)
  name             String                 // owner-facing, 1–60 chars
  nameKey          String                 @unique // name.trim().toLowerCase(): DB-enforced case-insensitive uniqueness
  description      String                 @default("") // optional "What it's for" line (purpose only, never contents)
  position         Int                    @default(0)  // list + dropdown order; new layouts go last; never shown
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt   // optimistic concurrency; explicitly bumped on EVERY save (§9.6)
  previousVersion  String?                // JSON snapshot of the layout before its last save ("Undo last save", §9.3)
  originalVersion  String?                // JSON snapshot of the migrated design ("Restore the original design");
                                          // set by the migration, copied by duplicate; null for layouts made from scratch
  sections         ProductLayoutSection[]
  previews         ProductLayoutPreview[]
}

/// Short-lived, admin-only preview of UNSAVED editor state (§9.3 "Preview changes"). Rows expire after 2 hours and
/// are swept on every preview create. Never read without a valid admin session.
model ProductLayoutPreview {
  id        Int           @id @default(autoincrement())
  token     String        @unique // 32 random hex chars
  layoutId  Int
  layout    ProductLayout @relation(fields: [layoutId], references: [id], onDelete: Cascade)
  sections  String        // JSON: the merged, validated section rows (same shape as a snapshot)
  expiresAt DateTime

  @@index([expiresAt])
}

/// One section of a layout, in `position` order.
model ProductLayoutSection {
  id           Int           @id @default(autoincrement())
  layoutId     Int
  layout       ProductLayout @relation(fields: [layoutId], references: [id], onDelete: Cascade)
  position     Int           @default(0)
  kind         String        // overlay | imageText | icons | testimonials | slideshow | featuredCollection | recommendations | reviews
  hidden       Boolean       @default(false)       // true = "Show on the store" switch off
  bodyHtml     String        @default("")          // sanitised rich text (overlay, imageText); a real column so
                                                    // `contains` searches (uploads, links) work like other tables
  data         String        @default("{}")        // JSON, shape per kind (§3); never shown to the owner
  refs         String        @default("")          // derived on every write: "\n" + lines.join("\n") + "\n" of image
                                                    // URLs and link pathnames (hrefPathname) found in `data` and
                                                    // bodyHtml; "" when none. Delimited so searches match whole lines
  collectionId Int?                                 // featuredCollection only
  collection   Collection?   @relation(fields: [collectionId], references: [id], onDelete: SetNull)

  @@index([layoutId, position])
  @@index([collectionId])
}
```

and on `Collection` add the back relation `layoutSections ProductLayoutSection[]` (no column change). On `Product`
add `@@index([layout])` (used by `groupBy layout`, `updateMany where layout`, the `?layout=` filter; additive) and
change the `prisma/schema.prisma:45` comment "key from src/lib/product-layouts.ts" to "a `ProductLayout.key`".

**Snapshot format** (`previousVersion`, `originalVersion`, `ProductLayoutPreview.sections`):
`{ v:1, name, description, sections: [{ kind, hidden, bodyHtml, data, collectionId }] }` in position order, with
`data` as the stored string. Upload URLs inside snapshots count as references (§6.4) so "Undo" never points at a
deleted file.

**`Product.layout` stays a `String` key, no foreign key** (decision D2). Integrity is enforced by the actions:
a layout can only be deleted when no product uses it, the product save validates the key against the table, and the
storefront falls back to `default` for an unknown key (today's behaviour). Keys are stable: the 18 migrated keys
are exactly today's, so every `Product.layout` value keeps working with no product rewrite.

### 2.1 Shared types and pure helpers — `src/lib/product-layout-sections.ts` (new, no `server-only`)

Imported by the storefront loader, the admin actions, the migration, the seed and tests.

```ts
export const SECTION_KINDS = ['overlay','imageText','icons','testimonials','slideshow','featuredCollection','recommendations','reviews'] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];
export const AUTOMATIC_KINDS: readonly SectionKind[] = ['recommendations', 'reviews'];
export const SINGLETON_KINDS: readonly SectionKind[] = ['recommendations', 'reviews']; // max one each per layout
export const MAX_SECTIONS = 20; export const MAX_FEATURED_PER_LAYOUT = 4;
export const MAX_ICON_BLOCKS = 8; export const MAX_TESTIMONIALS = 20; export const MAX_SLIDES = 6;

export type HeadingSize = 'h2' | 'h3' | 'h4';
export type OverlayData = { image: string; imageWidth: number | null; imageHeight: number | null; subheading: string | null; heading: string; headingClass: HeadingSize };
export type ImageTextData = {
  image: string; imageWidth: number | null; imageHeight: number | null;
  ratio: number;                 // h/w×100, derived (§3.2)
  size: 'medium' | 'large'; imageFirst: boolean; center: boolean; disableBottom: boolean;
  headingClass: HeadingSize; heading: string | null; headingThin: [string, string] | null; condensed: boolean;
  button: { href: string; label: string } | null;
};
export type IconBlock = { icon: IconKey; title: string; text: string };
export type IconsData = { blocks: IconBlock[] };
export type TestimonialsData = { subheading: string | null; heading: string; size: 'text-small' | 'text-medium' | 'text-large'; items: { quote: string; author: string }[] };
export type Slide = { desktop: string; desktopWidth: number | null; desktopHeight: number | null; desktopRatio: number; mobile: string | null; mobileWidth: number | null; mobileHeight: number | null; mobileRatio: number | null };
export type SlideshowData = { slides: Slide[] };
export type FeaturedCollectionData = { heading: string; collection: string | null /* handle snapshot, informational ONLY — never a fallback */; handles: string[] /* sort order only */; limit: 4 | 8 | 12 | null /* null = no limit (migrated only) */ };
export type EmptyData = Record<string, never>;

export function parseSectionData(kind: SectionKind, json: string): { data: SectionData; complete: boolean }; // never throws; complete=false when a required field (image, heading…) is missing
export function serializeSectionData(kind: SectionKind, data: SectionData): string; // stable key order
export function sectionRefs(kind, data, bodyHtml): string;                          // the `refs` column value ("\n…\n")
export function refsNeedles(pathOrUrl: string): string[];                           // ["\n"+p+"\n", "\n"+p+"?", "\n"+p+"#"]
export function ratioOf(w: number, h: number): number;   // Math.round(h / w * 100 * 1e4) / 1e4  (imageText)
export function fracOf(w: number, h: number): number;    // h / w (slideshow; full precision like 700/450)
export function newSectionDefaults(kind: SectionKind): { bodyHtml: string; data: SectionData };
export const SECTION_KIND_COPY: Record<SectionKind, { name: string; description: string }>; // §9.4 wording
```

`ICON_KEYS`/`IconKey` live in `src/lib/product-layout-icons.ts` (§4).

**Byte-stable round trip (required):** for every stored row, `serializeSectionData(kind, parse(row.data).data) ===
row.data`. The migration therefore writes `data` **only** through `serializeSectionData(kind,
parseSectionData(kind, JSON.stringify(built)).data)` (so defaults such as `button: null`, `limit: null` and key order
are already in the stored string), and a migration test asserts the round trip for all 135 rows (§13).

**Pure URL helpers move out of `uploads.ts`:** `sectionRefs` needs `extractUploadUrls`, which lives in
`src/lib/uploads.ts` (`import 'server-only'`). Move `extractUploadUrls` and a new `extractHrefs(html)` into the pure
module `src/lib/rich-text/urls.ts`; `uploads.ts` re-exports `extractUploadUrls` so existing importers don't change.
`hrefPathname` is already pure (`src/lib/links.ts`) and is imported from there.

Note the storage shape of **`slideshow` changes** from `{desktop, mobile, desktopRatio, mobileRatio}` to
`{slides:[…]}` (the owner may add slides); the migration wraps today's single slide (§7).

---------------------------------------------------------------------------------------------------------------------

## 3. Section kinds: field mapping

Legend: **Control** = what the owner sees. **Derived** = computed by the server on save, never shown.
**Hidden legacy** = migrated value that is preserved byte-for-byte unless the owner changes the related control.

**The merge rule (all kinds):** the save payload carries only owner-controllable values. For an existing section the
server starts from the **stored** `data`, applies the owner values, and recomputes a derived value **only when its
input changed** (new image URL, new heading text, heading style changed, collection changed). Unchanged sections
are not rewritten at all (compare the would-be `data`/`bodyHtml`/`hidden`/`position`; skip the update if equal), so
a save that touched one section leaves every other row identical.

**The base of a section (where "stored data" comes from).** Each section in the payload says what it starts from:

| `base` | Meaning | Server starts from |
|---|---|---|
| `{ from:'stored', id }` | an existing row | that row — must belong to **this** layout (§9.6) |
| `{ from:'copy', id }` | "Copy this section" in the editor | the source row's `data`/`bodyHtml`/`collectionId` (source must belong to this layout) |
| `{ from:'previous' \| 'original', index }` | a section loaded by "Undo last save" / "Restore the original design" | that entry of this layout's `previousVersion` / `originalVersion` snapshot |
| `{ from:'new' }` | "+ Add section" | `newSectionDefaults(kind)` |

So hidden legacy values (`ratio`, `headingThin`/`condensed`, slideshow `0.385`, `handles`, bundled image sizes,
`limit: null`) survive copying, undo and restore, and a bundled `/images/pdp/…` photo is accepted when it equals the
base's value (§5).

### 3.1 `overlay` — owner name **"Big photo with text"**

| Field | Control (label · help) | Notes |
|---|---|---|
| `image` | `ImageUpload` "Background photo" · "Shown full width behind the text. Wide photos work best (about 1920 × 600). Keep the middle clear for the text." `previewAspect="16 / 5"`, `required`, purpose `layout` | |
| `imageWidth/Height` | Derived from the upload (Upload row) or, for bundled files, `sharp` metadata at migration | Not used for rendering (cover). |
| `subheading` | `TextInput` "Small line above the heading (optional)" maxLength 60 | `''` → `null`. |
| `heading` | `TextInput` "Heading" required, **maxLength 80** | The band has a fixed look; shorter limits keep text inside it at 360px. |
| `headingClass` | `Select` "Heading size": **Extra large / Large / Medium** ↔ `h2/h3/h4` | Default for new: Large (h3). |
| `html` → `bodyHtml` | `RichTextEditor` "Text" `features={{images:false, youtube:false, headings:false, lists:false, align:false, color:false}}`, `minHeight={140}`, **max 600 characters of text** · help "Keep it short: a sentence or two." | Sanitised. |

### 3.2 `imageText` — **"Photo and text"**

| Field | Control | Notes |
|---|---|---|
| `image` | `ImageUpload` "Photo", `required`, `previewAspect` = the photo's real shape (stored ratio, or the new upload's `width/height`) | After an upload whose height ≥ width × 0.9 (portrait/square) or whose width < 600px, show a warning under the preview: "This photo is tall, so this section will be tall. A landscape photo works best." (or "This photo is small and may look blurry." for narrow ones). Not an error. |
| `ratio` | **Derived**: when the image URL changes, `ratioOf(width,height)` of the new image. Unchanged image → stored value kept (legacy). | No ratio field (D7). |
| `imageWidth/Height` | Derived (as overlay) | |
| `imageFirst` | Segmented control "Photo position": **Photo on the left / Photo on the right** (`true` = left; `false` = right) · help "On phones the photo is always on top." | |
| `size` | Segmented "Photo size": **Normal / Wide** ↔ `medium` (46%) / `large` (56%) | |
| `center` | Segmented "Text alignment": **Left / Centred** | |
| `headingClass` | "Heading size" Extra large / Large / Medium | New section: the size used most by Photo and text sections in this layout (ties → Medium); none → **Medium** (h4). |
| `heading` / `headingThin` / `condensed` | `TextInput` "Heading" (maxLength 120) **+** `Select` "Heading style": **Standard** / **Narrow letters, first word light** | Shown value: `heading ?? headingThin.join('')`. Style = narrow iff `condensed && headingThin`. On save: Standard → `heading = text, headingThin = null, condensed = false`; narrow → `condensed = true, heading = null, headingThin = splitFirstWord(text)` where `splitFirstWord("comfort reimagined") = ["comfort", " reimagined"]` (split at the first space; the space stays on the second part; one word → `[word, ""]`). Recomputed **only** if the text or the style changed (merge rule), so legacy pairs are untouched. A legacy mismatch (`condensed` without `headingThin` or vice versa; none exist today) shows as Standard and is preserved unless edited. |
| `html` → `bodyHtml` | `RichTextEditor` "Text" (same features as overlay: no headings, lists, alignment or colour — the section's own "Text alignment" control sets alignment) | Heading **or** text required. |
| `button` | `ToggleSwitch` "Show a button under the text"; when on: `TextInput` "Button text" (required, maxLength 30, default "Learn more") + `LinkPicker` "Button goes to" (`allowEmpty`) | Stored `{href,label}`; off → `null`. Migration stores today's `href:"#"` as `''`; the renderer outputs `href={button.href || '#'}` (DOM identical). Empty link: help "Without a link the button does nothing." **and** a "⚠ Button goes nowhere" tag on the section's summary row and on the layout's list card (§9.2, §9.3), so the 2 migrated `default` buttons are visible without opening anything. The link stays optional (existing data unchanged). |
| `disableBottom` | Inside a "More options" disclosure: `ToggleSwitch` "Space below this section" (on = `!disableBottom`) · help "Turn off to make this section sit right on top of the next one." | |

### 3.3 `icons` — **"Icons row"** (the cream trust strip)

| Field | Control | Notes |
|---|---|---|
| `blocks[]` | `SortableList` of blocks (max 8, min 1), "+ Add icon" | Each block: |
| `blocks[].icon` | **Icon picker** (§4): a 48px button showing the current icon; opens a `Popover` grid (bottom sheet on phones) of the ready-made icons with names | Migration assigns by position: 0 `delivery`, 1 `support`, 2 `quality`, 3 `assembly`, ≥4 `delivery` (today's `TRUST_ICONS[i] ?? Doorstep`). |
| `blocks[].title` | `TextInput` "Title" required, maxLength 40 | |
| `blocks[].text` | `TextArea` "Text" maxLength 200, 3 rows, `data-plain-text` · help "Press Enter to start a new line." | Plain text; `\n` kept (rendered `<br>`), U+00A0 kept byte-for-byte (§5 text rule; every migrated block has them). |
| remove | "Remove" button, no confirmation (undo = don't save) | |

Renderer change: icon from `block.icon` via `PDP_ICONS[key]`, React `key={index}`.

### 3.4 `testimonials` — **"Customer quotes"**

| Field | Control | Notes |
|---|---|---|
| `subheading` | `TextInput` "Small line above the heading (optional)" maxLength 60 | `null` today. |
| `heading` | `TextInput` "Heading" required, maxLength 120 | |
| `size` | Select "Quote text size": **Small / Medium / Large** ↔ `text-small/medium/large` | |
| `items[]` | `SortableList` (drag + arrows), "+ Add quote", max 20, min 1. Each: `TextArea` "Quote" (required, maxLength 600, `data-plain-text`, help "Add quote marks yourself if you want them shown. Press Enter to start a new line.") + `TextInput` "Customer name" (required, maxLength 60) + "Remove" | Quotes keep their literal `"…"` characters; nothing is added or stripped. `\n` is **kept** and `TestimonialsCarousel` renders the quote through the same `Lines` helper (`\n` → `<br>`); no migrated quote contains `\n` (0/115), so the DOM is unchanged. |

### 3.5 `slideshow` — **"Wide photo slideshow"**

| Field | Control | Notes |
|---|---|---|
| `slides[]` | `SortableList` layout `list`, max 6, min 1, "+ Add slide" | |
| `slides[].desktop` | `ImageUpload` "Computer photo" required, `previewAspect` from ratio · help "Put any text inside the photo. Shown full width." | |
| `slides[].mobile` | `ImageUpload` "Phone photo (optional)" · help "A taller photo for phones. Without one, phones show the computer photo." | |
| `desktopRatio` / `mobileRatio` | **Derived** `fracOf(w,h)` when that photo's URL changes; else stored legacy value (`0.385` stays `0.385`) | mobile removed → `mobileRatio=null`. |

Renderer: **one slide → exactly today's markup** (`desktop` `<img hidden md:block>` + `mobile` `<img md:hidden>`;
when `mobile` is null, the phone `<img>` uses the desktop photo and ratio). **Two or more slides** → new client
component `PdpSlideshow` (same `mb-[25px] mt-[30px] md:mb-10` wrapper; horizontal track reusing
`src/components/home/useDragTrack.ts`, dots like `TestimonialsCarousel`, autoplay 5 s paused on hover). **All slides
use the first slide's shape** (computer: first `desktopRatio`; phone: first `mobileRatio ?? desktopRatio`) with
`object-cover`, so the page never jumps between slides. In the editor, when a later slide's shape differs from the
first by more than 2%, show under that slide: "Slides are cropped to match the first one." No links on slides (D12).

### 3.6 `featuredCollection` — **"Products from a collection"**

| Field | Control | Notes |
|---|---|---|
| `heading` | `TextInput` "Heading" required, maxLength 120 | |
| `collectionId` (column) | `CollectionPicker` "Collection" required (new component, §9.5) | Migration resolves today's handle → id. |
| `collection` (data) | **Derived** handle snapshot — **informational only**, never used as a fallback (it would bring a deleted collection back) | |
| `handles` | **Hidden legacy** "pinned first" **sort order only** (they no longer add products). Kept while the collection is unchanged; **cleared to `[]`** when the owner picks another collection (then the collection's own order applies: `id` asc like today's tail). Help under the picker: "Shows the products of this collection (except the product being viewed)." | |
| `limit` | `Select` "How many products": **4 / 8 / 12** | New sections: 8. Migrated sections store `null` (no limit; `cushions` has 30) and the select shows an extra first option "All of them (as now)" only while the value is `null`. Changing the collection on a `null` section sets it to 8. |

Loader: `getFeaturedCards({collectionHandle, handles, limit})` queries `status:'ACTIVE', collections: { some: { handle
} }` (no more `OR handle in handles`), sorts by `handles` position then `id`, then applies `take: limit` when set.
Both pinned products are in their collection today, so the cards are identical. **`collectionId` null (collection
deleted) → the loader skips the section** (it does not render pinned products under an orphaned heading); the
collection delete action also clears `handles` of affected sections. The editor shows "⚠ The collection was deleted
— pick another" and the section's summary row carries the same tag.

### 3.7 `recommendations` — **"“You may also like” (automatic)"** and `reviews` — **"Customer reviews (automatic)"**

No content. Owner can move, hide/show, delete and re-add (max one of each per layout). Card text: "Filled in
automatically: 4 products similar to the one being viewed." / "Shows the product's customer reviews and the Write a
review button."

Removing **or hiding** the reviews section also removes the "Write a review" button: the delete dialog's consequences
and the save-warning change list (§9.3) say "Customers can't see or write reviews on these 247 products", and the
delete dialog adds the tip "Hide keeps it for later."

---------------------------------------------------------------------------------------------------------------------

## 4. Ready-made icon set

`src/lib/product-layout-icons.ts` (pure): `ICON_KEYS` + `ICON_LABELS`. `src/components/product/pdp-icons.tsx`:
`PDP_ICONS: Record<IconKey, (p:{className?:string}) => JSX.Element>` used by both the storefront and the admin
picker. All 20×20 viewBox, `fill="currentColor"`, single-weight outline drawn to match the live four (1px strokes
expressed as filled paths). The first four are **the existing SVGs moved unchanged** (pixel parity).

| Key | Label (picker) | Source |
|---|---|---|
| `delivery` | Delivery van | existing `DoorstepDeliveryIcon` |
| `support` | After-sales support (stopwatch) | existing `AfterSaleSupportIcon` |
| `quality` | Quality standard (box) | existing `InternationalStandardIcon` |
| `assembly` | Assembly (recycle arrows) | existing `AssemblyAssistanceIcon` |
| `warranty` | Warranty (shield with tick) | new |
| `returns` | Easy returns (circular arrow) | new |
| `payment` | Card payment | new |
| `cash` | Cash on delivery (banknote) | new |
| `measure` | Made to measure (ruler) | new |
| `leaf` | Natural materials (leaf) | new |
| `phone` | Call us (phone) | new |
| `chat` | Message us (speech bubble) | new |
| `star` | Top rated (star) | new |
| `store` | Visit our showroom (shopfront) | new |
| `clock` | Quick turnaround (clock) | new |
| `gift` | Gift ready (gift box) | new |

Unknown stored key → `delivery`. The `ZoomIcon`/`Share*` icons stay in `product/icons.tsx`; the four trust icons are
re-exported from there for any other importer (grep first; today only `TemplateSections.tsx` imports them).

---------------------------------------------------------------------------------------------------------------------

## 5. Validation and sanitisation (server)

All in `src/app/admin/actions/product-layouts.ts` (`'use server'`). **Every new action, including read-only ones
(`layoutUsageAction`, `searchCollectionsAction` in `actions/collections.ts`, `searchProductsForMoveAction`,
`createLayoutPreviewAction`), starts with `requireAdmin()`.**

- **Payload shape:** parsed with strict type checks before any database work (arrays are arrays, ids are integers,
  strings are strings, unknown keys dropped); total JSON size ≤ 512 KB and the count limits (20 sections, 4 featured,
  8 icon blocks, 20 quotes, 6 slides) checked first. A malformed payload returns a generic error, never throws.
- **Text:** `.trim()` (safe: no U+00A0 at either end of any migrated value) and strip control characters
  (`/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g`). Line breaks: icon text and quotes keep `\n` (normalise `\r\n`
  → `\n`); every other field replaces `/[\r\n\t]+/g` with a space. **Never use `\s` in these replacements** (the
  codebase's usual `.replace(/\s+/g,' ')` would turn every U+00A0 into a normal space and change line wrapping).
  Enforce the max lengths of §3 (hard error, not truncation, with the field error "Keep this under 120 characters").
- **Rich text:** `sanitizeRichText(bodyHtml)` on save **and** again on render (FOUNDATION rule). Empty check with
  `isRichTextEmpty`. Max 6 000 characters of HTML ("This text is too long."); overlay additionally max 600 characters
  of visible text.
- **Images:** must match `/^\/(?:uploads\/|images\/pdp\/)[A-Za-z0-9._~\-\/]+$/` **and** contain no `..` segment and no
  `%` (rejects `%2e` tricks). `/uploads/…` must have an `Upload` row (its `width/height` feed the derived ratio);
  otherwise "Please upload the photo again." `/images/pdp/…` values are accepted only when equal to the value in the
  section's **base** (§3: stored row, copy source, or snapshot entry) — the owner can't pick bundled files.
- **Links:** `normalizeHref` + `validateHref(href, { allowEmpty: true })` on save; `javascript:`/`data:` rejected.
- **Section ids:** inside the transaction load the ids of **this** layout's sections; a `base.id` (stored or copy) not
  in that set is an error ("This layout changed; please reload."). All updates use `where: { id, layoutId }`.
- **Kinds:** must be in `SECTION_KINDS`; singleton kinds at most once; max 20 sections; max 4 featured.
- **Required per kind:** overlay: image + heading. imageText: image + (heading or text). icons: ≥1 block, each with a
  title. testimonials: heading + ≥1 quote with quote and name. slideshow: ≥1 slide with a computer photo.
  featuredCollection: heading + an existing collection.
- **Layout:** name 1–60 chars, unique case-insensitively via the `nameKey` unique column (P2002 on `nameKey` → "Another
  layout is already called “Sofas”."); description ("What it's for", optional) ≤160 chars.
- **Concurrency:** payload carries the layout's `updatedAt`. Inside the transaction:
  `productLayout.updateMany({ where: { id, updatedAt: payload.updatedAt }, data: { updatedAt: new Date(), name,
  nameKey, description, previousVersion } })`; `count === 0` → `{ ok:false, code:'STALE' }`. This runs on **every**
  save (Prisma's `@updatedAt` alone would not move when only sections change), and the new `updatedAt` is returned to
  the client. Stale → save bar error "Someone else saved this layout a moment ago." with two buttons: **Save as a new
  layout instead** (keeps your edits, §9.3) and **Reload** (with the note "Reloading shows their version; your edits
  will be lost.").
- **Errors are returned per section** as `{ sectionKey: { field: message } }` (sectionKey = client key, §9.3) plus a
  top message "Please fix the highlighted sections." Never throw to the error boundary for owner mistakes.

---------------------------------------------------------------------------------------------------------------------

## 6. Storefront: reading layouts from the database

### 6.1 Loader — `src/components/product/pdp-data.ts`

- Delete `import templatesJson` and `templateFor`. Add:

```ts
/** Visible sections of a layout, in order. Unknown key → "default"; missing "default" → []. One query (+1 fallback). */
export const getLayoutSections = cache(async (key: string): Promise<PdpSection[]> => { … });
```

  `cache` from `react` (per-request de-dupe only). Query: `productLayout.findUnique({ where:{key}, select:{ sections:
  { where:{hidden:false}, orderBy:[{position:'asc'},{id:'asc'}], select:{id,kind,bodyHtml,data,collection:{select:{handle:true}}} } } })`.
  Map each row with `parseSectionData` into the **existing** `PdpSection` types (add `id: number` to each member;
  `OverlaySection.html` / `ImageTextSection.html` = `sanitizeRichText(bodyHtml)`; `IconsSection.blocks[].icon`;
  `SlideshowSection` becomes `{kind, slides}`; `FeaturedCollectionSection.collection` = relation handle).
  **Skip** (and `console.warn` once) any row whose `parseSectionData(...).complete` is false — never render defaults
  such as `<img src="">` — and any `featuredCollection` row with `collectionId` null (§3.6).
- `getLayoutSectionsForPreview(token)`: reads a `ProductLayoutPreview` row (not expired) and maps its snapshot
  sections the same way. Only called by the product page in admin preview mode (§6.2).
- **No cross-request data cache** (D9): the PDP is already `force-dynamic` and the query is two indexed reads.
  `unstable_cache` was rejected because its file cache in `.next/cache` survives restarts and would serve stale
  sections after the migration script or a seed.
- **Cache clearing.** After any layout create/save/rename/duplicate/delete/undo/restore, any `moveProductsAction` /
  undo-move, and `saveProductAction` when a product's `layout` changed, call
  `revalidatePath('/admin/product-layouts', 'layout')` and `revalidatePath('/admin/products', 'layout')` (covers the
  list, each editor, and every product edit page's dropdown). `revalidatePath('/products/[handle]', 'page')` is kept
  (a no-op while the PDP is `force-dynamic`, correct if that ever changes).

### 6.2 Product page

`page.tsx`: `const sections = await getLayoutSections(product.layout);` — everything else unchanged except React
keys use `s.id`. `getFeaturedCards(s)` gets the collection-only query + `limit` of §3.6 (same cards for migrated data).

**Admin preview mode.** `?layoutPreview=<token>` (a `ProductLayoutPreview` token, §9.3) is honoured **only** when
`getAdminOrNull()` (`src/lib/admin-guard.ts`) returns an admin (the page is already `force-dynamic`); otherwise the parameter is ignored
and the page renders normally. In preview mode: sections come from `getLayoutSectionsForPreview(token)`; the product
may be any status (drafts are previewable); `generateMetadata` adds `robots: { index:false, follow:false }`; a fixed
admin-only bar at the top reads "Preview — not saved yet. Only you can see this." with a "Back to editing" link. An
expired or unknown token shows the bar text "This preview has expired. Go back and press Preview again." over the
normal page.

### 6.3 Renderers (`TemplateSections.tsx`) — the only allowed changes

1. `TextWithIcons`: `const Icon = PDP_ICONS[b.icon] ?? PDP_ICONS.delivery`, `key={i}`.
2. `ImageWithText`: `href={s.button.href || '#'}`; at render, `validateHref(href)` again — invalid → `'#'`; external
   (`http(s)://` to another host) → `target="_blank" rel="noopener"` like the sanitiser. Migrated buttons are `#`, so
   their DOM is unchanged.
3. `ImageWithText`: render the `<h3>` **only when there is heading text** (`heading` or `headingThin`); every migrated
   section has one, so no migrated DOM changes.
4. `ImageWithTextOverlay`: `h-[500px] … md:h-[650px]` → `min-h-[500px] … md:min-h-[650px]` (text can no longer be
   clipped; migrated content fits, so heights are unchanged).
5. `[overflow-wrap:anywhere]` added to the heading elements of overlay / imageText, the testimonials quote, and icon
   titles/texts (a long unbroken word can't cause horizontal scroll at 360px).
6. `TestimonialsCarousel`: quote rendered through `Lines` (`\n` → `<br>`, §3.4).
7. `Slideshow`: `slides.length === 1` → today's markup with `mobile ?? desktop`, `mobileRatio ?? desktopRatio`;
   more → `<PdpSlideshow slides>` (§3.5).
8. Imports of `Overlay/ImageText/Icons/Slideshow` types follow the new shapes.

No other class name, spacing or element changes. `HEADING`, Barlow, `CardRow`, `JudgeReviews` untouched. Items 4
and 5 change `class` attributes only; they are the **only** allowed differences in the HTML parity check (§14.2) and
must give zero pixel difference.

### 6.4 Reference tracking (uploads and links)

- `src/lib/uploads.ts` `isUploadReferenced`: add
  `prisma.productLayoutSection.count({ where: { OR: [{ refs: { contains: '\n' + url + '\n' } }, { bodyHtml: { contains: url } }] } })`
  **and** `prisma.productLayout.count({ where: { OR: [{ previousVersion: { contains: url } }, { originalVersion: {
  contains: url } }] } })` and unexpired `productLayoutPreview` rows containing it (upload URLs carry random hex, so a
  plain `contains` is exact for snapshots). An upload used only by a layout (or its undo snapshot) survives the 24-hour
  orphan sweep.
- `UploadPurpose`/`UPLOAD_PURPOSES`: add `'layout'` (and the upload route's validation list).
- `src/lib/link-references.ts` `countLinkReferences`: count layout sections whose `bodyHtml` contains a needle
  (existing needle style) **or** whose `refs` contains one of `refsNeedles(path)` (`"\n<path>\n"`, `"\n<path>?"`,
  `"\n<path>#"`) — so `/collections/sofa` never matches `/collections/sofas`. Add the result to `richText` (the delete
  confirmations for collections/products/pages then mention "links in product page layouts").
- Collection delete dialog: additionally count `productLayoutSection` rows with that `collectionId` → consequence line
  "Used in 2 “Products from a collection” sections of product page layouts (they will disappear from the store)".
- `src/lib/link-targets.ts`: reuse `findBrokenLinks(bodyHtml)` and `resolveLinkTargets` for button hrefs in the
  editor (§9.3).

---------------------------------------------------------------------------------------------------------------------

## 7. Migration, seed parity and frozen input

### 7.1 Frozen input — `prisma/easy-mode-data/product-layouts.json`

Generated **once** (by a throwaway script, not committed) from `templates.json` + `PRODUCT_LAYOUTS`, then committed:

```json
{ "layouts": [ { "key": "default", "name": "General furniture (standard)", "description": "The standard page for most furniture.", "sections": [ { "kind": "overlay", …today's fields verbatim… } ] }, … ] }
```

Order = today's `PRODUCT_LAYOUTS` order (that is the `position`). Section fields are today's JSON **verbatim**
(no transformation in the file; all transformation is in the step, so it is reviewable in one place). Then delete
`src/components/product/data/templates.json`; nothing in `src/` may read the frozen file (the "Restore the original
design" feature reads the `originalVersion` column the migration wrote, not the file).

**Names and descriptions.** Descriptions keep only the **purpose** ("For office chairs and desks.", "The standard page
for most furniture.", "For the Coalesce living range.") and drop descriptions of contents ("Big banner, three
photo-and-text blocks…", "story blocks"), because the contents are shown live from the sections (§9.2). The label
"Simple (only “You may also like”)" becomes the name **"Simple"** with purpose "For products that need nothing
under the description." The 18 purpose lines are written in plain words when the file is generated and reviewed in
the file.

### 7.2 Step `product-layout-content` in `scripts/migrate-admin-easy-mode.ts`

Added to `STEPS` **immediately before** `product-layouts` (so a fresh seed creates the layouts before products are
assigned; on the existing dev DB `product-layouts` is already applied and skipped). Ledger id
`easy-mode:product-layout-content`; idempotent like every step (skipped when its `MigrationStep` row exists). Rules:

0. Read the file with `readData('product-layouts.json')`. Its fallback for a missing file is `{}`; this step instead
   **throws** ("prisma/easy-mode-data/product-layouts.json is missing") when `layouts` is not a non-empty array, so
   the whole migration rolls back and no ledger row is written.
1. **Per key, not all-or-nothing:** for each layout in file order, if a `ProductLayout` with that `key` already exists,
   skip it and report `"skipped <key>: already present"`; otherwise create it. (A layout someone created by hand
   before the step ran can't block the 18 imports.) If a migrated name collides with an existing `nameKey`, append
   " (original)" and report it.
2. Create `ProductLayout {key, name, nameKey, description, position: i}` (position after any existing rows' max when
   rows already exist).
3. For each section (position = index), build the object, then store
   `data = serializeSectionData(kind, parseSectionData(kind, JSON.stringify(built)).data)` (§2.1 byte-stable rule):
   - overlay: `{image, imageWidth, imageHeight, subheading, heading, headingClass}`; `bodyHtml = sanitizeRichText(html)`.
   - imageText: all fields verbatim (`ratio` stays the stored number), `button.href "#" → ""`, + `imageWidth/Height`.
   - icons: blocks + `icon` by position (§3.3); text strings verbatim (U+00A0 untouched).
   - testimonials: verbatim.
   - slideshow: `{ slides: [{ desktop, desktopRatio, mobile, mobileRatio, + widths/heights }] }` (ratios verbatim).
   - featuredCollection: `{heading, collection, handles, limit: null}`; `collectionId` = `Collection.id` by handle
     (`null` + a logged warning if missing).
   - recommendations / reviews: `{}`.
   - `refs = sectionRefs(...)`, `hidden = false`.
   - Image dimensions: `sharp(public + path).metadata()` (the step may use `sharp`, as `card-data` does); a missing
     file → `null` dims + warning (still migrates).
   - Finally set the layout's `originalVersion` = snapshot (§2) of the rows just written.
4. Products whose `layout` matches no layout key → set to `"default"` (renders identically: today's fallback).
5. Summary: `"18 layouts (0 skipped), 135 sections, 0 missing images, 0 missing collections, 0 products reset to
   default"` (exact counts from the run; today's JSON has 135 sections).

Change the existing `product-layouts` step (step 4) to validate keys against the **frozen file's keys**
(`readData('product-layouts.json')`, throwing like rule 0 when the file is missing) instead of `isProductLayout` (so
`src/lib/product-layouts.ts` can drop the hard-coded list). Its ledger row exists on the dev DB, so this only affects
fresh seeds.

### 7.3 `src/lib/product-layouts.ts` after the change

Keeps only pure helpers: `DEFAULT_LAYOUT_KEY = 'default'`, `layoutKeyFromName(name, taken: Set<string>)`
(slugify; an empty slug — Urdu name, emoji — becomes `layout`; cut to 56 chars before adding `-2`, `-3` …, so keys stay
≤ 60), `copyName(base, takenNameKeys)` (cuts the base so `"Copy of " + base + " 2"` fits in 60 chars, ending with
"…" when cut), `PROTECTED_LAYOUT_KEYS = ['default']`. Create/duplicate actions retry up to 3 times on P2002 (`key` or
`nameKey`) with the next suffix, so two simultaneous creates can't fail or collide. `PRODUCT_LAYOUTS`, `isProductLayout`, `layoutLabel`
are removed; every importer moves to the DB (§11).

### 7.4 Seed parity

`prisma/seed.ts`: add `prisma.productLayoutPreview.deleteMany()`, `prisma.productLayoutSection.deleteMany()`,
`prisma.productLayout.deleteMany()` to the wipe, in that order, **immediately before**
`prisma.$executeRawUnsafe('DELETE FROM _ProductCollections')` / `prisma.collection.deleteMany()` — nothing else; the
seed already ends with `runAdminEasyModeMigration`, which now creates the layouts. Parity check (as easy-mode did; the
schema hard-codes the DB path): copy the schema to the scratchpad with a `datasourceUrl`, seed an empty DB, and
compare with the migrated dev DB:
`SELECT key,name,nameKey,description,position,originalVersion FROM ProductLayout` and
`SELECT l.key,s.position,s.kind,s.hidden,s.bodyHtml,s.data,s.refs,c.handle FROM ProductLayoutSection s JOIN ProductLayout l … LEFT JOIN Collection c …`
must be identical row for row. For products, only check that **every `Product.layout` value in each DB is one of
its `ProductLayout` keys** (the dev DB's 695 products have been edited through the admin since seeding, so per-layout
counts legitimately differ).

### 7.5 Runbook on the dev database

1. `npm run db:backup` (or `cp prisma/dev.db <scratchpad>/dev.db.before-product-layouts`).
2. Stop the dev server; `npx prisma db push` (additive; never `--force-reset`); `npx prisma generate`.
3. `npx tsx scripts/migrate-admin-easy-mode.ts --dry-run` → read the report; then `npm run db:migrate-easy-mode`.
4. Run it again → every step `skipped`.
5. Restart the dev server; run the parity plan (§14).

---------------------------------------------------------------------------------------------------------------------

## 8. Images

- **Bundled files stay where they are** (`public/images/pdp/*`, 51 files). Migrated sections reference them by path.
  They are never deleted by the app (`releaseUploads` ignores non-`/uploads/` URLs).
- **New photos** go through `ImageUpload` → `POST /api/admin/uploads` with purpose `layout` → WebP in
  `/uploads/YYYY/MM/…` with known `width/height`. The server reads dimensions from the `Upload` row, never from the
  client.
- On every save/delete: removed URLs = (old `refs` ∪ `extractUploadUrls(oldBodyHtml)`) − (new ones), computed per
  layout; `releaseUploads(removed)` **after** the transaction. Because the previous version is kept as the undo
  snapshot, a just-removed photo stays referenced until the *next* save replaces that snapshot; then it is released
  (computed from the outgoing snapshot's URLs). Deleting a layout releases all URLs of its sections and snapshots.
  Duplicated layouts share URLs; the reference check keeps files until nothing uses them.
- **Shape warnings** (§3.2): computed in the browser from the upload response's `width/height` — no extra request.
- Admin hints carry the recommended sizes (overlay ~1920 × 600, photo-and-text ~1268 × 1028 normal / 1462 × 842 wide,
  slideshow 1920 × 740 computer / 450 × 700 phone).

---------------------------------------------------------------------------------------------------------------------

## 9. Admin

### 9.1 Navigation

`Sidebar.tsx`: insert **"Product page layouts"** → `/admin/product-layouts` right after **Products**, with a new
`LayoutIcon` (stacked rectangles) in `src/components/admin/icons.tsx`. Add both routes to
`tests/helpers/admin-routes.ts`.

### 9.2 List — `src/app/admin/(panel)/product-layouts/page.tsx`

- Title "Product page layouts". Intro `Notice tone="info"`: "These are the sections shown under the description on
  product pages. Each layout is shared: changing it changes every product that uses it. To give some products their
  own version, make a copy and move those products to it."
- One card per layout (position order; cards on all widths, 1 column phones / 2 columns ≥1024): name, "What it's
  for" line when set, the **live contents summary** — chips built from the actual sections using the
  `SECTION_KIND_COPY` names exactly ("Big photo with text · Photo and text ×3 · Customer quotes · “You may also like”
  · Customer reviews"; hidden ones struck through with "(hidden)" for screen readers) — and warning tags: "⚠ Button
  goes nowhere" (any visible photo-and-text button with an empty link), "⚠ Collection was deleted". **"Used by 247
  products"** (link → `/admin/products?layout=<key>`; "Not used by any product" when 0; "(3 drafts)" suffix when some
  are drafts), buttons **Edit**, **Make a copy**, **⋯** (Rename, Move products…, Delete).
- The same `LayoutSummary` (chips) component is used wherever a layout is chosen: the product editor help line (§11),
  the "Start from" select of "+ New layout", and the Move dialog's layout selects (as the option's second line).
- "+ New layout" (top): dialog "Start from" — a select of existing layouts **or** "Empty (only “You may also
  like”)" + "Name". Creates and opens the editor.
- Flash notices after actions ("Copy made. Move products to it from its page.").

### 9.3 Editor — `src/app/admin/(panel)/product-layouts/[id]/page.tsx` + `_components/LayoutEditor.tsx`

Server page loads the layout, sections (parsed), used-by counts, a preview product, link targets for every button
href (`resolveLinkTargets`), broken links per body (`findBrokenLinks`), collection names, then renders the client
editor. `pb-28` for the save bar.

Header: name (h1) + "Rename" (inline `TextInput` "Layout name", plus `TextInput` **"What it's for (optional)"** with
help "A short note to help you pick the right layout, e.g. “For office chairs and desks.”"), "Used by 247 products"
link, **"Preview changes ↗"** (below), and a **⋯** menu: "Make a copy", "Move products…", **"Undo last save"**,
**"Restore the original design"**, "Delete layout".

**Shared banner (from the start).** When 2 or more products use the layout, a `Notice tone="warning"` sits at the top
of the editor before any edit: "Changes here affect 247 products. To change only some of them, make a copy first."
with buttons **Make a copy** and **Save my changes as a new layout** (the latter is the same flow as the dialog button
below, available any time).

**Preview changes ↗.** Opens a small picker "Preview on" (a product search limited to products using this layout,
first ACTIVE product preselected; for an unused copy, any product — "Not used yet, so pick any product to preview
on"). It calls `createLayoutPreviewAction({ layoutId, draft })`, which runs the **same validation and merge as save
without writing the layout** (errors show exactly as on save), stores the merged sections in a
`ProductLayoutPreview` row (2 h expiry, expired rows swept on each create), and opens
`/products/<handle>?layoutPreview=<token>` in a new tab (§6.2). Works for saved and unsaved state alike, so the owner
can see an edit before it reaches anyone. Help: "Shows your changes on a real product page. Only you can see it."

**Undo last save / Restore the original design.** "Undo last save" (enabled when `previousVersion` is set; label
shows when: "Undo last save (today 14:05)") and "Restore the original design" (enabled when `originalVersion` is set,
i.e. migrated layouts and their copies) **load that version into the editor as unsaved changes** (sections carry
`base: {from:'previous'|'original', index}`, §3) after a `ConfirmDialog` "Replace what's in the editor with the
version from before your last save?". The owner then sees it, can preview it, and saves it normally (with the shared
warning and change list). Saving after an undo makes the replaced version the new `previousVersion`, so undo can be
undone. Name/description are restored too.

Body:

- **Section list** (`SortableList`, `ariaLabel="Sections"`): each row = drag handle, kind icon + kind name
  (`SECTION_KIND_COPY`), a summary (heading or first words; for automatic kinds the automatic note), thumbnail of the
  first photo, a grey **"Hidden"** pill when hidden, warning tags ("⚠ Button goes nowhere", "⚠ Collection was
  deleted", "⚠ Fix this" after a failed save), and actions: **Edit** (expands the section editor inline), a
  `ToggleSwitch` **"Show on the store"** (the only name for this control, everywhere), **⋯** menu: "Copy this section"
  (inserted below with `base: {from:'copy', id}`, or for an unsaved section a deep copy of its draft with the same
  base; disabled for singleton kinds), "Delete section" (`ConfirmDialog` `note="Removed when you save."`,
  consequences e.g. "The photo and text in this section"; for reviews also "Customers can't see or write reviews on
  these 247 products" + tip "Hide keeps it for later.").
  Arrows ("Move up"/"Move down") always visible (phone fallback).
- **Open sections:** at ≥ 640px several sections may be open. **Below 640px, opening a section closes the others.**
  Only open sections mount their `RichTextEditor` (closed ones keep the draft HTML in state). An open section has a
  sticky bar at its top: "← Back to all sections" (closes it and scrolls its row into view) + the section name.
  While a section is being dragged, all open sections collapse (the arrows remain the main way to move on phones).
- Fake "product above" marker at the top of the list: a static grey row "Product photos, price and description"
  (not draggable) so the owner understands where sections appear.
- **"+ Add section"** below the list: a sheet listing every kind with its name, one-line description and a tiny
  diagram; singleton kinds already present are disabled with "Already in this layout"; featured disabled at 4;
  everything disabled at 20 sections ("A layout can have up to 20 sections."). The new section is appended, expanded
  and scrolled into view with `newSectionDefaults(kind)` (photo-and-text heading size = the one most used by this
  layout's photo-and-text sections, else Medium; §3.2).
- **Section editors** per §3, in `_components/sections/{Overlay,ImageText,Icons,Testimonials,Slideshow,Featured,Automatic}Editor.tsx`.
  Each section has a stable client key (`s-<id>` or `crypto.randomUUID()` for new ones).
  - Broken links: `BrokenLinksNotice` inside the section editor for its body; a missing button target shows through
    `LinkPicker`'s own red state.
- **State and save:** one client state object `{ name, description, sections: SectionDraft[] }`; dirty = deep compare
  to the baseline; `UnsavedChangesGuard`; `StickySaveBar` actions **Save layout** (primary) and **Discard changes**
  (secondary, `ConfirmDialog`). Save calls `saveProductLayoutAction(payload)` (JSON payload, like `saveProductAction`).
- **Shared-change warning (before saving):** if `usedBy ≥ 2`, a dialog titled "Change all 247 products?" with:
  - **What changed** — computed in the browser from the baseline comparison, one line per category, removals and
    hides first: "Removed: Customer quotes" · "Hidden: Icons row" · "Customers can't see or write reviews on these
    247 products" (when reviews is removed or hidden) · "Added: Photo and text" · "Edited: Photo and text 1, 2" ·
    "Shown again: …" · "Order changed" · "Name changed". Sections are named `<kind name> <n>` (n counted per kind,
    only when the layout has more than one of that kind).
  - "Every product using “Office furniture” will show these changes straight away. You can undo the last save from
    the ⋯ menu."
  - Three buttons: **Save for all 247 products** (primary), **Save as a new layout instead**, **Keep editing**.
  `usedBy` 0 or 1 → no dialog.
- **Save as a new layout instead** (dialog, stale error, shared banner): asks for a name (prefilled with
  `copyName`), then `saveAsNewLayoutAction({ sourceLayoutId, name, draft })` creates a new layout from the draft
  (sections with `stored` bases become `copy` bases of the source layout, so hidden legacy values survive), used by no
  product, with the source's `originalVersion`. The original layout is untouched. It then opens the new layout's
  editor with the Move dialog already open ("Bring products here from “Office furniture”").
- After save: success status "Saved. 247 product pages are updated.", `markClean`, server data refresh
  (`router.refresh()`), expanded sections stay expanded.
- `SessionGuard` wraps the editor exactly like the product editor, so an expired session keeps the draft and asks
  the owner to sign in again before saving.
- Errors: sections with errors expand and get a red border + "Fix this: …" list at their top; the first one is
  scrolled into view; save bar error "Please fix the highlighted sections."

### 9.4 Wording table (kind names and descriptions — `SECTION_KIND_COPY`)

| Kind | Name | Description in "Add section" |
|---|---|---|
| overlay | Big photo with text | A full-width photo with a heading and text on top. |
| imageText | Photo and text | A photo beside a heading, text and an optional button. |
| icons | Icons row | Small icons with a title and a line of text, on a cream band. |
| testimonials | Customer quotes | A dark band with quotes from customers that slide by. |
| slideshow | Wide photo slideshow | One or more full-width photos, with separate phone photos. |
| featuredCollection | Products from a collection | A row of product cards from a collection you choose. |
| recommendations | “You may also like” (automatic) | Four similar products, chosen automatically. |
| reviews | Customer reviews (automatic) | The product's reviews and the Write a review button. |

### 9.5 New shared admin components

- `src/components/admin/CollectionPicker.tsx` — `{ value: {id,title}|null; onChange; label; hint?; required? }`,
  trigger shows "Collection · Cushions" or "Choose a collection"; popover/bottom sheet (`Popover`) with search over
  collections (new action `searchCollectionsAction(q)` in `actions/collections.ts`, title contains, 20 results with
  product counts). `data-testid="collection-picker"`.
- `src/components/admin/IconPicker.tsx` — `{ value: IconKey; onChange }`, trigger 48px with the icon and
  `aria-label="Choose icon: Delivery van"`; grid 4 columns × 56px tiles with labels. `data-testid="icon-picker"`.
- `SegmentedControl` in `ui-client.tsx` — `{ label; options:{value,label}[]; value; onChange; name? }`,
  `role="radiogroup"`, 40px buttons, wraps on narrow screens. (Used for photo position/size/alignment.)
- `RichTextEditor`: add `features.headings`, `features.lists`, `features.align`, `features.color` (all default true);
  false hides the Heading/Subheading, Bullet/Numbered list, Align left/centre/right, and Text colour buttons
  respectively, **and** the sanitiser call for that field strips the matching markup on save (`<h2>/<h3>` → `<p>`,
  lists → paragraphs, `text-align`/`color` styles removed) so pasted content can't bring them back. Overlay and
  photo-and-text turn all four off (plus photos and YouTube). No migrated body uses any of them, so parity holds and
  no list CSS is needed on the PDP.
- `src/components/admin/LayoutSummary.tsx` — the kind-chip strip + warning tags (§9.2), shared by list, product
  editor and Move dialog.
- `src/components/admin/ProductChecklist.tsx` — searchable checklist of products (title + thumbnail + current layout
  name), 20 per page with "Show more", "Select all shown", count "12 selected"; backed by
  `searchProductsForMoveAction({q, layoutKey?, collectionId?})`. Used by the Move dialog's "Choose products".
- `TextArea`: accept `data-plain-text` passthrough; `tests/admin/no-typed-fields.spec.ts` skips
  `textarea[data-plain-text]` (plain prose, never markup) — the scan's markup/JSON value check still applies to them.

### 9.6 Actions — `src/app/admin/actions/product-layouts.ts`

| Action | Behaviour |
|---|---|
| `saveProductLayoutAction(input)` | §5 validation; one `$transaction`: load this layout's section ids; snapshot the current rows → `previousVersion`; **always** `updateMany({where:{id, updatedAt}}, data:{updatedAt:new Date(), …})` (stale when `count===0`); update-in-place sections `where:{id, layoutId}` (only changed rows), create new (from their base), delete removed (this layout's ids only), positions 0..n-1; then `releaseUploads` (incl. URLs only in the outgoing `previousVersion`); revalidate (§6.1). Returns `{ok:true, updatedAt, ids:{clientKey:id}}` or errors. A save with no changes is refused client-side (Save disabled when clean). |
| `saveAsNewLayoutAction({sourceLayoutId, name, draft})` | §9.3; same validation and merge, bases resolved against the source layout; creates the new layout; no `previousVersion`; returns its id. |
| `createLayoutPreviewAction({layoutId, draft, productId})` | validation + merge without writing the layout; creates a `ProductLayoutPreview`; returns `{url}`. |
| `createProductLayoutAction({name, fromLayoutId|null})` | key `layoutKeyFromName`; position = max+1; copies sections (data, bodyHtml, refs, collectionId, hidden) and `originalVersion`, or creates one `recommendations` section. P2002 retry (§7.3). |
| `duplicateProductLayoutAction(id)` | name `copyName(...)`, as above. Redirects to the copy. |
| `makeLayoutForProductAction({productId})` | §11: duplicates the product's layout as "<layout name> – <product title>" (cut to fit), assigns it to that product only, returns the new layout id. One transaction. |
| `renameProductLayoutAction` | part of save (name/description fields); no separate action needed. |
| `moveProductsAction({fromId, toId, scope:'all'\|'collection'\|'chosen', collectionId?, productIds?})` | refuses `fromId === toId` and a missing target; inside one transaction re-reads the matching product ids (`layout: fromKey`, plus `collections some id` or `id in productIds`), `updateMany` by those ids, and returns `{count, movedIds, fromKey}`; revalidates (§6.1). |
| `undoMoveProductsAction({movedIds, fromKey, toKey})` | moves back only those ids whose `layout` is still `toKey`; returns the count. Offered as "Moved 12 products · Undo" for the session (toast with Undo button). |
| `deleteProductLayoutAction(formData)` | refuses protected key `default` and any layout with products (re-checked in the transaction, also when called directly); deletes (sections, previews cascade); releases uploads of sections and snapshots. |
| `layoutUsageAction(id)` | `{total, drafts}` for dialogs that open from the list. |
| `searchProductsForMoveAction(...)` | §9.5. |

Every action above, and `searchCollectionsAction`, begins with `requireAdmin()`.

---------------------------------------------------------------------------------------------------------------------

## 10. Rules

- **Used-by count** = `prisma.product.groupBy({ by:['layout'], _count:true })` over all statuses; drafts counted
  separately for the "(3 drafts)" suffix. Shown on list cards, editor header, delete and save dialogs, and in the
  product editor dropdown ("Office furniture — 247 products").
- **Duplicate** copies everything including hidden sections; image files are shared (reference-checked). The copy is
  used by no product. After duplicating, the copy's editor shows a `Notice` "This copy isn't used by any product yet."
  with **Bring products here…** (opens the Move dialog with the source as "from").
- **Move products dialog** — two layout selects, **From [layout]** and **To [layout]**, prefilled from where it was
  opened; either can be changed:
  - from a copy's notice / "Save as a new layout": title "Bring products here", From = the source, To = this layout;
  - from a layout's ⋯ "Move products…" or the delete-blocked message: title "Move this layout's products", From =
    this layout, To = empty ("Choose a layout"), wording "Move its 247 products to [layout]";
  - which products: ( ) All 247 products ( ) Only products in collection [CollectionPicker] — 12 products
    ( ) **Choose products** [`ProductChecklist` limited to the From layout] — 3 selected.
  From = To is impossible (the To select excludes the From layout). Confirm label "Move 12 products"; the count is
  re-checked in the transaction and the result says the real number. After moving: toast "Moved 12 products ·
  **Undo**" (undo remembers the exact product ids, §9.6). Single products also move from the product editor
  dropdown.
- **Rename** changes `name` (and description) only; the key and every product link stay. Blank name → "Please give the
  layout a name."
- **Delete** (`ConfirmDelete`): enabled only when used by 0 products and not `default`. Otherwise the button is
  disabled with `disabledReason` "Used by 247 products. Move them to another layout first." (+ a "Move products…"
  button) or "This is the standard layout used whenever a product has none; it can't be deleted." Consequences:
  "The layout “X” and its 8 sections", "Photos uploaded only for this layout", "Its undo history".
- **Hiding** a section keeps its content; hidden sections are skipped by the storefront loader.
- **Automatic sections** have no editor; they can be moved, hidden, deleted and re-added (one each).

---------------------------------------------------------------------------------------------------------------------

## 11. Product editor dropdown

- `products/_lib/load.ts`: load `layouts: {id, key, name, description, usedBy, summary}[]` (position order; `summary`
  = the `LayoutSummary` chip data); `layout` falls back to `'default'` when the product's key isn't in the list.
- `ProductEditor.tsx`: options `"<name>"` (keep the visible text as the name only, `usedBy` goes in the help line);
  help line under it = the **live contents summary** (`LayoutSummary`, compact) + description when set + " · Used by
  247 products"; plus a link **"Edit this layout ↗ (changes 247 products)"** (the suffix only when ≥ 2) to
  `/admin/product-layouts/<id>` (opens in the same tab; the unsaved guard protects the product form).
- **"Give this product its own layout"** button under the dropdown (shown for saved products when the chosen layout
  is used by ≥ 2 products): `ConfirmDialog` "Make a copy of “Office furniture” just for this product? Other products
  keep the current layout." → `makeLayoutForProductAction` → opens the new layout's editor. Disabled while the
  product form has unsaved changes ("Save the product first").
- `actions/products.ts`: replace `isProductLayout` with a DB check (`productLayout.findUnique({where:{key}})`); unknown
  → validation error "That page layout no longer exists. Pick another one." (`field: 'layout'`) instead of silently
  using default. Duplicate product keeps the layout key.
- `/admin/products?layout=<key>` filter: add a **"Page layout"** `Select` to the products page's existing GET filter
  form ("All layouts" + every layout by name) so the value is submitted with every search/filter and can be cleared
  like the other filters; `where.layout` applied when set; unknown key ignored.

---------------------------------------------------------------------------------------------------------------------

## 12. Phones (390 / 360)

- List: single-column cards; actions wrap; "Used by" link on its own line.
- Editor: section rows stack (thumbnail 56px, text, then a row of Edit / switch / ⋯); arrows always visible; drag
  handle uses the touch delay of `SortableList`. Section editors are full width; segmented controls wrap to two lines
  rather than scroll; the icon picker and collection picker open as bottom sheets; image uploads show the preview
  full width. Nested sortable lists (icon blocks, quotes, slides) have their own arrows.
- Below 640px one section is open at a time, with the sticky "← Back to all sections" bar (§9.3); the shared banner
  wraps; the Move dialog and the product checklist are full-screen sheets.
- `StickySaveBar` short labels: "Save" / "Discard". The warning and confirm dialogs fit at 360px.
- No horizontal page scroll anywhere (the mobile sweep checks it).

---------------------------------------------------------------------------------------------------------------------

## 13. Playwright tests

All test data uses `uniqueName('Layout test')` and is removed in `afterAll`/`finally` (layouts via prisma, test
products, `releaseTestUploads`). Hold the repo's `e2e.lock` around runs.

1. `tests/admin/product-layouts.spec.ts`
   - **List:** 18 migrated layouts visible with their names; "Office furniture" shows "Used by 247 products" (assert
     against a prisma count, not a literal).
   - **Copy and edit:** make a copy of "General furniture (standard)"; rename it; expand "Photo and text #1"; replace
     the photo (`uploadInto`, fixture `sofa-grey.jpg`), switch "Photo on the left", change heading, add a button with
     `pickLink` to a collection; add a quote, reorder quotes with arrows, hide the testimonials section; add an
     "Icons row" block and pick the `warranty` icon; save (no warning: 0 products). Reload → values persisted; the DB
     row's `ratio` equals the upload's `height/width×100` (derived, D7).
   - **Storefront:** create an ACTIVE test product (prisma) with the copy's key; open `/products/<handle>`: new heading,
     image `src` = the upload URL, photo side (`md:flex-row-reverse` absent), button href = the collection path,
     no testimonials band, warranty icon present.
   - **Shared warning:** give the copy 2 test products → the shared banner is visible on load; delete a section and
     hide another → Save shows "Change all 2 products?" with "Removed: …" and "Hidden: …" listed first; Keep editing
     cancels (DB unchanged); **Save as a new layout instead** creates a third layout with the edits, the copy is
     unchanged, and the Move dialog opens; confirm on the copy saves.
   - **Undo / restore:** after a save, "Undo last save" loads the previous version, saving it gives byte-identical
     section rows to before; on a copy of `default`, edit then "Restore the original design" + save → rows equal the
     migrated ones byte for byte.
   - **Preview changes:** edit a heading without saving → Preview opens `/products/<handle>?layoutPreview=…` showing the
     new heading; the DB is unchanged; the same URL in a signed-out context shows the saved heading (no preview).
   - **Move dialog:** move 2 chosen test products from the copy to another test layout → toast "Moved 2 products ·
     Undo" → Undo restores both; From = To is impossible.
   - **Give this product its own layout** (product editor) → new layout assigned to that product only, editor opens.
   - **Delete rules:** delete disabled while used (reason text); Move products → default; delete enabled → confirm →
     gone; its uploaded photo released (file 404). Deleting `default` is refused, **also by calling the action
     directly**.
   - **Hidden legacy preserved:** save the *copy* of a Coalesce layout after editing only its testimonials heading →
     the imageText rows' `data` strings are byte-identical to before (`headingThin`, `condensed`, `ratio`).
   - **Copy this section:** copy a Coalesce photo-and-text section, save → the new row's `data` is byte-identical to
     the source's (no "upload again" error).
   - **Icon text U+00A0:** in a copy, edit one icon title only, save → every other block's text is byte-identical
     (non-breaking spaces intact).
   - **Deleted collection:** a copy's featured section points at a test collection; delete the collection → the
     section is gone from the store and the editor shows the warning.
   - **Product editor dropdown** lists the copy by name; choosing it and saving changes `Product.layout`.
   - **Validation:** clear a required heading → section highlighted, save bar error, nothing saved. A second
     "You may also like"/reviews section, and the 20 / 4 / 8 / 20 / 6 limits, are refused by the server (direct
     action calls). Duplicate layout name (different case) → friendly error.
   - **Sanitising:** body text containing `<script>` / `onerror=` is stored cleaned; a button `javascript:` link is
     refused.
   - **Uploads:** an upload used only by a layout (and one only in `previousVersion`) has `isUploadReferenced` true
     and survives the 24-hour sweep.
   - **Stale:** save in two pages → second gets the stale message with "Save as a new layout instead" and "Reload";
     a save that only **reorders** sections also makes the other tab stale (updatedAt bump).
   - **Signed out:** each new action refuses / redirects.
   - **Long text:** a copy with an 80-character Extra large overlay heading, 600 characters of text and a 60-character
     unbroken word in an icon text: at 360px no horizontal scroll and the overlay text is not clipped.
2. `tests/admin/no-typed-fields.spec.ts` + `tests/helpers/admin-routes.ts`: add "product layouts list" and
   "product layout edit (sections open)" (prepare: expand every section; at desktop width so several stay open) — no
   URL/HTML/JSON/position/ratio/hex fields; skip rule for `textarea[data-plain-text]`; add
   `\b(ratio|class(name)?|hex)\b` (case-insensitive, word boundaries — "Classic" and "hexagon" are fine) to the banned
   label pattern.
3. `tests/admin/mobile.spec.ts`: same two routes at 412 and 360 (no horizontal scroll, ≥40px targets).
   `tests/admin/session-expired.spec.ts`: add the layout editor (draft kept, sign-in prompt, save after sign-in).
4. `tests/storefront/product-layouts.spec.ts`: for `default`, `coalesce-living`, `decor-cushions`,
   `blank-template-no-section` representative products (§14 table): section count, order (by class signature) and
   first heading text **read from the database** (`ProductLayoutSection` rows, visible only) rather than literals,
   icon count = the stored block count, slideshow phone/computer images present, featured headings present — so the
   spec keeps passing after the owner edits a layout.
5. Migration: `tests/integration/product-layouts-migration.spec.ts` (node-only test using prisma) runs against a
   **scratch database seeded from scratch** (same schema-copy + `datasourceUrl` approach as §7.4), never `dev.db`:
   every migrated layout's sections, parsed back, equal `prisma/easy-mode-data/product-layouts.json` after the
   documented transformations (sanitised HTML DOM-equivalent, `#`→`''`, icon by index, slideshow wrapped);
   `serialize(parse(row.data)) === row.data` for all 135 rows; `originalVersion` set on all 18; a second run skips the
   step; `--dry-run` leaves no rows; with one hand-made layout present first, all 18 keys are still imported.
6. **Lasting DOM parity:** `tests/storefront/product-layouts-dom.spec.ts` + `tests/fixtures/product-layouts-dom/<key>.html`
   (committed): for each of the 18 representative products, the `outerHTML` of the fixed sections (overlay, photo and
   text, icons, slideshow, quotes; product cards and reviews excluded) at 1440px. A layout is skipped (with a note)
   once it has been saved through the admin (`previousVersion` not null), so owner edits never fail it. Fixtures are
   generated from the BEFORE capture with only the §6.3 item 4/5 class changes applied.

---------------------------------------------------------------------------------------------------------------------

## 14. Pixel-parity verification plan

### 14.1 BEFORE capture (done, 2026-10-16, against the JSON-driven storefront)

Location: `/private/tmp/claude-501/-Users-mqrtxget-projects-personal-cozystyles/ff4d4862-ea6b-4748-8e76-ab9c4ce403e9/scratchpad/layouts-before/`

- `<layout>-1440.png` and `<layout>-390.png`: the region from the bottom of the product block (description + share
  links) to the end of `<main>` — i.e. every layout section, full height.
- `<layout>-<w>.html`: `outerHTML` of every section element (the DOM parity artefact).
- `meta.json`: handle, region height and per-section offsets/heights.
- The tools used, copied next to them: `layouts-shot.mjs` (capture) and `layouts-diff.mjs` (pixel diff). Run from the
  `scratchpad/pw` folder: `node layouts-shot.mjs ../layouts-after` then
  `node layouts-diff.mjs ../layouts-before ../layouts-after`.
- Capture settings: Chrome, DPR 1, `reducedMotion: reduce`, Playwright clock installed at a fixed time and paused
  (testimonial autoplay frozen on the first quote), page scrolled through so every lazy image loads, images forced
  eager, fonts awaited.

Representative product per layout (the ACTIVE product with the most reviews, ties by id; `door-products` uses `reno`
instead of the oddly named `free`):

| Layout | Product handle | Region height 1440 / 390 (px) |
|---|---|---|
| default | `dawn-manager-chair` | 4294 / 4613 |
| living-products | `camden-l-shape-sofa-cum-bed` | 4302 / 4544 |
| sofas | `jasper-sofa-2-seater` | 4236 / 4531 |
| bedroom-products | `bedside-table-candy-in-pine-grey-and-red-colour` | 4404 / 4723 |
| bed-sets | `sydney-single-bed-in-dark-grey-jute-with-light-oak` | 4508 / 4774 |
| dining-products | `dining-chair-elba` | 4512 / 4884 |
| study-products | `millie-study-desk` | 4223 / 4286 |
| kids-products | `wilson-bunk-bed-yellow-grey` | 3905 / 4060 |
| office-products | `apex-manager-chair-with-headrest` | 5016 / 5789 |
| wardrobes-products | `iris-wardrobe` | 3992 / 4239 |
| kitchens-products | `laundry-detergent-basket` | 3789 / 4044 |
| door-products | `reno` | 3787 / 4000 |
| decor-products | `cushion-filling` | 4500 / 5002 |
| decor-cushions | `cynosure-cushion-cover` | 7044 / 5258 |
| coalesce-living | `linea-arm-chair` | 4182 / 4448 |
| coalesce-dining | `arbour-dining-table-set` | 4516 / 4885 |
| coalesce-bedroom | `linea-dresser-2-0` | 4156 / 4452 |
| blank-template-no-section | `oryn-2-5-seater-curved-sofa-2` | 692 / 593 |

**Measured noise floor.** Two consecutive BEFORE runs gave byte-identical HTML snapshots but not byte-identical
PNGs: Chrome's image resampling differs slightly between runs (e.g. `living-products-1440`: 405 277 pixels differ,
max channel delta 16, rows 30–679 = the overlay photo; `decor-cushions-1440`: max delta 57 on 3 pixels). So the
pixel check needs a tolerance.

### 14.2 AFTER phase A (and again after B, with no layout edited)

Pass criteria for **each** of the 36 captures:

1. **HTML snapshot identical** to BEFORE (`diff -q`) after applying exactly the class substitutions of §6.3 items 4–5
   to the BEFORE file (`h-[500px]`→`min-h-[500px]`, `md:h-[650px]`→`md:min-h-[650px]`, the added
   `[overflow-wrap:anywhere]` tokens). Any other difference fails. (React keys don't appear in the DOM;
   sanitised `<br />` re-serialises as `<br>` in `outerHTML`.) Recommendation cards, featured cards and reviews come
   from the database, so compare against the same product/review data (no product edits between the runs). If a
   card or review differs, check that the difference is in the data only (e.g. a review was added) and has nothing
   to do with layouts, and note it in the hand-off.
2. **Same region height** (`meta.json`) and same section offsets/heights.
3. **Pixels:** `layouts-diff.mjs` reports `over24 ≤ 50` (pixels whose max channel delta exceeds 24) per image; any
   image above that is opened side by side and explained or fixed. (The `min-h`/`overflow-wrap` changes must not
   move a single pixel, since migrated content fits.)

Also run the two storefront specs and spot-check one product per layout at 1024px by eye.

### 14.3 Edit sanity

After phase B, edit a **copy** (never a used layout) to confirm the editor's changes appear — not a parity check.

---------------------------------------------------------------------------------------------------------------------

## 15. Implementation plan

### (A) Foundation: schema + migration + data layer + storefront from DB with parity

1. Back up `prisma/dev.db` (`npm run db:backup` and a scratchpad copy).
2. Write `prisma/easy-mode-data/product-layouts.json` from `templates.json` + `PRODUCT_LAYOUTS` (throwaway script in
   the scratchpad; verify 18 layouts / section counts match §1.1).
3. Move `extractUploadUrls` (+ new `extractHrefs`) to `src/lib/rich-text/urls.ts` (re-exported from `uploads.ts`);
   `src/lib/product-layout-icons.ts`, `src/lib/product-layout-sections.ts` (types, parse/serialize with the
   round-trip guarantee, refs, ratio helpers, defaults, copy).
4. Schema (§2) → stop dev server → `npx prisma db push` → `npx prisma generate`.
5. Migration step `product-layout-content` + step-4 key source change; seed wipe additions.
6. Run the migration: `--dry-run`, real run, second run all skipped.
7. `pdp-icons.tsx` (the four existing SVGs moved + 12 new), `pdp-data.ts` loader (incl. skip rules, featured
   collection-only query + limit, preview loader), `TemplateSections.tsx` changes (§6.3), `TestimonialsCarousel`
   `Lines`, `PdpSlideshow`, page.tsx switch to `getLayoutSections` + admin preview mode.
8. Delete `templates.json`; reduce `src/lib/product-layouts.ts` (§7.3); fix every importer
   (`actions/products.ts`, `products/_lib/load.ts`, `ProductEditor.tsx` — minimal DB-backed dropdown now, polish in B).
9. `uploads.ts` (`layout` purpose + references incl. snapshots/previews), `link-references.ts` (delimited needles),
   collection delete: clear featured `handles` + "used in N product page layout sections" consequence line.
10. `npx tsc --noEmit` and `npx tsc --noEmit -p tsconfig.scripts.json`; restart dev server.
11. Parity plan §14.2 — must pass before B starts. Seed parity check §7.4 (in a scratch DB, never `dev.db`).

### (B) Admin editor UI

1. Shared bits: `LayoutIcon`, `SegmentedControl`, `IconPicker`, `CollectionPicker` (+ `searchCollectionsAction`),
   `LayoutSummary`, `ProductChecklist` (+ `searchProductsForMoveAction`), `RichTextEditor features.headings/lists/
   align/color` (+ matching sanitiser stripping), `TextArea data-plain-text`.
2. `actions/product-layouts.ts` (§9.6) with the base/merge rule (§3), validation (§5), snapshots, preview,
   save-as-new, move + undo-move, make-layout-for-product.
3. List page (§9.2) incl. new-layout and duplicate flows, Move dialog (from/to/chosen + undo), Delete.
4. Editor page + `LayoutEditor` + the seven section editors; shared banner; Preview changes; Undo/Restore; save
   warning with change list and "Save as a new layout instead"; stale handling; broken links; `SessionGuard`;
   phone accordion + lazy Tiptap.
5. Product editor dropdown + summary + "Edit this layout (changes N products)" link + "Give this product its own
   layout" + "Page layout" filter in the products filter form (§11); `saveProductAction` revalidation (§6.1).
6. Sidebar entry.
7. Manual pass at 1440, 390, 360; `tsc`; re-run §14.2 (nothing edited ⇒ still identical).

### (C) Tests + README

1. Specs of §13 (+ helper updates). Full suite under the lock; store-wide ones with `E2E_EXCLUSIVE=1` as before.
2. README admin guide: new section **"Product page layouts"** after "Adding a product": what a layout is, that it's
   shared (with the warning), how to edit sections (photos, text, heading size, photo left/right, button, icons,
   quotes, slideshow, products from a collection, automatic sections), hide/move/delete/add sections, how to give a
   group of products their own version (Make a copy → Move products…, or "Give this product its own layout"),
   rename/delete rules, Preview changes, Undo last save, Restore the original design. Update step 7 of
   "Adding a product" and the menu list sentence ("…Products, Product page layouts, Collections…"). Update the
   "Controls everything" summary line and the migration paragraph (new step).
3. Update `docs/admin-easy-mode/SPEC.md` §1.2 non-goal "Editing the 18 product page section templates" → "moved to
   docs/product-layouts/SPEC.md" (one line), and mark this spec "Implemented" with any deviations.
4. Clean up every test layout/product/upload; confirm `SELECT count(*) FROM ProductLayout` = 18, `ProductLayoutPreview` is empty, the 18 layouts have `previousVersion` null, and the parity run
   once more.

---------------------------------------------------------------------------------------------------------------------

## 16. Decisions

- **D1. Two tables (`ProductLayout`, `ProductLayoutSection`) with per-kind JSON `data`.** A column per field across 8
  kinds would be mostly empty and need schema pushes for every new option; JSON is parsed by one pure module and is
  never shown to the owner. Rich text gets a real `bodyHtml` column and links/images a derived `refs` column so the
  existing `contains`-based upload and link reference checks keep working (escaped JSON would not match `href="…"`).
- **D2. `Product.layout` stays a string key, no foreign key.** Keys are stable and unique; no Product table rebuild in
  SQLite; all current values keep working; integrity enforced in actions with the existing `default` fallback.
- **D3. Keys never change.** Rename changes the display name only. New layouts get a key slugged from their name.
- **D4. Migration lives as a new step in `migrate-admin-easy-mode.ts`** (ledger, backup, dry-run, seed call all reused),
  input frozen in `prisma/easy-mode-data/product-layouts.json`, verbatim from today's JSON.
- **D5. Store sanitised HTML.** Verified DOM-identical for all 48 bodies; avoids a "legacy unsanitised" special case.
- **D6. Hidden legacy values are preserved by a server-side merge**, not by round-tripping them through the client.
- **D7. No ratio field.** imageText ratio = `round(h/w×100, 4)` of the uploaded image (matches every legacy value
  exactly); slideshow ratios = `h/w`; legacy values kept until the photo changes (protects the slideshow's `0.385`).
- **D8. `#` buttons migrate to an empty link** and render as `href="#"` — same DOM, and the editor shows "No link".
- **D9. No cross-request cache** for layouts (PDP is dynamic; avoids stale `.next/cache` after scripts).
- **D10. Icons are a fixed set of 16** (4 existing exact SVGs + 12 new in the same style); blocks store an icon key;
  migration assigns the old icons by position.
- **D11. Recommendations and reviews: at most one each per layout**; they can be moved, hidden, deleted, re-added.
- **D12. Slideshow supports up to 6 slides** (the brief asks for upload/reorder); one slide renders exactly as today;
  no per-slide link (text goes in the photo, like home banners).
- **D13. featuredCollection references the collection by id** (`SetNull` on delete → section skipped) so collection
  renames don't break it; `handles` only sort (never add products) and are kept until the collection is changed; a
  "How many products" limit (4/8/12) applies to new/changed sections, migrated ones keep "no limit".
- **D14. The `default` layout can't be deleted** (it is the fallback). Other layouts only when unused; moving products
  is offered in place (all, those in a chosen collection, or hand-picked), in either direction, with undo.
- **D15. The shared-change warning appears when ≥2 products use the layout**, preceded by a banner from the moment
  the editor opens, lists what changed, and offers "Save as a new layout instead". **Unsaved changes can be previewed**
  through a short-lived, admin-only preview token (`ProductLayoutPreview`, 2 h).
- **D21. One level of undo + the original design.** `previousVersion` (the layout before its last save) and
  `originalVersion` (the migrated design) are JSON snapshot columns; both load into the editor as unsaved changes
  rather than writing directly, so the owner sees, previews and confirms them through the normal save. No longer
  history (keeps the model small; one level covers "I just broke it").
- **D22. Section bases** (`stored` / `copy` / `previous` / `original` / `new`) give every section in a payload a
  server-side starting point, so hidden legacy values and bundled photos survive copying, undo and restore.
- **D16. Plain-text multi-line fields** (icon text, quotes) use a `TextArea` marked `data-plain-text`; the
  no-typed-fields scan exempts those but still rejects markup/JSON values in them.
- **D17. Whole-layout save** (one Save for all sections, like the product editor), not per-section saves — the warning
  then fires once and reorders/hides/deletes are atomic.
- **D18. Limits:** 20 sections, 4 featured, 8 icon blocks, 20 quotes, 6 slides — generous vs. today (max 9 / 2 / 4 /
  7 / 1) and keep queries bounded.
- **D19. Representative products for parity** = most-reviewed ACTIVE product per layout (exercises the reviews
  section), `reno` for doors.
- **D20. Layout list order is the migrated order; new layouts go last.** No reordering UI (it would need a position
  control and has no storefront effect beyond the dropdown order).

---------------------------------------------------------------------------------------------------------------------

## 17. Risks and edge cases

- **Owner edits a heavily shared layout by mistake** → banner from the start, Preview changes, a warning dialog with
  the product count and the change list, "Save as a new layout instead", and "Undo last save" afterwards.
- **Two admins/tabs** → `updatedAt` stale check, bumped on every save (section-only saves included); the losing tab
  can keep its edits as a new layout.
- **Collection deleted** → `SetNull`; the loader skips that section (pinned products don't linger); `handles`
  cleared; editor shows the warning; the collection delete dialog counts layout links/sections
  (`countLinkReferences` + a "used in N product page layout sections" line from `collectionId`).
- **Big collection picked** → "How many products" limit (default 8) keeps the row bounded.
- **Long text / unbroken words** → overlay band grows (`min-h`), lower overlay limits, `overflow-wrap:anywhere`.
- **Preview tokens** → admin session required, expire after 2 h, `noindex`; a leaked URL shows nothing extra to a
  signed-out visitor.
- **Product/collection a button links to is deleted or renamed** → LinkPicker red "Missing …" state; body links via
  `BrokenLinksNotice`; delete confirmations count them (§6.4).
- **Tiptap normalisation** of `<p>…<br></p>` (trailing break) happens only when the owner edits that body; the hidden
  input never dirties on load (existing RichTextEditor rule), and unchanged sections are not rewritten.
- **Very tall/narrow uploads** in imageText → the derived ratio follows the photo (as today's data does); the preview
  shows the real shape and a "This photo is tall…" warning appears; hint recommends sizes. No crop UI.
- **Mixed slide shapes** → all slides use the first slide's shape (no page jump); editor note.
- **Icon titles duplicated** → no React key collision (index keys).
- **Testimonials with one quote** → carousel handles `n=1` (no dots, no autoplay) — already supported.
- **A layout with zero visible sections** → product page simply ends after the description (valid).
- **Migration on a DB that never had easy-mode** → the step runs in order with the others; `Collection` handles for
  featured sections resolved at that time (warning if missing).
- **Dev cache**: the storefront query is uncached, so the migration takes effect without a restart; the restart is
  only needed for the Prisma client after `db push`.

---------------------------------------------------------------------------------------------------------------------

## 18. Review log

Revision 2 (2026-10-16) answers three reviews. Facts the reviewers raised were re-checked against the code and data
before acting: all 64 icon blocks contain U+00A0; 0 of 115 quotes contain `\n`; both pinned cushion products are in
`cushion-filling`; `getFeaturedCards` ORs `handles` with the collection and has no `take`; `uploads.ts` imports
`server-only`; the toolbar has lists/align/colour; the overlay band is a fixed height; `ImageWithText` always renders
its `<h3>`; all 51 bundled filenames match the tightened image regex.

**Accepted** (where the change lives):

| Reviewer · item | Change |
|---|---|
| R1.1, R3.8 preview | Admin-only `?layoutPreview=<token>` preview of **unsaved** state on any product incl. drafts (§2, §6.2, §9.3, D15). |
| R1.2 safe way out | "Save as a new layout instead" in the warning dialog, the stale message and the shared banner (§5, §9.3). |
| R1.3, R3.9 shared from the start | Shared banner on load; "(changes N products)" on the product editor link; "Give this product its own layout" (§9.3, §11). |
| R1.4 change list | Dialog lists removed/hidden first, then added/edited/order/name (§9.3). |
| R1.5 undo | `previousVersion` + `originalVersion` columns; Undo last save / Restore the original design load into the editor (§2, §9.3, D21). The original comes from the column written by the migration, so `src/` still never reads the frozen file. |
| R1.6 toolbar | `features.lists/align/color` off for overlay and photo-and-text, with sanitiser stripping (§3.1, §9.5). |
| R1.7, R3.3 featured limit | "How many products" 4/8/12, default 8, migrated `null` (§3.6). |
| R1.8 tall photos | Shape warning + real-shape preview (§3.2). |
| R1.9 slideshow jump | All slides use the first slide's shape + editor note (§3.5). |
| R1.10 wording | "Narrow letters, first word light"; chips use `SECTION_KIND_COPY`; one "Show on the store" switch; no "story blocks" (§3.2, §7.1, §9.2, §9.3). |
| R1.11 stale descriptions | Live `LayoutSummary` wherever a layout is chosen; "What it's for (optional)"; purpose-only migrated text; "Simple" (§7.1, §9.2, §11). |
| R1.12, R3.10 move dialog | From/To selects, "Choose products" checklist, Undo toast, From≠To, recount in transaction (§9.6, §10). |
| R1.13 filter | "Page layout" select in the products GET filter form (§11). |
| R1.14 reviews | Consequence line + "Hide keeps it for later" (§3.7, §9.3). |
| R1.15 dead buttons | "⚠ Button goes nowhere" on summary rows and list cards; link stays optional (§3.2, §9.2). |
| R1.16 empty heading | `<h3>` only with heading text (§6.3). |
| R1.17 neighbours | Heading size follows the layout's most-used size, else Medium; quote-marks help (§3.2, §3.4). |
| R1.18 phone length | One open below 640px, lazy Tiptap, sticky "Back to all sections", collapse while dragging (§9.3, §12). |
| R1.19 regex | Word-bounded `ratio`, `class`/`classname`, `hex` pattern (§13). |
| R2.1, R3.5 updatedAt | `updateMany({where:{id,updatedAt}})` bumping `updatedAt` on every save; returned to client (§5, §9.6). |
| R2.2 U+00A0 | §1.2 corrected; no `\s` in cleanup; byte-identical test (§5, §13). |
| R2.3, R3.1 copy section | Section **bases** incl. `copy` (§3, §5, D22); test (§13). |
| R2.4, R3.7 refs | `"\n…\n"`-delimited `refs`, pathnames, `refsNeedles` (§2, §6.4). |
| R2.5 server-only | `extractUploadUrls`/`extractHrefs` move to `src/lib/rich-text/urls.ts` (§2.1, §15). |
| R2.6, R3.2 deleted collection | Collection-only query, `handles` sort only, skip when `collectionId` null, `data.collection` never a fallback, handles cleared on collection delete (§3.6, §6.1). |
| R2.7 migration guard | Per-key import with skips reported; throws when the frozen file is missing (§7.2). |
| R2.8 byte format | Migration writes through parse→serialize; round-trip test on 135 rows; loader skips incomplete rows (§2.1, §6.1, §13). |
| R2.9 seed parity | Product check reduced to "every layout value is a key"; explicit wipe position (§7.4). |
| R2.10 revalidation | `revalidatePath(..., 'layout')` for both admin trees after every layout/used-by change, incl. `saveProductAction` (§6.1). |
| R2.11 smaller points | Quotes keep `\n`, rendered with `Lines` (§3.4, §6.3); `readData` missing-file throws (§7.2); schema comment updated (§2). |
| R3.4 clipping | `min-h` band, overlay limits 80 / 600, `overflow-wrap:anywhere`; HTML parity whitelist for exactly those class changes (§3.1, §6.3, §14.2). |
| R3.6 section scope | Ids checked against this layout; `where:{id, layoutId}` (§5, §9.6). |
| R3.11 names/keys | `copyName` cutting, empty slug → `layout`, keys ≤60, P2002 retry, `nameKey @unique` (§2, §7.3). |
| R3.12 security | `requireAdmin` in every new action incl. reads; tightened image regex (`/images/pdp/` or `/uploads/`, no `..`/`%`); render-time `validateHref` + `rel=noopener`; strict payload parse + 512 KB cap (§5, §6.3). |
| R3.13 index | `@@index([layout])` on Product (§2). |
| R3.14 session | `SessionGuard` + `session-expired.spec.ts` (§9.3, §13). |
| R3.15 collection delete | Added to phase A step 9 (§6.4, §15). |
| R3.16 brittle tests | Migration test on a scratch DB; storefront spec reads expectations from the DB (§13). |
| R3.17 risky-path tests | All listed cases added (§13). |
| R3.18 lasting parity | Committed DOM snapshot spec + fixtures (§13 item 6). |

**Adjusted or rejected:**

- **R1.6, "add `[&_ul]:list-disc` to the body divs if lists are wanted"** — not done: lists are turned off for both
  rich-text sections, so no list markup can reach the PDP and the extra classes would only change the DOM.
- **R3.3, a fourth "All" option** — not offered for new or changed sections (it reintroduces the 250-card problem).
  "All of them (as now)" appears only while a migrated section still has `limit: null`, so parity holds and the owner
  can see the current state.
- **R1.15, "or require a link once the button is on"** — the warning tag was chosen instead; requiring a link would
  block saving `default` (142 products) until the owner invents a destination for the two migrated buttons.
- **R3.18, "skip once `updatedAt` is newer than `createdAt`"** — the skip uses `previousVersion IS NOT NULL` instead:
  every admin save now sets it, while `updatedAt` vs `createdAt` can differ by milliseconds at creation and would
  skip every layout.
- **R1.1, "kept for a short time"** — fixed at 2 hours in a dedicated table rather than an in-memory store, because
  the dev server restarts on every schema change and an in-memory token would vanish mid-preview.
- **R2.11 quotes** — of the two options, `\n` is kept and rendered with `<br>` (rather than a single-line field):
  long quotes are easier to edit in a text area and no migrated quote is affected.

---------------------------------------------------------------------------------------------------------------------

## 19. Deviations (as built)

The build follows this spec except for the points below. Phase A and B details (with reasons) are in
`docs/product-layouts/NOTES.md` §5 and §7.2; they are summarised here so this list is complete.

**Phase A (foundation)**

1. The 12 new icons are 1px stroke outlines, not strokes converted to filled paths (§4). They look the same at 64px.
   The four migrated icons are byte for byte the old ones.
2. Quotes use `Lines` only when a quote contains `\n`, so the 115 migrated quotes keep their exact markup (§3.4).
3. `parseSectionData` fills defaults for broken or hand-made rows (heading size Large, ratio from the photo size,
   slideshow ratio 0.385); migrated rows never need them. `serializeSectionData` re-parses its input, so the key order
   is always the same.
4. The pure modules use relative imports, so scripts, the seed and the tests load them without path mapping.
5. "Simple (only “You may also like”)" is named **Simple**, with the note "For products that need nothing under the
   description." (§7.1).

**Phase B (admin editor)**

6. A save returns the fresh editor data; open sections stay open (client keys are remapped).
7. **Undo last save** / **Restore the original design** reuse the client keys of the saved sections of the same kind
   (so the change list says "Edited …"), add a "Goes back to …" line, and keep the current name when the loaded name
   belongs to another layout (a copy restoring the migrated design).
8. The stale check also runs before validation (the payload's `updatedAt`), besides the `updateMany` bump.
9. The Move dialog shows the chosen layout's `LayoutSummary` under each select (native options can't show chips);
   the toast reads "Moved N products to “X” · Undo".
10. Preview opens a blank tab inside the click and points it at the preview once ready (pop-up blockers).
11. "This layout isn't used by any product yet." with **Bring products here…** shows for every unused layout, not
    only fresh copies.
12. Photo-shape warnings (tall / small) show only for uploaded photos; the bundled photos are today's design.
13. Cosmetic: the rich-text toolbar (sticky at `top-16`) can overlap a section's sticky "← Back to all sections" bar
    while scrolling inside a long text.

**Phase C (tests and README)**

14. Direct server-action calls (limits, singletons, sanitising, `deleteProductLayoutAction` on `default` and on an
    in-use layout, every action signed out) go through `tests/helpers/layouts.ts` `callAction` / `callFormAction`,
    which read action ids from the dev server's `.next/server/server-reference-manifest.json`. Those cases need the
    local dev server; they cannot run against a remote `BASE_URL`.
15. DOM parity fixtures (`tests/fixtures/product-layouts-dom/<key>.html`) are the BEFORE capture byte for byte (fixed
    sections only). Instead of applying the §6.3 class changes to the fixtures, the spec undoes exactly those changes
    on the live markup before comparing. Same result, and the fixtures stay identical to the capture.
16. "Survives the 24-hour sweep" is tested with the app's real `isUploadReferenced` and `sweepOrphanUploads({ force: true })`,
    run by `tests/helpers/upload-refs.ts` (`tsx --conditions=react-server`, because `uploads.ts` imports
    `server-only`), after the two test uploads are back-dated by two days. The sweep is store-wide, as it is when the
    dashboard runs it.
17. The migration spec compares `bodyHtml` with `sanitizeRichText(original)` exactly, plus a loose DOM-equivalence
    check (`<br>` style, entity spelling, whitespace between tags) instead of a real DOM parse, since it runs in Node
    only. It builds its scratch database in a temp folder with a preload that points every `PrismaClient` at it, and
    asserts that `prisma/dev.db`'s checksum is unchanged.
18. The storefront spec checks the "first heading" against the first visible section that has one. "You may also
    like" and collection rows with no cards render nothing; the representative products all have cards, so this is
    not special-cased.
19. `tests/helpers/uploads.ts` `releaseTestUploads` now also counts layout references (sections, both snapshots and
    unexpired previews), mirroring `isUploadReferenced`.
20. The README section "Product page layouts" sits after "Options, combinations and statuses" rather than directly
    after "Adding a product", so step 5's "see below" still points at the options section. Step 7 links to it.
21. `tests/admin/mobile.spec.ts` needed no change: it walks `adminRoutes()`, which gained both layout routes in B.
22. Product fix found by the tests: the duplicate-singleton error read "only one ““You may also like”” section"
    (the name already has quotes). `parseLayoutDraft` now quotes only names without them.
23. `tests/admin/mobile.spec.ts` "the link picker opens as a bottom sheet" now allows 30 s for the first search
    result: in a full run the dev server unloads idle routes and recompiles `/api/admin/session` (≈12 s), which
    `SessionGuard` waits on before the first server action. A test-timing fix, not a product change.
