# Product page layouts: implementation notes (phases A and B)

What phase A of `SPEC.md` built, how to use it, and where it differs from the spec. If you build phase B (the admin
editor) or phase C (tests and README), read §1–§4 first.

## 0. State

- **Backups taken before the schema push and the migration:** `prisma/backups/dev-20261016-174006.db` (`npm run db:backup`),
  `prisma/backups/dev-20261016-174426-before-easy-mode-migration.db` (made by the migration) and
  `<scratchpad>/dev.db.before-product-layouts`.
- **Schema (§2)** applied with `npx prisma db push` (additive only): `ProductLayout`, `ProductLayoutSection`,
  `ProductLayoutPreview`, `Collection.layoutSections` back relation, `@@index([layout])` on Product, and updated
  comments. `npx prisma generate` was run and the dev server restarted (it is running on :3100).
- **Migration step `product-layout-content`** ran on `dev.db`: `18 layouts (0 skipped), 135 sections, 0 missing
  images, 0 missing collections, 0 products reset to default`. A second run skipped every step ("nothing to do").
  The `--dry-run` was done first and rolled back.
- **`src/components/product/data/templates.json` is deleted.** Its content is frozen in
  `prisma/easy-mode-data/product-layouts.json` (18 layouts, verbatim sections plus a name and a "what it's for" line).
  Nothing in `src/` reads that file.
- `npx tsc --noEmit` and `npx tsc --noEmit -p tsconfig.scripts.json` are clean.
- `tests/admin/product-sofa.spec.ts` (it picks "Sofas" in the Page layout dropdown) and `tests/storefront/regression.spec.ts`
  pass (15/15), run under `<scratchpad>/e2e.lock` with `E2E_AGENT=PL`.
- **No test data is left.** The DB has 18 layouts, 135 sections, 0 previews, every `previousVersion` null, 695 products
  with the same layout counts as before, and 0 uploads.

## 1. Pixel parity (SPEC §14.2), all 18 layouts × 1440 / 390

AFTER capture: `<scratchpad>/layouts-after/` (same `layouts-shot.mjs`, same products).

1. **HTML: 36/36 identical** to BEFORE, after undoing only the allowed §6.3 class changes
   (`[overflow-wrap:anywhere]`, `min-h-[500px]`, `md:min-h-[650px]`). The new tool is `<scratchpad>/pw/layouts-htmlcmp.mjs`
   (`node layouts-htmlcmp.mjs ../layouts-before ../layouts-after`). It also checks the geometry.
2. **Geometry: identical.** Same region height and the same top and height for every section, in all 36 captures.
3. **Pixels:** 18 of 36 PNGs are byte-identical. The rest are under the threshold: the worst is `kitchens-products-1440`,
   with `over24 = 3` (the limit is 50). Max channel deltas are 1–57, all inside photos. This is the noise documented in §14.1:
   Chrome resamples the photos slightly differently on each run. To confirm it, a second AFTER run
   (`<scratchpad>/layouts-after2/`, 4 layouts) was diffed against the first AFTER run. It gives the same kind of diffs in
   different rows, e.g. `kitchens-1440` AFTER vs AFTER2 `over24 3`, `living-1440` 733k pixels with max delta 20. So the
   remaining diffs are not caused by this change, and nothing more needs fixing.

Seed parity (§7.4) was checked against a scratch DB (`<scratchpad>/plseed/`). The schema was copied there with an absolute
URL and pushed. The seed was run through `preload.cjs`, which points every `PrismaClient` at `SEED_DB` and refuses to
run against `prisma/`. `dev.db`'s checksum was the same before and after.
- Section rows (`key, position, kind, hidden, bodyHtml, data, refs, collection handle`) are **identical**: 135 rows, same hash.
- Layout rows (`key, name, nameKey, description, position`) are identical. The `originalVersion` strings differ only in
  the two `collectionId` numbers inside the decor-cushions snapshot (2893/2894 on dev vs 69/70 fresh). These are the
  autoincrement ids of the same collections (`cushion-filling`, `cushions`), so the difference is expected.
- In both DBs every `Product.layout` is one of that DB's layout keys.

Round trip: `serializeSectionData(kind, parseSectionData(kind, row.data).data) === row.data` for all 135 rows. The checker
is `<scratchpad>/pl-verify.ts`; it also compares every migrated field with the frozen file. Every `imageText.ratio` equals
`ratioOf(width, height)` of the real file, so for photo-and-text sections a derived ratio is exactly today's behaviour.

## 2. Modules (import paths)

| Module | What it gives you |
|---|---|
| `@/lib/product-layout-sections` (pure, relative imports only) | `SECTION_KINDS`, `SectionKind`, `isSectionKind`, `AUTOMATIC_KINDS`, `SINGLETON_KINDS`, `MAX_*` limits, `HEADING_SIZES`; data types `OverlayData`, `ImageTextData`, `IconBlock`, `IconsData`, `TestimonialsData`, `Slide`, `SlideshowData`, `FeaturedCollectionData`, `SectionDataMap`, `SectionData`; `parseSectionData(kind, json)` → `{data, complete}` (never throws); `serializeSectionData(kind, data)` (it re-normalises, so the key order is always stable); `sectionImages`, `sectionRefs(kind, data, bodyHtml)`, `refsNeedles(path)`, `ratioOf(w,h)`, `fracOf(w,h)`, `splitFirstWord`, `newSectionDefaults(kind, {headingClass?})`, `SECTION_KIND_COPY`; snapshots: `SnapshotSection`, `LayoutSnapshot`, `serializeSnapshot`, `parseSnapshot` |
| `@/lib/product-layout-icons` (pure) | `ICON_KEYS` (16), `IconKey`, `ICON_LABELS`, `DEFAULT_ICON`, `isIconKey`, `legacyIconAt(i)` |
| `@/components/product/pdp-icons` | `PDP_ICONS: Record<IconKey, Component>`, `pdpIcon(key)` (unknown → delivery), and the 16 named icon components. The four trust icons were moved here byte for byte; `product/icons.tsx` re-exports them. |
| `@/lib/product-layouts` (pure) | `DEFAULT_LAYOUT_KEY`, `PROTECTED_LAYOUT_KEYS`, `MAX_LAYOUT_NAME`, `MAX_LAYOUT_KEY`, `layoutNameKey(name)`, `layoutKeyFromName(name, takenKeys)`, `copyName(base, takenNameKeys)`. `PRODUCT_LAYOUTS`, `isProductLayout` and `layoutLabel` are gone. The FOUNDATION-NOTES §2 row for this module is out of date. |
| `@/lib/rich-text/urls` (pure) | `extractUploadUrls(html)` (moved here; `@/lib/uploads` re-exports it), `extractHrefs(html)` |
| `@/components/product/pdp-data` | `PdpSection` union (every member has `id`), `getLayoutSections(key)` (`react` `cache`; unknown key → `default`; skips incomplete rows and featured rows whose collection is gone, with one `console.warn` per message), `getLayoutSectionsForPreview(token)` → `{layoutId, sections}` or null, `getFeaturedCards(section, excludeId?)`, `getRecommendations` |
| `@/components/product/Lines` | `Lines` (`\n` → `<br>`), shared by the server sections and the client carousel |
| `@/components/product/PdpSlideshow` | client carousel used for 2 or more slides |
| `@/components/product/LayoutPreviewBar` | the admin preview bar (fixed at the top, z-70) |
| `products/_lib/load.ts` | `LayoutOption` type, `loadLayoutOptions()` (position order + `usedBy` from `groupBy layout`). `loadEditorLookups()` now also returns `layouts`. |

**Stored `data` shapes** are exactly the §2.1 types. Key order is defined in `parse*` in `product-layout-sections.ts`. For
example, imageText is `image, imageWidth, imageHeight, ratio, size, imageFirst, center, disableBottom, headingClass,
heading, headingThin, condensed, button`. Slideshow is `{slides:[{desktop, desktopWidth, desktopHeight, desktopRatio,
mobile, mobileWidth, mobileHeight, mobileRatio}]}`. **Always write `data` through `serializeSectionData`** and `refs`
through `sectionRefs`, and B's merge rule holds byte for byte.

`refs` holds the image URLs, the button href pathname and, from `bodyHtml`, the upload URLs and internal link pathnames.
For example, a Coalesce body gives `"\n/images/pdp/Living.jpg\n/collections/coalesce-living\n"`. Internal means the href
starts with `/` and not with `//`; external links are not listed.

## 3. Storefront behaviour

- `page.tsx` calls `getLayoutSections(product.layout)` and uses `s.id` as the React key. Featured cards now use the
  collection-only query (exclude the viewed product → sort by pinned handles, then id → `limit`). The migrated
  cushion rows give the same cards.
- **Preview mode:** `?layoutPreview=<32 hex>` counts only when `getAdminOrNull()` returns an admin. Then the page uses
  the snapshot sections, drafts render too, `robots: noindex, nofollow` is added, and the bar reads "Preview — not saved
  yet. Only you can see this." with "Back to editing" → `/admin/product-layouts/<layoutId>`. An unknown or expired token
  shows the expired text over the normal sections. Signed out, the parameter is ignored. All of this was checked by hand
  with a temporary preview row, which was then deleted.
  Preview snapshot sections get negative ids (`-(index+1)`), used only as React keys.
- **Renderer changes are only those in §6.3:** icon from `block.icon`, `key={i}`; button `href` normalised and validated at
  render (invalid or empty → `#`; external → `target=_blank rel=noopener`); `<h3>` only when there is heading text; overlay
  `min-h-*`; `[overflow-wrap:anywhere]` on overlay/imageText headings, icon title/text and the quote; quote line breaks;
  one slide → the old markup (`mobile ?? desktop`), 2 or more → `PdpSlideshow`.
- **Cache:** none across requests (D9). `saveProductAction` (when the layout changed or the product is new),
  `duplicateProductAction` and `deleteProductAction` call `revalidatePath('/admin/product-layouts','layout')` and
  `('/admin/products','layout')`. **B must add the same calls to every layout action (§6.1).** The collection delete
  revalidates `/admin/product-layouts` when it touched sections.

## 4. Admin pieces done in A (B builds on them)

- Product editor "Page layout" dropdown: options come from the DB (`layouts` prop; the visible text is the layout name).
  The help line is "<what it's for> · Used by N products". The `LayoutSummary` chips, the "Edit this layout ↗" link and
  "Give this product its own layout" are B's work.
- `saveProductAction` checks the key against `ProductLayout`. An unknown key returns `INVALID` with "That page layout no
  longer exists. Pick another one." and `field: 'layout'`. The editor currently shows it as the top error; B can map
  `field: 'layout'` to the select. `loadProductEditorState` falls back to `default` when the product's key isn't a layout.
- `uploads.ts`: purpose `'layout'` is accepted by `/api/admin/uploads`. `isUploadReferenced` also counts
  `ProductLayoutSection.refs` (`"\n"+url+"\n"`) / `bodyHtml`, both snapshot columns, and unexpired preview rows.
- `countLinkReferences` adds layout sections (`bodyHtml` needles, plus `refsNeedles(path)` on `refs`) to `richText`.
  The wording of the delete-consequence lines for products, collections and pages now says "N links in pages,
  descriptions or product page layouts point here".
- Collection delete: inside the transaction it clears `handles` of that collection's featured sections (through
  parse/serialize), then the delete sets `collectionId` to null. The consequence line reads "Used in N “Products from a
  collection” sections of product page layouts (they will disappear from the store)".

## 5. Deviations and decisions

1. **New icons are stroke outlines** (`<g fill="none" stroke="currentColor" strokeWidth=1 round>` inside an
   `fill="currentColor"` 20×20 svg), not strokes converted to filled paths as §4 says. They look the same at 64px (contact
   sheet: `<scratchpad>/pl-icons.png`) and are easier to edit. The four live icons are untouched.
2. **Quotes:** `TestimonialsCarousel` uses `Lines` **only when the quote contains `\n`**. `Lines` wraps every line in a
   `<span>`, so using it for every quote would add a span to all 115 migrated quotes and break the HTML parity that §3.4
   assumed. Headings and icon texts keep `Lines` as before.
3. **`parseSectionData` defaults** (only used for broken or hand-made rows; migrated rows never hit them): `headingClass`
   → `h3` (matches the old renderer's `?? HEADING.h3`); imageText `ratio` → from the dimensions, else 100; slideshow
   `desktopRatio` → from the dimensions, else 0.385; a slide without a computer photo is dropped. `complete` is: overlay
   needs image + heading; imageText needs image (the save action must also require "heading or text" per §5, because
   `bodyHtml` is outside `data`); icons ≥1 block; testimonials heading + ≥1 item; slideshow ≥1 slide; featured heading.
   Recommendations and reviews are always complete.
4. **`serializeSectionData` re-parses its input**, so callers can pass any object shape and still get stable key order.
5. The pure modules use **relative imports** (`./links`, …) instead of `@/`, so `tsx` scripts, the seed and tests can
   load them without relying on tsconfig path mapping.
6. The migration resolves bundled image sizes with the existing `imageSize()` helper (sharp). The slideshow keeps
   `desktopRatio 0.385` verbatim; the real file is 1920×739, which is now stored as `desktopWidth/Height`.
7. Migrated "what it's for" lines (in the frozen file, reviewable there) are purpose only, e.g. "For office chairs and
   desks.", "The standard page for most furniture.", "For the Coalesce living range.". "Simple (only “You may also
   like”)" became **"Simple**", "For products that need nothing under the description."

## 6. Still to do (phases B and C, by the spec)

- ~~B~~ (done, see §7): `actions/product-layouts.ts` (§9.6) with the base/merge rule, validation, snapshots (`serializeSnapshot` /
  `parseSnapshot` are ready), preview creation (write `ProductLayoutPreview.sections` with `serializeSnapshot`; 2 h
  expiry; `getLayoutSectionsForPreview` already reads it), revalidation, `releaseUploads` after the transaction;
  list and editor pages, the shared components, the sidebar entry, and the product editor polish (§11), including
  the `?layout=` filter.
- B: the `RichTextEditor` `features.headings/lists/align/color` flags and the matching sanitiser stripping (§9.5) are
  not done.
- C: every spec in §13 (the DOM fixtures in item 6 can be generated from `<scratchpad>/layouts-before/*-1440.html` with the
  class substitutions applied), README, and updating `docs/admin-easy-mode/SPEC.md` §1.2 and FOUNDATION-NOTES §2
  (the `@/lib/product-layouts` row).
- Re-run the parity check after B with no layout edited:
  `cd <scratchpad>/pw && node layouts-shot.mjs ../layouts-afterB && node layouts-htmlcmp.mjs ../layouts-before ../layouts-afterB && node layouts-diff.mjs ../layouts-before ../layouts-afterB`.


## 7. Phase (B) admin editor — what was built

**State after B:** `npx tsc --noEmit` and `-p tsconfig.scripts.json` clean. DB identical to the migrated state:
18 layouts / 135 sections / 0 previews / 0 uploads / 695 products; the checksums of
`(key, position, kind, hidden, bodyHtml, data, refs, collectionId)` of all sections, of
`(key, name, nameKey, description, position, originalVersion, previousVersion, updatedAt)` of all layouts and of
`Product.layout` counts equal the ones taken before B (`<scratchpad>/dev.db.before-phaseB` is the backup).
Parity re-run (`<scratchpad>/layouts-afterB/`): **HTML + geometry identical for all 36 captures**, pixels all
`over24 ≤ 3` (same photo-resampling noise as after A). `tests/admin/no-typed-fields`, `mobile`, `product-sofa`,
`uploads` pass (`E2E_AGENT=PLB`, under the lock).

### 7.1 Files

| File | What |
|---|---|
| `src/lib/product-layout-draft.ts` (pure) | Draft shapes shared by editor and actions: `SectionBase`, per-kind owner values (`OverlayValues`, `ImageTextValues` with `heading` + `headingStyle`, `IconsValues`, `TestimonialsValues`, `SlideshowValues` (`mobile ''` = none), `FeaturedValues` (`collectionId`, `limit`)), `DraftSection`, `LayoutDraft`, `SectionErrors`, `LayoutActionError`; field limits; `valuesFromData` (stored data → values, nested keys `b0`/`q0`/`sl0`), `describeChanges` (save-warning list), `sectionLabels` ("Photo and text 2"), `summarizeSections` / `sectionWarnings` (chips + ⚠ tags), `cleanText` (never `\s`), `preferredImageTextHeading`. |
| `src/lib/product-layout-merge.ts` (pure) | `parseLayoutDraft` (strict types, limits, singletons, 512 KB), `cleanLayoutName`, `mergeLayoutDraft(draft, ctx)` = the §3 base/merge rule + §5 validation, `MergeContext` (rows, snapshots, Upload sizes, collections passed in), `mergedToSnapshot`, `draftImageUrls`, `draftCollectionIds`. A value equal to its base value is kept byte for byte; derived values are recomputed only when their input changed. |
| `src/app/admin/actions/product-layouts.ts` | `saveProductLayoutAction`, `saveAsNewLayoutAction`, `createLayoutPreviewAction`, `createProductLayoutAction`, `duplicateProductLayoutAction`, `makeLayoutForProductAction`, `deleteProductLayoutAction` (form), `layoutUsageAction`, `searchProductsForMoveAction`, `moveProductsAction`, `undoMoveProductsAction`. All start with `requireAdmin()`, all revalidate both admin trees. |
| `src/app/admin/actions/collections.ts` | + `searchCollectionsAction(q)` (20 results with product counts). |
| `src/app/admin/(panel)/product-layouts/` | `page.tsx` (list), `[id]/page.tsx` (editor; query `copied=<id>`, `created=1`, `own=1`, `rename=1`, `from=<id>` opens the Move dialog, `error=in-use|protected`), `_lib/load.ts` (`loadLayoutChoices`, `loadLayoutEditorData`, `layoutUsage`), `_components/LayoutEditor.tsx`, `LayoutList.tsx` (cards + New layout dialog), `MoveProducts.tsx` (dialog + Undo toast), `sections/{Overlay,ImageText,Icons,Testimonials,Slideshow,Featured,Automatic}Editor.tsx`, `sections/common.tsx`. |
| `src/components/admin/` | new `CollectionPicker`, `IconPicker`, `LayoutSummary` (server-safe), `ProductChecklist`, `MenuButton` (⋯ menus), `Dialog` (generic modal, `dialogButton` classes); `SegmentedControl` in `ui-client.tsx` (re-exported by `ui.tsx`); `LayoutIcon`, `DotsIcon`, `PlusIcon`; `RichTextEditor`/`Toolbar` `features.headings/lists/align/color`; `SortableList.onDragStateChange`; `Popover` sits at z-75 when opened inside a modal; `ImageUpload`'s required proxy input no longer holds the photo address. |
| `src/lib/rich-text/sanitize.ts` | + `sanitizeRichTextWith(html, flags)`: headings/list items → `<p>`, align/colour styles, photos and videos stripped for switched-off features (layout bodies use all off). |
| Product editor | "Page layout": `LayoutSummary` chips + what it's for + used-by, "Edit this layout ↗ (changes N products)", "Give this product its own layout" (saved products whose layout has ≥2 products; disabled while dirty), `field: 'layout'` errors shown under the select. `LayoutOption` is now `LayoutChoice`. Products list: "Page layout" filter (`?layout=<key>`). |
| Shell / tests | Sidebar "Product page layouts" after Products; `tests/helpers/admin-routes.ts` has "product layouts list" and "product layout edit (sections open)"; `no-typed-fields.spec.ts` skips `textarea[data-plain-text]` (still rejects markup/JSON values) and bans `ratio`/`class`/`classname`/`hex` labels. |

### 7.2 Behaviour notes and deviations

1. **Save returns the fresh editor data** (`{ok, updatedAt, ids, data}`); the editor is not keyed by `updatedAt`, so
   open sections stay open (client keys `s-<id>` are remapped through `ids`).
2. **Undo last save / Restore the original design** load the snapshot as unsaved sections that reuse the client keys of
   the saved sections of the same kind (so the change list says "Edited …"); the list also says "Goes back to …". When
   the snapshot's name belongs to another layout (a copy restoring the migrated design of "General furniture"), the
   current name is kept so the save doesn't fail on the unique name.
3. Stale check: the payload's `updatedAt` is compared up front, and `updateMany({id, updatedAt})` bumps it inside the
   transaction (also for reorder-only saves). Stale → save bar "Reload (your edits will be lost)" / "Save as a new
   layout instead". A `stored`/`copy`/snapshot base that doesn't belong to the layout also answers STALE.
4. **"Save as a new layout"** resolves `stored` bases as copies of the source rows, copies the source's
   `originalVersion`, then opens the new editor with `?from=<source>` → the Move dialog "Bring products here from …".
5. Release of uploads after save: candidates are the outgoing `previousVersion` + the old rows; `releaseUploads` keeps
   anything still referenced (new rows, the new undo snapshot, other layouts). Delete releases rows + both snapshots.
6. Move dialog: native selects can't show chips in options, so the chosen layout's `LayoutSummary` is shown under each
   select. The toast reads "Moved N products to “X” · Undo".
7. Preview: a blank tab is opened inside the click and pointed at the preview URL once the action returns (popup
   blockers). The preview product picker lists products of the layout (any product when unused).
8. "This layout isn't used by any product yet." + **Bring products here…** shows for every unused layout (not only
   fresh copies); From is the copy's source when known (`?copied=`), else chosen in the dialog.
9. Photo-and-text shape warnings ("tall" / "small") are shown only for `/uploads/` photos (the bundled design photos are
   today's design). The section editors use functional value updates, so two uploads finishing together don't
   overwrite each other.
10. The rich-text toolbar is still sticky at `top-16` and can overlap the section's sticky "← Back to all sections" bar
    while scrolling inside a long text (cosmetic).

### 7.3 Verified by hand (browser, then reverted)

On copies only (never a used layout), at 1440 and 390: every kind edited and saved (overlay heading/size/photo/text,
photo-and-text photo/right/heading/text/button with LinkPicker, icons with the warranty icon + a second block,
quotes added/reordered, slideshow 2–3 slides with a phone photo and the crop note, featured collection + limit,
automatic sections hidden and moved), section reorder by arrows, copy section (data byte-identical), Coalesce copy
(legacy imageText rows byte-identical after editing only the quotes heading; icon texts with U+00A0 byte-identical),
validation (empty heading → highlighted section + save bar error), discard, shared banner + "Change all 2 products?"
(Removed/Hidden first), Keep editing (DB unchanged), Save as a new layout → Move dialog → move 2 chosen → Undo,
Save for all, Undo last save (rows byte-identical), Restore original (rows equal `default`'s), Preview (admin sees the
unsaved heading, signed-out sees the saved one, DB unchanged), Give this product its own layout, delete blocked while
used → Move products… → delete, default not deletable, products `?layout=` filter. Storefront pages of throwaway
products showed every change at both widths with no horizontal scroll. All test layouts, products, previews and
uploads (rows and files) were removed afterwards. Scripts: `<scratchpad>/pw/plb-*.mjs`,
`<scratchpad>/plb/merge-roundtrip.mts` (untouched drafts merge back byte-identical for all 135 rows × stored / copy /
original bases), `<scratchpad>/plb/testprod.mts`.

### 7.4 Left for phase C

The §13 specs (incl. the new routes' session-expired case), README, `docs/admin-easy-mode` updates.

## 8. Phase (C) tests and README — what was built

| File | What |
|---|---|
| `tests/admin/product-layouts.spec.ts` | 19 serial tests covering SPEC §13.1: list, copy + edit every control, store, shared warning / save as new, undo / restore, preview, move + undo, own layout, product dropdown, uploads + 24 h sweep, delete rules, Coalesce byte-for-byte cases, deleted collection, validation and limits, sanitising, stale, signed out, long text at 360 px. Everything it creates is tracked by `LayoutTestData` and removed in `afterAll`. |
| `tests/helpers/layouts.ts` | `callAction` / `callFormAction` (direct server-action calls; ids from `.next/server/server-reference-manifest.json`), `draftFromDb`, `rowsOf`, `uploadRefs`, `LayoutTestData` (test products, collections, layouts, uploads + cleanup), editor helpers. |
| `tests/helpers/upload-refs.ts` | Runs the app's `isUploadReferenced` / forced `sweepOrphanUploads` (`tsx --conditions=react-server`). |
| `tests/helpers/uploads.ts` | `releaseTestUploads` also counts layout references. |
| `tests/admin/session-expired.spec.ts` | + layout editor: draft kept, sign-in prompt, saved after signing in (on a copy of "Simple"). |
| `tests/storefront/product-layouts.spec.ts` | 4 representative products; expectations read from the DB. |
| `tests/storefront/product-layouts-dom.spec.ts` + `tests/fixtures/product-layouts-dom/*.html` | Lasting DOM parity for all 18 (fixtures = BEFORE capture, generated by `<scratchpad>/plc-gen-dom.mjs`). |
| `tests/integration/product-layouts-migration.spec.ts` | Seed from scratch into a temp DB, compare with the frozen file, round trip, second run, `--dry-run`, hand-made layout first. |
| README | "Product page layouts" owner guide; menu list, step 7, admin summary line, migration and tests paragraphs. |

Product fix: the duplicate-singleton message no longer doubles the quotes around “You may also like”.
Deviations are listed in SPEC §19.

