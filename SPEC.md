# Interwood Clone — Build SPEC (for build agents)

You are building part of a full clone of interwood.pk (Pakistan furniture e-commerce).
Stack: **Next.js 15 (App Router) + TypeScript + Tailwind CSS 3.4 + Prisma/SQLite**.
The DB is seeded with the real catalog: 695 products, 255 collections, 47 pages, menus, banners, reviews.

## Ground rules (MUST follow)

1. **Only create/modify files you own** (listed in your task prompt). Never touch others' files, `prisma/`, `scripts/`, `package.json`, or configs.
2. Do NOT run `next build`, `next dev`, `npm start`, `npm install`, or any `git` command. Multiple agents share this directory.
3. Verify types with `npx tsc --noEmit` from the repo root. Fix errors **in your files only** — errors in other agents' files are expected noise (they're working in parallel).
4. Next.js 15: `params` and `searchParams` in pages are **Promises** — `const { handle } = await params;`. `cookies()` returns a Promise — `await cookies()`.
5. Server Components by default. Add `'use client'` only when you need hooks/browser APIs. Server Actions live in files with `'use server'` at top (use `src/app/admin/actions/*.ts`).
6. Images: use plain `<img>` tags or `next/image` (unoptimized globally). Local paths like `/images/products/foo-1.jpg` exist on disk. ALWAYS set width/height or aspect classes to avoid layout shift.
7. Styling: Tailwind classes only. Design tokens: `brand` (#108474 teal), `brand-900` (#103a3a dark teal), `terra` (#c25b41), `sale` (#ae2828), `ink` (#3d4246 text), `ink-dark` (#313131), `ink-muted`, `cream` (#f6f6f0), `cream-soft`, `cream-border`. Fonts: `font-heading` (Poppins) / `font-body` (Work Sans) applied automatically. Reusable CSS: `.container-iw`, `.rte` (rich text), `.input`, `.label`, `.btn-primary`, `.btn-outline`, `.btn-dark`.
8. Prices are **integer PKR rupees**. Format with `formatPKR(n)` from `@/lib/money` → "Rs. 84,000". Discount %: `discountPercent(price, compareAtPrice)`.
9. E-commerce UI text: "Add to Cart", "Buy Now", "Free Delivery & Installation", "Made to Order" (when inventory is 0). Keep copy faithful to a Pakistani furniture store.

## Shared libraries (already exist — read them before coding)

- `src/lib/db.ts` → `prisma` client (import from `@/lib/db`)
- `src/lib/money.ts` → `formatPKR`, `discountPercent`
- `src/lib/constants.ts` → `SITE`, `PAYMENT_METHODS`, `ORDER_STATUSES`, `PAKISTAN_CITIES`, `PAKISTAN_PROVINCES`
- `src/lib/queries.ts` → `getSettingsMap()`, `getMenu(location)`, `getBanners(location)`, `getAllNavCollections()`, `listProducts({collectionHandle,q,sort,page,perPage,minPrice,maxPrice,inStockOnly})` → `{items,total,page,perPage,pages}`, `getProductByHandle(handle)`, `getRelatedProducts(id, collectionHandles, limit)`, `getCollectionByHandle(handle)`, `getPageByHandle(handle)`, `listBlogPosts(limit)`, `getReviewsForProduct(productId)`, `getRecentReviews(limit)`, `getFeaturedCollections(limit)`. **ProductCardData**: `{id, handle, title, price, compareAtPrice, image, hot, rating, reviewCount, productType, inventory}`.
- `src/lib/cart.tsx` → client CartProvider + `useCart()` → `{items, count, subtotal, savings, hydrated, addItem(item, qty), setQty(key, qty), removeItem(key), clear()}`. CartItem: `{key, productId, variantId, handle, title, variantTitle, price, compareAtPrice, image, qty}`. `key` = `"productId:variantId"`. Cart is localStorage-backed and mounted globally.
- `src/lib/auth.ts` → `getCurrentAdmin()`, `setSessionCookie(id)`, `clearSessionCookie()` (HMAC-signed httpOnly cookie). Use in admin layout/actions only.
- `src/components/icons.tsx` → Search/Cart/User/Heart/Menu/X/ChevronDown/Right/Left/Star(full/half)/Phone/Mail/MapPin/Truck/Shield/Cube/Whatsapp/Facebook/Instagram/Youtube/Linkedin/Check/Plus/Minus/Trash/Edit/Filter/Package icons (all accept className).
- `src/components/catalog/ProductCard.tsx` → `<ProductCard product={cardData} />` (server-safe)
- `src/components/catalog/QuickAdd.tsx` → quick-add button (client)
- `src/components/ui/Stars.tsx` → `<Stars rating count size />`
- `src/components/admin/ui.tsx` → `AdminPageHeader`, `AdminCard`, `AdminTable`, `Badge`, `Field`, `TextInput`, `TextArea`, `Select`, `EmptyRow` (server-safe)
- `src/components/admin/SubmitButton.tsx` → `<SubmitButton>` with pending spinner (client; use inside `<form action={serverAction}>`)
- `src/components/layout/Header.tsx`, `Footer.tsx` → exist; do not touch.

## Data model notes

- `Product`: handle, title, bodyHtml, productType, status(ACTIVE/DRAFT/ARCHIVED), hot, tags, `options` = JSON string `'[{"name":"Size","values":["2-Seater","3-Seater"]}]'` (may be `[]`), rating, reviewCount. Relations: `variants[]` (title, price, compareAtPrice, option1..3, inventory, sku, position), `images[]` (src, alt, position), `collections[]` (handle, title), `reviews[]`.
- Cheapest variant = display price. `inventory === 0` → "Made to Order" (still purchasable).
- `Page`: handle, title, bodyHtml (rich HTML), isBlogPost, published, seoTitle, seoDescription. Blog posts have handles prefixed `news-` (e.g. `news-top-10-...`; the URL slug after /blogs/news/ is the part AFTER `news-`).
- `Banner`: location (`HOME_HERO`), title, subtitle, ctaLabel, href, image (web 1200x462), mobileImage (450x700), position, active.
- `MenuItem`: location (`MAIN`, `FOOTER_1..3`, `TOPBAR`), parentId tree, position, badge.
- `SiteSetting`: key/value strings (announcement, phone, email, complaintsEmail, whatsapp, address, facebook/instagram/youtube/linkedin, shippingFee, freeShippingThreshold, ratingSummary, ratingSummaryCount).
- `Order`: orderNumber (`IW-100001`…), customerName, phone, email, address, city, province, notes, paymentMethod (COD/CARD/BANK_TRANSFER/INSTALLMENTS), status (PENDING/CONFIRMED/PROCESSING/SHIPPED/DELIVERED/CANCELLED), subtotal/discount/shippingFee/total, adminNotes, items[] (title, variantTitle, price, quantity, image, productId nullable).

## Storefront route conventions

- Storefront pages live under `src/app/(store)/` (layout with Header/Footer exists).
- Collection URL: `/collections/<handle>`; product: `/products/<handle>`; static page: `/pages/<handle>`; search: `/search?q=`; cart `/cart`; checkout `/checkout`; success `/checkout/success?order=IW-100001`; track `/track`.
- Use `export const dynamic = 'force-dynamic'` or `revalidate = 0` on pages reading DB that must reflect admin edits immediately. Product/collection pages may use default caching — but prefer `force-dynamic` for correctness in this clone.
- `generateMetadata` for product/collection/page routes (title + description from bodyHtml stripped).

## Admin conventions

- Admin lives at `/admin` (dashboard). Login at `/admin/login`. Route groups: `src/app/admin/(auth)/…` for login, `src/app/admin/(panel)/…` for everything else. The `(panel)/layout.tsx` MUST call `getCurrentAdmin()` and `redirect('/admin/login')` when null.
- All mutations = **server actions** in `src/app/admin/actions/<domain>.ts` (`'use server'`, revalidatePath after write). Forms post to actions directly (`<form action={fn}>`); use `useActionState` client wrappers for error messages.
- Admin visual: light gray bg (`bg-gray-100`), white cards, left sidebar (dark teal `bg-brand-900`) with links: Dashboard, Orders, Products, Collections, Reviews, Banners, Menus, Pages, Messages, Settings. Mobile-friendly (collapsible sidebar ok).
- Delete actions: confirm via `confirm()` in a client wrapper or a two-step button — keep it simple.
- List pages: `AdminTable`, search input (GET form with `?q=`), pagination via `?page=` (20/page).
