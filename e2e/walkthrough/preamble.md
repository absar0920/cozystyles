# Interwood — Full Manual Test Walkthrough

This guide takes the store from an **empty database** to a fully working shop **using only the browser**: no seed data, no database edits, no API calls. Every step lists exactly what to click and type, what you should see, and a screenshot.

> This file is **generated** by a Playwright run that performs every step below in a real Chrome browser, so the screenshots match the instructions exactly. To regenerate it: `npm run docs:walkthrough` (see [Regenerating this guide](#regenerating-this-guide)).

## 0. Start from scratch

Nothing has to be created outside the browser. While the database has no admin, the **first sign-in** with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` creates the admin account. Everything else (settings, categories, products and their photos, banners, menus, pages, orders, messages, reviews) starts empty.

```bash
cd ~/projects/personal/interwood
npm install                      # first time only
npm run db:up                    # start the local MySQL in Docker (first time / after a reboot)

# 1. Delete all data and uploaded photos, recreate the empty tables
npm run db:reset
rm -rf uploads

# 2. Build and start the app
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
- **Photos are uploaded from your computer.** This guide uses sample photos that ship with the project in `public/images/`: when the file picker opens, go to the project folder → `public` → `images`. Every upload is converted to WebP, stored in `uploads/` and its URL (`/uploads/…`) is filled in for you. Pasting an existing image URL into the field still works too.
- Prices are whole Pakistani rupees: type `45000`, not `45,000.00`.
- Order numbers are assigned in sequence (`IW-100001`, `IW-100002`, …). If you have placed other orders, yours will differ from the screenshots.
