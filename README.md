# Interwood.pk Clone — Full-Stack Next.js E-Commerce

A faithful full-stack clone of [interwood.pk](https://interwood.pk/) (Pakistan's largest furniture manufacturer): storefront + backend + admin panel, seeded with the real catalog scraped from the live site.

## Stack

- **Next.js 15** (App Router, TypeScript, server components + server actions)
- **Tailwind CSS 3.4** — Interwood design tokens (`#108474` teal, Poppins/Work Sans)
- **Prisma + SQLite** (`prisma/dev.db`) — swappable to Postgres by changing `datasource`
- **NextAuth-free auth** — HMAC-signed httpOnly cookie sessions (admin)

## Quickstart

```bash
npm install
npm run db:push        # create schema
npm run db:seed        # seed from data/raw (scraped from interwood.pk)
npm run build
npm start              # http://localhost:3000
```

Product/collection/banner images are already downloaded under `public/images/` (≈470 MB, 1,648 files) and git-tracked.

### Admin panel

- URL: `http://localhost:3000/admin`
- Credentials (from `.env`): `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  - defaults: `admin@interwood.local` / `Interwood@2026`
- Controls **everything**: products (variants, images, options, collections), collections, orders (status workflow), banners (hero slider), navigation menus, static pages/blog, reviews moderation, contact-message inbox, site settings (phone/email/social/announcement), admin session.

## Data pipeline (how the seed was produced)

| Script | Purpose |
|---|---|
| `scripts/scrape.mjs` | Shopify JSON API: products (paginated), collections list, per-collection product maps, homepage HTML |
| `scripts/scrape2.mjs` / `scrape3.mjs` | Nested sitemaps (products/pages/collections/blogs), static page HTML |
| `scripts/download-images.mjs` | All product/collection/banner images from CDN → `public/images/`, writes `data/image-manifest.json` |
| `prisma/seed.ts` | Wipes + reseeds DB from `data/raw/` (products, variants, images, collections tree, pages, menus, banners, reviews, settings, admin user) |

Re-run `npm run scrape && npm run images && npm run db:seed` to refresh from the live site.

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
- The theme replicates the live site's extracted design tokens (colors, fonts, layout patterns) and navigation structure.
- Scraped content is seed/demo data for this local clone.
