# Foundation (Phase 1) hand-off notes

What F built for SPEC.md §7.2, how to use it, and where it differs from the spec. Phase-2 agents: read §1–§4
before you start; the contracts below are frozen (SPEC §7.5).

## 0. State of the repo

- Backups: `prisma/dev.db.bak-before-admin-easy-mode` (requested name) and
  `prisma/backups/dev-20261015-203645-before-admin-easy-mode.db` (the spec's folder). Both gitignored.
- Packages installed at the exact §4.1 versions (`--save-exact`). npm scripts added: `db:backup`,
  `db:migrate-easy-mode`, `test:e2e`.
- `.gitignore`: `/storage/`, `/prisma/backups/`, `/prisma/dev.db.bak-*`, `/test-results/`, `/playwright-report/`, `/tests/.auth/`.
- `next.config.mjs`: `serverExternalPackages: ['sharp','heic-decode']`, redirects `/cart`, `/checkout`, `/checkout/*` → `/` (verified 307).
- Schema §2.1 applied with `db push` (additive), DB reseeded (`npm run db:seed` = raw seed + all fidelity + migration),
  migration run again standalone → every step `skipped`.
- Dev server restarted, running on :3100. `npx tsc --noEmit` and `npx tsc --noEmit -p tsconfig.scripts.json` are clean.
  The §0.12 server-only grep over `scripts tests prisma` is empty.
- `/`, `/collections`, a product page, `/admin` and the admin products/menus/banners/pages/settings/collections/reviews/messages pages return 200.
- `tests/admin/uploads.spec.ts`: 8/8 passing (`E2E_AGENT=F npx playwright test tests/admin/uploads.spec.ts`).
- Phase-1 baseline screenshots (1280 + 390) of the 9 §7.2-step-14 pages:
  `<scratchpad>/fbase/*-phase1.png` (pre-change ones are `*-before.png`). NEW labels, Limited Edition bars and
  FREE DELIVERY are present. Expected differences only: fidelity data (collection product order etc., R1),
  `/pages/review` without the duplicate chrome, clean policy pages.
- The throwaway `admin/(panel)/dev-components` page was used to exercise every component (desktop + 360px), then deleted.

### Migration report (fresh reseed)

```
options-to-rows     695 products checked → 97 options, 220 values (0 appended from variants, 2 products remapped)
variant-status      843 variants → READY_TO_SHIP 517, PRE_ORDER 130, MADE_TO_ORDER 58, SOLD_OUT 138
product-flags       85 new, 37 limited, 624 delivery, 532 discount
product-layouts     553 products got a layout (0 unknown handles, 0 unknown layouts)
swatches            121 swatch colours set, 0 values left neutral
photo-tags          199 photos tagged across 78 products (1 conflicts kept)   ← noble-sofa
card-data           139 card photo ratios
collection-index    255 collection cards, 3 built-in cards, 0 skipped, 0 covers set (catalog fidelity already set them)
pages               47 pages → TEXT 6, BLOG 14, DESIGNED 27 (3 whole documents unwrapped)
sanitize-rich-text  595 product descriptions, 91 collection descriptions cleaned
menus               2 stacked headings, 8 "#" links cleared, 2 "?page=1" stripped, 0 TOPBAR/FOOTER_3 items removed
banners             0 non-home banners deleted
settings            0 shipping keys removed, 4 "#" social links cleared, whatsapp=923092050463, 3 keys added
```
Second run: all 13 steps `skipped (applied …)` + "nothing to do". `--dry-run` rolls back (tested on the raw DB).
Social links start **empty** (store's real profiles unknown) — footer icons stay hidden until filled in Settings.

## 1. Schema field names (Phase 1, additive)

`AdminUser.sessionVersion` · `Product.isNew / limitedEdition / layout / deliveryTime / discountGroup / cardImageRatio / trackStock / productOptions / inquiries`
· `Variant.status / stock` · `ProductImage.optionValueId / optionValue / width / height`
· `ProductOption {id, productId, name, position, values}` · `ProductOptionValue {id, optionId, value, position, swatchColor, swatchImage, images}`
· `Collection.indexCard` · `CollectionIndexCard {id, position, collectionId?, systemHandle?, systemTitle?, systemImage?, placeholder}`
· `MenuItem.newColumn` · `Page.kind / publishedAt / author / featuredImage / featuredImageWidth / featuredImageHeight / tags`
· `Upload`, `WhatsAppInquiry`, `MigrationStep` exactly as §2.1. Legacy columns untouched (do not read them, §2.3/§2.4).

Data copies: `prisma/easy-mode-data/*.json` (8 files). The originals in `src/` are still there for P/B to delete.

## 2. Libraries (import paths and how to call them)

| Module | Exports |
|---|---|
| `@/lib/slug` | `slugify(input, maxLength = 90)` |
| `@/lib/admin-guard` (server-only) | `requireAdmin(): Promise<AdminUser>` (redirects), `getAdminOrNull()` |
| `@/lib/variant-status` | `VARIANT_STATUSES`, `VariantStatus`, `VARIANT_STATUS_COPY`, `isVariantStatus`, `isAvailable`, `asksAvailability`, `cardStatusLabel(statuses)`, `schemaAvailability(statuses)` (full schema.org URL) |
| `@/lib/product-options` | `MAX_OPTIONS/MAX_VARIANTS/MAX_VALUE_LENGTH/MAX_OPTION_NAME_LENGTH`, `OPTION_NAME_SUGGESTIONS`, `isSwatchOptionName`, `isCardSwatchOptionName`, `variantTitle`, `normalizeHex`, `NEUTRAL_SWATCH` |
| `@/lib/product-layouts` | `PRODUCT_LAYOUTS`, `isProductLayout`, `layoutLabel` |
| `@/lib/page-kinds` | `PAGE_KINDS`, `PageKind`, `DESIGNED_PAGE_HANDLES` (27), `BLOG_HANDLE_PREFIX`, `blogHandle`, `blogSlug`, `pagePublicPath` |
| `@/lib/card-swatches` | `CardSwatchData`, `CardSwatchSource`, `buildCardSwatches(p)`, `CARD_SWATCH_SELECT` (`satisfies Prisma.ProductSelect`; spread it into a select) |
| `@/lib/dates` | `STORE_TIME_ZONE`, `startOfStoreDay`, `storeRangeStart(days)`, `formatStoreDateTime`, `timeAgo` |
| `@/lib/rich-text/sanitize` | `sanitizeRichText(html)`, `richTextToPlainText(html)`, `isRichTextEmpty(html)` — call on every save **and** before every `dangerouslySetInnerHTML` of product/collection/TEXT/BLOG bodies |
| `@/lib/links` | `LinkKind`, `LinkTarget`, `STATIC_LINK_TARGETS`, `LINK_KIND_LABEL`, `classifyHref`, `validateHref(href, {allowEmpty, allowInternal, allowExternal})` → error text or null, `normalizeHref`, `isExternalHref`, plus helpers `hrefPathname`, `externalLabel` |
| `@/lib/link-targets` (server-only) | `searchLinkTargets(q, limit?)`, `resolveLinkTargets(hrefs)` → `Record<href, LinkTarget>` (missing ones: `missing: true`, label `Missing collection “x”`) |
| `@/lib/link-references` (server-only) | `countLinkReferences(hrefs, exclude?)` → `{menuItems, banners, settings, richText}` |
| `@/app/admin/actions/links` | `searchLinkTargetsAction(q)`, `resolveLinkTargetsAction(hrefs)` (max 300) |
| `@/lib/whatsapp` | `WhatsAppConfig`, `WHATSAPP_DEFAULTS`, `GENERAL_QUESTION_TEXT`, `TRACK_ORDER_TEXT`, `normalizeWhatsAppNumber`, `waLink`, `ProductMessageInput`, `buildProductMessage` (exact §5.7.1 lines) |
| `@/lib/whatsapp-server` (server-only) | `getWhatsAppConfig()` |
| `@/lib/storage` (server-only) | `StorageBackend`, `getStorage()`, `UPLOAD_URL_PREFIX`, `isUploadKey`, `urlForKey`, `keyFromUrl` (local disk impl in `storage/local-disk.ts`, key regex in `storage/keys.ts`) |
| `@/lib/uploads` (server-only) | `UploadPurpose`, `UPLOAD_PURPOSES`, `StoredImage`, `MAX_UPLOAD_BYTES`, `UploadError`, `storeUploadedImage`, `sniffImageType`, `extractUploadUrls(html)`, `isUploadReferenced(url)`, `releaseUploads(urls)`, `sweepOrphanUploads({minAgeMs?, force?})` |
| `@/lib/queries` | Phase-1 changes done: `ProductCardData.available` + `statusLabel` (no `inventory`), `toCard` uses `variants.status` (cardSelect selects `status`), `listProducts.inStockOnly` uses status, `MenuNode.newColumn` (no `badge`), `getBanners()` (no arg), `listBlogPosts` filters `kind:'BLOG'`; deleted `getAllNavCollections`, `getFeaturedCollections`, `getCollectionByHandle`, `getRecentReviews` |

**Releasing uploads (every save that can drop an image):** collect the URLs the old row held (images, swatch images,
`extractUploadUrls(oldHtml)`), subtract the new ones, then **after** the transaction commits:
`await releaseUploads(removed)`. Anything not under `/uploads/` is ignored, so bundled `/images/…` are safe to pass.

**Upload API:** `POST /api/admin/uploads` multipart `{file, purpose}` → `{ ok:true, upload:{id,url,width,height,bytes} }` or
`{ ok:false, error }` (401/403/413/415/422/429). Client code uses `uploadImage(file, purpose, onProgress)` from
`@/components/admin/upload-client` (also exports `ACCEPT_IMAGES`, `UploadedImage`). Files are served from `/uploads/YYYY/MM/<slug>-<8hex>.webp`.
HEIC verified with a real `.heic`.

**Auth:** token is now `id.ver.exp.sig`; `setSessionCookie(admin: {id, sessionVersion})`. Everyone had to log in once more.

## 3. Admin components (all `src/components/admin/`, `'use client'` unless noted)

Exact §4.4 props. Hidden-input components dispatch a bubbling `input` only after user changes (helper
`useUserChangeEvent(value)` in `ui-client.tsx`), so `useFormDirty` works with plain `<form action>` forms.

- `ui.tsx` (server-safe): existing exports + `Notice`, `SectionCard`, `CheckboxField`, `FormError`, `ToggleSwitch` (re-exported from `ui-client.tsx`), `Tabs`; `Field.htmlFor`; `TextInput`/`TextArea` `maxLength` + `showCount`.
  - **Note:** with `showCount` the `maxLength` is a *soft* limit (counter turns amber, typing continues). Without `showCount` it is the native hard limit.
  - `ToggleSwitch` with `name` posts `'on'` when on and `''` when off.
- `icons.tsx`: every §4.3 icon plus `ArrowLeftIcon ArrowRightIcon UndoIcon RedoIcon SearchIcon CloseIcon TrashIcon ChatIcon KeyIcon ImagesIcon DocumentIcon NewspaperIcon`.
- `ImageUpload`, `ImageGallery` (also exports `newKey()`), `RichTextEditor` (+ `rich-text/Toolbar.tsx`, `LinkPopover.tsx`, `extensions.ts` with `richTextExtensions()`, `TEXT_COLORS`, `youtubeId()`), `LinkPicker` (also exports `linkTargetText`), `SortableList`, `ChipsInput`, `ColorSwatchPicker` (also exports `SWATCH_PALETTE`), `UnsavedChangesGuard` / `useFormDirty` / `FormDirtyGuard`, `ConfirmDialog`, `ConfirmDelete`, `ViewOnStoreLink`, `StickySaveBar`, `upload-client.ts`.
- New helper: `Popover.tsx` (portal, z-[60], bottom sheet < 640px) used by the pickers; reuse it for your own popovers.
- Extra `data-testid`s beyond the spec: `save-bar`, `link-picker-value`, `link-picker-popover`, `link-result`, `editor-link-popover`, `swatch-trigger`, `swatch-popover`. Test helpers: `tests/helpers/admin.ts` (`uniqueName`, `pickLink`, `uploadInto`, `saveBar`, `apiUpload`), `tests/helpers/fixtures.ts`, `tests/helpers/env.ts`.
- `.admin-rte` styles added at the end of `src/app/globals.css`.
- Shell: Sidebar nav per §4.5 (badges `inquiriesToday`, `newMessages`; Change password / View store / Logout); panel layout computes badges via `startOfStoreDay()` and shows the yellow "WhatsApp ordering is off" notice when `getWhatsAppConfig()` is null; `viewport-fit=cover` exported from the panel layout.
- `src/components/whatsapp/OrderOnWhatsApp.tsx` (stub: final markup + message, `data-testid="order-on-whatsapp"`, `data-ready`, no logging yet) and `WhatsAppGlyph.tsx` — W owns them now.

## 4. Action split

`actions/catalog.ts` → `products.ts`, `collections.ts`, `reviews.ts`; `actions/content.ts` → `banners.ts`, `menus.ts`, `pages.ts`
(mechanical; helpers now from `@/lib/slug` and `@/lib/admin-guard`). Import paths updated in the listed pages.

## 5. Deviations from the spec (and why)

1. **options-to-rows remaps variant columns** using the legacy 1-based `position`. The seed dropped single-value
   options, so `jasper-chaise-lounge` and `noble-sofa` had their only option at `position: 2` (variant `option2`) while
   `option1` held a hidden single colour. Following the spec literally would have appended "Beige"/"White" as a value of
   the orientation/size option. Instead option k reads its values from the legacy column, variants are rewritten so
   `option1` = option 0, and the stray single-value column is dropped. Products with an empty options JSON but a value in
   `option1` (`jasper-corner`, `arbour-dining-chair`) get an `Option 1` option with one value, as the spec says —
   **P: hide pickers for options that have only one value** (Shopify does), or the PDP would show "Option 1: Ivory velvet".
2. **Sanitiser unwrapping** of `span`/`div` is done with `exclusiveFilter` → `'excludeTag'`, not by renaming to `x-unwrap`
   in `transformTags`: sanitize-html leaks a discarded tag's rename onto the next closing tag (`</strong>` became `</x-unwrap>`).
   Behaviour is the spec's. Also: `<img>` without a usable `src` and `<a>` without `href` are unwrapped/dropped, and
   trailing empty paragraphs (the editor's trailing node) are trimmed.
3. Tiptap `Link` is configured with `HTMLAttributes: { target: null, rel: null }` so internal links are not saved with
   `target=_blank`; the sanitiser adds `target`/`rel` for external links only. The editor placeholder is an overlay
   (no `@tiptap/extensions` import, which is not a direct dependency).
4. `countLinkReferences(hrefs, exclude?)` takes an optional `{productId|pageId|collectionId}` to exclude the row being deleted.
5. `sweepOrphanUploads` also accepts `force: true` (skips the hourly throttle) for scripts/tests.
6. `/uploads/..%2F..%2F.env` is answered 400 by Next before the route runs; the test accepts 400 or 404 for that encoded form.
7. **`banners.ts` now calls `releaseUploads`** on save (old image/mobileImage) and delete — needed for the uploads spec's
   orphan scenario. That scenario drives today's banner form (sets `input[name=image]` / `title`, "Create banner",
   "Save banner", the `<details>` Delete). **When B rewrites the banners page, the scenario must be adapted (F2).**
8. Mobile admin header link text is "Store ↗" (was "Storefront"; "View store ↗" wrapped at 360px). The sidebar block has "View store ↗".
9. Migration's WhatsApp normaliser is a local copy (the spec forbids the migration importing `src/components/**`, which `lib/whatsapp.ts` does via `formatRs`).
10. The admin dashboard (`(panel)/page.tsx`) still reads `prisma.order` — W rewrites it; Orders pages still exist until W deletes them.

## 6. Notes for Phase-2 owners

- P: `catalog-data.ts` / `pdp-data.ts` / PDP page only got compile touches (status in selects, `available`, `isNew`,
  `limitedEdition`, `discountGroup`, `deliveryTime`); the old JSON-driven status/swatch logic is still there for you to replace.
  The product form still uses the old typed fields (incl. `inventory`) — yours to rebuild.
- B: `menu.ts` uses `!child.newColumn`; `getBanners()` has no argument; banner/menu/collection actions are in their own files.
- C: TEXT/BLOG bodies are already clean rich text; BLOG fields (`publishedAt`, `author`, `featuredImage*`, `tags`) are filled.
  The storefront blog still parses with `parseArticle` (works: no markers → whole body is content, but featured image/author
  now come from the fields — switch to them).
- W: `auth.ts` token change is done; `OrderOnWhatsApp`/`WhatsAppGlyph` stubs exist; `whatsapp`, `whatsappGreeting`,
  `whatsappAvailabilityGreeting`, `whatsappClosing`, `announcementHref/Cta/CtaHref` settings exist.
