## Appendix A — How the pieces fit together

| Admin setting | Where it shows on the storefront |
|---|---|
| **Settings → Announcement Bar** | Dark strip at the very top of every page (empty = hidden) |
| **Settings → Phone / Emails / Address** | Top bar phone, footer contact block, product page "Expert Support" |
| **Settings → WhatsApp Number** | Green floating WhatsApp button |
| **Settings → Social links** | Footer icons (empty = icon hidden) |
| **Settings → Shipping Fee / Free Shipping Threshold** | Cart and checkout "Delivery & Installation" line, and the amount actually charged |
| **Settings → Overall Rating / Rating Count Label** | Home page rating banner |
| **Collection → Featured on homepage** | "Shop by Category" tile + its own product row on the home page (ordered by Position) |
| **Collection → Show in navigation** | Listed on `/collections` |
| **Product → Hot product** | "Hot Selling Products" row on the home page |
| **Product → Status Draft/Archived** | Hidden everywhere on the storefront (404 on its URL) |
| **Variant → Inventory 0** | "Made to Order" (still purchasable) |
| **Variant → Compare at** | Struck-through price and "-X% OFF" badge |
| **Banner → Location** | Hero slider (top), Promo strip 1 (under the trust strip), Promo strip 2 (under the rating banner) |
| **Menus** | Main navigation (with dropdowns), top bar links, three footer columns |
| **Page with handle `contact`** | Gets the contact form automatically |
| **Page → Blog post** | Listed on `/blogs`, served at `/blogs/news/<handle>` |
| **Order → Status** | Customer's tracking timeline on `/track` (admin notes are never shown) |
| **Review → Approved** | Shown on the product page and in its star rating |
| Contact form & newsletter | Arrive in **Messages** |

## Appendix B — Order status flow

`Pending` (Order Placed) → `Confirmed` (Order Confirmed) → `Processing` (In Production) → `Shipped` → `Delivered` (Delivered & Installed). `Cancelled` can be set at any point and is excluded from dashboard revenue.

## Appendix C — Known limitations

- **No customer accounts.** The person icon in the header opens a login page, but it is only a placeholder; customers track orders with order number + phone instead.
- **First admin user** must be created with `npm run db:admin`; there is no admin sign-up or user management screen.
- **No image upload**: images are paths under `public/images/` or external URLs.
- **Card / Installments** are recorded as the chosen payment method only; no payment gateway is connected.
- **Newsletter** sign-ups are stored as messages in the inbox (no mailing-list integration).
- Product form errors detected **only by the server** (e.g. invalid Options JSON) reload the form and clear unsaved changes; price/stock mistakes are caught in the browser first.

## Regenerating this guide

```bash
rm -f prisma/dev.db && npm run db:push && npm run db:admin
npm run build && npx next start -p 3100     # the generator expects port 3100
npm run docs:walkthrough                    # rewrites docs/walkthrough/README.md + screenshots/
```

The automated regression suite (44 tests, same "browser only" rules) runs with `npm run test:e2e` against the same kind of fresh database.
