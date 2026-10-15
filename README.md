# Cozy Furnitures — Full-Stack Next.js E-Commerce

A faithful full-stack clone of the original site (a rebranded furniture store): storefront + backend + admin panel, seeded with the real catalog scraped from the live site.

## Stack

- **Next.js 15** (App Router, TypeScript, server components + server actions)
- **Tailwind CSS 3.4** — the live theme's tokens (`tailwind.config.ts`, `src/app/globals.css`): accent `#103a3a`, accent2 `#c25b41`, cream `#f6f6f0`
- **Prisma + SQLite** (`prisma/dev.db`) — swappable to Postgres by changing `datasource`
- **NextAuth-free auth** — HMAC-signed httpOnly cookie sessions (admin)

## Quickstart

```bash
npm install
npm run db:push        # create schema
npm run db:seed        # seed from data/raw (scraped source catalog, rebranded to Cozy Furnitures)
npm run build
npm start              # http://localhost:3000
```

Product/collection/banner images are already downloaded under `public/images/` (≈470 MB, 1,648 files) and git-tracked.

### Admin panel

- URL: `http://localhost:3000/admin`
- Credentials (from `.env`): `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  - defaults: `admin@cozyfurnitures.pk` / `CozyAdmin@2026`
- Controls **everything**: products (variants, images, options, collections), collections, orders (status workflow), banners (hero slider), navigation menus, static pages/blog, reviews moderation, contact-message inbox, site settings (phone/email/social/announcement), admin session.

## Data pipeline (how the seed was produced)

| Script | Purpose |
|---|---|
| `scripts/scrape.mjs` | Shopify JSON API: products (paginated), collections list, per-collection product maps, homepage HTML |
| `scripts/scrape2.mjs` / `scrape3.mjs` | Nested sitemaps (products/pages/collections/blogs), static page HTML |
| `scripts/download-images.mjs` | All product/collection/banner images from CDN → `public/images/`, writes `data/image-manifest.json` |
| `prisma/seed.ts` | Wipes + reseeds DB from `data/raw/` (products, variants, images, collections tree, pages, menus, banners, reviews, settings, admin user) |

Re-run `npm run scrape && npm run images && npm run db:seed` to refresh from the live site.

### Fidelity scripts (run after every `db:seed`)

The storefront reproduces the live site's look 1:1 (rebranded to Cozy Furnitures). Some of that needs data the
seed does not produce, so `scripts/fidelity/*.ts` patch the DB or generate data files. All are idempotent and safe
to re-run; run them after `npm run db:seed`:

```bash
npx tsx scripts/fidelity/global.ts             # header mega menu, footer menus + SEO link groups, announcement bar
npx tsx scripts/fidelity/home.ts               # hero slides (logo-free ones only, live links), reviews summary "4.92 ★ (102)"
npx tsx scripts/fidelity/catalog.ts --offline  # collection descriptions, featured order, index images, card swatch/sold-out data
npx tsx scripts/fidelity/product.ts --offline  # replace invented seed reviews with the live Judge.me reviews
npx tsx scripts/fidelity/content.ts            # clean rich-text pages + blog posts from data/raw
npx tsx scripts/fidelity/cart.ts               # refund-policy / cancellations pages linked from checkout
```

| Script | Writes | Notes |
|---|---|---|
| `global.ts` | DB: `Menu`, `Setting` | `prisma/seed.ts` imports the same menu data |
| `home.ts` | DB: `Banner`, `Setting` | banners matched by image file, so ids may change |
| `catalog.ts` | DB: `Collection`; `src/components/catalog/*.json`; `public/images/collections/` | drop `--offline` to download missing images, `--refresh-search` re-snapshots live search order |
| `product.ts` | DB: `Review`, `Product.rating/reviewCount` | drop `--offline` to fetch uncached live review widgets |
| `content.ts` | DB: `Page` | blog featured images live in `public/images/blog/` |
| `cart.ts` | DB: `Page` | imports helpers from `content.ts` |
| `landing.ts` | `src/components/pages/landing-data.json`; `public/images/landing/` | DB-free; `/pages/home-furniture` + `/pages/office-furniture` sections |
| `berlin.ts` | `public/images/berlin/`, `public/videos/berlin/` | DB-free; needs `ffmpeg` only to rebuild `evolution.mp4` (watermark + end card removed) |

Every downloaded image/video was checked by eye: nothing on the storefront shows the original brand's logo or
wordmark (artwork that did — some hero banners, the Imagine banner — is left out).

### Fonts

- **Poppins 400/500/600/700** (+ italic) via `next/font/google` — the theme font everywhere. Live loads no lighter
  Poppins face, so text the live CSS sets at weight 100–300 renders at 400 there; with no light face loaded the
  same happens here (`font-light` etc. intentionally render like live).
- **Work Sans 400/500/600** via `next/font/google` — only the desktop mega menu and mobile menu (live Globo menu).
- **Poppins 200**, self-hosted at `public/fonts/poppins-200-latin.woff2` under its own family (`font-poppins-thin`)
  — only our own artwork: the Cozy Furnitures logo wordmark and the catalogue cover lettering.
- **Barlow Condensed 100/600** via `next/font/google` — the Coalesce product-template headings.

## Seed contents

- **695 products** with variants, images, rich descriptions (real data)
- **255 collections** (department → category tree) + 3,917 product-collection links
- **47 pages** (About, Store Locator, policies, city pages, wedding package builder…) + 14 blog posts
- **7 hero banners** (web + mobile variants), **136 menu items** (mega menu + footer + topbar)
- **360 seeded reviews**, site settings

## Routes

**Storefront:** `/` · `/collections` · `/collections/[handle]` · `/products/[handle]` · `/search` · `/cart` · `/checkout` (+`/checkout/success`) · `/track` · `/pages/[handle]` · `/blogs` · `/blogs/news/[slug]`

**API:** `POST /api/orders` · `GET /api/orders/lookup` · `POST /api/contact`

**Admin:** `/admin` (dashboard) · `/admin/login` · `/admin/products` · `/admin/collections` · `/admin/orders` · `/admin/reviews` · `/admin/banners` · `/admin/menus` · `/admin/pages` · `/admin/messages` · `/admin/settings`

## Notes

- Checkout computes prices **server-side** from the DB (client prices never trusted); COD/card/bank/installment payment methods mirror the real site's options.
- The storefront replicates the live site's layout, typography, spacing, section order and navigation at desktop (1440) and mobile (390); only the brand name/logo differ.
- Scraped content is seed/demo data for this local clone.
