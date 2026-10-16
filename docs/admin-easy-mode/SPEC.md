# Admin Easy Mode — Implementation Spec

Repo: `/Users/mqrtxget/projects/personal/cozystyles` · branch `interwood-fidelity` · Next.js 15.5 App Router + TS +
Tailwind 3.4 + Prisma 6 / SQLite. Paths are relative to the repo root.

**Status: Implemented** (2026-10-16, branch `interwood-fidelity`). All 30 decisions are in place; `npx tsc --noEmit`
and the full Playwright suite (`npx playwright test`, plus `E2E_EXCLUSIVE=1` for the store-wide settings scenarios)
pass; the migration is idempotent and a fresh `db push` + `db:seed` reaches the same state as the migrated dev
database. The owner's guide is in the README.

### Deviations

- **Migration inputs.** The deleted data files (`variant-images.json`, `product-templates.json`,
  `collections-index.json`, pre-order / sold-out / swatch / card-data files) live on as frozen migration and seed
  inputs in `prisma/easy-mode-data/`. Nothing in `src/` reads them; every storefront consumer reads the database.
  `live-search-order.json` stays in `src/components/catalog/` (non-goal §1.2).
- **options-to-rows** remaps legacy variant columns by 1-based position and drops stray single-value columns
  (two products); options with one value get no picker on the PDP. Details in `FOUNDATION-NOTES.md` §5.
- **Sanitiser** unwraps `span`/`div` with `exclusiveFilter` instead of an `x-unwrap` rename (sanitize-html leaked the
  rename onto the next closing tag); behaviour is as specified.
- **Store-wide settings e2e scenarios** (empty WhatsApp number, Facebook link) run only with `E2E_EXCLUSIVE=1`, so the
  default run never changes Settings that other runs depend on.
- **Seed parity check.** `prisma/schema.prisma` hard-codes `url = "file:./dev.db"`, so `DATABASE_URL` does not redirect
  the seed. Parity was checked by seeding an empty database made from a schema copy (`datasourceUrl` injected):
  identical counts of variants by status, swatches, photo tags, pages by kind, menus by location, settings keys,
  banners, options and collection cards. The only difference: products saved through the admin renumber variant
  positions from 0 (the seed numbers from 1); the order is the same.
- Smaller notes (link-reference exclusion, sweep `force`, mobile "Store ↗" label, encoded `..` answered 400 by Next)
  are listed in `FOUNDATION-NOTES.md` §5.

This spec turns the 30 agreed decisions (the user settled them; they are not up for debate) into concrete work for
**one Foundation agent (F)** followed by **four parallel agents (P, W, C, B)** and a final **integration pass (F2)**,
which is also run by the Foundation owner. Implementation agents follow it literally. When the spec and the code
disagree, the spec wins. When the spec doesn't cover something, pick the simplest option that matches the decisions
and write it down in your hand-off report.

Contents

1. Goals and non-goals
2. Data model, migration and seed
3. Storage and uploads
4. Shared libraries, admin components and packages
5. Functional spec per area
6. Storefront consumers and data files
7. Workstream plan and file ownership
8. Test plan
9. Risks, edge cases and resolutions

Appendix A: the decisions, with where each one is implemented
Appendix B: review log

---------------------------------------------------------------------------------------------------------------------

## 0. Ground rules for every agent

1. **Ownership.** Only create, edit or delete files that §7 assigns to you. If you need a change in someone else's
   file, write it in your hand-off report; don't make it yourself. The only exceptions are the listed Phase-1
   "compile touches" (§7.2) and the F2 integration fixes (§7.7).
2. **No `next build`.** It overwrites the `.next` folder the dev server uses. The dev server runs at
   `http://localhost:3100` with hot reload.
3. **Restarting the dev server.** Only F and F2 change `prisma/schema.prisma` or install packages, so only they
   restart the dev server:
   `pkill -f "next dev"; cd /Users/mqrtxget/projects/personal/cozystyles && npx prisma generate && (nohup npx next dev -p 3100 > <scratchpad>/dev.log 2>&1 &)`.
   Then wait until `http://localhost:3100/admin/login` returns 200. If you find the server down, restart it the same
   way.
4. **Git.** Run no git command that changes state (no commit, checkout, reset, stash or mv). `git diff` and
   `git status` are fine. To move a file, copy it and delete the original.
5. **Typecheck.** Run `npx tsc --noEmit` from the repo root, plus `npx tsc --noEmit -p tsconfig.scripts.json` for
   `scripts/` and `prisma/seed.ts`. F creates `tsconfig.scripts.json`. In Phase 2, fix errors in your own files only;
   errors in other agents' files are expected noise while they work in parallel.
6. **Reseeding and migrating.** Phase-2 agents never run `db:seed`, `prisma db push` or the migration. Doing so would
   wipe the other agents' test data. Only F and F2 run them.
7. **Admin copy.** Use plain English everywhere in the admin. Labels are short ("Sale price", never "Compare-at").
   Every non-obvious field gets one line of help text underneath (`Field hint`). Never show the user JSON, HTML,
   handles, ids or raw paths, except the read-only web address shown in "Advanced".
8. **Phones.** Every admin screen must work at 360px wide: no horizontal page scroll, tap targets at least 40px,
   tables become cards below 640px, and the sticky save bar stays reachable.
9. **Storefront visuals.** The storefront was just rebuilt to match interwood.pk. Don't change its look, except where
   §5.7 (WhatsApp ordering, removing the cart) and §5.6 (footer address and social links) require it. Any other
   visible change counts as a regression. The complete list of accepted storefront differences is in §9 R31.
10. **Shared test environment (Phase 2).** All four agents share one dev server and one database, and
    `workers: 1` only serialises tests inside one run. So:
    - **Lock.** Every Phase-2 agent holds the lock `<scratchpad>/e2e.lock` around every `npx playwright test` run:
      `mkdir <scratchpad>/e2e.lock` (it fails while someone else holds it; retry every 15 s), run, then
      `rmdir <scratchpad>/e2e.lock` (in a `trap`, so it is released on failure). Only one Playwright run touches the
      shared server at a time.
    - **F2-only scenarios.** A scenario that switches a store-wide feature off or rewrites store-wide settings (clearing
      the WhatsApp number, editing greetings, announcement or social links) is wrapped in
      `test.skip(!process.env.E2E_EXCLUSIVE, 'store-wide setting: runs in F2 only')`, because it would change what
      other agents see in their manual checks. F2 runs the full suite with `E2E_EXCLUSIVE=1`.
    - **Reorders** (menu order, banner order, collections index order) run in Phase 2 under the lock and restore the
      original order in a `finally` block or `afterAll`.
    - The session-token format change is done by F in Phase 1 (§5.9), so no Phase-2 change logs anyone out, and each
      agent writes its own storage-state file (§8.1).
11. **Next 15 dynamic params.** Every new dynamic route handler and page receives `params` (and `searchParams`) as a
    `Promise`: `export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) { const { path } = await params; … }`.
    Code samples in this spec that write `params.x` mean the awaited value.
12. **Server-only markers.** Only these modules may `import 'server-only'`: `src/lib/uploads.ts`,
    `src/lib/storage/*`, `src/lib/link-targets.ts`, `src/lib/link-references.ts`, `src/lib/whatsapp-server.ts` and
    `src/lib/admin-guard.ts`. Modules that `scripts/`, `prisma/seed.ts` or `tests/` import (`rich-text/sanitize.ts`,
    `slug.ts`, `product-options.ts`, `variant-status.ts`, `product-layouts.ts`, `page-kinds.ts`, `card-swatches.ts`,
    `dates.ts`) must **not** import it, because under `tsx` it throws outside the `react-server` condition. Nothing
    under `scripts/` or `tests/` may import a server-only module (F checks this with
    `grep -rnE "lib/(uploads|storage|link-targets|link-references|whatsapp-server|admin-guard)" scripts tests prisma`,
    which must return nothing).

---------------------------------------------------------------------------------------------------------------------

## 1. Goals and non-goals

### 1.1 Goals

- **G1. Non-technical admin.** A shop owner can run the whole catalogue from a phone. The admin never asks them to
  type JSON, HTML, raw paths or position numbers. Photos are uploaded, links are picked, order is set by drag and
  drop, and long text is written in a rich-text editor (decisions 3, 12, 14, 18, 20).
- **G2. Product editing done right.** Products use Shopify-style options and variants with automatic combinations,
  per-variant status, colour swatches and photo tags. Saving updates rows in place, so variant and image ids, weights
  and every other field survive a save (decisions 4–13).
- **G3. Every behaviour is in the database.** Behaviour now driven by hard-coded JSON files keyed by handle moves into
  the database through a one-time, idempotent migration: swatch colours, photo tags, pre-order and sold-out lists,
  card badges, product page layouts, collection covers and the order of the collections index. The data files are
  then deleted (decision 23).
- **G4. WhatsApp ordering.** The cart, checkout, order tracking and the Order tables go away. Every product page gets
  an "ORDER ON WHATSAPP" button that sends an exact message template, and every click is logged (decisions 24–28).
- **G5. Clean content.** Policy pages and blog posts become clean, sanitised rich text with separate blog fields.
  Pages with a custom design stay code-driven (decisions 14–17).
- **G6. Safety.** A backup is taken before every schema change. The migration is idempotent, and a fresh reseed
  reaches the same end state. Every editor warns about unsaved changes, every delete confirmation says what will be
  lost, every edit page has "View on store", there is a Change Password page, and Playwright tests cover the main
  flows (decisions 29, 30).

### 1.2 Non-goals (explicitly out of scope)

- Online payment, customer accounts, order management of any kind. WhatsApp is the only ordering channel.
- Editing the **content** of designed pages: about-us, contact, store locator, wedding builder, department landing
  pages, Berlin, city pages and the others listed in §5.3. Their components and data stay in code. Only SEO and
  publish state are editable.
- Editing the 18 product page section templates (`templates.json`). Only *which* layout a product uses is editable.
- **Which** products the home page "Hot Selling Products" carousel shows, and in what order
  (`components/home/hotSelling.ts`), stays code-driven. Its swatches, prices, sale badges, stars and status labels do
  **not**: they come from the database like every other card (§5.2.4, decision 23).
- The "Shop by Category" tile list (`CATEGORY_TILE_HANDLES`), `homeReviews.ts`, `MarqueeStrip`, `SeoTextBlock` and
  `landing-data.json` stay code-driven. The decisions don't cover them.
- The live search ranking snapshot `src/components/catalog/live-search-order.json` stays as code-owned fidelity data.
  It isn't a merchandising control and has no admin concept. `CARD_TITLES` in `catalog-data.ts` (one product) stays
  too.
- Collection product order (`Collection.metafield.productOrder`) stays as it is and isn't editable.
- Multi-admin user management. There is one admin plus Change Password.
- A cloud storage backend. Only the interface is designed so one can be swapped in later.
- `SITE` constants that shadow settings in ContactPage, FormPages and product meta. They aren't in the decisions, so
  leave them, except the ones W removes (§5.7.6). Exception: the hard-coded `wa.me` link in `FormPages.tsx` is a
  WhatsApp button, so decisions 27 and 28 apply to it (§5.7.4).

---------------------------------------------------------------------------------------------------------------------

## 2. Data model, migration and seed

### 2.0 Strategy: additive first, then clean up (read this first)

The schema changes in **two steps** so the tree keeps compiling and the four parallel agents never need a schema
change:

- **Phase 1 (F): additive only.** F adds every new model and field (§2.1). Every old column stays in place and is
  still populated. F runs the migration (§2.5), so the new fields are filled from the old data and the data files.
  Old code keeps working on the old columns. New code reads the new fields.
- **Phase 2 (P, W, C, B).** Each agent switches its consumers to the new fields and stops reading the old fields
  listed in §2.4.
- **F2: clean up.** F2 renames the old columns that the migration still has to read on databases that were never
  migrated (for example production) to `legacy*` fields via `@map`, so the database column names don't change. It
  drops the columns nothing needs and drops the `Order` and `OrderItem` tables (§2.4). It then reseeds and runs
  everything.

### 2.1 Phase-1 schema (exact). F applies this to `prisma/schema.prisma`

Keep all existing models and fields. Add the following. `// NEW` marks additions.

```prisma
model AdminUser {
  id             Int      @id @default(autoincrement())
  email          String   @unique
  passwordHash   String
  name           String
  role           String   @default("ADMIN") // ADMIN | SUPERADMIN
  sessionVersion Int      @default(0) // NEW — bumped on password change; part of the session token
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model Product {
  // … all existing fields stay (options, featured, tags, …) …
  isNew          Boolean   @default(false)     // NEW — "New arrival" (red NEW label)
  limitedEdition Boolean   @default(false)     // NEW — "Limited edition" (yellow bar on cards)
  layout         String    @default("default") // NEW — key from src/lib/product-layouts.ts
  deliveryTime   String    @default("")        // NEW — e.g. "Delivered in 20 to 30 working days"; non-empty → FREE DELIVERY tag + line on PDP
  discountGroup  Int?                          // NEW — 10|20|30|40|50: the mobile "Discount %" filter bucket
  cardImageRatio Float?                        // NEW — product card photo box height/width (live fidelity); null → 700/920
  trackStock     Boolean   @default(false)     // NEW — show the optional stock count column in admin
  productOptions ProductOption[]               // NEW
  inquiries      WhatsAppInquiry[]             // NEW
}

model Variant {
  // … existing fields stay (inventory, weightGrams, …) …
  status String @default("READY_TO_SHIP") // NEW — READY_TO_SHIP | MADE_TO_ORDER | PRE_ORDER | SOLD_OUT
  stock  Int?                             // NEW — optional stock count; null = not tracked (admin only, never drives the storefront)
}

model ProductImage {
  // … existing fields stay …
  optionValueId Int?                                                                              // NEW — "Shows: <value>"
  optionValue   ProductOptionValue? @relation(fields: [optionValueId], references: [id], onDelete: SetNull) // NEW
  width         Int?                                                                              // NEW (known for uploads)
  height        Int?                                                                              // NEW

  @@index([optionValueId]) // NEW
}

/// One product option (max 3 per product). position 0|1|2 ↔ Variant.option1|option2|option3.
model ProductOption {                                     // NEW
  id        Int                  @id @default(autoincrement())
  productId Int
  product   Product              @relation(fields: [productId], references: [id], onDelete: Cascade)
  name      String
  position  Int
  values    ProductOptionValue[]

  @@index([productId])
}

model ProductOptionValue {                                // NEW
  id          Int            @id @default(autoincrement())
  optionId    Int
  option      ProductOption  @relation(fields: [optionId], references: [id], onDelete: Cascade)
  value       String
  position    Int            @default(0)
  swatchColor String?        // "#rrggbb" (only meaningful for Color/Colour/Finish options)
  swatchImage String?        // photo swatch: /uploads/… or /images/…; wins over swatchColor
  images      ProductImage[]

  @@index([optionId])
}

model Collection {
  // … existing fields stay …
  indexCard CollectionIndexCard? // NEW
}

/// A card on the /collections index page ("Shop by Category"), in display order.
model CollectionIndexCard {                               // NEW
  id           Int         @id @default(autoincrement())
  position     Int         @default(0)
  collectionId Int?        @unique
  collection   Collection? @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  /// Cards with no Collection row: the built-in "all products" cards (frontpage | all | all-1).
  systemHandle String?     @unique
  systemTitle  String?
  systemImage  String?
  /// 1..6 Shopify line-art placeholder used when the card has no photo (live fidelity).
  placeholder  Int         @default(1)
}

model MenuItem {
  // … existing fields stay (badge, …) …
  newColumn Boolean @default(true) // NEW — MAIN level-2 headings: false = stack under the previous group (old "STACK" badge)
}

model Page {
  // … existing fields stay (isBlogPost, …) …
  kind                String    @default("TEXT") // NEW — TEXT | BLOG | DESIGNED
  publishedAt         DateTime?                  // NEW — blog date (null → createdAt)
  author              String    @default("")     // NEW — blog author
  featuredImage       String?                    // NEW — blog featured image
  featuredImageWidth  Int?                       // NEW
  featuredImageHeight Int?                       // NEW
  tags                String    @default("")     // NEW — blog tags, comma separated labels

  @@index([kind, published]) // NEW
}

/// Every uploaded file (one row per stored object).
model Upload {                                            // NEW
  id           Int      @id @default(autoincrement())
  key          String   @unique // "2026/10/grey-sofa-front-a1b2c3d4.webp"
  url          String   @unique // "/uploads/2026/10/grey-sofa-front-a1b2c3d4.webp"
  originalName String   @default("")
  mime         String   @default("image/webp")
  width        Int
  height       Int
  bytes        Int
  purpose      String   @default("") // product | swatch | banner | collection | blog | editor
  createdAt    DateTime @default(now())

  @@index([createdAt])
}

/// One row per click on a WhatsApp button (no personal data).
model WhatsAppInquiry {                                   // NEW
  id             Int      @id @default(autoincrement())
  createdAt      DateTime @default(now())
  kind           String   // ORDER | AVAILABILITY | GENERAL | TRACK
  productId      Int?
  product        Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  productTitle   String   @default("") // snapshot at click time
  variantId      Int?     // no FK: variants may be deleted later
  variantSummary String   @default("") // "Size: 3 Seater · Color: Grey"
  quantity       Int      @default(1)
  unitPrice      Int?     // PKR snapshot (null for GENERAL/TRACK, 0 = price on request)
  pagePath       String   @default("") // "/products/alexa-sofa-chair?variant=123"

  @@index([createdAt])
  @@index([productId, createdAt])
}

/// Ledger for scripts/migrate-admin-easy-mode.ts: one row per completed step.
model MigrationStep {                                     // NEW
  id        String   @id // e.g. "easy-mode:variant-status"
  appliedAt DateTime @default(now())
  summary   String   @default("")
}
```

F applies it with `npx prisma db push` (additive, so no data loss). The dev server is **stopped** first
(`pkill -f "next dev"`): adding the `ProductImage.optionValueId` foreign key makes Prisma rebuild that SQLite table,
which can fail with "database is locked" while the server is mid-query, and the running server would keep the old
client anyway. F restarts it after `prisma generate`.

### 2.2 Field semantics (canonical)

| Field | Meaning | Storefront consumer |
|---|---|---|
| `Variant.status` | `READY_TO_SHIP` = in stock. `MADE_TO_ORDER` = made after the order is confirmed. `PRE_ORDER` = coming later. `SOLD_OUT` = unavailable. Only `SOLD_OUT` is "unavailable". | PDP button and badges, card status bar, availability filter, strike-through of option values, JSON-LD |
| `Variant.stock` | Optional count, for the admin's information only | none |
| `Variant.price` / `compareAtPrice` | Unchanged storage. In admin: **Regular price** = `compareAtPrice ?? price`. **Sale price** = `price` when `compareAtPrice > price`, otherwise empty. On save: `price = sale ?? regular`, `compareAtPrice = sale != null ? regular : null` | prices everywhere |
| `Variant.option1..3` | The variant's value string for option position 0..2. Always equal to one `ProductOptionValue.value` of that option (the save path enforces this) | pickers, `?variant=` lookups |
| `ProductOptionValue.swatchColor/Image` | Swatch for Color/Colour/Finish options. Fallback is a neutral circle `#ccc` | PDP swatches, card swatches |
| `ProductImage.optionValueId` | "Shows: <value>". The gallery leads with this photo when that value is selected | PDP gallery, card swatch photo |
| `Product.layout` | Key of one of the 18 templates (§5.1.9) | `templateFor(layout)` |
| `Product.isNew` / `limitedEdition` | Replace the tags "New Arrivals" / "limited-edition" | NEW label, Limited Edition bar |
| `Product.deliveryTime` | Replaces the tag "Delivered in …" | PDP FREE DELIVERY tag and delivery line |
| `Product.discountGroup` | Replaces the tag `discount=NN` | mobile "Discount %" filter |
| `Product.cardImageRatio` | Replaces `live-card-data.json.imageRatios` | card photo aspect |
| `CollectionIndexCard` | Replaces `collections-index.json` | `/collections` |
| `MenuItem.newColumn` | Replaces badge `STACK` (`STACK` ⇒ `newColumn=false`) | mega menu columns |
| `Page.kind` | `TEXT` = rich text edited in the admin. `BLOG` = blog post with fields. `DESIGNED` = rendered by code; the admin edits SEO and publish state only | pages and blog routes |

Card status label (one function, `cardStatusLabel` in `src/lib/variant-status.ts`):

1. Any variant is `READY_TO_SHIP` → `'Ready to ship'`.
2. Otherwise, any variant is `PRE_ORDER` → `'Pre-Order'`.
3. Otherwise, any variant is `MADE_TO_ORDER` → `null`. The card shows no bar, which keeps parity with the live site
   (§9 R3).
4. Otherwise (all `SOLD_OUT`, or no variants) → `'Sold Out'`.

### 2.3 Legacy columns: who may read them

Until F2, the old columns stay populated: `Product.options`, `Product.tags` (which still contains the magic tags on
databases that were never migrated), `Variant.inventory`, `MenuItem.badge`, `Page.isBlogPost` and `Banner.location`.

**Phase-2 code must not read or write** any field listed in §2.4. Only `scripts/migrate-admin-easy-mode.ts` and
`prisma/seed.ts` touch them.

### 2.4 F2 cleanup diff (applied after the four workstreams finish)

```prisma
model Product {
  vendor          String   @default("Cozy Furnitures")          // default changed
  legacyOptions   String   @default("[]") @map("options")       // renamed (same DB column) — migration input only
  // removed: featured, orderItems
}
model Variant {
  legacyInventory Int      @default(50) @map("inventory")       // renamed — migration input only
}
model Collection {
  // removed: featured, showInNav, position, kind   (metafield stays: productOrder)
}
model MenuItem {
  legacyBadge     String?  @map("badge")                        // renamed — migration input only
}
model Banner {
  // removed: location, subtitle, ctaLabel, textColor, overlay
  // kept: id, title, href, image, mobileImage, position, active
}
model Page {
  legacyIsBlogPost Boolean @default(false) @map("isBlogPost")   // renamed — migration input only
}
// removed models: Order, OrderItem
```

F2 runbook:

1. Stop the dev server (`pkill -f "next dev"`), then back up the database (§2.5.1).
2. `npx tsx scripts/migrate-admin-easy-mode.ts --export-orders` writes `prisma/backups/orders-<ts>.json` when any
   orders exist, using raw SQL.
3. Apply the diff.
4. `npx prisma db push --accept-data-loss`, then `npx prisma generate`.
5. Update every remaining reader and writer of the removed or renamed columns:
   - `seed.ts` and the migration → the `legacy*` names.
   - `scripts/fidelity/home.ts`: drop the `location: 'HOME_HERO'` filters (lines ~35 and ~48); all banners are home
     banners.
   - `scripts/fidelity/global.ts` `createMenuTree`: write `newColumn` only (plus `legacyBadge` only if the migration
     still needs it on a fresh seed; it does not, because `newColumn` is written directly).
   - Confirm `grep -rnE "isBlogPost|\.badge\b|location: 'HOME_HERO'|showInNav|featured:|orderBy: \{ position" src scripts prisma/seed.ts`
     shows no reader of a removed Collection/Banner/MenuItem/Page column (Phase 2 already switched
     `layout/actions.ts`, the blog route and the admin collections list; see §6.2).
6. `npm run db:seed`.
7. Run the migration again and expect "nothing to do".
8. Restart the dev server.
9. Typecheck, then run all Playwright specs with `E2E_EXCLUSIVE=1`.

### 2.5 Migration: `scripts/migrate-admin-easy-mode.ts`

Exports `runAdminEasyModeMigration(prisma: PrismaClient, opts?: { backup?: boolean; dryRun?: boolean; log?: (s: string) => void }): Promise<MigrationReport>`.
It can also run standalone: `npx tsx scripts/migrate-admin-easy-mode.ts [--dry-run] [--no-backup] [--export-orders]`.
Add the npm script `"db:migrate-easy-mode": "tsx scripts/migrate-admin-easy-mode.ts"`.

#### 2.5.1 Backup

- `npm run db:backup` (new script `scripts/backup-db.ts`) copies the SQLite file named in `DATABASE_URL`
  (`file:./dev.db` resolves against `prisma/`) to `prisma/backups/dev-YYYYMMDD-HHMMSS.db` and prints the path.
- The migration calls the same function first unless `backup: false` (the seed passes false). The
  `prisma/backups/` folder is gitignored.
- F must back up **before** the Phase-1 `db push`, and F2 before the cleanup push.

#### 2.5.2 Inputs

- The database.
- `prisma/easy-mode-data/*.json`. F **copies** these files there; phase-2 owners delete the originals in `src/`:
  - `product-templates.json` (from `src/components/product/data/`)
  - `variant-images.json` (same folder)
  - `preorder-variants.json` (same folder)
  - `swatch-colors.json` (from `src/components/catalog/`)
  - `swatch-variants.json` (same folder)
  - `live-sold-out.json` (same folder)
  - `live-card-data.json` (same folder)
  - `collections-index.json` (same folder)
- The `public/` folder, for local image files and their dimensions.

The migration must not import anything from `src/components/**`. It may import these F-owned modules:
`src/lib/rich-text/sanitize.ts`, `src/lib/product-layouts.ts`, `src/lib/product-options.ts`,
`src/lib/variant-status.ts`, `src/lib/page-kinds.ts` and `src/lib/slug.ts` (none of them imports `'server-only'`;
§0.12). Its private HTML helpers live in
`scripts/lib/legacy-html.ts`: `innerOf`, `extractRteFromDocument`, `extractMainFromDocument`, `parseLegacyArticle` (a copy of today's
`parseArticle`), `tableToLists` and `youtubeIframesToTiptap`.

#### 2.5.3 Mechanics

- The whole run is **one interactive transaction**:
  `prisma.$transaction(async (tx) => …, { timeout: 300_000, maxWait: 10_000 })`.
- `--dry-run` runs everything, prints the report, then throws a sentinel error so the transaction rolls back.
- Each step has an id `easy-mode:<step>`. A step runs only if its `MigrationStep` row is absent, and writes that row
  with a one-line summary when it finishes. A second run is therefore a no-op that prints `skipped (applied <date>)`
  for every step. That is what "idempotent" means here. Steps that are naturally idempotent (upserts) are guarded the
  same way for simplicity.
- The seed wipes `MigrationStep`, so a reseed runs every step again.
- Every step logs counts, for example `variant-status: 843 variants → READY_TO_SHIP 590, PRE_ORDER 140, MADE_TO_ORDER 70, SOLD_OUT 43`.

#### 2.5.4 Steps, in order, with exact rules

**1. `options-to-rows`.**
- For every product with no `ProductOption` rows:
  - Parse `Product.options` (legacy JSON). Accept `[{name, values, position?}]` and sort by `position`, then array
    order.
  - Create options at positions 0..n-1, with values at positions 0..m-1. Trim the strings. Drop empty and duplicate
    values (duplicates compared case-insensitively).
  - Then add any `Variant.option{i+1}` value that isn't in the option's values. Append it and log a warning.
- If the JSON is empty but some variant has a non-null `option1..3`, create an option named `Option 1`, `Option 2`,
  `Option 3` (by position) from the distinct values in variant order.
- `'Default Title'` is never a value.

**2. `variant-status`.**
- Load `live-sold-out.json` (a set of handles), `preorder-variants.json` (handle → SKUs) and
  `live-card-data.json.statuses` (handle → label or null).
- For each variant of product `p`, the first matching rule wins:
  1. `inventory <= 0` **or** `p.handle ∈ soldOut` → `SOLD_OUT`
  2. `sku ∈ preorder[p.handle]` → `PRE_ORDER`
  3. `statuses[p.handle] === null` (the key is present with value null) → `MADE_TO_ORDER`
  4. `statuses[p.handle] === 'Coming Soon'` → `PRE_ORDER`
  5. Otherwise → `READY_TO_SHIP`
- Set `stock = null` for every variant.
- Verified against the current database: these rules reproduce today's card label for 684/695 products and today's
  PDP button for every variant (see §9 R2).

**3. `product-flags`.**
- Split `Product.tags` on commas and trim each tag.
  - Exactly `New Arrivals` → `isNew = true`.
  - Exactly `limited-edition` → `limitedEdition = true`.
  - The first tag matching `/^delivered in /i` → `deliveryTime = tag` (keep the original casing).
  - A tag matching `/^discount=(\d+)$/` whose number is in `[10,20,30,40,50]` → `discountGroup`.
- Remove every tag you consumed (all matching ones). Rewrite `tags` joined with `','`.
- Expected counts: about 85 new, 37 limited, 624 delivery, 532 discount.

**4. `product-layouts`.**
- For each entry `handle → suffix` in `product-templates.json` where the suffix is a known layout key, set
  `Product.layout = suffix`.
- Products not listed keep `default`. Log unknown handles and unknown keys.

**5. `swatches`.**
- For each option where `isSwatchOptionName(option.name)`, set each value's `swatchColor` to `toHex(name)`, where
  `toHex` returns `swatch-colors.json[value]` (exact key).
- If that's missing and the value matches `/^[a-z]+$/i`, use the CSS keyword table in `scripts/lib/css-colors.ts`
  (≈40 entries; at least blue, black, grey/gray, beige, maroon, brown, navy, white, red, green, yellow, orange, pink,
  purple, silver, gold, cream, ivory, tan, teal, olive, charcoal).
- Otherwise leave it null.
- The stored value is always lowercase `#rrggbb`. Convert 3-digit hex and named colours to 6-digit hex.

**6. `photo-tags`.** Images are ordered by `(position, id)`, and `galleryIndex` means the index into that list.
- From `variant-images.json` (handle → `{ sku: galleryIndex }`): find the variant by SKU and pick the tag option.
  That is the first option where `isSwatchOptionName(name)`; failing that, the option whose value differs between the
  mapped SKUs; failing that, option 0. Tag `images[galleryIndex]` with the variant's value for that option. Skip
  images that are already tagged and log any conflict.
- Then, from `swatch-variants.json` (handle → `{ images: { colourValue: imagePosition } }`): tag the image whose
  `position === imagePosition` with the colour value of the card-swatch option (`isCardSwatchOptionName`), if it
  isn't tagged yet.

**7. `card-data`.** `live-card-data.json.imageRatios[handle]` → `Product.cardImageRatio = value / 100`. Ratings are
**not** migrated. Card stars now show when `reviewCount > 0`, and the seed's product fidelity step imports the live
reviews (see §2.6 and §9 R4).

**8. `collection-index`.**
- For each entry `i` of `collections-index.json`, in order:
  - If the handle exists in `Collection`, upsert a `CollectionIndexCard` keyed by `collectionId` with
    `{ position: i, placeholder: entry.placeholder ?? 1 }`.
  - If the handle is `frontpage`, `all` or `all-1`, upsert a card keyed by `systemHandle` with
    `{ systemTitle: entry.title, position: i, placeholder: entry.placeholder ?? 1 }`. Set `systemImage` to
    `/images/collections/<handle>.<ext>` when that file exists in `public/` **and** `entry.image` is set; otherwise
    null.
  - Log and skip any other handle.
- **Covers:** for each collection where `image IS NULL`, the index entry has an `image` and a local
  `public/images/collections/<handle>.<ext>` exists → set `Collection.image` to that path. This is the same rule as
  `catalog.ts --offline`.

**9. `pages`.**
- Set `kind` for every page:
  - Handle starts with `news-`, or `isBlogPost` is true → `BLOG`.
  - Handle is in `DESIGNED_PAGE_HANDLES` (§5.3.1) → `DESIGNED`.
  - Otherwise → `TEXT`.
- **TEXT conversion:**
  - If the body matches `/<!doctype|<html[\s>]/i`, replace it with `extractRteFromDocument(body)`: the inner HTML of
    the first `<div class="page-content-width rte"`. If that div is missing, use the inner `<main>`, or else leave the
    body unchanged and log it.
  - Then apply `tableToLists`, then `sanitizeRichText`, then `wrapLooseInline` and `tidyInlineMarks` (below).
  - **`tableToLists` rule:**
    - If the first row is a header (all `th`, or every cell's text is wrapped in `b`/`strong`), each column `j`
      becomes `<p><strong>{header j}</strong></p><ul>{<li>cell(i,j)</li> for each later row, empty cells skipped}</ul>`.
    - Otherwise each row becomes `<p>{cells joined with " — "}</p>`.
    - Cell content keeps inline formatting only.
- **BLOG conversion:**
  - Run `parseLegacyArticle(bodyHtml)` (the same logic as today's `parseArticle`). It reads both the raw Shopify
    article chrome and the normalised marker format.
  - `publishedAt` = the parsed date (if missing, `createdAt`). `author` = the parsed author or `''`. `tags` = the
    parsed tag labels joined with `,`.
  - `featuredImage` = the parsed image src, only if it starts with `/` or `https://`. If it's a local file under
    `public/`, read its width and height with `sharp(file).metadata()`; otherwise use the parsed attributes or
    1920×800.
  - `bodyHtml` = the parsed content, then `youtubeIframesToTiptap`, then `tableToLists`, then `sanitizeRichText`. If
    the content's first element is an `<img>` with the same src as the featured image, remove it. Then
    `wrapLooseInline` and `tidyInlineMarks`.
  - `kind = 'BLOG'`. Title and SEO fields are unchanged.
- **DESIGNED:** the body is untouched (it's legacy section markup rendered as-is; §5.3), **except** a body that is a
  whole Shopify document (matches `/<!doctype|<html[\s>]/i`; today only `review`). That body is replaced with
  `extractMainFromDocument(body)` (new helper in `scripts/lib/legacy-html.ts`): the inner HTML of `<main>` (the
  page's `custom_liquid` section), with any header, announcement bar, footer, `<title>`, `<head>` and `<script>`
  removed. If there is no `<main>`, log it and leave the body unchanged. This removes the second header, footer and
  `<title>` that `/pages/review` renders today; no sanitising is applied (the section markup must keep its classes).
- **Store what the editor saves** (`scripts/lib/legacy-html.ts`): the sanitiser drops the legacy
  `<div class="sub-title">` wrappers, which leaves text and bold runs between blocks. `wrapLooseInline` puts each
  such source line in its own `<p>` (a line holding only `<br>` becomes `<p><br /></p>`); `tidyInlineMarks` drops
  empty bold/italic/underline runs and joins touching runs of the same mark. Without this the first editor save
  (even typing a letter and deleting it) merges the lines into one paragraph and the page's look changes.
  **Step 9b `page-blocks`** applies both to every TEXT/BLOG body, for databases where step 9 ran before they existed
  (a no-op after a fresh seed).

**10. `sanitize-rich-text`.** Set `Product.bodyHtml = sanitizeRichText(bodyHtml)` and
`Collection.description = sanitizeRichText(description)`. Plain-text descriptions become `<p>…</p>`. Headings keep
their level (the sanitiser allows `h1`–`h6`; §4.2), so the 34 `<h1>` and the `<h5>` in collection descriptions render
at the same size as today.

**11. `menus`.**
- `MenuItem` with `badge = 'STACK'` → `newColumn = false`. Every other item keeps the default `true`.
- `href = '#'` → `''` (FOOTER_SEO group titles and placeholder links; see §9 R27).
- A bare `?page=1` query is stripped (`/collections/kitchens?page=1` → `/collections/kitchens`); it is the default
  page, so the target is unchanged. Any other query string is kept.
- Delete items whose `location` is `TOPBAR` or `FOOTER_3`, including their children.

**12. `banners`.** Delete banners whose `location != 'HOME_HERO'` (expected 0) and log them.

**13. `settings`.**
- Delete the keys `shippingFee` and `freeShippingThreshold`.
- Change `facebook`, `instagram`, `youtube` and `linkedin` from `'#'` to `''`. No real profile URLs are seeded: the
  store's own (Cozy Furnitures) profiles aren't known, and the scraped interwood.pk profiles belong to another
  business. The social icons therefore start hidden until the owner fills them in Settings (§5.6), and the hand-off
  report says so.
- `whatsapp`: if `normalizeWhatsAppNumber(current)` is null, set it to `'923092050463'`; otherwise store the
  normalised digits.
- Upsert these if missing:
  - `whatsappGreeting` = `Hello Cozy Furnitures! I'd like to order this product:`
  - `whatsappAvailabilityGreeting` = `Hello Cozy Furnitures! I'd like to ask about the availability of this product:`
  - `whatsappClosing` = `Please confirm availability and delivery to my city: ` (with the trailing space)
- Upsert `announcementHref`, `announcementCta` and `announcementCtaHref` as `''` if they're missing.

The report object is `{ steps: { id, status: 'applied' | 'skipped', summary }[] }`. Print it as a table.

### 2.6 Seed (`prisma/seed.ts`): a fresh reseed reaches the same end state

Phase 1 (F):

1. Wipe, adding the new tables first: `whatsAppInquiry`, `migrationStep`, `collectionIndexCard`,
   `productOptionValue`, `productOption`. Keep `orderItem` and `order` in Phase 1; F2 removes them.
   - The `upload` table is **not** wiped, and the wipe deletes **no files** in `storage/uploads`. After a reseed the
     old uploads are unreferenced, so the orphan sweep (§3.6) deletes each file and its row once it is older than
     24 hours. The sweep also reconciles the disk against the table (`StorageBackend.list`), so a file whose row is
     missing for any reason is still cleaned up.
2. Seed everything as today. The legacy columns are still written: `options` JSON, `inventory`, `badge`.
   - Exception: `createMenuTree` in `scripts/fidelity/global.ts` now also writes `newColumn: it.badge !== 'STACK'`.
3. Then call, in this order, all with `prisma` passed in:
   - `applyGlobalFidelity` (already exported)
   - `applyHomeFidelity`
   - `applyCatalogFidelity({ offline: true })`
   - `applyProductFidelity({ offline: true })`
   - `applyContentFidelity`
   - `runAdminEasyModeMigration(prisma, { backup: false })`
4. Settings: seed `whatsapp: '923092050463'` directly. Drop `shippingFee` and `freeShippingThreshold` from the seed
   map. The migration's settings step is then a no-op for those keys.

F2: replace the legacy property names with the `legacy*` ones, stop writing `featured` on collections and products,
the removed Collection fields, `badge` and the removed banner fields, and remove the order wipes.

**The dev database runbook (F, Phase 1).** The current `prisma/dev.db` is a raw seed with no fidelity applied and
no admin edits. Row counts match the committed HEAD copy and `updatedAt` equals the seed time. So F:

1. Stops the dev server, then backs the database up.
2. Runs `db push` with the additive schema.
3. Runs `npm run db:seed`. This reaches exactly the state a fresh reseed produces, including fidelity and the
   migration.
4. Runs the migration once more standalone and confirms every step reports "skipped".

The standalone migration path, without a reseed, exists for databases that were never reseeded, such as production
servers.

### 2.7 Fidelity script refactor (F)

| Script | Change |
|---|---|
| `global.ts` | `createMenuTree` writes `newColumn`. No other change. |
| `home.ts` | Wrap `main` as `export async function applyHomeFidelity(prisma)`. Keep the standalone run guard (`require.main === module`). |
| `catalog.ts` | Export `applyCatalogFidelity(prisma, { offline, refreshSearch })`. Delete `writeSwatchVariants` and `writeSoldOut`; their data is now in the database. `INDEX` reads `prisma/easy-mode-data/collections-index.json`. `--refresh-search` still writes `src/components/catalog/live-search-order.json`. |
| `product.ts` | Export `applyProductFidelity(prisma, { offline })`. `LIVE_CARD_DATA` → `prisma/easy-mode-data/live-card-data.json`. Keep the standalone guard. |
| `content.ts` | Keep `export applyContentFidelity`. **Remove the standalone run.** Re-running it after the migration would overwrite clean blog bodies. Running the file directly now prints `Run npm run db:seed (content fidelity is part of the seed now).` and exits 1. |
| `cart.ts` | W deletes it; its policy pages were only linked from checkout. |
| `landing.ts`, `berlin.ts` | Unchanged. |

F2 updates `README.md` §"Fidelity scripts": the fidelity steps are now part of `npm run db:seed`, and nothing has to
be re-run after a seed.

---------------------------------------------------------------------------------------------------------------------

## 3. Storage and uploads

### 3.1 Layout

- Files are stored under `storage/uploads/<YYYY>/<MM>/<slug>-<8 hex>.webp`. The repo root `storage/` is gitignored.
  The optional env `UPLOADS_DIR` overrides the root (absolute path).
- `<slug>` = `slugify(originalBaseName).slice(0, 40)`, falling back to `photo`. `<8 hex>` = `crypto.randomBytes(4)`.
- Public URL: `/uploads/<YYYY>/<MM>/<file>`.
- Key regex, the only shape the route accepts: `^\d{4}/\d{2}/[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}\.webp$`.
- Bundled images under `public/images/**` are never moved, rewritten or deleted.

### 3.2 Storage module: `src/lib/storage/index.ts` (server-only)

```ts
export interface StorageBackend {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** null when missing */
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; size: number; contentType: string; mtime: Date } | null>;
  delete(key: string): Promise<void>;          // missing = no-op
  exists(key: string): Promise<boolean>;
  /** Every stored key under `prefix` ('' = all), with its last-modified time. Used only by the orphan sweep. */
  list(prefix?: string): AsyncIterable<{ key: string; mtime: Date }>;
}
export function getStorage(): StorageBackend;    // local disk today: src/lib/storage/local-disk.ts
export const UPLOAD_URL_PREFIX = '/uploads/';
export function isUploadKey(key: string): boolean;          // the key regex above
export function urlForKey(key: string): string;              // '/uploads/' + key
export function keyFromUrl(url: string): string | null;      // strips prefix, validates; null for anything else
```

`local-disk.ts`:

- `root = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'storage/uploads')`.
- Every method validates the key with `isUploadKey`, resolves `path.resolve(root, key)` and asserts the result starts
  with `root + path.sep`. This defeats path traversal.
- `put` writes to `<file>.tmp` and then renames. It creates folders with `mkdir -p`.
- `list` walks `root` recursively and yields only names that pass `isUploadKey` (so `.tmp` files and anything else
  are ignored).

### 3.3 Image pipeline: `src/lib/uploads.ts` (server-only, `import 'server-only'`)

```ts
export type UploadPurpose = 'product' | 'swatch' | 'banner' | 'collection' | 'blog' | 'editor';
export type StoredImage = { id: number; url: string; width: number; height: number; bytes: number };
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export class UploadError extends Error { constructor(public status: 400|413|415|422|429, message: string) }
export async function storeUploadedImage(file: File, purpose: UploadPurpose): Promise<StoredImage>;
export function sniffImageType(head: Uint8Array): 'jpeg' | 'png' | 'webp' | 'heic' | null;
export function extractUploadUrls(html: string): string[];        // every "/uploads/…" in src/href attributes
export async function isUploadReferenced(url: string): Promise<boolean>;
export async function releaseUploads(urls: Iterable<string>): Promise<number>; // deletes unreferenced ones; returns count
export async function sweepOrphanUploads(opts?: { minAgeMs?: number }): Promise<number>; // default 24h
```

`storeUploadedImage`:

1. If `file.size > MAX_UPLOAD_BYTES`, throw 413 with: "This photo is bigger than 20 MB. Please choose a smaller one."
2. Read the bytes and run `sniffImageType` on the first 32 bytes.
   - JPEG: `FF D8 FF`.
   - PNG: `89 50 4E 47 0D 0A 1A 0A`.
   - WebP: `RIFF????WEBP`.
   - HEIC: bytes 4..8 are `ftyp`, and the brand at 8..12 is one of
     `heic heix hevc hevx heim heis mif1 msf1`.
   - Anything else: throw 415 with "Only JPG, PNG, WebP or iPhone (HEIC) photos can be uploaded." The `File.type` the
     client sends is ignored.
3. HEIC: decode with `heic-decode` (libheif in WASM; §4.1) to raw RGBA: `const { width, height, data } = await decode({ buffer })`, then feed sharp
   `sharp(Buffer.from(data), { raw: { width, height, channels: 4 }, limitInputPixels: MAX_INPUT_PIXELS })`. This
   skips a JPEG encode/decode round trip. The prebuilt sharp can't decode HEVC, so the WASM decoder is required.
   HEIC decodes are serialised through a module-level queue (one at a time per process) because each one can use
   hundreds of MB of memory. A decode error throws 422.
4. Run sharp (`MAX_INPUT_PIXELS = 270_000_000`, enough for 200 MP phone photos; the 20 MB byte cap and
   `failOn` still guard against decompression bombs):

   ```ts
   sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
     .rotate()
     .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
     .webp({ quality: 82, effort: 4 })
     .toBuffer({ resolveWithObject: true })
   ```

   - `.rotate()` applies EXIF orientation. Sharp drops all metadata (EXIF and GPS) because `.withMetadata()` is never
     called.
   - `maxSide` = 400 for `swatch`, 2000 for everything else.
   - An error whose message contains "pixel limit" throws 422: "This photo is too large in pixels. Please resize it
     below 200 megapixels and try again."
   - Any other decode failure throws 422: "This photo could not be read. Try exporting it as JPG."
5. Insert the `Upload` row first, then `getStorage().put(key, data, 'image/webp')`. If `put` fails, delete the row and
   rethrow. Return `StoredImage`. (A crash between the two leaves at most a row with no file, which the sweep removes,
   or, for older code paths, a file with no row, which the disk reconciliation removes.)

`isUploadReferenced(url)` returns true if any of these exist:

- `ProductImage.src = url`
- `ProductOptionValue.swatchImage = url`
- `Collection.image = url`, or `Collection.description` contains `url`
- `CollectionIndexCard.systemImage = url`
- `Banner.image = url`, or `Banner.mobileImage = url`
- `Page.featuredImage = url`, or `Page.bodyHtml` contains `url`
- `Product.bodyHtml` contains `url`
- `SiteSetting.value` contains `url`

Any new column that stores an image must be added here. This list is part of the spec.

`releaseUploads(urls)` ignores anything that doesn't start with `/uploads/`, so bundled `/images/` are never touched.
For each remaining URL that is unreferenced, it calls `storage.delete`, then deletes the `Upload` row.

`sweepOrphanUploads({ minAgeMs = 24h })` does two passes:

1. **Rows:** every `Upload` row with `createdAt` older than `minAgeMs` that `isUploadReferenced` says is unused →
   `storage.delete(key)` and delete the row. A row whose file is missing is deleted too.
2. **Disk:** `for await (const { key, mtime } of storage.list())`: a key with no `Upload` row, an `mtime` older than
   `minAgeMs`, and no reference → `storage.delete(key)`. This catches files left by a crash, by a seed wipe on an
   older database, or by a test run.

It is throttled to once an hour per process by a module-level timestamp, and logs the counts.

### 3.4 Upload endpoint: `src/app/api/admin/uploads/route.ts`

The endpoint lives under `/api/...` on purpose. `src/middleware.ts` matches `/admin/:path*`, and Next buffers
middleware request bodies at about 10 MB. Server actions are also capped at 10 MB by `next.config.mjs`.

- `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';`
- `POST`, `multipart/form-data`, fields `file` (required) and `purpose` (an `UploadPurpose`; default `product`).
- **Order of checks:**
  1. `getCurrentAdmin()` → 401 `{ ok:false, error:'Your session has ended. Please log in again.' }`.
  2. CSRF: the `Origin` header must be present, and `new URL(origin).host` must equal the request's public host:
     the first value of `X-Forwarded-Host` when present, else the `Host` header. Do **not** compare with
     `request.nextUrl.origin`, which is `localhost:<port>` behind a reverse proxy. A request with
     `Sec-Fetch-Site: same-origin` and no `Origin` is also accepted. Anything else → 403
     `{ ok:false, error:'This upload was blocked for security reasons. Please reload the page and try again.' }`.
  3. `Content-Length > MAX_UPLOAD_BYTES + 64 KB` → 413 before parsing.
  4. Rate limit `rateLimit('upload:'+admin.id, 120, 10 min)` → 429.
  5. `storeUploadedImage`.
- **Response 200:** `{ ok: true, upload: { id, url, width, height, bytes } }`. **Errors:** `{ ok: false, error }`
  with the status from `UploadError`.
- After a successful upload, at most once per hour per process (a module-level timestamp), run
  `sweepOrphanUploads()` fire-and-forget.

### 3.5 Serving: `src/app/uploads/[...path]/route.ts`

- `export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> })`.
  `const { path } = await params; const key = path.join('/')`. If `!isUploadKey(key)`, return 404. If
  `storage.get(key)` returns null, return 404.
- Headers:
  - `Content-Type: image/webp`
  - `Content-Length`
  - `Cache-Control: public, max-age=31536000, immutable` (names are unique, so caching forever is safe)
  - `X-Content-Type-Options: nosniff`
  - `Content-Disposition: inline`
- `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.
- No auth: these are public storefront images.

### 3.6 Reference tracking and orphan rules

Every save action that can drop an image computes the URLs it removed and calls `releaseUploads(removed)` **after**
its transaction commits:

- **Products:** old image `src`s, swatch images and the URLs in the old `bodyHtml`, minus the new ones.
- **Banners:** old `image` and `mobileImage`.
- **Collections:** cover, plus the URLs in the description.
- **Pages and blog:** `featuredImage`, plus the URLs in the body.
- **Index cards:** `systemImage`.
- **Deletes:** every URL the deleted rows held, including cascaded variants, images and option values.

Uploads that were never saved (a photo uploaded and then the form abandoned) are removed by
`sweepOrphanUploads({ minAgeMs: 24h })`. It runs after uploads and from the dashboard page load, at most once an hour.

Because a duplicated product shares its image URLs with the original, both reference the same file. The reference
check, not a refcount, keeps the file until neither product uses it.

### 3.7 Client helper: `src/components/admin/upload-client.ts` (`'use client'`)

```ts
export type UploadedImage = { id: number; url: string; width: number; height: number };
export const ACCEPT_IMAGES = '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif';
export function uploadImage(file: File, purpose: UploadPurpose, onProgress?: (pct: number) => void): Promise<UploadedImage>;
```

- Uses XHR so it can report progress. Rejects with the server's `error` message.
- Pre-checks `file.size` on the client and shows the same 20 MB message.

---------------------------------------------------------------------------------------------------------------------

## 4. Shared libraries, admin components and packages

### 4.1 Packages F installs (exact versions, no caret)

| Package | Version | Why |
|---|---|---|
| `sharp` | 0.35.5 | image pipeline. Same version Next already pulls in, so it dedupes |
| `heic-decode` | 2.1.0 | HEIC → raw RGBA for sharp (needs `src/types/heic-decode.d.ts`: `declare module 'heic-decode' { … }`). Used instead of `heic-convert`, which would add a JPEG round trip |
| `server-only` | 0.0.1 | so `import 'server-only'` resolves for tooling too, not only through Next's internal alias (§0.12) |
| `sanitize-html` | 2.17.7 | server-side sanitiser |
| `@tiptap/core`, `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-text-align`, `@tiptap/extension-text-style`, `@tiptap/extension-image`, `@tiptap/extension-youtube` | **all 3.31.4** | rich text editor (v3 StarterKit already includes Underline and Link) |
| `@dnd-kit/core` | 6.3.1 | drag and drop |
| `@dnd-kit/sortable` | 10.0.0 | sortable lists |
| `@dnd-kit/utilities` | 3.2.2 | CSS transform helper |
| dev: `@playwright/test` | 1.63.0 | e2e, run with the installed Chrome (`channel: 'chrome'`) |
| dev: `@types/sanitize-html` | 2.16.1 | types |

Every pinned version is at least two weeks old. All `@tiptap/*` packages must be the **same** version.

`next.config.mjs` (F): add `serverExternalPackages: ['sharp', 'heic-decode']` and:

```js
async redirects() {
  return [
    { source: '/cart', destination: '/', permanent: false },
    { source: '/checkout', destination: '/', permanent: false },
    { source: '/checkout/:path*', destination: '/', permanent: false },
  ];
}
```

`/track` can't be a config redirect because it needs the WhatsApp number from the database (§5.7.5).

### 4.2 Pure and server libs (F creates, final unless stated)

**`src/lib/slug.ts`**

```ts
export function slugify(input: string, maxLength = 90): string; // NFKD, strip accents, & → "and", [^a-z0-9]+ → "-", trim dashes
```

**`src/lib/admin-guard.ts`** (server-only)

```ts
export async function requireAdmin(): Promise<AdminUser>;        // redirect('/admin/login') when absent (for server actions/pages)
export async function getAdminOrNull(): Promise<AdminUser | null>; // for route handlers
```

**`src/lib/variant-status.ts`** (client-safe)

```ts
export const VARIANT_STATUSES = ['READY_TO_SHIP', 'MADE_TO_ORDER', 'PRE_ORDER', 'SOLD_OUT'] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];
export const VARIANT_STATUS_COPY: Record<VariantStatus, { label: string; help: string }> = {
  READY_TO_SHIP: { label: 'Ready to ship', help: 'In stock — we can deliver soon.' },
  MADE_TO_ORDER: { label: 'Made to order', help: 'We make it after the order is confirmed.' },
  PRE_ORDER:     { label: 'Pre-order',     help: 'Not in stock yet — customers can reserve it.' },
  SOLD_OUT:      { label: 'Sold out',      help: 'Not available. Customers can still ask on WhatsApp.' },
};
export function isVariantStatus(v: unknown): v is VariantStatus;
export function isAvailable(status: string): boolean;          // status !== 'SOLD_OUT'
export function asksAvailability(status: string): boolean;     // PRE_ORDER | SOLD_OUT → "ASK ABOUT AVAILABILITY"
export function cardStatusLabel(statuses: readonly string[]): string | null; // §2.2 rule
export function schemaAvailability(statuses: readonly string[]): string;     // InStock | MadeToOrder | PreOrder | SoldOut (schema.org URL)
```

**`src/lib/product-options.ts`** (client-safe)

```ts
export const MAX_OPTIONS = 3, MAX_VARIANTS = 100, MAX_VALUE_LENGTH = 60, MAX_OPTION_NAME_LENGTH = 40;
export const OPTION_NAME_SUGGESTIONS = ['Size', 'Color', 'Finish', 'Material', 'Orientation', 'Seats'];
export function isSwatchOptionName(name: string): boolean;     // /colou?r|finish/i   (admin + PDP)
export function isCardSwatchOptionName(name: string): boolean; // /^(colou?rs?|finish(es)?)$/i (cards; live parity)
export function variantTitle(values: string[]): string;        // values.join(' / ') || 'Default Title'
export function normalizeHex(input: string): string | null;    // "#ABC"/"abc"/"#aabbcc" → "#aabbcc"
export const NEUTRAL_SWATCH = '#cccccc';
```

**`src/lib/product-layouts.ts`** (client-safe). There are 18 entries. `key` must equal the template suffix in
`src/components/product/data/templates.json`.

```ts
export const PRODUCT_LAYOUTS: { key: string; label: string; help: string }[] = [
  { key: 'default',                  label: 'General furniture (standard)', help: 'Big banner, three photo-and-text blocks, testimonials, “You may also like”, reviews.' },
  { key: 'living-products',          label: 'Living room',                  help: 'Living room story blocks, testimonials, recommendations, reviews.' },
  { key: 'sofas',                    label: 'Sofas',                        help: 'Sofa story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'bedroom-products',         label: 'Bedroom',                      help: 'Bedroom story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'bed-sets',                 label: 'Bed sets',                     help: 'Bed set story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'dining-products',          label: 'Dining',                       help: 'Dining story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'study-products',           label: 'Study',                        help: 'Study story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'kids-products',            label: 'Kids',                         help: 'Kids room story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'office-products',          label: 'Office furniture',             help: 'Workspace story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'wardrobes-products',       label: 'Wardrobes',                    help: 'Wardrobe story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'kitchens-products',        label: 'Kitchens',                     help: 'Kitchen story blocks with icons, testimonials, recommendations (no reviews).' },
  { key: 'door-products',            label: 'Doors',                        help: 'Door story blocks with icons, testimonials, recommendations (no reviews).' },
  { key: 'decor-products',           label: 'Decor accessories',            help: 'Decor story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'decor-cushions',           label: 'Cushions',                     help: 'Starts with two cushion carousels, then the decor story blocks.' },
  { key: 'coalesce-living',          label: 'Coalesce — living',            help: 'Coalesce range: recommendations first, slideshow, story blocks, reviews.' },
  { key: 'coalesce-dining',          label: 'Coalesce — dining',            help: 'Coalesce range: recommendations first, slideshow, story blocks, reviews.' },
  { key: 'coalesce-bedroom',         label: 'Coalesce — bedroom',           help: 'Coalesce range: recommendations first, slideshow, story blocks, reviews.' },
  { key: 'blank-template-no-section',label: 'Simple (only “You may also like”)', help: 'No extra sections below the product.' },
];
export function isProductLayout(key: string): boolean;
export function layoutLabel(key: string): string;
```

**`src/lib/page-kinds.ts`** (client-safe)

```ts
export const PAGE_KINDS = ['TEXT', 'BLOG', 'DESIGNED'] as const; export type PageKind = (typeof PAGE_KINDS)[number];
export const DESIGNED_PAGE_HANDLES: readonly string[]; // §5.3.1 (27 handles)
export const BLOG_HANDLE_PREFIX = 'news-';
export function blogHandle(slug: string): string;      // 'news-' + slug
export function blogSlug(handle: string): string;      // strip prefix
export function pagePublicPath(p: { kind: string; handle: string }): string; // /blogs/news/<slug> | /pages/<handle>
```

**`src/lib/card-swatches.ts`** (client-safe, pure). The one card-swatch builder, used by P's `catalog-data.ts` and
B's hot-selling carousel (§5.2.4):

```ts
export type CardSwatchData = { name: string; color: string; swatchImage: string | null; image: string | null; active: boolean };
export type CardSwatchSource = {
  productOptions: { name: string; values: { id: number; value: string; swatchColor: string | null; swatchImage: string | null }[] }[]; // values in position order
  images: { src: string; optionValueId: number | null }[];                                                                              // in position order
};
export function buildCardSwatches(p: CardSwatchSource): CardSwatchData[];
//   option = first isCardSwatchOptionName option (none → []); per value:
//   { name: value, color: swatchColor ?? NEUTRAL_SWATCH, swatchImage, image: first image tagged with the value ?? null,
//     active: images[0]?.optionValueId === value.id }
export const CARD_SWATCH_SELECT: Prisma.ProductSelect; // the productOptions + images select that feeds it
```

`CardSwatchData` is structurally compatible with `CardSwatch` in `ProductCard.tsx`.

**`src/lib/dates.ts`** (client-safe). Every "today / last N days" boundary in the admin is computed in the shop's
time zone through this helper (Sidebar badge, dashboard, inquiries page):

```ts
export const STORE_TIME_ZONE = 'Asia/Karachi';
export function startOfStoreDay(now?: Date): Date;                 // 00:00 PKT today, as a UTC Date
export function storeRangeStart(days: number, now?: Date): Date;   // startOfStoreDay(now) minus (days - 1) days
export function formatStoreDateTime(d: Date): string;              // "15 Oct 2026, 3:42 pm" in PKT
export function timeAgo(d: Date, now?: Date): string;              // "2 h ago", "3 days ago"
```

**`src/lib/rich-text/sanitize.ts`** (`sanitize-html`; Node-only in practice, but it must **not** `import 'server-only'`,
because the migration and the seed import it; §0.12)

```ts
export function sanitizeRichText(html: string): string;
export function richTextToPlainText(html: string): string;   // for meta descriptions / excerpts
export function isRichTextEmpty(html: string): boolean;      // only whitespace / empty <p>
```

The config is exact and shared by the admin save paths, the migration and storefront rendering:

- **`allowedTags`:** `p br strong em u s h1 h2 h3 h4 h5 h6 ul ol li a img span div iframe sup sub`. All heading levels
  are allowed so existing content keeps its look (34 `<h1>` and an `<h5>` in collection descriptions, `<h4>` in blog
  posts and policy pages). The sanitiser decides what is **safe**; the editor toolbar decides what the admin can
  **create** (two heading sizes, decision 14).
- **`transformTags`:**
  - `b → strong` and `i → em`.
  - `span` → kept only if its `style` has an allowed `color`; otherwise renamed to `x-unwrap`, which is not allowed
    and so is discarded with its content kept.
  - `div` → kept only if it has a `data-youtube-video` attribute; otherwise `x-unwrap`. (`transformTags` can't see
    children, so the "contains an iframe" check is done by `exclusiveFilter`: a kept `div` whose `frame.mediaChildren`
    is empty, i.e. its iframe was removed, is dropped.)
  - `a` → if the href is external (`^https?://` and not the site's own host), add `target="_blank"` and
    `rel="noopener noreferrer"`; otherwise remove `target`.
  - `img` → add `loading="lazy"`.
- **`allowedAttributes`:**
  - `a: [href, target, rel]`
  - `img: [src, alt, width, height, loading]`
  - `span: [style]`
  - `p`, `h1`–`h6`: `[style]`
  - `div: ['data-youtube-video']`
  - `iframe: [src, width, height, allowfullscreen]`
- **`allowedStyles`:**
  - `span: { color: [/^#[0-9a-f]{3,6}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i] }`
  - `p`, `h1`–`h6`: `{ 'text-align': [/^(left|center|right|justify)$/] }`
- **Schemes:**
  - `allowedSchemes: ['http','https','mailto','tel']`
  - `allowedSchemesByTag: { img: ['http','https'] }`
  - `allowProtocolRelative: false`
  - Relative URLs (`/…`) are allowed.
- **iframes:**
  - `allowedIframeHostnames: ['www.youtube.com','www.youtube-nocookie.com']`.
  - The `exclusiveFilter` removes iframes whose src doesn't match
    `^https://www\.youtube(-nocookie)?\.com/embed/[A-Za-z0-9_-]{6,20}`, and (above) YouTube `div`s left without an
    iframe.
- **`nonTextTags`:** the defaults plus `title`, `head` and `template`.
- **Post-processing:** collapse 3 or more consecutive `<p></p>`/`<p><br></p>` into one. Trim.
- Plain text with no tags becomes `<p>${escape(text)}</p>`. A blank line becomes a paragraph break and a single
  newline becomes `<br>`.

**`src/lib/links.ts`** (client-safe)

```ts
export type LinkKind = 'home'|'collection'|'collectionsIndex'|'allProducts'|'product'|'page'|'blogPost'|'blogIndex'|'external'|'email'|'phone'|'none';
export type LinkTarget = { href: string; kind: LinkKind; label: string; detail?: string; missing?: boolean };
export const STATIC_LINK_TARGETS: LinkTarget[]; // Home "/", All products "/collections/all", Collections page "/collections", Blog "/blogs/news"
export function classifyHref(href: string): { kind: LinkKind; handle?: string };
export function validateHref(href: string, opts?: { allowEmpty?: boolean; allowInternal?: boolean; allowExternal?: boolean }): string | null; // error text or null
export function normalizeHref(href: string): string;  // trims, strips the site's own origin, "#" → ""
export function isExternalHref(href: string): boolean;
```

`classifyHref` (and `resolveLinkTargets`, `countLinkReferences`) match on the **pathname only**: the `?query` and
`#hash` are ignored when finding the target, so `/collections/kitchens?page=1` resolves to "Collection · Kitchens".
The stored href keeps its query; the picker shows only the target's name.

`validateHref` accepts:

- `''`, when allowed.
- Internal paths matching `^/(?:[a-z0-9\-._~%/]*)(?:\?[^#\s]*)?(?:#[\w-]*)?$`.
- `https?://` URLs that parse with `new URL`.
- `mailto:`, and `tel:` followed by digits.

**`src/lib/link-targets.ts`** (server-only)

```ts
export async function searchLinkTargets(query: string, limit?: number): Promise<LinkTarget[]>;
export async function resolveLinkTargets(hrefs: string[]): Promise<Record<string, LinkTarget>>;
```

- `search`: up to 6 collections (title/handle contains), 6 products (title contains, any status, with a "Draft"
  detail when unpublished), 4 pages (TEXT and DESIGNED), 4 blog posts, plus static targets whose label matches.
  Ordering: exact title match first, then startsWith, then the rest.
- `resolve`: batched with one `IN` query per kind, keyed by pathname (query and hash ignored, as above). Unknown
  internal targets come back with
  `missing: true, label: 'Missing collection “dining-table-set”'` (or the product, page or post wording).
  External links come back as `{kind:'external', label: hostname + path (truncated 40)}`.

**`src/lib/link-references.ts`** (server-only)

```ts
export async function countLinkReferences(hrefs: string[]): Promise<{ menuItems: number; banners: number; settings: number; richText: number }>;
```

It's used in delete confirmations (products, collections, pages, blog). It matches exact `href`, ignoring
`?query` and `#hash`. `richText` counts the rows (products' `bodyHtml`, pages' and blog posts' `bodyHtml`,
collections' `description`) that contain `href="<path>"`, `href="<path>?` or `href="<path>#` for any of the hrefs,
excluding the row being deleted. Callers add the bullet "N pages or descriptions link here; those links will stop
working" when it is non-zero.

**`src/app/admin/actions/links.ts`** (`'use server'`; both call `requireAdmin()`):

```ts
export async function searchLinkTargetsAction(query: string): Promise<LinkTarget[]>;
export async function resolveLinkTargetsAction(hrefs: string[]): Promise<Record<string, LinkTarget>>; // max 300
```

**`src/lib/whatsapp.ts`** (client-safe; seeded by F per §5.7.1, then owned by W) and
**`src/lib/whatsapp-server.ts`** (server-only; `getWhatsAppConfig()`).

### 4.3 Admin primitives: `src/components/admin/ui.tsx` (F adds; existing exports unchanged)

```ts
export function Notice(props: { tone: 'info'|'success'|'warning'|'error'; title?: string; children: ReactNode; action?: ReactNode }): JSX.Element;
export function SectionCard(props: { id?: string; title: string; description?: string; children: ReactNode; collapsible?: boolean; defaultOpen?: boolean }): JSX.Element; // <details> when collapsible (server-safe)
export function CheckboxField(props: { name?: string; label: string; hint?: string; defaultChecked?: boolean; checked?: boolean; onChange?: (v: boolean) => void }): JSX.Element; // client-safe pure
export function FormError(props: { message?: string | null }): JSX.Element | null;
export function ToggleSwitch(props: { name?: string; label: string; hint?: string; checked?: boolean; defaultChecked?: boolean; onChange?: (v: boolean) => void; formAction?: (fd: FormData) => void | Promise<void>; fields?: Record<string, string> }): JSX.Element;
//   role="switch", aria-checked, ≥40px tap target; with formAction it renders its own tiny <form> (list-page toggles) — never place that variant inside another form
export function Tabs(props: { items: { label: string; href: string; active: boolean; hint?: string }[]; ariaLabel: string }): JSX.Element;
//   a row of links (role="tablist" styling), horizontally scrollable on phones; `hint` renders under the tab row for the active tab
```

`Field` gains an optional `htmlFor`. `TextInput` and `TextArea` gain optional `maxLength` and `showCount` (a live
"42 / 160" counter under the field, turning amber past the limit; the counter needs a tiny client child, so the two
become `'use client'`-safe). `Select` stays as it is. `data-testid`s: `toggle-switch`, `tabs`, `char-count`.

These are the only On/Off switch, tab bar and character counter in the admin. P, B and C use them instead of
building their own.

Admin icons: `src/components/admin/icons.tsx` (F) provides `GripIcon`, `ArrowUpIcon`, `ArrowDownIcon`, `UploadIcon`,
`ImageIcon`, `LinkIcon`, `ExternalLinkIcon`, `CopyIcon`, `EyeIcon`, `WarningIcon`, `BoldIcon`, `ItalicIcon`,
`UnderlineIcon`, `H2Icon`, `H3Icon`, `ListBulletIcon`, `ListNumberIcon`, `AlignLeftIcon`, `AlignCenterIcon`,
`AlignRightIcon`, `PaletteIcon` and `YoutubeIcon`. All are `{ className?: string }`, inline SVG with
`currentColor`.

### 4.4 Shared admin components (F). Exact contracts

All are `'use client'` and live in `src/components/admin/`. Each "hidden input" component renders
`<input type="hidden" name={name} value=…>` when `name` is given, so it works inside plain `<form action={serverAction}>`
forms. They're controlled when `onChange` is given and self-managed otherwise. Required `data-testid`s are listed for
the Playwright tests.

**Dirty-tracking rule for every hidden-input component** (`ImageUpload`, `ImageGallery`, `LinkPicker`,
`RichTextEditor`, `ChipsInput`, `ColorSwatchPicker` when named, `ToggleSwitch`). React setting a hidden input's value
fires no `input` or `change` event, so after every **user-initiated** change the component dispatches
`hiddenInput.dispatchEvent(new Event('input', { bubbles: true }))` (in a `useEffect` keyed on the value, guarded by a
"changed by the user" ref). It **never** dispatches on mount, on initial normalisation, or when a parent resets the
value after a save. `useFormDirty` listens for exactly that event.

**Layers** (z-index, used by every component below): admin mobile header and `StickySaveBar` `z-30`; popovers and
bottom sheets (LinkPicker, ColorSwatchPicker, the editor's link and YouTube popovers) `z-[60]`; modals
(`ConfirmDialog`, `ConfirmDelete`) `z-[70]`. Popovers, sheets and modals render through
`createPortal(…, document.body)`.

#### `ImageUpload.tsx`: single image

```ts
export type ImageUploadProps = {
  name?: string;                  // hidden input: the URL ('' when none)
  value: string | null;           // initial / controlled URL (/uploads/… or bundled /images/…)
  onChange?: (url: string | null, meta?: { width: number; height: number }) => void;
  label: string;
  hint?: string;                  // e.g. "Recommended 1200 × 462. Put your text inside the image."
  purpose: UploadPurpose;
  previewAspect?: string;         // CSS aspect-ratio, default '4 / 3'
  required?: boolean;             // shows "Required" and blocks the form submit when empty (see below)
  allowRemove?: boolean;          // default true
};
```

- **States:** empty, showing a drop zone with "Upload photo" and "or drag a photo here"; uploading, with a progress
  bar; filled, showing the preview with `object-contain` on a checkerboard plus Replace and Remove buttons; and error,
  shown in red under the box.
- Removing only clears the field. The server releases the file on save (§3.6).
- **`required`:** `type=hidden` inputs are barred from constraint validation, so the component also renders a
  visually hidden proxy `<input className="sr-only" tabIndex={-1} required value={url ?? ''} onChange={() => {}}
  aria-hidden>` with `setCustomValidity(url ? '' : 'Please upload a photo')`. Its `onInvalid` handler focuses the
  Upload button and shows the message under the box. The server action validates again and returns an inline field
  error.
- `data-testid="image-upload"` sits on the root, which contains an `input[type=file]` with `accept=ACCEPT_IMAGES`.

#### `ImageGallery.tsx`: multi-image, sortable, per-image "Shows" tag

```ts
export type GalleryItem = { key: string; id: number | null; src: string; alt: string; tagKey: string | null; width?: number | null; height?: number | null };
export type ImageGalleryProps = {
  items: GalleryItem[];
  onChange: (items: GalleryItem[]) => void;
  tagOptions?: { key: string; label: string }[]; // e.g. [{key:'v12', label:'Color: Grey'}]; omit → no "Shows" selector
  purpose?: UploadPurpose;                        // default 'product'
  maxItems?: number;                              // default 40
  name?: string;                                  // optional hidden JSON input
};
```

- **Upload:** multi-select upload, three at a time, with a progress bar per file. A failed file shows its error and a
  "Try again" button.
- **Ordering:** sortable grid (2 columns on phones, 4 on desktop) built on `SortableList` (grid mode), with drag,
  "Move left/right" arrow buttons and a "Make main photo" action.
- **Main photo:** the first item gets a "Main photo" badge.
- **Each item has:**
  - The thumbnail.
  - An alt input: "Describe the photo", with the hint "Helps Google and people using screen readers".
  - A "Shows" select: options "Any option (always shown)" plus `tagOptions`.
  - Remove, with no confirmation (it can be undone until the form is saved).
- New items get `key = crypto.randomUUID()` and `id = null`.
- `data-testid`s: `image-gallery`, `gallery-item` (with `data-image-id={id ?? ''}`), `gallery-tag-select`.

#### `RichTextEditor.tsx` (+ `src/components/admin/rich-text/Toolbar.tsx`, `LinkPopover.tsx`, `extensions.ts`)

```ts
export type RichTextEditorProps = {
  name?: string;          // hidden input carrying current HTML
  value: string;          // initial HTML (already sanitised)
  onChange?: (html: string) => void;
  label?: string; hint?: string; placeholder?: string;
  minHeight?: number;     // px, default 260
  features?: { images?: boolean; youtube?: boolean }; // default both true
  ariaLabel?: string;
};
```

**Extensions:**

- `StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, code: false, codeBlock: false, blockquote: false, horizontalRule: false, strike: false, link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } })`
- `TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left','center','right','justify'] })`
- All six heading levels and `justify` are in the **schema** only, so existing content (h1/h4/h5 headings, 151
  product bodies with justified text) survives a load and save unchanged. The toolbar offers only Heading (h2),
  Subheading (h3) and left/center/right (decision 14). A paragraph or heading that is already h1/h4–h6 or justified
  shows no active toolbar state; choosing Heading/Subheading or an alignment replaces it.
- `TextStyle`, `Color`
- `Image.configure({ inline: false })`
- `Youtube.configure({ nocookie: true, width: 640, height: 360 })`
- `useEditor({ immediatelyRender: false })`

**Toolbar** (wraps on phones; buttons are 40px):

- Bold, Italic, Underline.
- "Heading" (h2) and "Subheading" (h3).
- Bullet list and Numbered list.
- Link: opens `LinkPopover`, which contains a `LinkPicker` plus a "Remove link" button.
- Align left, center and right.
- Text colour: a palette of Default (unset), `#103a3a` (store teal), `#c25b41` (terracotta), `#ae2828` (red),
  `#a19a7e` (gold), `#7b7b7b` (grey), `#000000` (black) and `#21b259` (green).
- Photo: file picker → `uploadImage(file,'editor')` → `setImage({src, alt})`. Alt is asked inline after insert, and
  can also be changed later with the image "Describe" bubble.
- YouTube: a dialog with "Paste the YouTube link". It accepts `youtube.com/watch?v=`, `youtu.be/` and `/shorts/`
  links and validates them, otherwise it shows "That doesn't look like a YouTube link".
- Undo and Redo.

There is no raw HTML or source mode.

**Hidden input and dirty state:** the hidden input starts with `value` (the sanitised HTML from the server) and is
written only from Tiptap's `onUpdate` when the transaction is user-initiated (`transaction.docChanged` and not the
initial `setContent`, which is called with `emitUpdate: false`). Tiptap's normalisation of the initial HTML
therefore never marks the form dirty.

**Content area:** `.admin-rte` styles: prose-like headings, lists, links underlined and `max-width: 100%` images. F
adds them to `src/app/globals.css` under `.admin-rte`. That file is shared, but only F edits it, and only this block.

**Pasting:** Tiptap's schema drops unsupported markup. The server sanitises again on save.

`data-testid="rich-text-editor"` sits on the root, and the editable element has `role="textbox"`.

#### `LinkPicker.tsx`

```ts
export type LinkPickerProps = {
  name?: string;                // hidden input with the href
  value: string;                // '' = no link
  onChange?: (href: string) => void;
  initialTarget?: LinkTarget;   // pre-resolved label (server pages pass this to avoid a round trip)
  label?: string; hint?: string;
  allowEmpty?: boolean;         // default true → "No link" choice
  allowInternal?: boolean;      // default true
  allowExternal?: boolean;      // default true
  required?: boolean;
};
```

- **Closed state:** a button showing the target's name and kind, for example "Collection · Sofas",
  "Product · Alexa Sofa Chair", "Web address · facebook.com/cozy…", "No link". A missing target shows in red: ⚠
  "Missing collection “…” — pick another". The trigger has `aria-label="Choose link"`.
- **Open state:** a popover on desktop and a bottom sheet on phones.
  - A search box with placeholder "Search collections, products, pages…", debounced 250 ms, calling
    `searchLinkTargetsAction`.
  - Results are grouped (Collections, Products, Pages, Blog posts, Shortcuts).
  - A "Custom web address" tab, only when `allowExternal`, with a URL input and live `validateHref` errors.
  - "No link", only when `allowEmpty`.
  - Picking a result closes the picker.
- Raw paths are never shown, except the custom web address the user typed.
- With `allowInternal=false` it renders only the web address input plus an "Open" button. Settings uses this for
  social profile links.
- `data-testid="link-picker"`.

#### `SortableList.tsx`

```ts
export type SortableListProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, ctl: SortableItemControls) => ReactNode;
  ariaLabel: string;
  layout?: 'list' | 'grid' | 'horizontal';  // default 'list'
  arrowLabels?: { prev: string; next: string }; // default Move up/Move down ('list'); Move left/Move right ('grid', 'horizontal')
  disabled?: boolean;
  disabledReason?: string;      // shown as a hint above the list while disabled
};
export type SortableItemControls = { index: number; isFirst: boolean; isLast: boolean; dragging: boolean; handle: ReactNode; moveUp: () => void; moveDown: () => void; arrows: ReactNode };
```

- Uses `@dnd-kit` with `MouseSensor` (distance 6), `TouchSensor` (delay 200, tolerance 6) and `KeyboardSensor`
  (`sortableKeyboardCoordinates`). Not `PointerSensor`: it also fires for touch and would bypass the touch delay.
- `<DndContext id={useId()} …>` so the generated `aria-describedby` ids match between server and client (no
  hydration warning).
- The strategy is `verticalListSortingStrategy` ('list'), `rectSortingStrategy` ('grid', which also handles wrapping
  chips) or `horizontalListSortingStrategy` ('horizontal').
- Each `SortableList` owns its own `DndContext`; nesting lists (menus have three levels) is safe because each context
  only sees its own items.
- Drag listeners are bound **only to the handle** via `setActivatorNodeRef`; a row never starts a drag from its
  inputs, so typing in a price field or scrolling past rows on a phone is unaffected.
- `handle` is a 40×40 button with `GripIcon`, `aria-label="Drag to reorder"`, `style={{ touchAction: 'none' }}`
  (`data-testid="drag-handle"`).
- `arrows` renders the two buttons labelled from `arrowLabels` ("Move up"/"Move down" by default; those strings are
  also the aria-labels), disabled at the ends. They're always visible and are the phone fallback.
- Each item wrapper has `data-testid="sortable-item"`.

#### `ChipsInput.tsx`

```ts
export type ChipsInputProps = {
  name?: string;                // hidden input: JSON.stringify(string[])
  value: string[];
  onChange?: (v: string[]) => void;
  ariaLabel: string; label?: string; hint?: string; placeholder?: string;
  suggestions?: string[];       // datalist-style dropdown filtered by input
  maxChips?: number;            // default 50
  maxLength?: number;           // default 60 per chip
};
```

- Enter, comma or Tab adds a chip. Backspace in an empty input removes the last chip.
- Pasted text containing commas or newlines is split into several chips.
- Duplicates are ignored (compared case-insensitively). Chips are trimmed.
- Each chip has an × (`aria-label="Remove <chip>"`).

#### `ColorSwatchPicker.tsx`

```ts
export type SwatchValue = { color: string | null; image: string | null };
export type ColorSwatchPickerProps = { value: SwatchValue; onChange: (v: SwatchValue) => void; valueLabel: string };
```

- **Trigger:** a 32px circle showing the image, else the colour, else a neutral dashed circle, with
  `aria-label="Swatch for <valueLabel>"`.
- **Popover:** an 18-colour palette, each with a name tooltip: Black #000000, White #ededed, Off-white #f3efe7,
  Beige #c7aa82, Sand #b7a89d, Taupe #ccc7bb, Grey #808080, Dark grey #605959, Navy #000080, Blue #2377a4,
  Green #81864a, Olive #857c56, Mustard #ffdb58, Pink #e493a3, Maroon #800000, Rose #af6f70, Brown #7f5112,
  Walnut #5a3a22.
- Then a "Custom colour" `<input type="color">`, "Use a photo instead" (`ImageUpload` with purpose `swatch`,
  square), and "Clear".

#### `UnsavedChangesGuard.tsx`

```ts
export function UnsavedChangesGuard(props: { dirty: boolean; message?: string }): null;
export function useFormDirty(formRef: React.RefObject<HTMLFormElement | null>): { dirty: boolean; markClean: () => void };
export function FormDirtyGuard(props: { formId: string; message?: string }): null; // for server-rendered <form id=…>
```

- When dirty: add a `beforeunload` handler, and a capture-phase document click listener on same-origin `a[href]`
  that isn't `target=_blank`. That listener calls `window.confirm(message)` and calls `preventDefault` if the user
  cancels.
- Default message: "You have unsaved changes. Leave this page and lose them?"
- `useFormDirty` snapshots `new FormData(form)` after mount (in a `useEffect`, once the client components have
  rendered their hidden inputs) and compares it on bubbling `input`/`change` events on the form. It notices changes
  made by the components above because they dispatch `input` on their hidden inputs (§4.4 dirty-tracking rule).
  Submitting the form disables the guard; `markClean()` re-snapshots after a successful `useActionState` save.

#### `ConfirmDelete.tsx`

```ts
export type ConfirmDeleteProps = {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;     // hidden inputs (e.g. { id: '12' })
  title: string;                      // "Delete “Alexa Sofa Chair”?"
  consequences: string[];             // bullets: what will be lost (computed by the caller)
  confirmLabel?: string;              // default "Delete permanently"
  triggerLabel?: string;              // default "Delete"
  trigger?: 'button' | 'icon' | 'link';
  disabled?: boolean; disabledReason?: string;
};
```

- A thin wrapper around `ConfirmDialog` (below), with `tone="danger"` and "This can't be undone." after the
  bullets.
- The confirm button submits a `<form action={action}>` holding the hidden fields. The modal, and therefore that
  form, is rendered with `createPortal(…, document.body)`, so it is never nested inside an edit page's own `<form>`
  (nested forms are invalid HTML and the browser would submit the outer save form instead). Placing the trigger
  inside an edit form is therefore safe.
- `data-testid="confirm-delete"` on the trigger.

#### `ConfirmDialog.tsx`: confirmations that don't submit anything

```ts
export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  consequences: string[];
  confirmLabel: string;
  cancelLabel?: string;               // default "Cancel"
  tone?: 'danger' | 'default';        // danger = red confirm button
  note?: string;                      // e.g. "Removed when you save." or "This can't be undone."
  onConfirm: () => void;
  onCancel: () => void;
};
```

- A modal `role="dialog"` with `aria-modal`, rendered through a portal at `z-[70]`. Esc and a backdrop click call
  `onCancel`. Focus goes to Cancel when it opens and returns to the trigger when it closes.
- Used for **local** removals that only take effect when the page is saved: removing an option value or option
  (§5.1.5 R4/R5), turning the options toggle off, deleting a menu item in the menu editor (§5.5), "Remove from page"
  on Arrange Collections (§5.2.2). These use `note="Removed when you save."`, never a server action.
- `data-testid="confirm-dialog"` on the dialog.

#### `ViewOnStoreLink.tsx`

```ts
export function ViewOnStoreLink(props: { href: string | null; label?: string; disabledReason?: string }): JSX.Element;
```

Renders "View on store ↗" (`target=_blank`). With `href=null` it renders a disabled pill whose tooltip and inline
text is `disabledReason`, for example "Publish to see it on the store".

#### `StickySaveBar.tsx`

```ts
export type SaveBarAction = { label: string; shortLabel?: string; variant?: 'primary' | 'secondary'; type?: 'submit' | 'button'; form?: string; name?: string; value?: string; onClick?: () => void; disabled?: boolean };
export function StickySaveBar(props: { dirty: boolean; saving?: boolean; status?: string; error?: string | null; actions: SaveBarAction[] }): JSX.Element;
```

- `fixed inset-x-0 bottom-0 z-30 lg:left-64 pb-[max(env(safe-area-inset-bottom),0.75rem)]`, white, with a top
  border and shadow. The admin layout's viewport meta gets `viewport-fit=cover`.
- The status text: `error` in red, else "Unsaved changes" with an amber dot when `dirty`, else `status`.
- At 400px and wider the text is on the left and the buttons on the right. Below 400px the text is one truncated
  line above the buttons, and the buttons stay **side by side** using `shortLabel` when given (e.g. "Draft" /
  "Publish").
- On touch devices, while a text input or the rich-text editor has focus (the on-screen keyboard is open), the bar
  is hidden (`focusin`/`focusout` on the document, `(pointer: coarse)` only) so it never covers the field being
  typed in.
- Only one `StickySaveBar` is visible on a page at a time.
- The page using it must add `pb-28`.

### 4.5 Admin shell (F)

**`src/components/admin/shell/Sidebar.tsx`** nav, in order:

| Label | Route |
|---|---|
| Dashboard | `/admin` |
| WhatsApp inquiries | `/admin/inquiries` (badge: inquiries today) |
| Products | `/admin/products` |
| Collections | `/admin/collections` |
| Reviews | `/admin/reviews` |
| Home banners | `/admin/banners` |
| Menus | `/admin/menus` |
| Pages | `/admin/pages` |
| Blog posts | `/admin/blog` |
| Messages | `/admin/messages` (badge: new) |
| Settings | `/admin/settings` |

- The admin block shows the name and email, a "Change password" link (`/admin/account/password`), "View store ↗"
  and Logout.
- Orders is removed, along with the `pendingOrders` prop.

**`src/app/admin/(panel)/layout.tsx`:**

- Computes `newMessages` and `inquiriesToday` (`createdAt >= startOfStoreDay()`, §4.2 `dates.ts`).
- If `getWhatsAppConfig()` returns null, it renders a yellow
  `Notice tone="warning" title="WhatsApp ordering is off"` above every page: "Add your WhatsApp number in Settings —
  until then the Order on WhatsApp buttons are hidden on the store." It has a "Go to Settings" action linking to
  `/admin/settings#whatsapp`.

---------------------------------------------------------------------------------------------------------------------

## 5. Functional spec per area

Conventions for every edit page:

- The page header shows the title and a `ViewOnStoreLink`.
- The body is `SectionCard`s.
- There's an `UnsavedChangesGuard` (or `FormDirtyGuard`) and a `StickySaveBar`.
- Success shows a green `Notice` ("Saved. The store is updated.").
- Validation errors are shown inline under the field and summarised in the save bar.
- Every destructive action goes through `ConfirmDelete` (server deletes) or `ConfirmDialog` (removals that take
  effect on save), and says what will be lost.
- Every mutation calls `requireAdmin()`, validates on the server (never trust the client), runs in a transaction, then
  calls `releaseUploads` and `revalidatePath(...)`.

### 5.1 Products (owner P)

#### 5.1.1 Routes and files

- `/admin/products`: the list.
- `/admin/products/new`: a new product.
- `/admin/products/[id]`: edit.
- The editor is a single client component, `src/app/admin/(panel)/products/_components/ProductEditor.tsx`. It gets
  its initial state from the server page, which loads it with `loadProductEditorState(id)` in
  `products/_lib/load.ts` (server).

#### 5.1.2 Editor state and save contract

```ts
// src/app/admin/(panel)/products/_lib/types.ts
export type OptionValueState = { key: string; id: number | null; value: string; swatchColor: string | null; swatchImage: string | null };
export type OptionState = { key: string; id: number | null; name: string; values: OptionValueState[] };
export type VariantState = {
  key: string; id: number | null;
  valueKeys: string[];               // one key per option, in option order ([] when no options)
  regularPrice: string; salePrice: string;   // strings while editing; '' allowed for sale
  status: VariantStatus; sku: string; weightGrams: string; stock: string;
};
export type ProductEditorState = {
  id: number | null; updatedAt: string | null;
  title: string; handle: string; handleTouched: boolean;
  deliveryTime: string; bodyHtml: string;
  hot: boolean; isNew: boolean; limitedEdition: boolean; layout: string;
  vendor: string; productType: string; tags: string[]; discountGroup: number | null; trackStock: boolean;
  options: OptionState[]; variants: VariantState[]; images: GalleryItem[]; collectionIds: number[];
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
};
export type SaveProductInput = Omit<ProductEditorState, 'handleTouched' | 'status'> & { intent: 'draft' | 'publish'; force?: boolean };
export type SaveProductResult =
  | { ok: true; state: ProductEditorState }   // the full reloaded state: loadProductEditorState(id) after the commit
  | { ok: false; code: 'INVALID'; error: string; field?: string }
  | { ok: false; code: 'STALE'; error: string; currentUpdatedAt: string };
```

Server actions live in `src/app/admin/actions/products.ts`:

```ts
export async function saveProductAction(input: SaveProductInput): Promise<SaveProductResult>;
export async function duplicateProductAction(id: number): Promise<{ ok: true; id: number } | { ok: false; error: string }>;
export async function deleteProductAction(formData: FormData): Promise<void>;     // redirects to /admin/products?deleted=1
export async function toggleProductHotAction(formData: FormData): Promise<void>; // list page "Best seller" star
```

**After a successful save** the client **replaces its whole editor state with `result.state`**. That state is
`loadProductEditorState(id)` run after the commit, so every option, value, variant and image created by this save now
has its real `id`, and `updatedAt` is the new one. Keys are rebuilt by the loader (`key = 'o<id>'`, `'v<id>'`,
`'var<id>'`, `'img<id>'`), and the client remaps any UI state keyed by the old keys (selected rows, open chip menus)
through the returned ids where it can, else clears it. Then it resets the dirty state and shows "Saved. The store is
updated." For a new product it then calls `router.replace('/admin/products/<id>?saved=1')`; the server page renders
`<ProductEditor key={state.updatedAt} initial={state} />`, so that navigation (and any later `router.refresh()`)
remounts the editor from fresh server props as well. A second save therefore sends real ids and the current
`updatedAt`, and never re-creates rows (decision 13).

**`field` format** (for inline errors): `title`, `handle`, `deliveryTime`, `options.<optionKey>.name`,
`options.<optionKey>.values.<valueKey>`, `variants.<variantKey>.regularPrice` (or `.salePrice`, `.sku`,
`.weightGrams`, `.stock`), `images.<itemKey>.alt`, `tags`. The editor scrolls to the field, opens a collapsed
`SectionCard` that contains it (Advanced), highlights the row for 3 seconds and focuses the input. The save bar shows
the same message.

**Stale state** (`code: 'STALE'`): the save bar shows "This product was changed somewhere else (another tab or
person)." with two buttons: "Reload latest (lose my changes)" (`router.refresh()` + remount) and "Save mine
anyway" (resubmits the same input with `updatedAt = currentUpdatedAt` and `force: true`, which skips the check). The
owner never has to copy and paste.

#### 5.1.3 Page layout: one long page, sections in this order

**Header.** The title (or "New product"), a status pill ("Published" / "Draft" / "Archived"), `ViewOnStoreLink`
(`/products/<handle>`; disabled with "Publish to see it on the store" when not ACTIVE), a "Duplicate" button and
`ConfirmDelete`.

1. **Basics**
   - **Title.** Required, at most 200 characters.
   - **Delivery time.** Optional. Hint: "Example: Delivered in 20 to 30 working days. When filled, the product page
     shows a FREE DELIVERY tag and this line."
2. **Photos**
   - `ImageGallery`. `tagOptions` = every value of every option, labelled `"<Option>: <value>"`.
   - Hint: "The first photo is the main photo. Use “Shows” to switch the gallery when a customer picks that
     option. JPG, PNG, WebP or iPhone photos up to 20 MB."
3. **Description**
   - `RichTextEditor`. Hint: "Shown under the price. Use Heading for “Specifications:”-style titles."
4. **Options & prices** (§5.1.5)
5. **Collections**
   - A searchable checkbox tree: `buildCollectionTree`, moved into `products/_lib/collections.ts`.
   - Selected collections are shown as chips at the top.
   - Hint: "The product appears on these collection pages."
6. **Visibility**
   - "Best seller (star on the product photo, listed first when sorting by best selling)" → `hot`.
   - "New arrival (red NEW label)" → `isNew`.
   - "Limited edition (yellow label on product cards)" → `limitedEdition`.
   - "Page layout": a select of `PRODUCT_LAYOUTS` labels, with the chosen layout's `help` shown underneath. Hint:
     "Sections shown below the product."
   - Publish state is set by the save buttons, not by a field. The section shows the current state as text.
7. **Advanced** (`SectionCard collapsible defaultOpen={false}`)
   - **Web address:** `cozyfurnitures.pk/products/` plus an editable slug. It's auto-filled from the title until the
     user edits it (`handleTouched`). For an existing product, editing it shows the warning "Changing the web address
     breaks links that people have saved or shared."
   - **Brand (vendor):** default "Cozy Furnitures".
   - **Product type:** a text input with suggestions (a datalist of the distinct existing `productType` values).
   - **Search keywords (tags):** `ChipsInput`. Hint: "Extra words that help the store search find this product."
   - **Discount filter group:** a select of None, 10%, 20%, 30%, 40% or 50%. Hint: "Puts the product under this
     choice in the phone “Discount %” filter."
   - **Track stock count:** a checkbox (→ `trackStock`). When it's on, the variants table shows a "Stock" column.
   - **Per-variant SKU and weight:** a compact table with columns "Combination", "SKU" (blank means auto) and
     "Weight (kg)". It's shown and stored as grams; the UI uses kg with 2 decimals, and kg × 1000 is rounded on save.

**Sticky save bar.**

- New or draft product: buttons "Save as draft" (secondary, `intent: 'draft'`, short label "Draft") and "Publish"
  (primary, `intent: 'publish'`). Status text: "Draft — not visible on the store".
- Published product: buttons "Unpublish (save as draft)" (secondary, short label "Unpublish") and "Save" (primary,
  `intent: 'publish'`).
- An archived product saved as draft becomes DRAFT, and "Publish" makes it ACTIVE.

#### 5.1.4 Server validation (`saveProductAction`)

- **Draft vs publish.** With `intent: 'draft'` only the title is required: a blank Regular price is saved as `0`
  (shown as "Price on request" if it is published by mistake), and the variant and option structure rules below
  still apply because the generator always keeps them consistent. With `intent: 'publish'` every variant needs a
  Regular price; a blank one returns `"Enter a price for Grey / 3 Seater (use 0 for 'Price on request')."` with
  `field: 'variants.<key>.regularPrice'`. A non-number returns `"Prices can only contain numbers (row: Grey / 3
  Seater)."` with the same field format.
- `title` is required, trimmed, at most 200 characters.
- `handle` = `slugify(handle || title)`. If it's empty, return the error
  `"Add a title so we can make the web address."` with `field: 'title'`. Uniquify it with `-2`, `-3`, … against
  other products.
- Options:
  - At most 3. Names are non-empty, at most 40 characters and unique (case-insensitive).
  - Each option has at least 1 value. Values are trimmed, non-empty, at most 60 characters and unique within the
    option (case-insensitive).
  - The total number of combinations is at most 100.
- Variants:
  - There's exactly one variant for each `valueKeys` tuple, and every key must exist.
  - When there are no options, there's exactly one variant with `valueKeys: []`.
- Prices:
  - `regularPrice` is an integer, 0 ≤ n ≤ 100,000,000. Commas are stripped.
  - `salePrice` is empty, or an integer with 0 < sale < regular. Error text:
    `"Sale price must be lower than the regular price (row: Grey / 3 Seater)."`
- `status` must be in `VARIANT_STATUSES`.
- `sku` is at most 64 characters. When it's blank the server generates `CF-<productId>-<n>` (n = 1-based variant
  order), made unique within the product.
- `weightGrams` is an integer from 0 to 2,000,000.
- `stock` is an integer ≥ 0 when `trackStock`; otherwise it's stored as null.
- `images`: the src must start with `/uploads/` or `/images/`. Alt is at most 200 characters (blank means the title).
  `tagKey` must be null or an existing value key. At most 40 images.
- `bodyHtml` = `sanitizeRichText(input.bodyHtml)`.
- `layout`: `isProductLayout(layout)`, else `'default'`.
- `discountGroup` ∈ {null, 10, 20, 30, 40, 50}.
- `tags`: each is trimmed, has commas removed and is at most 60 characters. At most 50. Stored joined with `','`.
- `collectionIds` are filtered to ids that exist.
- **Concurrency:** if `input.id` is set, `input.force` is not true and
  `product.updatedAt.toISOString() !== input.updatedAt`, return
  `{ ok: false, code: 'STALE', error: 'This product was changed somewhere else (another tab or person).', currentUpdatedAt }`
  (the UI is in §5.1.2).
- Every other error returns `code: 'INVALID'` with a `field` in the §5.1.2 format.

#### 5.1.5 Options and prices UI, and the generator algorithm

The generator lives in `products/_lib/variants.ts` as pure functions with unit-testable logic. The UI:

- **Toggle:** "This product has options like size or colour" (`ToggleSwitch`). When it's off, the section shows one
  row: Regular price, Sale price and Status, plus Stock when tracked. Hint under every Regular price input (or once
  in the table header on desktop): "Use 0 if the price is on request."
  - Turning it **off** while options exist opens `ConfirmDialog`: title "Remove all options?", consequences "Keeps
    one price (from <first combination>)", "Removes N combinations", "Photo “Shows” tags are cleared", and the note
    "Removed when you save." Confirming applies R5 repeatedly until no option is left (so the first variant keeps its
    id). Cancelling leaves the toggle on.
- **Option cards:**
  - Each card has an option name input with suggestions from `OPTION_NAME_SUGGESTIONS`.
  - A **value chip editor** (`OptionValuesEditor`, P's own component):
    - Type a value and press Enter or comma to add it.
    - Click a chip to rename it inline.
    - × removes a value.
    - Drag reorders the chips (`SortableList layout="horizontal"`).
  - Swatch options (`isSwatchOptionName`) show a `ColorSwatchPicker` before each chip.
  - "Remove option" is a link at the bottom of the card.
- "Add another option" appears while there are fewer than 3 options.
- **Variants table** (`VariantsTable`):
  - Columns: select checkbox, Combination (for example "Grey / 3 Seater"), Regular price (Rs.), Sale price (Rs.),
    Status (select), and Stock when tracked.
  - The rows are a `SortableList` (drag plus arrows), and the order is saved as `Variant.position`.
  - Each row's root has `data-testid="variant-row"` and `data-variant-id={id ?? ''}` (empty until saved).
  - A "Sort by option order" button reorders the rows into cartesian order.
  - Below 640px each row is a card.
- **Bulk bar** (above the table): Apply to [All combinations | Selected | every "<Option>: <value>"], then the fields
  Regular price, Sale price (with a "clear" checkbox) and Status, then an "Apply" button. Only the fields that were
  filled are applied.
  - Shortcuts: "Set all prices" pre-selects All. "Apply to all <value>" is offered in each chip's ⋯ menu and
    pre-selects that value.

**Generator rules.** A variant's identity is its `valueKeys` tuple.

- **R1. Combinations.** `combos(options)` is the cartesian product of the value keys, in option order and value
  order.
- **R2. Add a value** `v` to option `i`.
  - For each combination containing `v` that doesn't exist yet, create a variant: `id: null`, `sku: ''`.
  - It copies `regularPrice`, `salePrice`, `status` and `weightGrams` from a template: the existing variant whose tuple
    equals the new tuple except at `i`, where it has the option's **first** value. If there isn't one, the first
    variant.
  - New variants are appended at the end, in combination order.
- **R3. Add an option** (index `n`, first value `v0`).
  - Every existing variant gets `valueKeys.push(v0)` and **keeps its id**.
  - The new option's other values create variants per R2.
  - Adding the first option to a product with no options turns the single default variant into the `v0` variant,
    keeping its id.
- **R4. Remove a value** `v` of option `i`.
  - The variants containing `v` are removed. Ask first with `ConfirmDialog`: "Remove “Blue”? This also removes 3
    combinations: Blue / 1 Seater, Blue / 2 Seater, Blue / 3 Seater." with the note "Removed when you save."
  - Removing the last value of an option = R5.
  - Photo tags pointing at `v` become "Any option".
- **R5. Remove an option** `i`.
  - For each reduced tuple (with position `i` dropped), keep the **first** variant (in current order) that maps to
    it, and remove the rest. Ask first with `ConfirmDialog`, saying how many will be removed.
  - Drop index `i` from every `valueKeys`.
  - If no options remain, keep exactly one variant: the first one, keeping its id.
- **R6. Rename a value.** Change the text only. Keys don't change, so variants and photo tags follow automatically.
  On save the server rewrites `Variant.option1..3` and `title` for every affected variant **in place**.
- **R7. Reorder values or options.** This doesn't change the variant list order; the "Sort by option order" button
  does that. Reordering options swaps key positions in every `valueKeys` tuple consistently.
- **R8. Limits.** Adding something that would exceed 100 combinations is blocked with: "That would make N
  combinations — the limit is 100. Remove some values first." More than 3 options isn't possible (the button is
  hidden).
- **R9. Duplicate values.** A duplicate name (case-insensitive) is rejected inline: "“Grey” is already in this
  option."

#### 5.1.6 Save algorithm: update in place, never delete and recreate (fixes decision 13)

`saveProductAction` runs one `prisma.$transaction(async (tx) => …)`:

0. **Ownership.** Load this product's option ids, value ids (through its options), variant ids and image ids. Any input
   `id` that is not in the matching set is treated as `id: null` (create). The action receives plain client JSON, so
   this stops a crafted input from updating another product's rows.
1. Upsert the product scalars (`status` from `intent`: publish → ACTIVE, draft → DRAFT).
2. **Options.**
   - Load the existing options and values.
   - For each input option: if it has an `id` that belongs to this product, update `name` and `position`; otherwise
     create it.
   - Delete options that are absent from the input. Their values cascade, and image tags become null via SetNull.
   - Build `valueKey → valueId` for every value: update the existing ones (`value`, `position`, `swatchColor`,
     `swatchImage`), create the new ones, and delete the ones that are gone.
3. **Variants.**
   - Load the existing ones. For each input variant with `position = index`:
     - Compute the strings: `option{i+1} = valueText(valueKeys[i])`. Unused positions are null.
     - Compute `title = variantTitle(values)`, `price`/`compareAtPrice` (§2.2), `status`, `sku`, `weightGrams` and
       `stock`.
   - If the input has an `id` belonging to this product, **update** that variant (the id is kept). `weightGrams`
     comes from the input, which loaded it from the database. Otherwise create a new one.
   - Delete only the variants whose ids are missing from the input.
4. **Images.** The same diff, by `id`: `position = index`, `src`, `alt`, `optionValueId = map(tagKey)`, plus
   `width`/`height` from the gallery item when known. Never `deleteMany`/`createMany` the whole set.
5. Collections: `set`.
6. Return `removedUrls`: old image srcs, swatch images and body upload URLs that are no longer referenced by the new
   state.

After the commit:

- `releaseUploads(removedUrls)`.
- `revalidatePath('/')`, `revalidatePath('/products/' + handle)`, the old handle's path if it changed,
  `revalidatePath('/collections', 'layout')` and `revalidatePath('/admin/products')`.

**Ids are preserved for every unchanged or edited variant and image.** So `?variant=<id>` links and inquiry history
stay valid.

#### 5.1.7 Duplicate

`duplicateProductAction(id)` copies everything:

- Options and values (with swatches), variants (with new ids, every field copied, `sku = ''`), images (same `src`,
  with tags remapped to the new value ids) and collections.
- `title = "<title> (copy)"`, `handle` = uniquified `<handle>-copy`, `status = 'DRAFT'`.
- Then the client does `router.push('/admin/products/<newId>?duplicated=1')`. The page shows
  `Notice info`: "This is a copy. It is a draft until you publish it."

#### 5.1.8 Delete

`ConfirmDelete` consequences are computed on the server page:

- "The product and its N combinations"
- "M photos (uploaded photos not used anywhere else are deleted)"
- "K customer reviews"
- If `countLinkReferences` finds any: "X menu links and Y banners that point to this product will stop working" and
  "N pages or descriptions link here; those links will stop working"

Delete runs in a transaction (relations cascade). After the commit: `releaseUploads(all image and swatch URLs, plus
body URLs)`, then redirect.

#### 5.1.9 Products list (`/admin/products`)

- **Columns:** photo (48px), title (links to edit) with the price range underneath (for example "Rs.45,000 – Rs.60,000"
  or "Price on request"), status pill, combinations count, availability summary (for example "2 ready · 1 pre-order",
  made from the variant statuses), updated date, and actions (Edit, Duplicate, View on store, Delete).
- **Filters:** search (title), Status (All, Published, Draft, Archived), "Missing photos", "Sold out" (every variant
  `SOLD_OUT`), and Collection (a select). URL contract (frozen, §7.5; the dashboard links to it):
  `?q=<text>`, `?status=published|draft|archived`, `?photos=missing`, `?availability=soldout`,
  `?collection=<id>`, `?page=<n>`.
- Paging is 20 per page (`Pager`).
- Below 640px the table becomes cards.
- The "Best seller" star toggle stays.

#### 5.1.10 Storefront: product page and cards (P)

- **`app/(store)/products/[handle]/page.tsx`**
  - `getProductByHandle` is extended in queries.ts by P to include
    `productOptions { values { orderBy position } } orderBy position` and `images.optionValue`.
  - `options = productOptions.map(o => ({ name, values: o.values.map(v => v.value) }))`.
  - `swatches: Record<optionIndex, Record<value, { color: string; image: string | null }>>`. Only swatch options are
    included; the colour is `swatchColor ?? NEUTRAL_SWATCH`.
  - `images: { src, alt, tag: { optionIndex, value } | null }[]`.
  - `variants` include `status`.
  - `sections = templateFor(product.layout)`. `isNew = product.isNew`. `deliveryLine = product.deliveryTime || null`.
  - The description renders `sanitizeRichText(product.bodyHtml)`.
  - JSON-LD `availability = schemaAvailability(statuses)`.
  - `whatsapp = await getWhatsAppConfig()` is passed to `ProductMain`.
- **`components/product/ProductMain.tsx`**
  - Availability by status: the initial variant is the first `isAvailable` one. `unavailableValues` uses the status.
  - Lead image:
    - When a value is selected, lead with the first image tagged with that value. If the clicked option's value has
      no tagged image, keep the current lead, unless another selected value of a swatch option has one.
    - The initial lead comes from the initial variant's values, with swatch options checked first.
    - `?variant=` deep links still work.
  - **Buy box** (replaces the qty + ADD TO CART block):
    - The qty stepper (unchanged), then `<OrderOnWhatsAppButton … />` (§5.7.2) where the button used to be.
    - If `whatsapp` is null, hide both the stepper and the button.
    - Labels by status:
      - READY_TO_SHIP / MADE_TO_ORDER: "ORDER ON WHATSAPP".
      - PRE_ORDER / SOLD_OUT: "ASK ABOUT AVAILABILITY".
    - The Sold-out badge is unchanged. PRE_ORDER adds a "Pre-order" badge next to the price, styled like the
      Sold-out badge but with the `bg-accent2` colour.
    - "What is Pre-Order?" and its text stay for PRE_ORDER.
    - MADE_TO_ORDER replaces the line "Our team will get in touch…" with "Made to Order — our team will confirm the
      delivery time with you."
  - `addItem`/`useCart` are removed.
- **`VariantPicker.tsx`:** a swatch with an image renders `background: center/cover url(image)`. Otherwise it uses the
  colour.
- **`pdp-data.ts`:**
  - Delete `templateFor(handle)`; add `templateFor(layout)`.
  - Delete `variantImageIndex`, `preOrderSkus`, `swatchColor`, `SWATCH_COLORS` and the JSON imports.
  - `cardSelect` adds `isNew`, `limitedEdition`, `cardImageRatio` and `variants.status`, plus `productOptions` and
    tagged images for card swatches.
- **`components/catalog/catalog-data.ts`:**
  - Delete every JSON import except `live-search-order.json`.
  - `statusLabel = cardStatusLabel(variant statuses)`.
  - `isNew`, `limitedEdition` and `imageRatio = cardImageRatio ?? undefined` come from the fields.
  - `rating = p.rating`, `showRating = p.reviewCount > 0`.
  - **Swatches:** `buildCardSwatches(p)` from `src/lib/card-swatches.ts` (F), selected with `CARD_SWATCH_SELECT`.
    The option is the first `isCardSwatchOptionName` option; each swatch is
    `{ name: value, color: swatchColor ?? NEUTRAL_SWATCH, swatchImage, image: first image tagged with this value ?? null, active: images[0]?.optionValueId === value.id }`.
  - **Sold out** (search ordering and the availability facet): every variant is `SOLD_OUT`.
  - The `inStock`/`outOfStock` facets use `isAvailable(status)`.
  - The discount filter uses `discountGroup === filters.discount`.
- **`ProductCard.tsx`:** the default status uses `statusLabel`. A swatch with `swatchImage` renders it as the
  background. There is still **no button** on cards (decision 25).
- **`lib/queries.ts`** (owned by P in Phase 2): extend `getProductByHandle` as above. The function names and shapes
  used by other workstreams are frozen (§7.5).

### 5.2 Collections (owner B)

#### 5.2.1 Edit (`/admin/collections/[id]`, `/admin/collections/new`)

The fields are a server-rendered form plus client components, posting to `saveCollectionAction(formData)` in
`src/app/admin/actions/collections.ts`. Validation errors come back through `useActionState`; don't use
`?error=` redirects for field errors.

- **Title** (required).
- **Cover photo:** `ImageUpload name="image" purpose="collection" previewAspect="3 / 4"`. Hint: "Shown on the
  Collections page and the home “Shop by Category” tiles."
- **Description:** `RichTextEditor name="description"`. Hint: "Shown under the products on the collection page (with
  “Show more”)." Sanitised on save.
- **Inside collection (optional):** a parent select with the "— Top level —" option. The existing cycle check is
  kept.
- **Products:** the existing `ProductsPicker`, kept. It already hides its ids.
- **Show on the Collections page:** a checkbox.
  - Checking it creates a `CollectionIndexCard` at the end. Unchecking it deletes the card.
  - Hint: "Change the order on Collections → Arrange Collections page."
- **Advanced** (collapsed): Web address (slug, with the same rename warning as products).
- **Removed from the form:** kind, position, "Show in nav", "Featured on homepage". The admin list filters for them
  (kind tabs, featured, shown in nav) go too, and the list's sort options become "Name (A–Z)" (default, `title asc`)
  and "Recently updated" (`updatedAt desc`); the "Position" sort is removed.
- **`ConfirmDelete` consequences:**
  - "N products stay in the catalogue but leave this collection"
  - "M sub-collections move to the top level"
  - "X menu links point here and will stop working"
  - "N pages or descriptions link here; those links will stop working" (when non-zero)
  - "Removed from the Collections page"
  - "Its uploaded cover is deleted if not used elsewhere"
- After saving or deleting: `releaseUploads(old cover + description URLs removed)`,
  `revalidatePath('/', 'layout')` and `revalidatePath('/collections/<handle>')`.

#### 5.2.2 Arrange Collections page (`/admin/collections/arrange`)

- **Page header:** "Collections page" with `ViewOnStoreLink('/collections')`. It's linked from a button on the
  Collections list.
- A `SortableList` of all `CollectionIndexCard`s, ordered by `position`. Each row has a thumbnail (cover, else the
  placeholder SVG `/images/catalog/collection-placeholder-<n>.svg`), the title, "Collection" or "Built-in: all
  products", the arrows and a "Remove from page" × button, which opens `ConfirmDialog` ("Remove “Sofas” from the
  Collections page? The collection itself is kept.", note "Removed when you save.").
- Built-in cards (`systemHandle`) have an editable title and a cover `ImageUpload` (purpose `collection`). They can't
  be removed (the button is disabled with the tooltip "Built-in card").
- "Add collections": a multi-select search over collections that have no card yet. The chosen ones are appended.
- Save bar: "Save order". It calls `saveCollectionIndexAction(input)`.

  ```ts
  type IndexInput = { cards: { id: number | null; collectionId: number | null; systemHandle: string | null; systemTitle?: string; systemImage?: string | null }[] };
  ```

  The positions are the array order. Input `id`s that aren't existing `CollectionIndexCard` ids are treated as new;
  `collectionId`s must exist and appear at most once. It deletes cards that are missing from the input, but
  built-ins can never be deleted.

#### 5.2.3 Storefront (B)

**`app/(store)/collections/page.tsx`:**

- Reads `prisma.collectionIndexCard.findMany({ orderBy: { position: 'asc' }, include: { collection: { select: { handle, title, image } } } })`.
- Each card is `{ href: '/collections/' + (collection?.handle ?? systemHandle), title: collection?.title ?? systemTitle, image: collection?.image ?? systemImage ?? null, placeholder }`.
- Delete the `collections-index.json` import and `staticImage()`.
- The markup is unchanged.

**`collections/[handle]/page.tsx`:** `sanitizeRte` → `sanitizeRichText` (keep `truncateRte`). `rte.ts` keeps only
`truncateRte`.

#### 5.2.4 Home "Hot Selling Products" (B)

Decisions 7 and 23 apply to this carousel too: an admin's swatch, price, status or review edit must reach it.

- `components/home/hotSelling.ts` keeps only the ordered list of handles, plus an optional per-handle
  `salePercent` override where live parity needs a badge value that differs from the computed one:
  `export const HOT_SELLING: { handle: string; salePercent?: number | null }[]`. The hard-coded `swatches`,
  `compareAt`, `rating` and `activeSwatch` are deleted.
- `(store)/page.tsx` builds each card from the database: swatches with `buildCardSwatches` (`CARD_SWATCH_SELECT`),
  price and struck compare-at price from the variants (as `toCard` does), sale % = `salePercent` override when
  given, else the max over variants (as today's catalog card), stars from `rating` when `reviewCount > 0`, and the
  status label from `cardStatusLabel` over `variants.status`.
- Expected differences from today (listed in §9 R31): the ringed swatch follows the first photo's "Shows" tag, and
  products whose live card hid the compare-at price may now show it.

### 5.3 Pages and blog (owner C)

#### 5.3.1 Kinds

`DESIGNED_PAGE_HANDLES` (exact, in `src/lib/page-kinds.ts`):

- Rendered by components: `about`, `about-us`, `authorized`, `berlin`, `catalogues`, `contact`, `home-furniture`,
  `lead-form`, `loyalty-form`, `office-furniture`, `store-locator`, `support-complaint-form`, `track-your-ticket`,
  `wedding-package-builder`.
- Legacy section markup, rendered from the body as-is: `buy-now-pay-later`, `coalesce-collection`, `coalesce-home`,
  `coalesce-office`, `gujranwala`, `imagine`, `interwood-grove-discount`, `islamabad`, `karachi`, `lahore`,
  `rawalpindi`, `review`. (`review` is stored as a whole Shopify document today; the migration strips it to its
  `<main>` content, §2.5.4 step 9.)
- Redirect to WhatsApp tracking: `track-your-order`.

That's 27 handles. `TEXT` (6 today): `privacy-policy`, `payment`, `rewards`, `shipping-and-delivery`,
`terms-of-use`, `terms-of-offers-for-sale`. Pages created in the admin are TEXT. `BLOG`: the 14 `news-*` posts.

#### 5.3.2 Admin: Pages (`/admin/pages`, `/admin/pages/new`, `/admin/pages/[id]`)

- **List:** only TEXT and DESIGNED pages. Columns: title, kind ("Text page" or "Custom design"), Published/Hidden
  toggle, updated, actions. "New page" creates a TEXT page. DESIGNED pages have no delete action, with the tooltip
  "Custom-design pages can be hidden but not deleted".
- **TEXT edit:**
  - Title.
  - Content: `RichTextEditor`.
  - **Search engine listing** card:
    - SEO title: `TextInput name="seoTitle" maxLength={60} showCount`, hint "Shown in Google results and the
      browser tab. Leave empty to use the page title."
    - SEO description: `TextArea name="seoDescription" rows={3} maxLength={160} showCount`, hint "The short text
      under the title in Google results."
  - Published: `ToggleSwitch name="published"` labelled "Visible on the store".
  - Advanced (collapsed): Web address, `/pages/<slug>`.
  - `ConfirmDelete` consequences: "The page and its text", "X menu links point here and will stop working", and "N
    pages or descriptions link here" when non-zero.
  - **Web address rules:** the slug is made from the title and uniquified (`-2`, `-3`, …) against **all** pages
    (`Page.handle` is unique across kinds). A TEXT page may never use a handle in `DESIGNED_PAGE_HANDLES` or one
    starting with `news-`; such a slug gets `-page` appended, and a typed one is rejected with "That web address is
    used by a built-in page. Please choose another."
  - **After the first save** of a new page: `Notice info`: "To let customers find this page, add it to a menu."
    with the action link "Go to Menus" → `/admin/menus?tab=about`.
- **DESIGNED edit:**
  - `Notice info title="This page has a custom design"`: "Its layout and text are built into the website, so they
    can't be edited here. You can change how it appears in search engines and whether it is visible."
  - The search engine listing card and the Published checkbox. Title is read-only. No body editor.
  - `track-your-order` additionally shows: "This address opens a WhatsApp chat so customers can ask about their
    order."
- **Actions** (`src/app/admin/actions/pages.ts`):
  - `savePageAction(prev, formData)` for TEXT and DESIGNED. For a DESIGNED page it only writes the seo fields and
    `published`, regardless of what else is posted.
  - `togglePagePublishedAction`.
  - `deletePageAction`, which refuses DESIGNED pages.

#### 5.3.3 Admin: Blog posts (`/admin/blog`, `/admin/blog/new`, `/admin/blog/[id]`)

- **List:** featured thumbnail, title, date, author, tags, Published toggle, actions. Sorted by date, newest first.
- **Edit form:**
  - **Title.**
  - **Date:** `<input type="date">`, defaulting to today. Stored as midday UTC (`T12:00:00Z`) to avoid day shifts.
  - **Author:** text, with suggestions from the distinct existing authors.
  - **Featured image (optional):** `ImageUpload purpose="blog" previewAspect="1060 / 550"`, hint "Shown at the top
    of the post and on the blog page. Recommended 1060 × 550." The width and height are stored from the upload meta
    (null when removed).
  - **Content:** `RichTextEditor`.
  - **Tags:** `ChipsInput`, with suggestions from the distinct tags of all posts. Hint: "Each tag gets its own page
    on the blog."
  - **Search engine listing:** as for pages (same components and names).
  - **Published:** `ToggleSwitch`.
  - The slug is uniquified against all pages, like TEXT pages.
  - **Advanced:** Web address, `/blogs/news/<slug>`. Stored as `handle = 'news-' + slug`.
- **Actions:** `saveBlogPostAction`, `toggle…` and `deleteBlogPostAction`, also in `pages.ts`.
  `kind = 'BLOG'` is enforced on the server.

#### 5.3.4 Storefront (C)

**`app/(store)/pages/[handle]/page.tsx`:**

- Unpublished → 404.
- `kind === 'BLOG'` → 404. A blog post isn't a page.
- DESIGNED:
  - A `SECTION_PAGES` component if there is one.
  - Else `track-your-order` → `redirect('/track')`, as today.
  - Else the legacy body rendered as today with `cleanBodyHtml` inside the same wrapper.
- TEXT: `sanitizeRichText(page.bodyHtml)` inside the existing `.page-content-width.rte` wrapper. The payment popup
  stays.
- Metadata: `seoTitle || title`, then `seoDescription || richTextToPlainText(body).slice(0,160)`.

**Blog:**

- **Query:** new `src/components/pages/blog-data.ts` with `listPublishedPosts()`. It selects
  `kind: 'BLOG', published: true` ordered by `publishedAt desc nulls last`, then `createdAt desc`.
- **`BlogIndex`, the post page and prev/next** read the fields:
  - date = `publishedAt ?? createdAt`
  - author
  - image = `featuredImage ? { src: featuredImage, width: featuredImageWidth ?? 1920, height: featuredImageHeight ?? 800 } : null`
  - tags = the labels, each with href `/blogs/news/tagged/<slugify(label)>`
  - excerpt = `articleExcerpt(sanitized body)`
  - the post page renders the content as `sanitizeRichText(page.bodyHtml)` (decision 14: sanitise on render)
  - the post route's lookup (`blogs/news/[handle]/page.tsx`, today `post.isBlogPost`) uses `kind === 'BLOG'`
- Delete `parseArticle` and `BLOG_TAGS`.
- The tag select options are the distinct tags of published posts, sorted A–Z. That keeps today's 4 live tags and
  their order.
- `/blogs/news/tagged/[tag]` → 404 when no published post has a tag with `slugify(label) === tag`.
- **The output must look identical** to today for the 14 migrated posts: date, author, featured image, tags,
  content (headings keep their level, including the `<h4>`s; §4.2), share, prev/next. The one accepted difference is
  that Word-paste classes such as `class="MsoNormal"` are gone, which has no visible effect.

### 5.4 Banners (owner B)

`/admin/banners` (a single page). Header: "Home banners" plus `ViewOnStoreLink('/')`.

- `Notice info`: "Put your text inside the image — the slider shows only the picture. Recommended size: 1200 × 462
  for computers, 450 × 700 for phones."
- **List:** a `SortableList` of banner cards. Each card has the desktop thumbnail, a mobile thumbnail, the link
  target name (resolved via `resolveLinkTargets`), an On/Off `ToggleSwitch` (`formAction={toggleBannerAction}`),
  Edit and Delete.
- A "Save order" bar appears when the order has changed: `reorderBannersAction(ids: number[])`, which sets
  positions 0..n-1 (ids must all be existing banners).
- **One thing at a time.** While a banner form is open (adding or editing), the list's drag handles and arrows are
  disabled (`SortableList disabled disabledReason="Save or cancel the banner you're editing first."`), and only the
  form's save bar is shown. While the order has unsaved changes, the Edit and "Add banner" buttons are disabled with
  the hint "Save or undo the new order first." and an "Undo" button sits next to "Save order". So there is never
  more than one `StickySaveBar`, and "Save order" never submits a form.
- **Add/Edit form** (inline expandable card, `saveBannerAction(prev, formData)`):
  - **Name (only for you and screen readers)** → `title`. Optional; defaults to "Banner N".
  - **Computer image** (required): `ImageUpload name="image" purpose="banner" previewAspect="1200 / 462"`.
  - **Phone image** (optional): `ImageUpload name="mobileImage" purpose="banner" previewAspect="450 / 700"`. Hint: "If empty, phones
    show the computer image."
  - **Link:** `LinkPicker name="href"` (empty means the slide isn't clickable).
  - **Show on the store:** `ToggleSwitch name="active"`.
  - Removed: location, subtitle, ctaLabel, textColor and overlay. They're no longer written; F2 drops them.
- New banners get `position = max + 1`.
- **Delete:** `ConfirmDelete` with "The slide is removed from the home page" and "Its uploaded photos are deleted if
  not used elsewhere". `releaseUploads` runs afterwards.
- Storefront: `HeroSlider` is unchanged. `(store)/page.tsx` calls `getBanners()` (signature frozen by F).

### 5.5 Menus (owner B)

`/admin/menus?tab=main|about|support|popular` (the default is `main`). Header plus `ViewOnStoreLink('/')`.

| Tab label | location | Depth | Notes |
|---|---|---|---|
| Main menu | `MAIN` | 3 levels: top item → column heading / link / empty row → links | top items and links have a LinkPicker |
| Footer “About” | `FOOTER_1` | 1 level | storefront column heading stays "Information" |
| Footer “Customer Support” | `FOOTER_2` | 1 level | storefront column heading stays "User Area" |
| Footer “Popular searches” | `FOOTER_SEO` | 2 levels: group title → links | group titles have **no link field** (stored href `''`) |

TOPBAR and FOOTER_3 are gone.

The tab bar is the shared `Tabs` component. Each footer tab shows a hint under the tab row so the owner can match it
to the store:

- Footer “About”: "Shown in the website footer under the “Information” heading."
- Footer “Customer Support”: "Shown in the website footer under the “User Area” heading."
- Footer “Popular searches”: "Shown at the bottom of the website footer as groups of links."
- Main menu: "The menu at the top of every page. Items with links inside open a dropdown."

- **Editor:** a client component holding the whole tree for the tab.
  - Each level is a `SortableList` with drag and arrows. Items expand and collapse.
  - Each item has:
    - Label: required, except for empty rows.
    - Link: `LinkPicker` with `initialTarget` pre-resolved server-side via `resolveLinkTargets` over all hrefs in
      the tab.
    - "Show" toggle (→ `enabled`).
    - "Add link inside", where depth allows.
    - "Move to…": a select of the possible parents at the right depth, for moving between groups.
    - Delete, through `ConfirmDialog` (a local removal; nothing is deleted on the server until "Save menu"): title
      "Remove “<label>”?", consequences "Also removes its N links" when it has children, note "Removed when you
      save."
  - MAIN level-2 items **that have children** (column headings), except the first one, show the checkbox **"Start a
    new column in the dropdown"** (→ `newColumn`). Hint: "Untick to show this group under the previous one in the
    same column."
  - MAIN level 2 offers "Add empty row", which creates a spacer: label `''`, href `''`, shown as "— empty row —".
  - Save bar: "Save menu".
- **Action:** `saveMenuAction(location, items: MenuNodeInput[])` in `src/app/admin/actions/menus.ts`.

  ```ts
  type MenuNodeInput = { id: number | null; label: string; href: string; enabled: boolean; newColumn: boolean; spacer: boolean; children: MenuNodeInput[] };
  ```

  - Validate the location.
  - Validate the depth per the table. A spacer is allowed only at MAIN depth 2.
  - Labels are required (at most 80 characters) unless it's a spacer.
  - Hrefs go through `validateHref` (empty is allowed for spacers, FOOTER_SEO group titles and MAIN headings).
  - Ids must belong to this location.
  - In a transaction: update or create each item with `parentId` and `position` = index, then delete the ids of this
    location that are missing (cascading their children).
  - `revalidatePath('/', 'layout')`. Last save wins; there's no concurrency check.
- **Storefront:** `components/layout/menu.ts` `megaColumns` uses `!child.newColumn` for stacking (F does this one-line
  change in Phase 1). Delete `STACK_BADGE` (B).

### 5.6 Settings (owner B)

`/admin/settings` is a server page with a client form, posting to `saveSettingsAction(prev, formData)` with
`useActionState`. Field errors are shown inline and the inputs are preserved (the action returns the submitted
values in its state on error). After a successful save the action calls `revalidatePath('/', 'layout')` and
`revalidatePath('/admin', 'layout')`, so the storefront buttons, the bubble, the announcement bar, the footer and the
admin's yellow WhatsApp banner all update, and the page shows `Notice success` "Saved. The store is updated." The
sections (cards), in order:

**1. WhatsApp ordering** (`id="whatsapp"`)

- **WhatsApp number** (`whatsapp`):
  - Hint: "Pakistani mobile number. Customers' WhatsApp messages go here. Example: 0309 2050463."
  - Accepts `+92 309 2050463`, `0309-2050463`, `923092050463` or `3092050463`. Stored as `normalizeWhatsAppNumber`
    → `923XXXXXXXXX`.
  - Invalid input shows "Enter a Pakistani mobile number like 0309 2050463."
  - Empty is allowed. It shows a warning: "Leave empty to hide all WhatsApp buttons."
- **"Send test message":** a link opening `waLink(number, 'Test message from your Cozy Furnitures website admin.')`
  in a new tab. It's built from the current input value on the client and disabled while the number is invalid.
  Hint: "Opens WhatsApp with a sample message so you can check the number works."
- **Greeting (order button)** → `whatsappGreeting`. Max 200 characters. Default text shown as the placeholder.
- **Greeting (availability button)** → `whatsappAvailabilityGreeting`.
- **Closing line** → `whatsappClosing`. Hint: "Added at the end. Product details are always added automatically."
- **Live preview:** a read-only box rendering `buildProductMessage` for a sample product.

**2. Announcement bar**

- **Text** → `announcement`. One line, at most 120 characters, a `TextInput`. Empty hides the bar.
- **Bar link** → `announcementHref`, `LinkPicker`, optional.
- **Button text** → `announcementCta`, optional.
- **Button link** → `announcementCtaHref`, `LinkPicker`. Required if there's button text.
- A preview of the bar.

**3. Contact details**

- Phone → `phone`.
- Customer care email → `email`.
- Complaints email → `complaintsEmail`. Hint under the two emails: "The footer shows the complaints email, or the
  customer care email if that is empty."
- **Address** → `address`. A plain `TextArea` with 3 rows and no HTML. Hint: "Shown in the website footer."

**4. Social links**

- Facebook, Instagram, YouTube and LinkedIn → `facebook`, `instagram`, `youtube`, `linkedin`.
- Each uses `LinkPicker allowInternal={false} allowEmpty`. The hostname is validated: Facebook must be on
  `facebook.com` or `fb.com`, and likewise for the others. Error example: "This doesn't look like a Facebook
  address."
- Empty hides that icon. All four start empty after the migration (§2.5.4 step 13), so the footer's "Follow Us"
  shows no icons until the owner fills them in.

**5. Store rating**

- **Store rating (out of 5)** → `ratingSummary`: a number 0–5 with one decimal. Hint: "Shown next to the stars on
  the home page."
- **Reviews text** → `ratingSummaryCount`: text. Hint: "Example: 2,500+ verified reviews."

**Removed:** the Shipping section (`shippingFee`, `freeShippingThreshold`).

**`SETTING_KEYS`:** announcement, announcementHref, announcementCta, announcementCtaHref, phone, email,
complaintsEmail, address, facebook, instagram, youtube, linkedin, whatsapp, whatsappGreeting,
whatsappAvailabilityGreeting, whatsappClosing, ratingSummary, ratingSummaryCount.

**Footer** (`components/layout/Footer.tsx`, B). This is the only intended storefront visual change in B:

- **Contact Info:** after the phone/email paragraph, if `settings.address` is set, render
  `<p className="m-0 mt-[10px] text-[15px] leading-[25.5px]">` with the address lines joined by `<br>`.
- **Follow Us:** the `<ul>` renders one `<li className="inline-block mr-[15px]">` per non-empty social link:
  `<a href target="_blank" rel="noopener noreferrer" aria-label="Facebook">` containing the existing
  `FacebookIcon`, `InstagramIcon`, `YoutubeIcon` or `LinkedinIcon` from `@/components/icons` at `h-5 w-5 text-accent
  hover:text-accent2`.
- With no social links, the `<ul>` stays empty, as it is today.

### 5.7 WhatsApp ordering and cart removal (owner W)

#### 5.7.1 `src/lib/whatsapp.ts`: exact contract (F writes the first version, W owns it)

```ts
export type WhatsAppConfig = { number: string; greeting: string; availabilityGreeting: string; closing: string };
export const WHATSAPP_DEFAULTS: Omit<WhatsAppConfig, 'number'> = {
  greeting: "Hello Cozy Furnitures! I'd like to order this product:",
  availabilityGreeting: "Hello Cozy Furnitures! I'd like to ask about the availability of this product:",
  closing: 'Please confirm availability and delivery to my city: ',
};
export const GENERAL_QUESTION_TEXT = 'Hello Cozy Furnitures! I have a question.';
export const TRACK_ORDER_TEXT = "Hello Cozy Furnitures! I'd like to check the status of my order.";
export function normalizeWhatsAppNumber(input: string): string | null;
//   digits only; "0" + 10 digits starting "03" → "92" + rest; "3" + 9 digits → "92" + it; result must match /^923\d{9}$/ else null
export function waLink(number: string, text: string): string; // `https://wa.me/${number}?text=${encodeURIComponent(text)}`
export type ProductMessageInput = {
  kind: 'ORDER' | 'AVAILABILITY';
  title: string;
  options: { name: string; value: string }[];
  quantity: number;
  price: number;                 // unit price; 0 = price on request
  compareAtPrice: number | null;
  url: string;                   // absolute: `${origin}/products/${handle}?variant=${variantId}`
  statusLabel?: string;          // AVAILABILITY only: 'Pre-order' | 'Sold out'
};
export function buildProductMessage(input: ProductMessageInput, config: WhatsAppConfig): string;
```

`buildProductMessage` produces these lines, joined with `\n`, with no blank lines:

1. `kind === 'ORDER' ? config.greeting : config.availabilityGreeting`
2. `*${title}*`
3. One line per option: `${name}: ${value}`, in option order. Omitted when there are no options.
4. `Quantity: ${quantity}`
5. If `price > 0`: `Price: ${formatRs(price)}`, plus `' each'` when `quantity > 1`, plus
   `` ` (was ${formatRs(compareAtPrice)})` `` when `compareAtPrice > price`. Otherwise `Price: on request`.
   `formatRs` from `@/components/ui/Price` gives "Rs.45,000".
6. AVAILABILITY only: `Status: ${statusLabel}`
7. `url`
8. `config.closing`, kept exactly as stored, including any trailing space.

**Example.** ORDER, Alexa Sofa Chair, Color Grey, qty 2, 45000 was 60000, variant 123:

```
Hello Cozy Furnitures! I'd like to order this product:
*Alexa Sofa Chair*
Color: Grey
Quantity: 2
Price: Rs.45,000 each (was Rs.60,000)
http://localhost:3100/products/alexa-sofa-chair?variant=123
Please confirm availability and delivery to my city: 
```

`src/lib/whatsapp-server.ts`: `export async function getWhatsAppConfig(): Promise<WhatsAppConfig | null>`. It reads
the settings and returns null when the number is empty or invalid. Empty greeting or closing values fall back to
`WHATSAPP_DEFAULTS`.

#### 5.7.2 `src/components/whatsapp/OrderOnWhatsApp.tsx`

F seeds a stub with this exact export and props that renders the final markup, minus logging. W completes it.

```ts
export type OrderOnWhatsAppProps = {
  config: WhatsAppConfig | null;   // null → render nothing
  product: { id: number; title: string; handle: string };
  variant: { id: number; price: number; compareAtPrice: number | null; status: string } | null; // null → render nothing
  options: { name: string; value: string }[];
  quantity: number;
  className?: string;
};
export function OrderOnWhatsAppButton(props: OrderOnWhatsAppProps): JSX.Element | null;
```

- Renders `<a href={waLink(...)} target="_blank" rel="noopener noreferrer">` styled `btn h-[52px] flex-1 gap-[10px]`.
  That's the existing store dark-teal solid button, with `WhatsAppGlyph` (an 18px white glyph in
  `src/components/whatsapp/WhatsAppGlyph.tsx`) before the label.
- The label is "Order on WhatsApp" or "Ask about availability". The `btn` class uppercases it. Choose with
  `asksAvailability(variant.status)`.
- The message is computed at render time with `origin = window.location.origin`. Use a `useEffect`-set state; before
  hydration, use `process.env.NEXT_PUBLIC_SITE_URL`.
- `onClick`: `logWhatsAppClick({ kind, productId, variantId, quantity, path: location.pathname + location.search })`.
  It doesn't prevent the default action.
- `data-testid="order-on-whatsapp"`, plus `data-ready="true"` once the `useEffect` has set the real origin (tests
  wait for it before clicking).

#### 5.7.3 Click logging

`src/components/whatsapp/log-click.ts` (client):

```ts
export type WhatsAppClick = { kind: 'ORDER'|'AVAILABILITY'|'GENERAL'|'TRACK'; productId?: number; variantId?: number; quantity?: number; path: string };
export function logWhatsAppClick(c: WhatsAppClick): void;
//   navigator.sendBeacon('/api/whatsapp-click', new Blob([JSON.stringify(c)], { type: 'text/plain;charset=UTF-8' }))
//   (a CORS-safelisted type, so no browser rejects or preflights it); if sendBeacon is missing or returns false,
//   fetch(..., { method:'POST', keepalive:true, body, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }); never throws
```

`src/app/api/whatsapp-click/route.ts`: `POST`.

- The body is parsed with `JSON.parse(await req.text())` (it arrives as `text/plain`); a parse error → 400.
- Rate limit `rateLimit('wa:'+ip, 30, 60_000)`. If it's exceeded, return 204 and log nothing.
- Validate:
  - `kind` is in the enum.
  - `productId` and `variantId` are positive integers.
  - `quantity` is an integer from 1 to 99 (default 1).
  - `path` is a string of at most 300 characters starting with `/`.
- When `productId` is given:
  - Load the product. If it's missing, drop `productId`.
  - Load the variant only if it belongs to the product.
  - Snapshot `productTitle`, `variantSummary` (`"<Option>: <value> · …"` built from `productOptions` and
    `option1..3`, or `''`) and `unitPrice = variant.price`.
- Insert the `WhatsAppInquiry` and return 204. Bodies over 4 KB get 413.
- Responses aren't cached.

#### 5.7.4 Floating bubble

`components/layout/FloatingButtons.tsx` `WhatsappButton({ config }: { config: WhatsAppConfig | null })`:

- The visuals are unchanged.
- `href = waLink(config.number, GENERAL_QUESTION_TEXT)`. `onClick` logs `GENERAL`.
- It renders nothing when `config` is null.

`(store)/layout.tsx` passes `await getWhatsAppConfig()`.

**Complaint form WhatsApp link** (`src/components/pages/FormPages.tsx`, line ~138, today a hard-coded
`https://wa.me/923458203203`). This is a WhatsApp button, so decisions 27 and 28 apply. C owns the file and makes
this one allowed change to a designed component: `FormPages` (or the complaint-form component inside it) receives
`whatsapp: WhatsAppConfig | null` from `pages/[handle]/page.tsx`, links via
`waLink(config.number, GENERAL_QUESTION_TEXT)` with `onClick={() => logWhatsAppClick({ kind: 'GENERAL', path })}`,
and hides the link (and only the link) when the config is null. The visible markup is otherwise unchanged.

After W and C finish, `grep -rn "wa\.me/" src | grep -v src/lib/whatsapp.ts` must return nothing.

#### 5.7.5 Redirects

- `/cart`, `/checkout` and `/checkout/*` → `/` via `next.config.mjs` (F).
- `/track`: a new route handler at `src/app/track/route.ts` (`GET`, `dynamic = 'force-dynamic'`).
  - It inserts a `WhatsAppInquiry { kind: 'TRACK', pagePath: '/track' }`, using the same rate limit as above, **unless**
    the request is a prefetch or a bot: a `Next-Router-Prefetch`, `RSC` or `Purpose: prefetch` / `Sec-Purpose:
    prefetch` header, or a user agent matching
    `/bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|curl|wget|headless/i`. The redirect is sent either
    way.
  - It then answers `302` to `waLink(config.number, TRACK_ORDER_TEXT)`, or to `/` when `config` is null.
  - W deletes `src/app/(store)/track/page.tsx` first; Next won't allow both a page and a route at `/track`.
- `/pages/track-your-order` → `redirect('/track')`, unchanged (C's file).

#### 5.7.6 Removal list (W deletes or edits every item)

| Path | Action |
|---|---|
| `src/lib/cart.tsx` | delete |
| `src/app/layout.tsx` | remove the `CartProvider` import and wrapper |
| `src/app/(store)/layout.tsx` | remove the `CartDrawer` import and mount; pass the WhatsApp config to `WhatsappButton` |
| `src/components/layout/CartDrawer.tsx` | delete |
| `src/components/layout/Header.tsx` | remove the `useCart` and `ThemeCartIcon` imports, `{count, openDrawer}`, and the whole cart `<li>`. Search and account icons stay where they are |
| `src/components/layout/actions.ts` | delete `cartRecommendations` and its imports. Keep `predictiveSearch`, but switch its legacy reads: articles use `where: { kind: 'BLOG', published: true, … }` (not `isBlogPost`), and collections are ordered by `title: 'asc'` (not `position`, which F2 drops) |
| `src/app/(store)/cart/page.tsx`, `cart/CartView.tsx` | delete |
| `src/app/(store)/checkout/page.tsx`, `checkout/success/page.tsx` | delete |
| `src/app/(store)/track/page.tsx` | delete (replaced by `src/app/track/route.ts`) |
| `src/components/checkout/*` (8 files) | delete, **after** moving `HideStoreChrome`, `SYSTEM_FONT`, `Checkbox`, `FloatingInput` and `blueLink` verbatim into the new `src/components/account/ui.tsx` |
| `src/app/(store)/account/login/page.tsx` | import from `@/components/account/ui`. The "Track your order" link stays |
| `src/app/api/orders/route.ts`, `api/orders/lookup/route.ts` | delete |
| `src/app/admin/(panel)/orders/page.tsx`, `orders/[id]/page.tsx` | delete |
| `src/app/admin/actions/orders.ts` | delete |
| `src/components/catalog/QuickAdd.tsx` | delete (dead code) |
| `src/components/product/PreOrderModal.tsx` | change the last line to "For any help, message us on WhatsApp or call {localPhone(SITE.phone)}." Remove "You can purchase in-stock and pre-order items together in the same order…" (no cart any more) |
| `src/components/icons.tsx` | delete `ThemeCartIcon`, `EmptyCartIcon` and `CartIcon` once nothing references them |
| `src/lib/constants.ts` | delete `PAYMENT_METHODS`, `ORDER_STATUSES`, `PAKISTAN_CITIES`, `PAKISTAN_PROVINCES` and `SITE.whatsapp`; update the comment |
| `scripts/fidelity/cart.ts` | delete |
| `src/app/admin/(panel)/page.tsx` | rewrite (§5.8) |
| `prisma/schema.prisma` Order/OrderItem | **not W.** F2 drops them (§2.4) |
| `src/components/admin/ui.tsx` order badge styles | **not W.** F2 removes them |

After W finishes, `grep -rnE "useCart|lib/cart|CartDrawer|/checkout|api/orders|ORDER_STATUSES|PAYMENT_METHODS|components/checkout|QuickAdd|ThemeCartIcon|prisma\.order" src` must return nothing.

### 5.8 WhatsApp inquiries page and dashboard (owner W)

**`/admin/inquiries`** (`src/app/admin/(panel)/inquiries/page.tsx`):

- **Filters** (URL contract, frozen in §7.5: `/admin/inquiries?range=1|7|30|90|all&kind=all|ORDER|AVAILABILITY|GENERAL|TRACK&q=…&page=n`):
  - `range` = 1 ("Today"), 7, 30 (default), 90 or all. Boundaries use `storeRangeStart(days)` from `dates.ts`
    (Asia/Karachi), so "today" starts at midnight Pakistan time.
  - `kind` = all, ORDER, AVAILABILITY, GENERAL or TRACK, shown as "Order", "Availability question", "General
    question" and "Order tracking".
  - `q` = product title contains.
- **Summary row:** the total in the range, today's count, and the top 5 products in the range as
  "Product — N clicks" links.
- **Table** (50 per page, newest first):
  - When: `timeAgo` ("2 h ago"), with `formatStoreDateTime` in the `title` attribute.
  - Type.
  - Product: a link to `/admin/products/<id>`, plus a "↗" link to the store page. The snapshot title is shown when the
    product was deleted.
  - Options (`variantSummary`).
  - Qty.
  - Price (`formatRs(unitPrice)`; "On request" when 0; "—" when null).
  - From: a readable source derived from `kind` and `pagePath`, never the raw path: "Product page" (ORDER and
    AVAILABILITY), "Chat button · <page name>" (GENERAL; the page name from `resolveLinkTargets` on the pathname,
    e.g. "Home", "Collection · Sofas", "Contact form" for the complaint form), "Order tracking link" (TRACK). The
    raw `pagePath` appears only in the cell's `title` tooltip.
- Cards on phones.
- An empty state explains: "When customers tap Order on WhatsApp, it shows up here."

**Dashboard** (`/admin`, rewrite of `src/app/admin/(panel)/page.tsx`):

- **Row 1, inquiry stats:** WhatsApp clicks today, last 7 days, last 30 days (each linking to the inquiries page with
  `range=1`, `7`, `30`; boundaries from `dates.ts`), and the share of "Availability" clicks over the last 30 days.
- **Row 2, catalogue overview:** published products (`/admin/products?status=published`), drafts
  (`?status=draft`), products without photos (`?photos=missing`), sold-out products (every variant `SOLD_OUT`;
  `?availability=soldout`), collections, and new messages. The link formats are the §5.1.9 contract.
- **Most asked-about products (30 days):** a table of the top 10 with photo, title, clicks and a "View" link
  (`groupBy productId`).
- **Recent inquiries:** the last 8.
- **Quick links:** Add product, Home banners, Menus, Settings.
- Call `sweepOrphanUploads()` fire-and-forget, throttled hourly inside the lib.
- No order or revenue tiles.

### 5.9 Change password (owner W)

- **Route:** `/admin/account/password`. The page is `src/app/admin/(panel)/account/password/page.tsx` and the form is
  `PasswordForm.tsx` (client, `useActionState`).
- **Fields:**
  - Current password.
  - New password, with the hint "At least 10 characters."
  - Confirm new password.
  - All three are `autocomplete` `current-password`/`new-password` and have a show/hide toggle.
- **Action** `changePasswordAction(prev, formData)` in `src/app/admin/actions/auth.ts`:
  - `requireAdmin`.
  - Rate limit `pw:<adminId>`, 5 per 10 minutes.
  - `bcrypt.compare(current)`. On failure: "Your current password is not correct."
  - New password: at least 10 characters, different from the current one, and matching the confirmation.
  - Hash with cost 12.
  - `sessionVersion: { increment: 1 }`, then `setSessionCookie(updatedAdmin)` so this browser stays logged in and other
    sessions end.
  - Returns `{ ok: true }`. The page shows "Password changed. Other devices have been logged out."
- **`src/lib/auth.ts`** (**F in Phase 1**, then owned by W). The token format changes in Phase 1, before any
  Phase-2 agent logs in, so it never invalidates other agents' sessions mid-phase. W only adds
  `changePasswordAction` and the page:
  - The token becomes `${id}.${sessionVersion}.${exp}.${sig}`, with the HMAC over `${id}.${ver}.${exp}`.
  - `verifySessionToken` returns `{ id, ver } | null`.
  - `getCurrentAdmin` also requires `admin.sessionVersion === ver`.
  - `setSessionCookie(admin: { id: number; sessionVersion: number })`.
  - `loginAction` passes the admin.
  - Old 3-part tokens are rejected, so everyone logs in once more after this ships. That's acceptable.
- **Playwright** tests must **not** change the real admin password. A future test that does must change it back in
  `afterAll`.

### 5.10 Reviews and messages

No functional changes, except deletes (decision 29). The reviews page moves its import to `actions/reviews.ts` (F
does this in Phase 1). Owners: reviews P, messages W.

- **Review delete (P):** the existing `<details>`/`ConfirmSubmit` delete becomes `ConfirmDelete` with title
  "Delete this review?" and consequences "The review by <author> and its <N>-star rating" and "The product's
  rating and review count are recalculated".
- **Message delete (W):** `ConfirmDelete` with title "Delete this message?" and the consequence "The message from
  <name> (<email>), received <date>, and its text".
- After both, `ConfirmSubmit.tsx` is unused, and F2 deletes it (§7.7).

---------------------------------------------------------------------------------------------------------------------

## 6. Storefront consumers and data files

### 6.1 Data files

| File | Moved to (F copies) | Consumer switched by | Original deleted by |
|---|---|---|---|
| `src/components/product/data/product-templates.json` | `prisma/easy-mode-data/` | P (`templateFor(layout)`) | P |
| `src/components/product/data/variant-images.json` | ″ | P (image tags) | P |
| `src/components/product/data/preorder-variants.json` | ″ | P (status) | P |
| `src/components/catalog/swatch-colors.json` | ″ | P (option value swatches) | P |
| `src/components/catalog/swatch-variants.json` | ″ | P (image tags) | P |
| `src/components/catalog/live-sold-out.json` | ″ | P (status) | P |
| `src/components/catalog/live-card-data.json` | ″ | P (status, cardImageRatio, reviews) | P |
| `src/components/catalog/collections-index.json` | ″ | B (`CollectionIndexCard`) | B |
| `src/components/product/data/templates.json` | stays (template content in code) | — | — |
| `src/components/catalog/live-search-order.json` | stays (non-goal) | — | — |

The copies in `prisma/easy-mode-data/` are kept permanently. They're the inputs that `seed.ts` and the migration
need to reproduce the end state.

### 6.2 Consumer list (file → function → change)

| File | Function / spot | Change | Owner |
|---|---|---|---|
| `src/components/product/pdp-data.ts` | `templateFor`, `variantImageIndex`, `preOrderSkus`, `swatchColor`, `SWATCH_COLORS`, `cardSelect` | §5.1.10 | P |
| `src/app/(store)/products/[handle]/page.tsx` | options/swatches/images/variants/sections/isNew/deliveryLine/preOrderSkus props, JSON-LD, description render | §5.1.10 | P |
| `src/components/product/ProductMain.tsx` | stock/pre-order logic, gallery lead, buy box | §5.1.10 | P |
| `src/components/product/types.ts` | `VariantInfo.inventory` → `status: string`; `unavailableValues` uses `isAvailable` | | P |
| `src/components/product/VariantPicker.tsx` | swatch image | | P |
| `src/components/catalog/catalog-data.ts` | `LIVE_RATINGS`, `LIVE_IMAGE_RATIOS`, `LIVE_STATUSES`, `LIVE_SOLD_OUT`, `SWATCH_COLORS`, `SWATCH_VARIANTS`, `swatchesFor`, `toCatalogCard`, availability facets, discount filter, `getCatalogCollection` (unchanged) | §5.1.10 | P |
| `src/components/catalog/ProductCard.tsx` | status default, swatch image | | P |
| `src/lib/queries.ts` | Phase 1 (F): `ProductCardData` gains `available: boolean`, `statusLabel: string \| null` and drops `inventory`; `toCard` uses `variants.status`; `listProducts.inStockOnly` → `variants.some.status != SOLD_OUT`; `getMenu` returns `newColumn` and drops `badge`; `getBanners()` takes no argument; `listBlogPosts` filters `kind:'BLOG'`; delete the unused `getAllNavCollections`, `getFeaturedCollections`, `getCollectionByHandle`, `getRecentReviews`. Phase 2 (P): `getProductByHandle` include. P does **not** delete `getRelatedProducts` in Phase 2 (W's `actions.ts` imports it until W deletes `cartRecommendations`); F2 removes it if unused | | F → P |
| `src/app/(store)/page.tsx` | `getBanners()`; hot-selling `statusLabel` → `card.statusLabel` (F Phase 1); otherwise unchanged | | F touch → B |
| `src/app/(store)/collections/page.tsx` | `collections-index.json` → `CollectionIndexCard` | §5.2.3 | B |
| `src/app/(store)/collections/[handle]/page.tsx` | `sanitizeRte` → `sanitizeRichText` | | B |
| `src/components/catalog/rte.ts` | drop `sanitizeRte` | | B |
| `src/components/layout/menu.ts` | `STACK` badge → `newColumn` | F Phase 1 one-liner, then B | F touch → B |
| `src/components/layout/Footer.tsx` | address + socials | §5.6 | B |
| `src/app/(store)/pages/[handle]/page.tsx` | kinds, sanitised TEXT body | §5.3.4 | C |
| `src/components/pages/content.ts`, `BlogIndex.tsx`, `blogs/**` | fields instead of `parseArticle` | §5.3.4 | C |
| `src/components/layout/FloatingButtons.tsx`, `Header.tsx`, `(store)/layout.tsx`, `app/layout.tsx` | WhatsApp config, cart removal | §5.7 | W |
| `src/app/(store)/search/page.tsx` | uses `getCatalog`; no change expected | | P |
| `scripts/fidelity/product.ts`, `catalog.ts` | data paths | §2.7 | F |
| `src/components/catalog/catalog-data.ts`, `(store)/products/[handle]/page.tsx` | magic-tag reads → `isNew`, `limitedEdition`, `deliveryTime`, `discountGroup` | §7.2 compile touches | F (Phase 1) |
| `src/components/layout/actions.ts` | `predictiveSearch`: `isBlogPost: true` → `kind: 'BLOG'`; collections `orderBy: { title: 'asc' }`; delete `cartRecommendations` | §5.7.6 | W |
| `src/app/(store)/blogs/news/[handle]/page.tsx` | `post.isBlogPost` → `post.kind === 'BLOG'` | §5.3.4 | C |
| `src/components/pages/FormPages.tsx` | hard-coded `wa.me` link → settings number + click log | §5.7.4 | C |
| `src/components/home/hotSelling.ts`, `(store)/page.tsx` | hard-coded swatches/compareAt/rating/activeSwatch → database | §5.2.4 | B |
| `src/app/admin/(panel)/collections/page.tsx` | drop the kind/featured/showInNav filters and the `position` sort; sort by title or updatedAt | §5.2.1 | B |
| `scripts/fidelity/home.ts` | drop the `location: 'HOME_HERO'` filters | §2.4 runbook step 5 | F2 |
| `scripts/fidelity/global.ts` | `createMenuTree` writes `newColumn` only (no `badge`) | §2.4 runbook step 5 | F2 |

---------------------------------------------------------------------------------------------------------------------

## 7. Workstream plan and file ownership

### 7.1 Phases

```
Phase 1  F   (alone)  ─────────────►  hand-off checklist §7.3 green
Phase 2  P | W | C | B (parallel) ─►  each hand-off checklist §7.4 green
Phase 3  F2  (alone)  ─────────────►  cleanup schema, reseed, full test run, reviewer sweep
```

### 7.2 F: Foundation (Phase 1). Owns these files

**Config and infrastructure**

| File | Action |
|---|---|
| `package.json`, `package-lock.json` | install the §4.1 packages. Scripts: `db:backup`, `db:migrate-easy-mode`, `test:e2e` (`playwright test`) |
| `.gitignore` | add `/storage/`, `/prisma/backups/`, `/test-results/`, `/playwright-report/`, `/tests/.auth/` |
| `next.config.mjs` | §4.1 |
| `tsconfig.scripts.json` (new) | extends `./tsconfig.json`; `include: ["scripts/**/*.ts", "prisma/seed.ts", "src/**/*.ts", "src/**/*.tsx"]`; `exclude: ["node_modules"]` |
| `src/types/heic-decode.d.ts` (new) | |
| `playwright.config.ts` (new) | §8.1 |
| `tests/admin/auth.setup.ts`, `tests/helpers/env.ts`, `tests/helpers/fixtures.ts`, `tests/helpers/admin.ts` (new) | §8.1 |
| `tests/admin/uploads.spec.ts` (new) | §8.2 |

**Data**

| File | Action |
|---|---|
| `prisma/schema.prisma` | §2.1, and F2 §2.4 |
| `prisma/seed.ts` | §2.6 |
| `prisma/easy-mode-data/*.json` (8 copies) | §2.5.2 |
| `scripts/migrate-admin-easy-mode.ts`, `scripts/backup-db.ts`, `scripts/lib/legacy-html.ts`, `scripts/lib/css-colors.ts` (new) | |
| `scripts/fidelity/global.ts`, `home.ts`, `catalog.ts`, `product.ts`, `content.ts` | §2.7 |

**Libraries**

| File | Action |
|---|---|
| `src/lib/storage/index.ts`, `src/lib/storage/local-disk.ts`, `src/lib/uploads.ts` | §3 |
| `src/lib/slug.ts`, `src/lib/admin-guard.ts`, `src/lib/variant-status.ts`, `src/lib/product-options.ts`, `src/lib/product-layouts.ts`, `src/lib/page-kinds.ts`, `src/lib/links.ts`, `src/lib/link-targets.ts`, `src/lib/link-references.ts`, `src/lib/rich-text/sanitize.ts` | §4.2 |
| `src/lib/whatsapp.ts`, `src/lib/whatsapp-server.ts` | seed, then hand to W |
| `src/lib/queries.ts` | the Phase-1 changes in §6.2, then hand to P |
| `src/lib/auth.ts`, `src/app/admin/actions/auth.ts` (`loginAction` only) | the §5.9 session-token change, then hand to W |
| `src/lib/card-swatches.ts`, `src/lib/dates.ts` | §4.2 |

**Routes**

| File | Action |
|---|---|
| `src/app/api/admin/uploads/route.ts`, `src/app/uploads/[...path]/route.ts` | §3.4, §3.5 |

**Admin shared**

| File | Action |
|---|---|
| `src/components/admin/ui.tsx`, `src/components/admin/icons.tsx`, `src/components/admin/upload-client.ts` | |
| `ImageUpload.tsx`, `ImageGallery.tsx`, `RichTextEditor.tsx`, `rich-text/*`, `LinkPicker.tsx`, `SortableList.tsx`, `ChipsInput.tsx`, `ColorSwatchPicker.tsx`, `UnsavedChangesGuard.tsx`, `ConfirmDialog.tsx`, `ConfirmDelete.tsx`, `ViewOnStoreLink.tsx`, `StickySaveBar.tsx` (all in `src/components/admin/`) | §4.4 |
| `src/components/admin/SubmitButton.tsx` | unchanged; F owns it |
| `src/components/admin/shell/Sidebar.tsx`, `src/app/admin/(panel)/layout.tsx` | §4.5 |
| `src/app/admin/(panel)/_catalog/ConfirmSubmit.tsx`, `_catalog/Pager.tsx` | keep. F2 deletes `ConfirmSubmit` if it's unused |
| `src/app/admin/actions/links.ts` (new) | |
| `src/app/globals.css` | only the `.admin-rte` block |
| `src/components/whatsapp/OrderOnWhatsApp.tsx` | stub, then hand to W |

**Action split.** This is a mechanical move with no behaviour change:

- `src/app/admin/actions/catalog.ts` → `products.ts` (P), `collections.ts` (B), `reviews.ts` (P). Delete
  `catalog.ts`.
- `src/app/admin/actions/content.ts` → `banners.ts` (B), `menus.ts` (B), `pages.ts` (C). Delete `content.ts`.
- Shared helpers go to `src/lib/slug.ts` and `src/lib/admin-guard.ts`. A `'use server'` file may only export async
  functions, so the helpers can't live in the action files.

**Phase-1 compile touches (mechanical only; the files then belong to their Phase-2 owner)**

- Import paths after the action split:
  - `admin/(panel)/products/page.tsx`, `products/[id]/page.tsx`, `products/_components/ProductForm.tsx`
  - `collections/page.tsx`, `collections/[id]/page.tsx`, `collections/_components/CollectionForm.tsx`
  - `reviews/page.tsx`, `banners/page.tsx`, `menus/page.tsx`, `pages/page.tsx`, `pages/[id]/page.tsx`
- `src/components/layout/menu.ts`: `child.badge === STACK_BADGE` → `!child.newColumn`.
- `src/app/(store)/page.tsx`: `getBanners()`, `card.inventory > 0 ? … : …` → `card.statusLabel`, and the select
  includes `status`.
- `src/components/catalog/ProductCard.tsx`: `product.inventory > 0` → `product.available`.
- `src/components/catalog/catalog-data.ts` and `src/components/product/pdp-data.ts`: wherever `ProductCardData`
  needs `available` and `statusLabel`, compute them from the selected `variants.status`. Add `status` to the selects.
  All the other logic stays (P rewrites it in Phase 2).
- **Magic-tag reads** (the migration's `product-flags` step removes these tags, so the reads must switch in Phase 1
  or the storefront loses its NEW labels, Limited Edition bars, FREE DELIVERY tag, delivery line and Discount %
  filter until P lands). Add `isNew`, `limitedEdition`, `deliveryTime` and `discountGroup` to the selects, then:
  - `catalog-data.ts` ~238–239: `isNew: p.isNew`, `limitedEdition: p.limitedEdition`.
  - `catalog-data.ts` ~302 (discount filter): `where.discountGroup = filters.discount` instead of the
    `discount=NN` tag match.
  - `(store)/products/[handle]/page.tsx` ~173–174: `isNew: product.isNew`,
    `deliveryLine: product.deliveryTime || null`.
  - Then `grep -rnE "New Arrivals|limited-edition|discount=|delivered in" src --include='*.ts' --include='*.tsx'`
    finds only comments.
- `src/components/layout/actions.ts`: only if a type error forces it.
- `src/app/(store)/blogs/news/[handle]/page.tsx`: only if a type error forces it.

**Phase-1 runbook (in order)**

1. Stop the dev server (`pkill -f "next dev"`) and back up `prisma/dev.db`.
2. Install the packages.
3. Apply the schema (§2.1).
4. `npx prisma db push`.
5. `npx prisma generate`.
6. Copy the data files.
7. Write the libs and the migration.
8. Update the seed and fidelity scripts.
9. `npm run db:seed`.
10. Run the migration again and expect all steps "skipped".
11. Do the compile touches (including the magic-tag reads), then restart the dev server.
12. Build the components and the `auth.ts` token change.
13. `npx tsc --noEmit` and the scripts tsc are both green; the §0.12 server-only grep is empty.
14. Take the **Phase-1 baseline** screenshots of `/`, `/collections`, `/collections/sofas-all`,
    `/products/alexa-sofa-chair`, `/blogs/news`, a blog post, `/pages/privacy-policy`, `/pages/review` and
    `/pages/lahore` at 1280 and 390, only **after** step 11, so the storefront already reads the new fields. Compare
    with screenshots taken before step 1: expected differences are limited to the fidelity data, now applied (§9
    R1), `/pages/review` losing its duplicate chrome, and the blog post page, which C fixes. Every Phase-2 "visually
    unchanged" check compares against this baseline.

The screenshots in step 14 count only if the NEW labels, Limited Edition bars and the FREE DELIVERY tag are visible
where they were before step 1.

F may create a throwaway `src/app/admin/(panel)/dev-components/page.tsx` to check the components, and must delete it
before hand-off.

### 7.3 F hand-off checklist

- `npx tsc --noEmit` and `npx tsc --noEmit -p tsconfig.scripts.json` pass.
- The dev server is up. `/`, `/collections`, a product page, the admin dashboard, and the admin products, menus,
  banners, pages and settings pages all return 200.
- Upload works end to end: `tests/admin/uploads.spec.ts` passes.
- The migration report is pasted into the hand-off notes, and a second run skips every step.
- Every component in §4.4 exists with the exact props and `data-testid`s.

### 7.4 Phase-2 ownership (exclusive)

**P: Products** (admin and storefront product/catalog)

- `src/app/admin/actions/products.ts`, `src/app/admin/actions/reviews.ts`
- `src/app/admin/(panel)/products/**`. Create `_components/ProductEditor.tsx`, `OptionsEditor.tsx`,
  `OptionValuesEditor.tsx`, `VariantsTable.tsx`, `BulkEditBar.tsx`, `CollectionsTree.tsx`, `AdvancedSection.tsx`, and
  `_lib/{types,variants,load,collections}.ts`. Delete `ImagesEditor.tsx`, `VariantsEditor.tsx` and `ProductForm.tsx`.
  Reuse `TitleSlugFields.tsx` or delete it.
- `src/app/admin/(panel)/reviews/page.tsx`
- `src/app/(store)/products/**`, `src/app/(store)/search/page.tsx`, `src/app/(store)/collections/[handle]/actions.ts`
- `src/components/product/**`, except `PreOrderModal.tsx` (W). This includes `data/templates.json`; delete the 3 data
  JSONs.
- `src/components/catalog/**`, except `rte.ts`, `CategoryTile.tsx`, `ExpandableRte.tsx` and
  `collections-index.json` (B) and `QuickAdd.tsx` (W). Delete the 4 catalog JSONs.
- `src/components/ui/Price.tsx`, `src/components/ui/Stars.tsx` (`formatRs` is frozen)
- `src/lib/queries.ts`, `src/lib/money.ts`
- `tests/admin/product-sofa.spec.ts`

**W: WhatsApp, cart removal, inquiries, dashboard, password**

- `src/lib/whatsapp.ts`, `src/lib/whatsapp-server.ts`, `src/lib/auth.ts`, `src/lib/constants.ts`, `src/lib/ratelimit.ts`
- `src/components/whatsapp/**` (`OrderOnWhatsApp.tsx`, `WhatsAppGlyph.tsx`, `log-click.ts`)
- `src/app/api/whatsapp-click/route.ts`, `src/app/track/route.ts`
- `src/app/layout.tsx`, `src/app/(store)/layout.tsx`
- `src/components/layout/Header.tsx`, `FloatingButtons.tsx`, `CartDrawer.tsx` (delete), `actions.ts`, `SearchPanel.tsx`
- `src/components/icons.tsx`, `src/components/product/PreOrderModal.tsx`
- `src/components/account/ui.tsx` (new), `src/app/(store)/account/**`
- Everything in the §5.7.6 removal list
- `src/app/admin/(panel)/page.tsx` (dashboard), `src/app/admin/(panel)/inquiries/**`, `src/app/admin/(panel)/account/**`
- `src/app/admin/actions/auth.ts`, `src/app/admin/actions/messages.ts`
- `src/app/admin/(panel)/messages/page.tsx`, `src/app/admin/(auth)/**`, `src/components/admin/shell/LoginForm.tsx`, `LogoutButton.tsx`
- `src/app/api/contact/route.ts` (no change expected)
- `tests/admin/whatsapp-order.spec.ts`

**C: Pages and blog**

- `src/app/admin/actions/pages.ts`
- `src/app/admin/(panel)/pages/**`, `src/app/admin/(panel)/blog/**` (new)
- `src/app/(store)/pages/**`, `src/app/(store)/blogs/**`
- `src/components/pages/**`, including `blog-data.ts` (new). The designed components (AboutPage, StoreLocator, …) are
  owned but **must not change**, with one allowed exception: the WhatsApp link in `FormPages.tsx` (§5.7.4).
- `tests/admin/blog-post.spec.ts`

**B: Banners, menus, settings, collections, footer, home**

- `src/app/admin/actions/banners.ts`, `menus.ts`, `settings.ts`, `collections.ts`
- `src/app/admin/(panel)/banners/**`, `menus/**`, `settings/**`, `collections/**` (including `arrange/page.tsx`
  (new). Delete `_components/ImageField.tsx`)
- `src/components/layout/Footer.tsx`, `menu.ts`, `MobileMenu.tsx`, `NewsletterForm.tsx`
- `src/components/home/**`, `src/app/(store)/page.tsx`
- `src/app/(store)/collections/page.tsx`, `collections/[handle]/page.tsx`, `collections/all-1/**`, `collections/frontpage/**`
- `src/components/catalog/rte.ts`, `CategoryTile.tsx`, `ExpandableRte.tsx`; delete `collections-index.json`
- `tests/admin/banner.spec.ts`, `tests/admin/menu-reorder.spec.ts`

**Unowned and not to be edited in Phase 2:** `src/middleware.ts`, `src/lib/db.ts`, `src/components/brand/**`,
`src/app/(store)/not-found.tsx`, `public/**`, `data/**`, `scripts/scrape*.mjs`, `scripts/download-images.mjs`,
`scripts/fidelity/landing.ts` and `berlin.ts`, `SPEC.md`, `README.md` (F2 updates them), and this spec.

### 7.5 Frozen cross-workstream contracts in Phase 2

These can't change signature or shape without the orchestrator:

- `getSettingsMap`, `getMenu` (`MenuNode = { id, label, href, newColumn, children }`), `getBanners()`,
  `getPageByHandle`, `toCard`, `displayPrice`, `listProducts` and `ProductCardData` in `src/lib/queries.ts`.
- `formatRs`.
- `OrderOnWhatsAppButton` props, `WhatsAppConfig`, `getWhatsAppConfig`, `buildProductMessage`,
  `normalizeWhatsAppNumber` and `waLink`.
- Every F library and component in §3–§4.
- P's catalog exports used by B's pages: the names and signatures of `getCatalogCollection` and `getCatalog`
  (`catalog-data.ts`), the `ProductGrid`, `InfiniteGrid` and `FilterBar` components and their props, and the
  `ProductCard` props (including `CardSwatch`). P may change their internals, not their call sites.
- `rateLimit` in `src/lib/ratelimit.ts` (W), used by F's upload route and P's review action.
- URL contracts: the products list `/admin/products?q=&status=published|draft|archived&photos=missing&availability=soldout&collection=<id>&page=`
  (§5.1.9) and the inquiries page `/admin/inquiries?range=1|7|30|90|all&kind=…&q=&page=` (§5.8).

If you need something new, put it in a new file you own.

### 7.6 Phase-2 hand-off checklist (each agent)

- Typecheck is clean for your files.
- Your Playwright spec passes against the dev server (without `E2E_EXCLUSIVE`; the global-state scenarios are
  skipped, §0.10). Scenarios that need another workstream's code (listed per spec in §8.2) may stay pending until
  F2; say which in your report.
- Screenshots at 390px and 1280px of every admin screen you built are checked by eye.
- There are no typed URL, HTML or JSON fields in your screens (§8.3 sweep, limited to your routes).
- The data files assigned to you are deleted, and `grep` shows no imports of them.
- Your storefront pages are visually unchanged, apart from the intended changes, against Phase-1 screenshots.
- You have a written list of anything you couldn't do and any change you need in someone else's file.

### 7.7 F2: integration (Phase 3, F's owner)

1. Merge-level typecheck. F2 may make minimal compile fixes in any file and must list them.
2. Run the §2.4 runbook: back up, export orders, apply the schema cleanup, push with `--accept-data-loss`, rename to
   `legacy*` in seed and migration, reseed, run the migration a second time and expect "skipped", restart the dev
   server.
3. Remove the order badge styles from `ui.tsx`, delete `ConfirmSubmit.tsx` if it's unused, delete unused functions
   in `queries.ts` (coordinate with P's final state), and update `README.md`: data pipeline, uploads (back up
   `storage/uploads` together with the DB), admin guide, and tests. Add a note at the top of `SPEC.md` pointing to
   this document and saying the cart and checkout sections are obsolete.
4. Write `tests/admin/no-typed-fields.spec.ts`, `tests/admin/mobile.spec.ts`,
   `tests/storefront/regression.spec.ts` and `tests/integration/whatsapp-e2e.spec.ts` (§8.2), and run the full suite
   with `E2E_EXCLUSIVE=1` (which also runs every global-state scenario skipped in Phase 2).
5. Launch the independent reviewers (§8.4) and fix or route what they find.

---------------------------------------------------------------------------------------------------------------------

## 8. Test plan

### 8.1 Infrastructure (F)

**`playwright.config.ts`:**

```ts
import { defineConfig, devices } from '@playwright/test';
const authFile = `tests/.auth/admin-${process.env.E2E_AGENT ?? 'default'}.json`; // per agent: no concurrent writes to one file
export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100', channel: 'chrome', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'admin', testMatch: /(admin|integration)\/(?!mobile).*\.spec\.ts/, dependencies: ['setup'], use: { storageState: authFile } },
    { name: 'admin-mobile', testMatch: /admin\/mobile\.spec\.ts/, dependencies: ['setup'], use: { ...devices['Pixel 7'], channel: 'chrome', storageState: authFile } },
    { name: 'admin-mobile-360', testMatch: /admin\/mobile\.spec\.ts/, dependencies: ['setup'], use: { ...devices['Pixel 7'], viewport: { width: 360, height: 740 }, channel: 'chrome', storageState: authFile } },
    { name: 'storefront', testMatch: /storefront\/.*\.spec\.ts/ },
  ],
});
```

There's no `webServer` block: the dev server is already running.

**Helpers:**

- **`tests/helpers/env.ts`:** `adminCredentials()` reads `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`, else parses
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `.env` with a small parser and no dependency.
- **`tests/admin/auth.setup.ts`:** log in through the UI and save `authFile`. Phase-2 agents set `E2E_AGENT` to
  their letter (`P`, `W`, `C`, `B`).
- **`tests/helpers/fixtures.ts`:** `makeImage(name, { width, height, color, format: 'jpeg'|'png', exif?: boolean })`.
  It uses sharp to write into `test-results/fixtures/`. With `exif: true`, it embeds GPS EXIF via
  `.withMetadata({ exif: { IFD3: { GPSLatitude: '31/1 31/1 0/1', GPSLatitudeRef: 'N' } } })`.
  `makeTextFileNamedJpg()` writes a fake `.jpg` that is really text.
- **`tests/helpers/admin.ts`:** `uniqueName(prefix)` → `"E2E <prefix> <timestamp>"`; `pickLink(page, pickerLocator, search, resultText)`;
  `uploadInto(locator, file)`; `saveBar(page)`; `apiUpload(request, file, purpose)`, which posts to
  `/api/admin/uploads` with `headers: { Origin: baseURL }` (Playwright's request context sends no `Origin` header,
  so without it the CSRF check returns 403).

**Test data hygiene:**

- Each spec creates its own rows with `uniqueName`, deletes them in `afterAll` through the admin UI or actions, and
  restores any order it changed.
- The specs run with `workers: 1` within a run, and Phase-2 agents serialise whole runs with the lock and skip the
  global-state scenarios (§0.10).
- Tests never change the admin password.

### 8.2 Specs (file → owner → scenarios)

**1. `tests/admin/uploads.spec.ts` (F)**

- Authenticated API calls go through `apiUpload` (which sends `Origin: baseURL`).
- An unauthenticated `POST /api/admin/uploads` (request context without storageState) → 401.
- An authenticated POST with no `Origin` and no `Sec-Fetch-Site` → 403; with `Origin: https://evil.example` → 403.
- A text file named `.jpg` → 415 with the friendly message.
- PNG 3000×1500 → 200. The URL matches `^/uploads/\d{4}/\d{2}/[a-z0-9-]+-[0-9a-f]{8}\.webp$`. `GET` returns
  `image/webp`. Its dimensions (via sharp in the test) are 2000×1000.
- JPEG with GPS EXIF → the stored file has no `exif` in `sharp().metadata()`.
- `GET /uploads/../../.env` and `/uploads/2026/10/x.webp` (an invalid key) → 404.
- Orphan rule: upload A, then save a test banner with A. Replace it with upload B and save → A returns 404 and B
  returns 200. Delete the test banner → B returns 404 too.

**2. `tests/admin/product-sofa.spec.ts` (P)**: decision 30, "create a sofa with Size × Color …"

- New product: title `uniqueName('Sofa')` and delivery time.
- Turn on options. Add "Size" with values `1 Seater`, `3 Seater`, and "Color" with `Grey`, `Blue`. Assert the 4
  combinations are listed.
- Pick a swatch for Grey from the palette.
- Bulk: "Set all prices" regular 100000. Then "Apply to all 3 Seater" regular 150000, sale 120000. Set the status of
  `Blue / 1 Seater` to Pre-order.
- Upload 2 photos (through the gallery's file input) and tag photo 2 "Shows: Color: Blue".
- Description: type text, apply Bold, make a bullet list, and add a link with the LinkPicker to a collection.
- Collections: tick "Sofas".
- Visibility: tick New arrival and pick the layout "Sofas".
- **Publish.** Record every `[data-testid=variant-row]` `data-variant-id` and every `[data-testid=gallery-item]`
  `data-image-id` (all non-empty now, without reloading: the editor took them from the save result, §5.1.2).
- **Ids survive edits, without reloading:**
  - Rename `Grey` → `Charcoal`. Assert the combinations are renamed. Add the value `2 Seater` to Size. Save.
  - Assert the recorded variant and image ids are unchanged (the renamed rows keep theirs), and the 2 new
    `2 Seater` rows now have ids. Record them.
  - Change one price and save again, still without reloading. Assert every id, including the `2 Seater` rows', is
    unchanged and no "changed somewhere else" message appeared.
- Reload. Everything persists, and the ids still match.
- Storefront `/products/<handle>`:
  - The title, the NEW label and the price "Rs.100,000" are shown.
  - Selecting `3 Seater` shows "Rs.120,000" and the struck "Rs.150,000".
  - Selecting `Blue` makes the first gallery image src equal photo 2. `Blue / 1 Seater` shows "Ask about
    availability" (needs the `OrderOnWhatsAppButton` stub wired into `ProductMain`, which P does).
  - The description has `<strong>`, `<ul>` and the link.
  - The card appears in `/collections/sofas-all` (or whichever "Sofas" collection was ticked) with the "Ready to
    ship" bar.
- Remove the value `1 Seater` → the `confirm-dialog` lists 2 combinations (`1 Seater / Charcoal`,
  `1 Seater / Blue`). Cancel, and assert both rows are still there.
- Delete the product (the ConfirmDelete text mentions the combinations and photos) → the storefront returns 404.

**3. `tests/admin/banner.spec.ts` (B)**

- Create a banner: upload a desktop (1200×462) and a mobile (450×700) image, pick the link "Collection · Cushions"
  with the LinkPicker search, turn it on, and save.
- Assert the LinkPicker shows "Collection · Cushions" and never `/collections/cushions` in visible text.
- The home page has a slide `<a href="/collections/cushions">` whose `<img src>` starts with `/uploads/`, and whose
  `<source media="(max-width: 767px)">` has the mobile URL.
- **Unsaved-changes guard on a hidden-input-only change:** open the banner's edit form, change **only** the desktop
  image (upload a new one), click the "Menus" sidebar link → a `confirm` dialog appears (accept `page.on('dialog')`
  with dismiss, and assert the URL is still `/admin/banners`). Then save.
- After that save → the old desktop upload URL returns 404.
- While the form is open, the drag handles and arrows are disabled.
- Reorder the new banner to first place with the "Move up" buttons, then "Save order" → it's the first slide on home.
  Restore the original order in `finally` (§0.10).
- Delete it (the confirmation text mentions photos) → it's gone from home, and the uploads return 404.

**4. `tests/admin/menu-reorder.spec.ts` (B)** (runs under the lock; restores the order in `finally`)

- Tab Footer “Customer Support”: the hint mentions “User Area”. Record the order. Move item 3 to position 1 with
  "Move up" twice and save → the storefront footer "User Area" column shows that label first.
- Drag item 1 below item 2 with the drag handle (mouse) and save → the storefront order matches.
- Delete an item → the `confirm-dialog` says "Removed when you save."; cancel it.
- Main menu: find a column heading with "Start a new column in the dropdown" and assert the checkbox state of
  Recliners is unchecked (migrated STACK).
- Restore the original order and save. Assert the storefront order is back.

**5. `tests/admin/whatsapp-order.spec.ts` (W)**: only W-owned behaviour, so it can pass in Phase 2 without P's or
B's work:

- `buildProductMessage` (imported directly; `src/lib/whatsapp.ts` is client-safe) with a fixed config and the §5.7.1
  example input returns exactly the example text, line by line, including the trailing space of the closing line. A
  second case: `kind: 'AVAILABILITY'`, `statusLabel: 'Pre-order'`, `price: 0` → availability greeting first,
  `Price: on request`, `Status: Pre-order`.
- `normalizeWhatsAppNumber`: `+92 309 2050463`, `0309-2050463`, `923092050463`, `3092050463` → `923092050463`;
  `042 111 111 111` and `''` → null.
- `/cart` → lands on `/`. `/checkout` → `/`. `/track` (with `maxRedirects: 0`) → 302 with a `Location` starting
  `https://wa.me/923092050463?text=`. A `/track` request with header `Next-Router-Prefetch: 1` also redirects but adds
  no inquiry row.
- The header has no cart icon (`a[href="/cart"]` count 0).
- `POST /api/whatsapp-click` with a `text/plain` JSON body `{ kind: 'ORDER', productId: <alexa id>, variantId, quantity: 2, path: '/products/alexa-sofa-chair' }`
  → 204; `/admin/inquiries` shows a new row with the product, the options, qty 2 and "Product page" as the source.
  The dashboard's "most asked-about" includes it.
- The floating bubble's link is `https://wa.me/923092050463?text=…` with the general question text.

**5b. `tests/integration/whatsapp-e2e.spec.ts` (F2)**: the scenarios that need P's product page and B's Settings:

- Storefront `/products/alexa-sofa-chair`: wait for `[data-testid=order-on-whatsapp][data-ready=true]`, pick a
  colour (the second swatch) and set qty 2.
- Capture the WhatsApp URL with
  `const req = context.waitForEvent('request', r => r.url().startsWith('https://wa.me/'))` (after
  `context.route('https://wa.me/**', r => r.abort())`), click "Order on WhatsApp", and parse `(await req).url()`. Do
  not read `popup.url()`: an aborted navigation reports `about:blank` or an error URL.
- Assert the `text` param **equals** the template built from the visible state, line by line: the greeting,
  `*Alexa Sofa Chair*`, `Color: <selected>`, `Quantity: 2`, `Price: Rs.<n> each…`,
  `<page origin>/products/alexa-sofa-chair?variant=<id from the page URL>`, and
  `Please confirm availability and delivery to my city: `.
- A product with a PRE_ORDER variant shows "Ask about availability", and its message starts with the availability
  greeting and contains `Status: Pre-order`.
- `/admin/inquiries` shows the click with qty 2.
- `E2E_EXCLUSIVE` only: Settings: clear the number and save → the storefront has no Order button and no floating
  bubble, and the admin shows the yellow banner. Restore `0309 2050463` (in `finally`) → stored as
  `923092050463`, and the buttons are back.
- `E2E_EXCLUSIVE` only: Settings: set Facebook to `https://www.facebook.com/e2e-test` and save → the footer has
  exactly one `a[aria-label=Facebook]` with that href. Restore the previous value in `finally`.

**6. `tests/admin/blog-post.spec.ts` (C)**

- Create a post with title, date, author, featured image upload, content with a Subheading, tags `Design Ideas` and
  `E2E Tag`, and publish.
- `/blogs/news` shows the card with the image and date. The post page shows the date, author, image, tags and
  content.
- `/blogs/news/tagged/e2e-tag` lists it.
- Delete the post → the tag page returns 404.
- Open the designed page "about-us" in the admin → it shows the "This page has a custom design" notice and has no
  editor.
- Edit the TEXT page "privacy-policy" → the editor shows clean content: no `<!doctype`, and the editor's HTML has no
  `class=`.

**7. `tests/admin/no-typed-fields.spec.ts` (F2).** For every admin route — dashboard, inquiries, products list, a
product edit, new product, collections list, a collection edit, arrange, banners (with the form open), each menus
tab, pages list, a TEXT page, a DESIGNED page, blog list, a blog edit, settings and password — assert:

- 0 × `input[type=url]`.
- 0 visible `textarea`.
  - Exceptions: the settings Address field (`name="address"`), the SEO description (`name="seoDescription"`), and
    review/message bodies, which are read-only.
- 0 visible inputs whose `placeholder` or `value` starts with `/`, `http` or `{`, or whose value looks like
  `<…>` or JSON.
  - Exceptions: inputs inside `[data-testid=link-picker] [data-custom-url]`, and the social link fields.
- 0 elements whose visible label text matches `/json|html|handle|position|compare-at|metafield|badge/i`.
  - Exception: "Web address" in Advanced.
- 0 `input[type=number]` labelled Position.

**8. `tests/admin/mobile.spec.ts` (F2).** Runs in two projects: Pixel 7 (412px) and `admin-mobile-360` (360×740,
the §0.8 minimum). For the same routes,
`document.documentElement.scrollWidth <= window.innerWidth + 1`. The product editor's sticky save bar is visible and
in the viewport. Reorder a banner using the arrow buttons. Open the LinkPicker → the sheet is visible.

**9. `tests/storefront/regression.spec.ts` (F2)**

- Home: the slider has ≥1 slide and the "Hot Selling Products" and "Shop by Category" sections are present.
- `/collections`: the first card's title is "Home page", the second "Furniture", and the card count matches
  `CollectionIndexCard`.
- `/collections/sofas-all`: 4-column grid, and the status bars contain only the 3 allowed labels.
- Alexa Sofa Chair: swatches, SKU, price.
- Blog post `/blogs/news/local-ingenuity-global-standards`: date, author, featured image, YouTube iframe from
  `youtube-nocookie.com`.
- `/pages/privacy-policy` **and** `/pages/review`: exactly 1 `<title>`, 1 announcement bar, 1 site header, 1 footer,
  no `<html` inside main.
- Home "Hot Selling Products": the Alexa Sofa Chair card's swatch colours equal its `ProductOptionValue.swatchColor`
  values (read through a test-only query or the admin product page).
- `/pages/about-us`: the AboutPage marker is present.
- The footer shows the address and has no `href="#"` social links.
- `/pages/track-your-order` → ends at wa.me.

### 8.3 Manual review checklist (each owner for their area; reviewers for everything)

**Typed URL/HTML/JSON sweep.** Code grep:

```
grep -rnE 'type="url"|font-mono|JSON\.parse\(String\(formData|placeholder="/|placeholder="https?:|Options \(JSON\)|Body \(HTML\)|name="(options|bodyHtml|variantsJson|imagesJson|position|badge|location)"' src/app/admin src/components/admin
```

It must return nothing, except `LinkPicker`'s custom URL input and the hidden inputs written by components. Also:

```
grep -rn "wa\.me/" src | grep -v src/lib/whatsapp.ts      # must return nothing (every WhatsApp link uses the Settings number)
```

**Every edit page has:**

- View on store.
- The unsaved changes guard. Test it twice: edit a text field, and separately change **only** an upload, a picked
  link, the rich text or a chip, then click a sidebar link → a confirm dialog appears both times. Simply opening the
  page and leaving must **not** ask (the editor's initial normalisation doesn't count as a change).
- A sticky save bar.
- ConfirmDelete with consequences, including the review delete (P) and message delete (W) (§5.10). Local
  removals (option values, menu items, Arrange "Remove from page") use `ConfirmDialog` with "Removed when you
  save."

**Phone at 360px:** every page, product editor variants as cards, LinkPicker sheet, drag with the arrows, rich-text
toolbar wrapping.

**Labels:**

- "Regular price" / "Sale price" (never "Compare-at").
- "Shows".
- "Page layout" with readable names.
- "Start a new column in the dropdown".
- "Web address" only in Advanced.

**Uploads:** JPG, PNG, WebP and **a real iPhone HEIC** (manual, since the e2e can't generate HEIC) → WebP with the
longest side ≤ 2000. A 25 MB file → the friendly error. A photo with GPS → stripped.

**Storefront regression at 1280 and 390** for home, `/collections`, a collection, a product with swatches, a product
with sizes, search "sofa", blog index and post, privacy policy, about-us, a city page (`/pages/lahore`), and the
footer. Compare with the Phase-1 screenshots.

**Seed parity:**

1. Back up the database.
2. `npm run db:seed`.
3. Dump the tables (counts plus checksums of `Variant.status` and `ProductImage.optionValueId` per product,
   `Page.kind`, `CollectionIndexCard` order).
4. Compare with the dump taken before reseeding → identical, apart from rows created by tests.

**Performance:** the product page and collection page server time stays within +20% of Phase 1 (check `dev.log`
timings for 5 requests each).

### 8.4 Independent reviewers (after F2)

Spawn one reviewer each for Products, WhatsApp/cart removal, Content (pages and blog), Banners/Menus/Settings/
Collections, and Uploads/Security. Each one:

- Reads this spec section.
- Tries to break the area: odd input, double submits, two tabs, rename while tagged, removing values, huge images,
  bad links, deleting referenced items, phone viewport.
- Runs the §8.3 sweep for their routes.
- Reports findings with reproduction steps.

A "sweep reviewer" greps the whole `src/app/admin` and `src/components/admin` for anything a user could type as a
URL, HTML or JSON, and checks every storefront consumer of the deleted data files.

---------------------------------------------------------------------------------------------------------------------

## 9. Risks and edge cases (with chosen resolutions)

| # | Risk / edge case | Resolution |
|---|---|---|
| R1 | Reseeding the dev database applies the fidelity scripts it never had: 3 hero banners deactivated, fake reviews replaced by the 40 live-reviewed products, collection descriptions/images/product order filled, clean policy pages. That changes what the storefront shows compared with today. | Intended. The README already requires these after every seed, and the storefront rebuild targets that state. F takes Phase-1 screenshots **after** the reseed as the regression baseline. |
| R2 | 11 products are "Ready to ship" on the live card but all their in-stock variants are pre-order. With status-driven labels their card now says "Pre-Order". `nexis-side-table` ("Coming Soon") becomes "Pre-Order". | Accepted. The data is self-consistent now, and the PDP was already showing PRE-ORDER for them. |
| R3 | `MADE_TO_ORDER` (58 kitchens, doors and built-in wardrobes) has no card bar on live. | `cardStatusLabel` returns null for MADE_TO_ORDER-only products (live parity). The PDP shows "Made to Order" in the delivery line, so the label is still status-driven. |
| R4 | Card stars were driven by `live-card-data.ratings` (40 products). | `showRating = reviewCount > 0`, `rating = Product.rating`. Product fidelity (in the seed) imports exactly those 40 products' live reviews, so the set matches 40/40. A database migrated without a reseed keeps its seeded reviews and shows more stars. That's documented in the README. |
| R5 | Admins change prices in "Regular/Sale" terms, but the data stores price/compareAt. Some rows have `compareAtPrice <= price` (hidden on the storefront). | They load as Regular = price with an empty Sale. Saving drops the meaningless compareAt. No visible change. |
| R6 | Renaming or removing option values while photos are tagged. | Tags reference the value key or id. A rename keeps the tag. A removal sets the tag to "Any option" (client) and SetNull (database). |
| R7 | The same image is used by two products (duplicate) or by the product and its description. | The reference scan, not a refcount, decides deletion. A file is deleted only when no reference remains. |
| R8 | A photo is uploaded but the form is never saved. | The 24-hour orphan sweep removes it. Uploads younger than 24 hours are never swept, so a long editing session is safe. |
| R9 | A HEIC from Android or iPhone is in a HEIF variant that heic-decode can't decode. | Return 422 "This photo could not be read. Try exporting it as JPG." |
| R10 | A huge PNG (decompression bomb). | `limitInputPixels: 270M` (large enough for 50–200 MP phone photos, which get their own "too large in pixels" message above it), the 20 MB byte cap, and `failOn: 'error'`. |
| R11 | Two admins or tabs edit the same product. | `updatedAt` optimistic check (`code: 'STALE'`) with "Reload latest" and "Save mine anyway" buttons (§5.1.2). Menus and banners: last write wins (low risk, one admin). |
| R12 | Handle (web address) rename breaks inbound links and menu links. | A warning under the field. The LinkPicker flags missing targets in red on Menus and Banners, so broken links are visible. Delete confirmations count the links that point there. No automatic redirects (out of scope). |
| R13 | Deleting a collection used by home tiles (`CATEGORY_TILE_HANDLES`) or hot selling (code lists). | Those lists skip missing rows already (`filter(Boolean)`). The confirmation counts menu links. Acceptable. |
| R14 | Legacy section-markup pages (city pages and others) contain unsanitised Shopify markup; `review` is even a whole Shopify document with its own header, footer and `<title>`. | They're DESIGNED, not editable, and render as today (`cleanBodyHtml`). The content came from our own scrape, not from users. The migration strips whole-document bodies (`review`) to their `<main>` content (§2.5.4 step 9), and the regression spec checks `/pages/review` has one title, header and footer. |
| R15 | Policy pages contain tables (shipping-and-delivery, rewards), and the editor has no tables. | `tableToLists` converts them once, during the migration. The content stays readable. Check visually in review (§8.3). |
| R16 | The blog's one YouTube iframe. | It's converted to the Tiptap youtube node markup (`div[data-youtube-video] > iframe` with the nocookie src). The sanitiser allows only YouTube embed URLs. |
| R17 | The session token format changes, so existing sessions are invalidated. | Accepted: one extra login. F makes the change in Phase 1, before Phase-2 agents log in. Tests log in through the setup project, one storage-state file per agent. |
| R18 | Reseeding resets the admin password to `.env`. | Documented in the README. The Change Password page notes "If the database is re-seeded, the password from the .env file is restored." |
| R19 | A WhatsApp number that isn't a Pakistani mobile (the old seeded value is a UAN landline). | The migration replaces any invalid value with `923092050463`. The Settings validation accepts only `923XXXXXXXXX`. Empty hides the buttons and shows the yellow admin banner. |
| R20 | Logging click spam. | 30 per minute per IP, silently ignored beyond that. No personal data is stored. |
| R21 | `sendBeacon` is blocked by an ad blocker, so clicks are lost. | Acceptable. The click still opens WhatsApp, because logging never blocks navigation. |
| R22 | The orders table might hold data on some server. | F2's `--export-orders` writes JSON before the drop. Today the dev database has 0. |
| R23 | Parallel agents share one dev database and dev server, and tests mutate data. | Unique names, clean-up in `afterAll`, `workers: 1`, a lock around every Playwright run, store-wide-setting scenarios only in F2, reorders restored in `finally`, per-agent auth files, and no reseed or schema change in Phase 2 (§0.10). |
| R24 | Middleware buffers bodies on `/admin/*`, and server actions are limited to 10 MB. | Uploads go to `/api/admin/uploads` (not matched by the middleware) and the route handler does its own auth and Origin check. |
| R25 | Tiptap is client-only (SSR mismatch). | `immediatelyRender: false`. The editor renders a skeleton until mounted, and the hidden input carries the initial HTML so a submit before mount loses nothing. |
| R26 | `MenuItem` spacers (blank label) couldn't be saved before. | They're explicit spacer items in the menu editor, allowed only at MAIN depth 2. |
| R27 | FOOTER_SEO group headings have `href '#'`, and the child "Vases & Bowls" has `'#'`. | Group titles have no link field (stored as `''`; the storefront renders titles as text already). `normalizeHref('#')` → `''`. The migration's menus step also rewrites `href = '#'` to `''`. `Footer` and `Header`/`MobileMenu` (B, W) render an item with an empty href as a `<span>` with the same classes, so it looks the same with no dead link. W adds this to Header; B to Footer and MobileMenu. |
| R28 | `tsconfig.json` excludes `scripts/` and `prisma/seed.ts`, so migration bugs would escape tsc. | `tsconfig.scripts.json` plus a dry-run of the migration in F's checklist. |
| R29 | `sharp` and `heic-decode` get bundled into the server build. | `serverExternalPackages` in `next.config.mjs`. Inside `src/`, both are imported only from `src/lib/uploads.ts` (`import 'server-only'`); the migration and test fixtures import `sharp` directly under `tsx`. |
| R30 | Seed parity: the migration must reach identical results whether fidelity ran or not. | Steps read the database's current state. The dev path always reseeds (seed → fidelity → migration). The parity check is in §8.3. |
| R31 | Accepted storefront differences (the complete list; anything else is a regression, §0.9). | (1) Cart icon, cart drawer, ADD TO CART → ORDER ON WHATSAPP / ASK ABOUT AVAILABILITY, the Pre-order badge and Made to Order line (§5.7, §5.1.10). (2) Footer address and social icons (§5.6; socials start empty). (3) Fidelity data applied by the reseed (R1) and status-driven card labels (R2). (4) `/pages/review` without its duplicate header, footer and title. (5) Policy pages: tables become lists (R15), and the `.sub-title` class on 34 policy headings is dropped by the sanitiser (decision 15), so those headings lose that class's styling; heading levels are kept. (6) Hot-selling cards: the ringed swatch follows the first photo's tag, and the struck compare-at price shows wherever the variants have one (§5.2.4). Heading sizes in collection descriptions, blog posts and policy pages do **not** change (§4.2). |

---------------------------------------------------------------------------------------------------------------------

## Appendix A: decision → implementation map

| # | Decision (short) | Where |
|---|---|---|
| 1 | Uploads on disk, `/uploads` route, swappable storage | §3.1–3.5 (F) |
| 2 | sharp: 2000px, WebP, strip EXIF; JPG/PNG/WebP/HEIC ≤ 20 MB | §3.3 (F) |
| 3 | Every image URL field → upload; unreferenced uploads deleted, bundled never | §3.6, §4.4 ImageUpload/ImageGallery, §5 |
| 4 | Product page sections, sticky save, draft/publish, duplicate | §5.1.3, §5.1.7 (P) |
| 5 | Options → variants generator, bulk, rename, remove | §5.1.5 (P) |
| 6 | Variant status drives the labels; optional stock | §2.2, §5.1.10 (P), `variant-status.ts` (F) |
| 7 | Colour picker or swatch photo, neutral fallback | ColorSwatchPicker (F), §5.1.5, §5.1.10 (P) |
| 8 | Photo "Shows" tag switches the gallery | ImageGallery (F), §5.1.10 (P) |
| 9 | Advanced section: slug, SKU, weight, vendor, type, tag chips | §5.1.3 (P) |
| 10 | New arrival / Limited edition checkboxes | §2.5 step 3, §5.1.3 |
| 11 | Page layout dropdown, 18 readable names | `product-layouts.ts` (F), §5.1.3 (P) |
| 12 | Drag and drop plus arrows everywhere | SortableList (F); variants, photos, banners, menus, collections index |
| 13 | Save in place, ids kept | §5.1.6 (P) |
| 14 | Tiptap editor with the toolbar; sanitise on save and on render | §4.2 sanitize, §4.4 RichTextEditor (F), consumers (P/B/C) |
| 15 | Policy pages converted once to rich text | §2.5 step 9 (F), §5.3 (C) |
| 16 | Blog fields | §2.1 Page, §2.5 step 9, §5.3.3–5.3.4 (C) |
| 17 | Designed pages: SEO and publish only | §5.3.1–5.3.2 (C) |
| 18 | No typed JSON or HTML | §0.7, §8.2 #7, §8.3 |
| 19 | Banner = desktop and mobile upload + link + on/off + order | §5.4 (B) |
| 20 | Link picker everywhere | §4.2 links, §4.4 LinkPicker (F), §5.4–5.6 |
| 21 | Menu tabs; STACK → "Start a new column" | §5.5 (B), migration step 11 |
| 22 | Settings: address and socials in footer, announcement, no shipping fees | §5.6 (B) |
| 23 | Data files → DB, then deleted | §2.5, §6, `card-swatches.ts` (F), hot-selling cards from the DB §5.2.4 (B) |
| 24 | Remove cart, checkout, track, orders; redirects | §5.7.5–5.7.6 (W), §2.4 (F2) |
| 25 | ORDER ON WHATSAPP and availability button; no card button; bubble | §5.7.2, §5.7.4 (W), §5.1.10 (P) |
| 26 | Exact message template; greeting and closing editable | §5.7.1 (W), §5.6 (B) |
| 27 | Number 923092050463, validation, test link, hidden when empty, yellow banner | §2.5 step 13, §5.6, §4.5 |
| 28 | Click log, inquiries page, dashboard | §5.7.3, §5.8 (W), complaint-form link §5.7.4 (C) |
| 29 | Backup, idempotent migration, seed parity, unsaved guard, delete consequences, View on store, change password | §2.5–2.6, §4.4, §5.9 |
| 30 | Playwright specs and reviewers | §8 |

---------------------------------------------------------------------------------------------------------------------

## Appendix B: review log

Self-review round 1. Every finding was accepted unless marked otherwise. Where a finding offered alternatives, the
chosen one is named.

| # | Finding (section) | Resolution |
|---|---|---|
| 1 | Save contract leaves `id: null` / stale `updatedAt` in client state (§5.1.2, two reports) | Accepted. `saveProductAction` returns the full reloaded `ProductEditorState`; the client replaces its state, and the server page keys the editor on `updatedAt`. Test: add a value, save, save again without reloading, ids unchanged (§8.2 #2). |
| 2 | `review` is a whole Shopify document (§5.3.1, R14) | Accepted (keep DESIGNED, strip to `<main>` in the migration; regression check added). |
| 3 | Unassigned consumers of F2-dropped columns (§6.2) | Accepted. `actions.ts` (W), blog route (C), admin collections list (B), `home.ts`/`global.ts` (F2 runbook step 5). |
| 4 | Hot-selling hard-codes swatches/prices/stars (§1.2) | Accepted (§5.2.4, shared `card-swatches.ts`). A per-handle `salePercent` override is kept for parity. |
| 5 | `FormPages.tsx` hard-coded `wa.me` number (§5.7) | Accepted (C's allowed change, §5.7.4; grep added to §8.3). |
| 6 | Sanitiser remaps h1/h4–h6, changing sizes (§4.2, two reports) | Accepted, choosing "keep existing levels": the sanitiser allows h1–h6 and the editor schema keeps them, while the toolbar still creates only two sizes. The alternative (h4 → `<p><strong>`) was rejected because it still changes how migrated content looks. |
| 7 | Seed wipes `Upload`, leaking files (§2.6/§3.6, two reports) | Accepted, both fixes: the seed keeps `Upload` rows, `StorageBackend.list()` lets the sweep reconcile the disk, and the row is inserted before `put`. |
| 8 | Reviews/messages deletes lack consequences (§5.10) | Accepted. |
| 9 | Socials seeded empty; test can't detect a broken feature (§5.6) | Accepted: they start empty (the store's real profiles are unknown and interwood.pk's belong to another business), and an F2 test sets and restores Facebook. |
| 10 | Menu hrefs with `?page=1` resolve as missing (§4.2) | Accepted (pathname matching; the migration strips bare `?page=1`). |
| 11 | Sofa spec compares ids before the first save (§8.2) | Accepted (reordered; `data-variant-id`/`data-image-id` added to contracts). |
| 12 | Phone banner image lacks `purpose` (§5.4) | Accepted. |
| 13 | Blog post content not sanitised on render (§5.3.4) | Accepted. |
| 14 | Footer tab names don't match storefront headings (§5.5) | Accepted (hints under each tab). |
| 15 | Inquiries table shows raw paths; no time zone (§5.8, two reports) | Accepted ("From" column; `dates.ts` in Asia/Karachi). |
| 16 | Link references ignore rich text (§4.2) | Accepted (`richText` count). |
| 17 | `'server-only'` breaks tsx scripts (§4.2) | Accepted (§0.12; `server-only` package added). |
| 18 | Migration removes tags that Phase-1 code still reads (§2.0) | Accepted (F switches the four reads in Phase 1; baseline taken after). |
| 19 | CSRF Origin check breaks API tests and proxies (§3.4) | Accepted (host vs `X-Forwarded-Host`/`Host`; `Sec-Fetch-Site`; `apiUpload` sends `Origin`). |
| 20 | Hidden inputs never mark forms dirty (§4.4, two reports) | Accepted (bubbling `input` dispatch on user changes only; editor writes only on user transactions). The MutationObserver/polling alternative was rejected as noisier. |
| 21 | `required` can't work on hidden inputs (§4.4, two reports) | Accepted (sr-only proxy input plus server check). |
| 22 | `ConfirmDelete` nested inside edit forms (§4.4) | Accepted (portal). |
| 23 | sharp pixel limit too low; slow HEIC path (§3.3) | Accepted (270 MP limit with its own message; `heic-decode` raw RGBA, replacing `heic-convert`; one HEIC decode at a time). |
| 24 | Parallel Phase-2 test runs interfere (§7/§8, R23, two reports) | Accepted with one change: a lock serialises whole runs and store-wide-setting scenarios are F2-only, but reorder scenarios are **not** skipped in Phase 2. With the lock no other run can observe them, and B's specs would otherwise prove nothing until F2. The auth-token change moved to F (Phase 1); auth files are per agent. |
| 25 | Next 15 `params` is a Promise (§3.5) | Accepted (§0.11 and §3.5). |
| 26 | dnd-kit SSR ids, sensor conflict, missing horizontal layout (§4.4, two reports) | Accepted (`useId`, Mouse+Touch sensors, handle-only activator, `horizontal` layout, `arrowLabels`). |
| 27 | Tiptap/sanitiser round trip: YouTube div check, `justify` (§4.2) | Accepted (`exclusiveFilter`; `justify` in the schema without a button). |
| 28 | `sendBeacon` content type; `/track` logs prefetches and bots (§5.7) | Accepted. |
| 29 | Value/image ids not ownership-checked (§5.1.6) | Accepted (step 0; same rule in `saveCollectionIndexAction`, banner reorder). |
| 30 | `db push` with the dev server running (§2.1, §7.2) | Accepted (stop first, in both runbooks). |
| 31 | WhatsApp spec reads `popup.url()`; clicks before hydration (§8.2) | Accepted (`waitForEvent('request')`, `data-ready`). |
| 32 | No non-form confirm dialog for local removals (§4.4) | Accepted (`ConfirmDialog`, wrapped by `ConfirmDelete`). |
| 33 | W's spec depends on P and B (§7.6) | Accepted (split: W tests its own behaviour; the end-to-end PDP and Settings scenarios move to F2's `tests/integration/whatsapp-e2e.spec.ts`). |
| 34 | Draft validation too strict; undefined `field` format (§5.1.4) | Accepted. |
| 35 | Sweep regex vs mandated copy; SEO description control (§8.2 #7) | Accepted (Best seller label reworded; SEO description is a `TextArea`, excepted by name). |
| 36 | Unfrozen cross-workstream exports and URL contracts (§7.5) | Accepted. |
| 37 | Missing shared toggle, tabs and counter (§4.3) | Accepted (`ToggleSwitch`, `Tabs`, `maxLength`/`showCount`). |
| 38 | Settings save doesn't revalidate (§5.6) | Accepted. |
| 39 | Options toggle off and stale-save dead ends (§5.1.5) | Accepted. |
| 40 | Banners page has two save mechanisms (§5.4) | Accepted (one at a time; one save bar). |
| 41 | Save bar and overlay layering on phones (§4.4) | Accepted (z-layers, safe area, short labels, hidden while typing). |
| 42 | Blog image `src: null` (§5.3.4) | Accepted. |
| 43 | New TEXT page discoverability and slug collisions (§5.3.2) | Accepted. |
| 44 | Raw setting keys as labels (§5.6) | Accepted. |
| 45 | 360px never tested (§8.2 #8) | Accepted (`admin-mobile-360` project). |

