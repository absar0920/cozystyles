# Interwood — Full Manual Test Walkthrough

This guide takes the store from an **empty database** to a fully working shop **using only the browser**: no seed data, no database edits, no API calls. Every step lists exactly what to click and type, what you should see, and a screenshot.

> This file is **generated** by a Playwright run that performs every step below in a real Chrome browser, so the screenshots match the instructions exactly. To regenerate it: `npm run docs:walkthrough` (see [Regenerating this guide](#regenerating-this-guide)).

## 0. Start from scratch

The only step that can't be done in the browser is creating the **first admin login**: the app has no sign-up screen. `npm run db:admin` creates that one user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`. Everything else (settings, categories, products, banners, menus, pages, orders, messages, reviews) starts empty.

```bash
cd ~/projects/personal/interwood
npm install                      # first time only

# 1. Delete the database and recreate the empty tables
rm -f prisma/dev.db
npm run db:push

# 2. Create the admin login (the only non-browser step)
npm run db:admin                 # → "Admin ready: <ADMIN_EMAIL>"

# 3. Build and start the app
npm run build
npm start                        # → http://localhost:3000
```

| | |
|---|---|
| Storefront | `http://localhost:3000/` |
| Admin panel | `http://localhost:3000/admin` |
| Admin email | value of `ADMIN_EMAIL` in `.env` (currently `admin@cozyfurnitures.pk`) |
| Admin password | value of `ADMIN_PASSWORD` in `.env` (currently `CozyAdmin@2026`) |

**Tips**

- Use **two browser windows**: a normal one for the admin and a **private/incognito** one for the shopper, so the admin login and the shopper's cart stay separate.
- Images are entered as **paths to files that already exist** in `public/images/` (e.g. `/images/products/alexa-sofa-chair-1.jpg`) or as full `https://` URLs. There is no file upload.
- Prices are whole Pakistani rupees: type `45000`, not `45,000.00`.
- Order numbers are assigned in sequence (`IW-100001`, `IW-100002`, …). If you have placed other orders, yours will differ from the screenshots.
