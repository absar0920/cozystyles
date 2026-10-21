# Deploying to Hostinger (managed Node.js Web App + MySQL)

Everything stays inside one Hostinger account: the Next.js app runs as a managed **Node.js Web App**
(Business or Cloud plan), data lives in **Hostinger MySQL**, admin-uploaded images live in a folder in
your **home directory**, and **Hostinger CDN** caches the site and images at the edge.

```
 shoppers ─► Hostinger CDN ─► interwood.pk ─► Node.js Web App (next start)
                                               ├─► MySQL (127.0.0.1:3306)       orders, catalog, settings
                                               └─► ~/interwood-uploads/          admin-uploaded images
                                                   served at /uploads/…  (immutable, cached by the CDN)
```

## Why it is set up this way

| Concern | Decision |
|---|---|
| Database | Managed Web Apps only offer **MySQL** (MariaDB). Prisma talks to it directly; schema changes ship as migrations in `prisma/migrations/` and are applied by `npm run build`. |
| Deploys wipe the app folder | Hostinger replaces `hbuilds/` and `public_html` on every deploy. Nothing the app writes may live there — so uploads go to `UPLOAD_DIR`, a folder **outside** the app (your home directory). |
| Image size / speed | Every upload is converted to **WebP**, auto-rotated, stripped of camera metadata and capped (products 1800px, banners 2400px, collections 1200px, page images 1600px). A 6 MB phone photo typically becomes 150–400 KB. |
| CDN | Upload file names contain a content hash (`sofa-3f9a1c2b7d4e.webp`), so they never change and are served with `Cache-Control: public, max-age=31536000, immutable`. The CDN fetches each file from the app once and serves it from the edge afterwards. |
| First admin | No shell needed: while the database has no admin, signing in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` creates it. |

## One-time setup

### 1. Create the database
hPanel → **Websites → Manage → Databases → MySQL Databases**: create a database and user (e.g.
`u123456789_interwood` / `u123456789_iw`) with a strong password.

### 2. Create the uploads folder
hPanel → **File Manager**: in your home directory (`/home/u123456789/`, the folder that contains
`domains/`), create `interwood-uploads`. Note the full path — File Manager shows it in the address bar.

> Not inside `domains/<site>/` — that tree belongs to the deployment and is replaced on each deploy.

### 3. Create the Node.js Web App
hPanel → **Websites → Add website → Node.js Web App**, connect the GitHub repository (or upload a zip
without `node_modules`, `.next`, `.git`, `uploads`), and set:

| Setting | Value |
|---|---|
| Framework | Next.js |
| Node version | 22.x |
| Build command | `npm run build` (generates Prisma client, applies migrations, builds) |
| Start command | `npm start` |

### 4. Environment variables
In the app's **Environment variables** panel:

| Name | Value |
|---|---|
| `DATABASE_URL` | `mysql://u123456789_iw:PASSWORD@127.0.0.1:3306/u123456789_interwood` — use **127.0.0.1**, not `localhost` (Node resolves `localhost` to IPv6 and the connection is refused). URL-encode special characters in the password (`@` → `%40`, `#` → `%23`). |
| `SESSION_SECRET` | output of `openssl rand -base64 48` (a new one — never reuse the dev value) |
| `ADMIN_EMAIL` | the admin's email |
| `ADMIN_PASSWORD` | a strong password (8+ characters) |
| `UPLOAD_DIR` | `/home/u123456789/interwood-uploads` (the folder from step 2) |
| `NEXT_PUBLIC_SITE_NAME` | `Interwood` |
| `NEXT_PUBLIC_SITE_URL` | `https://interwood.pk` |

Save, then **Deploy**. The build log should show `prisma migrate deploy` applying `…_init`.

### 5. First sign-in
Open `https://<your-domain>/admin`, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. The account is
created on that first sign-in. From then on, use the admin panel as described in
[the walkthrough](walkthrough/README.md).

### 6. Turn on the CDN
hPanel → **Websites → Manage → Performance → CDN** → enable. No app changes are needed: uploads and
Next.js static assets are already sent with long-lived cache headers, and pages are dynamic (`no-store`)
so orders and stock are always fresh.

## Upgrading later
Push to the connected branch (or upload a new zip) and **Redeploy**. Migrations in `prisma/migrations/`
are applied during the build; the database and `UPLOAD_DIR` are untouched.

To change the schema: edit `prisma/schema.prisma` locally, run `npx prisma migrate dev --name <change>`
against the local database, commit the new folder in `prisma/migrations/`, deploy.

## Backups
- **Database:** Hostinger's daily backups include MySQL; for an on-demand copy use hPanel →
  Databases → phpMyAdmin → Export.
- **Uploads:** included in Hostinger's account backups (they live in your home directory). For an
  extra copy, download `interwood-uploads` from File Manager as a zip.

## Optional: images on a separate CDN subdomain
To serve images from e.g. `cdn.interwood.pk` without touching Node at all, create that subdomain as a
plain website, point `UPLOAD_DIR` at its folder (`/home/u123456789/domains/cdn.interwood.pk/public_html/uploads`)
and set `UPLOAD_PUBLIC_URL=https://cdn.interwood.pk/uploads`. New uploads are then stored with that
URL; earlier `/uploads/…` URLs keep working through the app.

## Checklist if something is off
| Symptom | Check |
|---|---|
| Build fails at `prisma migrate deploy` | `DATABASE_URL` host is `127.0.0.1`, user has all privileges on the database, password URL-encoded |
| Upload says "UPLOAD_DIR is not configured" | Add the `UPLOAD_DIR` variable and redeploy |
| Upload says "could not be saved on the server" | The `UPLOAD_DIR` folder exists and is in your home directory; see Runtime Logs |
| Images disappear after a deploy | `UPLOAD_DIR` points inside `domains/…/public_html` or the app folder — move it to the home directory |
| Can't sign in on a fresh database | `ADMIN_PASSWORD` is at least 8 characters and matches exactly; the bootstrap only runs while no admin exists |
