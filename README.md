# Cozy Furnitures — Full-Stack Next.js E-Commerce

A faithful full-stack clone of the original site (a rebranded furniture store): storefront + backend + admin panel, seeded with the real catalog scraped from the live site.

## Stack

- **Next.js 15** (App Router, TypeScript, server components + server actions)
- **Tailwind CSS 3.4** — the live theme's tokens (`tailwind.config.ts`, `src/app/globals.css`): accent `#103a3a`, accent2 `#c25b41`, cream `#f6f6f0`
- **Prisma + MySQL/MariaDB** — local database in Docker (`docker-compose.yml`), Hostinger MySQL in production; schema changes ship as migrations in `prisma/migrations/`. Deploying: [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md)
- **NextAuth-free auth** — HMAC-signed httpOnly cookie sessions (admin)

## Running the shop: admin guide

This section is for the shop owner. No technical knowledge is needed: you never type web addresses, HTML or code.
Everything works on a phone too.

### Signing in

Open `/admin` on your site (for example `https://yourshop.pk/admin`) and sign in with your email and password.
To change the password, use **Change password** at the bottom of the left-hand menu (under your name). If a developer re-seeds the database,
the password goes back to the one in the `.env` file.
You stay signed in for 12 hours. If that runs out (or your password is changed on another device) while a page is
open, pressing **Save** asks for your password first and then saves — nothing you typed is lost.

The left-hand menu (the ☰ button on a phone) has: Dashboard, WhatsApp inquiries, Products, Product page layouts, Collections, Reviews,
Home banners, Menus, Pages, Blog posts, Messages and Settings. Every edit page has a **See it on the store** link,
a save bar that stays at the bottom of the screen, and a warning if you try to leave with unsaved changes.

### Adding a product

1. **Products → Add product.**
2. **Basics**: type the title. The web address is made from the title for you.
3. **Photos**: tap **Upload** and choose one or more photos (JPG, PNG, WebP or iPhone HEIC, up to 20 MB each).
   They are resized and cleaned automatically. Drag photos to change the order (or use the ↑ ↓ arrows on a
   phone); the first photo is the main one.
4. **Description**: write it in the editor. The toolbar has bold, italic, underline, two heading sizes, lists,
   links, alignment, text colour, photos and YouTube videos.
5. **Options & prices**: see below. A product without options just has one Regular price, an optional Sale price
   (leave it empty when it is not on sale) and a Status.
6. **Collections**: search and tick the collections the product belongs to.
7. **Visibility**: tick **New arrival** or **Limited edition** to show those labels, and pick a **Page layout**
   (the sections shown below the description, such as big photos, icons and customer quotes). Under the list you
   see what the layout contains and how many products use it, with a link to edit it. See
   [Product page layouts](#product-page-layouts) below.
8. Press **Publish** to put it on the store, or **Save as draft** to keep it hidden while you work on it.

**Advanced** (closed by default) holds the web address, SKU (left empty, one is made for you), weight, brand,
product type and search keywords. You rarely need it.

To copy an existing product, open it and press **Duplicate**: the copy starts as a draft.
Deleting a product tells you exactly what will be lost (combinations, photos, links pointing to it) before you confirm.

### Options, combinations and statuses

1. In **Options & prices**, tick **This product has options like size or colour**.
2. Type the option name (for example `Size`) and its values (`3 Seater`, press Enter, `2 Seater`, Enter…).
   **+ Add another option** adds a second or third one (for example `Color`). Up to 3 options.
3. Every combination (for example *3 Seater / Grey*) appears automatically with its own **Regular price**,
   **Sale price** and **Status**:
   - **Ready to ship**, **Made to order**, **Pre-order** or **Sold out**. The labels on the store follow this.
     Pre-order and Sold-out items show an **Ask about availability** button instead of **Order on WhatsApp**.
4. **Change many at once**: set one price, sale price or status for all combinations, or only for one value
   (for example "all *3 Seater*").
5. Click a value to rename it: every combination using it is updated. Removing a value asks first and lists the
   combinations that will go.
6. For an option named **Color**, **Colour** or **Finish**, each value gets a colour circle: pick a colour or
   upload a small photo of the fabric. These are the swatches customers tap on the store.
7. **Track stock count** (optional) adds a Stock column for your own records. The store never shows it.

**Tagging photos**: under each product photo, choose what it **Shows** (for example *Color: Grey*). When a
customer picks Grey on the store, the gallery jumps to the Grey photos.

### Product page layouts

Under the description, every product page shows a few ready-made **sections**: a big photo with text, photos with
text beside them, a row of icons, customer quotes, a slideshow, products from a collection, "You may also like"
and customer reviews. A **page layout** is one set of these sections in a fixed order. Each product uses one
layout (chosen in the product's **Page layout** list), and **many products share the same layout**.

**Product page layouts** in the left-hand menu lists every layout with what it contains and **Used by N products**
(tap it to see those products).

**A layout is shared.** Changing it changes every product that uses it. When more than one product uses the layout
you are editing, a yellow note says so at the top, and pressing **Save layout** first shows **Change all N
products?** with a list of what you changed. You can then save for all of them, choose **Save as a new layout
instead**, or keep editing.

**Editing sections.** Open a layout with **Edit**. The sections are listed in the order they appear on the page.
Tap **Edit** on a section to change it:

- **Photos**: tap **Upload photo** or **Replace**. The section takes the shape of your photo by itself, so a wide
  photo gives a wide section. You never type the address of a photo.
- **Text**: headings are plain boxes. The longer text has a small editor for bold, italic, underline and links.
- **Heading size**: choose Extra large, Large or Medium.
- **Photo and text**: choose **Photo on the left** or **Photo on the right** (on phones the photo is always on
  top), Normal or Wide photo, and text left or centred. **Show a button under the text** adds a button: type its
  text and choose where it goes with **Choose link** (a collection, a product, a page…). A ⚠ **Button goes nowhere**
  tag means the button has no link yet.
- **Icons row**: each icon has a title and a short text. Tap the icon to pick another one from the ready-made set.
  **+ Add icon**, **Remove** and the arrows change the row (up to 8 icons).
- **Customer quotes**: add, edit, remove and reorder the quotes (with the customer's name).
- **Wide photo slideshow**: upload a computer photo for each slide and, if you like, a separate taller phone photo.
  With two or more slides they slide by on their own. Put any text inside the photos.
- **Products from a collection**: type a heading, pick the collection and how many products to show. If that
  collection is deleted, the section disappears from the store and the editor shows ⚠ **Collection was deleted**.
- **"You may also like"** and **Customer reviews** fill themselves in. You can only move, hide or delete them.

**Moving, hiding, adding and deleting sections.** Drag a section by its handle, or use the ↑ ↓ arrows (easiest on a
phone). The **Show on the store** switch hides a section without losing what is in it. The **⋯** menu of a section
has **Copy this section** and **Delete section**. **Add section** at the bottom adds any kind of section. A layout
can have up to 20 sections, one "You may also like" and one reviews section. Nothing changes on the store until
you press **Save layout**; **Discard changes** goes back to the saved version.

**Giving some products their own version.** Don't edit a shared layout when only some products should change:

- **Make a copy** (on the list or in the layout's **⋯** menu), change the copy, then move products to it with
  **Bring products here…** or **Move products…**. You can move all of a layout's products, only those in one
  collection, or products you tick one by one. After moving, **Undo** in the message moves them back.
- Or open a product and press **Give this product its own layout**: that product gets a private copy to change
  freely, and the other products keep the old one.

**Rename and delete.** **Rename** (in the layout's header, or the **⋯** menu on the list) changes the name and the
optional "What it's for" note; products keep their layout. A layout can only be deleted when no product uses it:
move its products to another layout first (**Move products…**). The standard layout, "General furniture
(standard)", is used whenever a product has none and can never be deleted.

**Preview changes ↗** opens your changes on a real product page in a new tab before you save. Only you can see
it, and nothing changes for customers.

**Undo last save** (in the layout's **⋯** menu) brings back the version from before your last save, and **Restore
the original design** brings back the layout as the shop first had it. Both load into the editor first: look at it,
preview it if you like, then press **Save layout** to keep it.

### Collections

**Collections** lists every collection. Open one to change its name, cover photo, description, parent collection and products.
**Arrange Collections page** sets which cards appear on the store's "Shop by Category" page and in what order
(drag, or the arrows on a phone).

### Home banners

**Home banners** are the big photos sliding at the top of the home page. Each slide has:

- a **Computer photo** (recommended 1200 × 462) and an optional **Phone photo** (recommended 450 × 700);
  **put your text inside the photo**,
- a **Link**: tap it and search for a collection, product or page, or choose "Custom web address",
- a **Show on the store** switch, and drag handles to change the order.

### Menus

**Menus** has four tabs: **Main menu** (top of the site), **Footer “About”**, **Footer “Customer Support”** and
**Footer “Popular searches”**. Add links with the link picker, drag to reorder (arrows on a phone), and use
**Start a new column in the dropdown** to begin a new column in the main menu's drop-down. Press **Save menu**.

### Pages and blog posts

- **Pages**: policy pages and other text pages are edited in the same editor as product descriptions.
  Pages marked **This page has a custom design** (About us, Contact, Store locator, city pages, the wedding
  package builder and similar) keep their built-in design; you can only change their search-engine title and
  description, and show or hide them.
- **Blog posts**: title, content, **Date**, **Author**, **Featured photo** and **Tags**. Turn **Visible on the store**
  off to hide a post without deleting it.

### WhatsApp ordering and Settings

There is no cart or checkout: customers order on WhatsApp. On a product page they choose options and quantity and
tap **ORDER ON WHATSAPP**; WhatsApp opens with a ready message:

```
<greeting line>
*Product title*
Size: 3 Seater
Color: Grey
Quantity: 1
Price: Rs.120,000 each (was Rs.150,000)
https://yourshop.pk/products/…?variant=…
<closing line>
```

In **Settings → WhatsApp ordering**:

- **WhatsApp number**: a Pakistani mobile, e.g. `0309 2050463` (stored as `923092050463`). Use **Send test message**
  to check it. If the number is empty, the store hides every WhatsApp button and the admin shows a yellow warning.
- **Greeting (order button)**, **Greeting (availability button)** and **Closing line**: the first and last lines of
  the message. Product details are always added automatically.

Settings also has the **Announcement bar** (text, button text and link), **Contact details** (address, phone,
emails, shown in the footer), **Social links** (shown as icons in the footer; empty ones are hidden) and the
**Store rating** shown on the home page.

### WhatsApp inquiries

Every tap on an Order on WhatsApp / Ask about availability / chat button is logged (product, chosen options,
quantity, page and time, no personal data). **WhatsApp inquiries** lists them with filters by period and type, and
the **Dashboard** shows click totals, a catalogue overview and the **most asked-about products** of the last 30 days. Customers' actual
messages arrive in your WhatsApp, not in the admin.

**Messages** holds the contact-form submissions; **Reviews** lets you approve or delete product reviews.

---

## Developer notes

### Quickstart

```bash
cp .env.example .env   # then set SESSION_SECRET / ADMIN_PASSWORD
npm install
npm run db:up          # local MariaDB in Docker (port 3307)
npm run db:migrate     # create the tables
npm run db:seed        # optional: the demo catalog (rebranded), fidelity scripts and the easy-mode migration
npm run build          # generates the Prisma client, applies migrations, builds
npm start              # http://localhost:3000
```

Without `db:seed` the store starts empty, like a new deployment: sign in at `/admin` with `ADMIN_EMAIL` /
`ADMIN_PASSWORD` (the first sign-in creates the admin) and add everything in the admin. `npm run db:reset` drops
all data and recreates the tables.

Product/collection/banner images are already downloaded under `public/images/` (≈470 MB, 1,648 files) and git-tracked.

#### Admin panel

- URL: `http://localhost:3000/admin`
- Credentials (from `.env`): `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  - defaults: `admin@cozyfurnitures.pk` / `CozyAdmin@2026`
- Controls **everything** in plain language (no typed JSON, HTML or URLs): products (options & combinations, photos tagged by option value, rich-text description, page layout), product page layouts (the sections under the description: photos, text, icons, quotes, slideshows, collection rows; shared-change warning, copies, moving products, preview, undo), collections (+ Arrange Collections page), home banners (desktop + phone photo uploads, link picker), navigation menus, text pages + blog posts (rich-text editor), reviews moderation, WhatsApp inquiries log, contact-message inbox, site settings (WhatsApp number + message lines, announcement, address, social links, store rating), change password.
- Orders are taken on WhatsApp: product pages show **ORDER ON WHATSAPP** (or **ASK ABOUT AVAILABILITY** for pre-order / sold-out combinations); every click is logged and shown under *WhatsApp inquiries*. Uploaded photos are processed with `sharp` (≤2000px WebP, EXIF stripped) into `storage/uploads/` and served from `/uploads/…`.

### Data pipeline (how the seed was produced)

| Script | Purpose |
|---|---|
| `scripts/scrape.mjs` | Shopify JSON API: products (paginated), collections list, per-collection product maps, homepage HTML |
| `scripts/scrape2.mjs` / `scrape3.mjs` | Nested sitemaps (products/pages/collections/blogs), static page HTML |
| `scripts/download-images.mjs` | All product/collection/banner images from CDN → `public/images/`, writes `data/image-manifest.json` |
| `prisma/seed.ts` | Wipes + reseeds DB from `data/raw/` (products, variants, images, collections tree, pages, menus, banners, reviews, settings, admin user) |

Re-run `npm run scrape && npm run images && npm run db:seed` to refresh from the live site.

#### Backups and uploads

Photos uploaded in the admin are processed with `sharp` (longest side ≤ 2000 px, WebP, EXIF/GPS removed) and stored
on the server's disk in `storage/uploads/` (gitignored; `UPLOADS_DIR` overrides the folder and is required in
production, outside the deployed app folder), served by the
`/uploads/[...path]` route because `next start` does not serve files added to `public/` at runtime. All file access
goes through `src/lib/storage/` (one interface, local-disk backend), so a cloud backend can be swapped in later.

**Back up the uploads folder together with the database.** `npm run db:backup` dumps the local MySQL database
into `prisma/backups/` (gitignored); on Hostinger use hPanel backups / phpMyAdmin export. Bundled images in `public/images/` are never deleted; an uploaded file is deleted
when the last record using it is saved without it, and a background sweep removes uploads that nothing references
after 24 hours. Re-seeding keeps the `Upload` table and the files.

#### Data migration (admin easy mode)

`scripts/migrate-admin-easy-mode.ts` moved behaviour that used to live in hard-coded JSON files and magic tags into
the database: option rows, variant statuses (from the pre-order / sold-out lists), New arrival / Limited edition
flags, page layouts, swatch colours, photo tags, the Collections page order, page kinds + clean rich text, menus,
banners and settings (WhatsApp number `923092050463`, message lines), and the content of the 18 product page layouts
(step `product-layout-content`: `prisma/easy-mode-data/product-layouts.json` → `ProductLayout` +
`ProductLayoutSection` rows, each layout's migrated design kept as its "Restore the original design" version;
layouts whose key already exists are skipped). Its inputs are frozen copies in `prisma/easy-mode-data/`; nothing in
`src/` reads them.

```bash
npm run db:migrate-easy-mode                              # backs up the DB to prisma/backups/, then applies pending steps
npx tsx scripts/migrate-admin-easy-mode.ts --dry-run      # print the report, roll back
npx tsx scripts/migrate-admin-easy-mode.ts --no-backup
```

It is idempotent: each step records a `MigrationStep` row, so a second run prints "skipped" for every step.
`prisma/seed.ts` runs it as its last step, so a fresh `db:migrate` + `db:seed` reaches the same state as a migrated
database. Everything reads the database from `DATABASE_URL`.

#### Tests

```bash
npm run test:e2e                 # = npx playwright test; reuses the dev server on :3100 (starts one if none answers)
E2E_EXCLUSIVE=1 npx playwright test tests/integration   # also runs the store-wide settings scenarios
BASE_URL=https://staging.example npx playwright test   # against another server
E2E_FRESH_URL=http://localhost:3200 npx playwright test --project=fresh-install   # a server on an EMPTY database
```

The main suite expects the seeded demo database (`npm run db:seed`). `tests/fresh-install/` checks a new deployment
instead: run a second server on a database that only has its tables (`DATABASE_URL=…/cozy_fresh npx prisma migrate
deploy`, then `DATABASE_URL=…/cozy_fresh UPLOADS_DIR=/tmp/fresh-uploads npx next start -p 3200`) and point
`E2E_FRESH_URL` at it: the store and every admin screen work with no data, the first sign-in creates the admin, a
first product with a photo is published and WhatsApp ordering is switched on.

Playwright (`@playwright/test`, installed Chrome via `channel: 'chrome'`) covers: creating a sofa with Size × Color,
uploading and tagging photos, writing the description, publishing and editing in place (ids kept); banners with
uploads and the link picker; menu reordering; Order on WhatsApp (exact message text, click logging, availability
variant); uploads (resize, EXIF strip, path safety, orphan deletion); the unsaved-changes guard; product page layouts
(copy and edit every kind of section, the store reflecting it, the shared-change warning, save as new, undo/restore,
preview, moving products, delete rules, direct server-action calls for limits/sanitising/signed-out, stale saves;
`tests/admin/product-layouts.spec.ts`), the layout migration against a scratch database built from scratch
(`tests/integration/product-layouts-migration.spec.ts`), and lasting storefront parity of the 18 migrated layouts
(`tests/storefront/product-layouts*.spec.ts`; fixtures in `tests/fixtures/product-layouts-dom/`); a sweep that no admin
screen asks for a typed URL/HTML/JSON/position; phone layouts at 412 and 360 px; a storefront regression project. Tests create
uniquely named data and delete it afterwards; the store-wide settings scenarios change and restore Settings, so they
only run with `E2E_EXCLUSIVE=1`. Login comes from `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`, else `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` (set the E2E ones if the password was changed in the admin). Typecheck with `npx tsc --noEmit`.

#### Behind a reverse proxy

Rate limits (WhatsApp click logging, contact form, reviews) key on the client IP, which is only trusted from
`X-Forwarded-For` entries added by your own proxies. Set `TRUSTED_PROXY_HOPS` to the number of proxies in front of
the app (e.g. `TRUSTED_PROXY_HOPS=1` behind one nginx using `proxy_set_header X-Forwarded-For
$proxy_add_x_forwarded_for`). Unset, the header is ignored and all visitors share one bucket per limit. WhatsApp
click logging is also limited per browser through a signed `cz_visitor` cookie (set by `src/middleware.ts`, signed
with `SESSION_SECRET`): requests without a valid cookie, such as forged posts from a script, share one small budget
of 60 a minute, so they can't stop real customers' clicks from being logged.

#### Fidelity scripts (part of `db:seed`)

The storefront reproduces the live site's look 1:1 (rebranded to Cozy Furnitures). Some of that needs data the
raw seed does not produce, so `scripts/fidelity/*.ts` patch the DB. `npm run db:seed` already runs every step
below (offline) and then the admin easy-mode migration (`npm run db:migrate-easy-mode`, idempotent: a second run
reports "skipped"), so nothing has to be run afterwards. Each script can still be run on its own:

```bash
npx tsx scripts/fidelity/global.ts             # header mega menu, footer menus + SEO link groups, announcement bar
npx tsx scripts/fidelity/home.ts               # hero slides (logo-free ones only, live links), reviews summary "4.92 ★ (102)"
npx tsx scripts/fidelity/catalog.ts --offline  # collection descriptions, featured order, index images, card swatch/sold-out data
npx tsx scripts/fidelity/product.ts --offline  # replace invented seed reviews with the live Judge.me reviews
npx tsx scripts/fidelity/content.ts            # clean rich-text pages + blog posts from data/raw
```

| Script | Writes | Notes |
|---|---|---|
| `global.ts` | DB: `Menu`, `Setting` | `prisma/seed.ts` imports the same menu data |
| `home.ts` | DB: `Banner`, `Setting` | banners matched by image file, so ids may change |
| `catalog.ts` | DB: `Collection`; `public/images/collections/`; `src/components/catalog/live-search-order.json` (only with `--refresh-search`) | drop `--offline` to download missing images |
| `product.ts` | DB: `Review`, `Product.rating/reviewCount` | drop `--offline` to fetch uncached live review widgets |
| `content.ts` | DB: `Page` | blog featured images live in `public/images/blog/` |
| `landing.ts` | `src/components/pages/landing-data.json`; `public/images/landing/` | DB-free; `/pages/home-furniture` + `/pages/office-furniture` sections |
| `berlin.ts` | `public/images/berlin/`, `public/videos/berlin/` | DB-free; needs `ffmpeg` only to rebuild `evolution.mp4` (watermark + end card removed) |

Every downloaded image/video was checked by eye: nothing on the storefront shows the original brand's logo or
wordmark (artwork that did — some hero banners, the Imagine banner — is left out).

#### Fonts

- **Poppins 400/500/600/700** (+ italic) via `next/font/google` — the theme font everywhere. Live loads no lighter
  Poppins face, so text the live CSS sets at weight 100–300 renders at 400 there; with no light face loaded the
  same happens here (`font-light` etc. intentionally render like live).
- **Work Sans 400/500/600** via `next/font/google` — only the desktop mega menu and mobile menu (live Globo menu).
- **Poppins 200**, self-hosted at `public/fonts/poppins-200-latin.woff2` under its own family (`font-poppins-thin`)
  — only our own artwork: the Cozy Furnitures logo wordmark and the catalogue cover lettering.
- **Barlow Condensed 100/600** via `next/font/google` — the Coalesce product-template headings.

### Seed contents

- **695 products** with variants, images, rich descriptions (real data)
- **257 collections** (department → category tree) + 3,961 product-collection links
- **47 pages**: 6 text pages (policies), 14 blog posts, 27 custom-design pages (About, Store Locator, city pages, wedding package builder…)
- **843 variants** (517 ready to ship, 130 pre-order, 58 made to order, 138 sold out), 97 options with 220 values, 121 swatch colours, 199 tagged photos
- **7 hero banners** (computer + phone photos), **222 menu items** (124 main, 11 + 8 footer, 79 popular searches)
- **62 reviews** (the real reviews from the live product pages; 14 of them had no date there and are shown without one), site settings (WhatsApp number 923092050463)

### Routes

**Storefront:** `/` · `/collections` · `/collections/[handle]` · `/products/[handle]` · `/search` · `/pages/[handle]` · `/blogs` · `/blogs/news/[slug]`

**API:** `POST /api/whatsapp-click` (click log) · `POST /api/contact` · `/api/admin/uploads` (photo uploads) · `/api/admin/session` (session check + signing in again without leaving an editor) · `GET /uploads/…` (uploaded files)

**Redirects:** `/cart`, `/checkout*` → `/`; `/track` → WhatsApp chat (logged)

**Admin:** `/admin` (dashboard) · `/admin/login` · `/admin/products` · `/admin/collections` (+ Arrange) · `/admin/reviews` · `/admin/banners` · `/admin/menus` · `/admin/pages` · `/admin/blog` · `/admin/inquiries` · `/admin/messages` · `/admin/settings` · `/admin/account/password`

**Tests:** `npm run test:e2e` (see *Tests* above)

### Notes

- There is no cart or checkout: the WhatsApp message (greeting, product, options, quantity, price, link, closing line) is built from the DB; greeting/closing lines are editable in Settings.
- The storefront replicates the live site's layout, typography, spacing, section order and navigation at desktop (1440) and mobile (390); only the brand name/logo differ.
- Scraped content is seed/demo data for this local clone.
