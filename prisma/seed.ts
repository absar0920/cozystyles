/**
 * Seed the database from data/raw/ (scraped from interwood.pk).
 * Run: npm run db:seed  (after npm run images so local image paths exist)
 *
 * After the raw seed it applies every fidelity step (global, home, catalog, product, content — all offline)
 * and then the admin easy-mode migration, so a fresh reseed reaches the same end state as a migrated database.
 * Uploaded files (Upload rows + storage/uploads) are left alone; the orphan sweep removes unused ones later.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { GLOBAL_MENUS, GLOBAL_SETTINGS, applyGlobalFidelity, createMenuTree } from '../scripts/fidelity/global';
import { applyHomeFidelity, applyHomeHotSellingOrder } from '../scripts/fidelity/home';
import { applyCatalogFidelity } from '../scripts/fidelity/catalog';
import { applyProductFidelity } from '../scripts/fidelity/product';
import { applyContentFidelity } from '../scripts/fidelity/content';
import { printReport, runAdminEasyModeMigration } from '../scripts/migrate-admin-easy-mode';

const prisma = new PrismaClient();
const RAW = 'data/raw';

type ShopifyImage = { src: string; alt?: string | null; position?: number };
type ShopifyVariant = {
  id: number; title: string; sku?: string | null; price: string; compare_at_price?: string | null;
  option1?: string | null; option2?: string | null; option3?: string | null;
  available?: boolean; position?: number; grams?: number; featured_image?: { src: string } | null;
  inventory_quantity?: number;
};
type ShopifyProduct = {
  id: number; title: string; handle: string; body_html?: string; vendor?: string; product_type?: string;
  tags?: string | string[]; published_at?: string | null; created_at?: string; options?: { name: string; values: string[] }[];
  variants: ShopifyVariant[]; images: ShopifyImage[];
};
type ShopifyCollection = { id: number; handle: string; title: string; body_html?: string; products_count?: number; image?: { src: string } | null };

const manifest: Record<string, string> = existsSync('data/image-manifest.json')
  ? JSON.parse(readFileSync('data/image-manifest.json', 'utf8'))
  : {};

function mapImg(src?: string | null): string | null {
  if (!src) return null;
  if (manifest[src]) return manifest[src];
  // try matching ignoring query strings
  const base = src.split('?')[0];
  const hit = Object.keys(manifest).find((k) => k.split('?')[0] === base);
  return hit ? manifest[hit] : null;
}

function priceToInt(p?: string | null): number | null {
  if (p == null || p === '') return null;
  return Math.round(parseFloat(p));
}

/** Rebrand scraped Interwood content → Cozy Furnitures (longest patterns first). */
function rebrand(s: string): string {
  if (!s) return s;
  return s
    .replace(/Interwood Mobel \(Pvt\.?\) ?\.? Ltd\.?/gi, 'Cozy Furnitures (Pvt.) Ltd.')
    .replace(/Interwood Mobel/gi, 'Cozy Furnitures')
    .replace(/Interwoodmobel/gi, 'Cozy Furnitures')
    .replace(/https?:\/\/careers\.interwood\.pk\/?/gi, '/pages/contact')
    .replace(/https?:\/\/corporate\.interwood\.pk\/?[a-z/-]*/gi, '/pages/contact')
    .replace(/[\w.+-]*@[\w-]*interwood[\w.-]*\.[a-z.]+/gi, (m) => m.replace(/[\w.-]*interwood[\w.-]*/i, 'cozyfurnitures'))
    .replace(/https?:\/\/(?:www\.)?interwood\.pk/gi, '')
    .replace(/interwood\.pk/gi, 'cozyfurnitures.pk')
    .replace(/Interwood/g, 'Cozy Furnitures')
    .replace(/interwood/gi, 'Cozy Furnitures')
    .replace(/Cozy Furnitures began as a humble carpentry shop[\s\S]{0,200}?/i, (m) =>
      m.replace(/[\s\S]*/, 'Cozy Furnitures grew from a small Lahore workshop into one of Pakistan’s most loved furniture brands.'),
    )
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** Extract page body HTML between template header and footer. */
function extractPageBody(html: string): string {
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  // content = from first template section to the footer sections group (first `sections--` AFTER a template section)
  const firstTemplate = s.search(/<div id="shopify-section-template--/);
  if (firstTemplate >= 0) {
    const rest = s.slice(firstTemplate + 10);
    const footRel = rest.search(/<div id="shopify-section-sections--/);
    s = footRel > 0 ? s.slice(firstTemplate, firstTemplate + 10 + footRel) : s.slice(firstTemplate);
  }
  s = s
    .replace(/<\/?velcroframe[^>]*>/gi, '')
    .replace(/https?:\/\/interwood(-pkt)?\.myshopify\.com/g, '')
    .replace(/https?:\/\/interwood\.pk/g, '')
    .replace(/\sdata-[a-z-]+="[^"]*"/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    // Shopify forms are inert on our site; neutralise so they render as content
    .replace(/<form[^>]*>/gi, '<div class="bg-cream-soft rounded-lg">')
    .replace(/<\/form>/gi, '</div>')
    .trim();
  return s;
}

function titleFromHtml(html: string): string {
  const m = html.match(/<title>\s*([\s\S]*?)\s*<\/title>/);
  return (m ? m[1] : 'Untitled').replace(/\s*[–-]\s*Interwood\s*$/i, '').replace(/\n/g, ' ').trim();
}

async function main() {
  console.log('Seeding…');

  // ---------- wipe ----------
  await prisma.$transaction([
    prisma.whatsAppInquiry.deleteMany(), prisma.migrationStep.deleteMany(), prisma.collectionIndexCard.deleteMany(),
    prisma.productOptionValue.deleteMany(), prisma.productOption.deleteMany(),
    prisma.review.deleteMany(),
    prisma.contactSubmission.deleteMany(), prisma.banner.deleteMany(), prisma.menuItem.deleteMany(),
    prisma.productImage.deleteMany(), prisma.variant.deleteMany(),
    prisma.productLayoutPreview.deleteMany(), prisma.productLayoutSection.deleteMany(), prisma.productLayout.deleteMany(),
    prisma.$executeRawUnsafe('DELETE FROM _ProductCollections'),
    prisma.collection.deleteMany(), prisma.product.deleteMany(),
    prisma.page.deleteMany(), prisma.siteSetting.deleteMany(), prisma.adminUser.deleteMany(),
  ]);

  // ---------- admin ----------
  await prisma.adminUser.create({
    data: {
      email: (process.env.ADMIN_EMAIL ?? 'admin@cozyfurnitures.pk').toLowerCase(),
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'CozyAdmin@2026', 10),
      name: 'Cozy Furnitures Admin',
      role: 'SUPERADMIN',
    },
  });

  // ---------- products ----------
  const productFiles = readdirSync(path.join(RAW, 'products')).filter((f) => f.endsWith('.json')).sort();
  const allProducts = new Map<string, ShopifyProduct>();
  for (const f of productFiles) {
    const parsed = JSON.parse(readFileSync(path.join(RAW, 'products', f), 'utf8'));
    for (const p of parsed.products ?? []) allProducts.set(p.handle, p);
  }
  console.log(`products found: ${allProducts.size}`);

  // hot-selling handles (from homepage campaign collections)
  const hotHandles = new Set<string>();
  for (const h of ['hot-selling-items-homepage', 'wedding-campaign-products', 'best-sellers', 'offer-of-the-week', 'exclusive-flash-deals']) {
    const fp = path.join(RAW, 'collections', `${h}.json`);
    if (existsSync(fp)) for (const x of JSON.parse(readFileSync(fp, 'utf8'))) hotHandles.add(x);
  }

  let imgMiss = 0;
  for (const p of allProducts.values()) {
    const variants = p.variants ?? [];
    const images = (p.images ?? [])
      .map((img, i) => ({ ...img, position: img.position ?? i + 1 }))
      .map((img) => ({ src: mapImg(img.src), alt: img.alt ?? p.title, position: img.position }))
      .filter((img): img is { src: string; alt: string; position: number } => !!img.src);
    if (!images.length) imgMiss++;

    const tags = Array.isArray(p.tags) ? p.tags.join(',') : (p.tags ?? '');
    const opts = (p.options ?? []).filter((o) => o.name !== 'Title' && o.values?.length > 1);

    await prisma.product.create({
      data: {
        handle: p.handle,
        title: p.title,
        bodyHtml: rebrand(p.body_html ?? ''),
        vendor: rebrand(p.vendor ?? 'Cozy Furnitures'),
        productType: p.product_type ?? '',
        status: 'ACTIVE',
        hot: hotHandles.has(p.handle),
        tags,
        legacyOptions: JSON.stringify(opts), // the easy-mode migration turns this into ProductOption rows
        createdAt: p.created_at ? new Date(p.created_at) : new Date(),
        variants: {
          create: variants.map((v, i) => ({
            title: v.title && v.title !== 'Default Title' ? v.title : 'Default Title',
            sku: v.sku ?? null,
            price: priceToInt(v.price) ?? 0,
            compareAtPrice: priceToInt(v.compare_at_price),
            option1: v.option1 && v.option1 !== 'Default Title' ? v.option1 : null,
            option2: v.option2 ?? null,
            option3: v.option3 ?? null,
            legacyInventory: v.available === false ? 0 : (v.inventory_quantity ?? 25 > 0 ? Math.max(5, v.inventory_quantity ?? 25) : 25),
            position: v.position ?? i + 1,
            weightGrams: v.grams ?? 0,
          })),
        },
        images: { create: images },
      },
    });
  }
  console.log(`products seeded (${imgMiss} without local images)`);

  // ---------- collections ----------
  const collectionDefs: ShopifyCollection[] = [];
  for (const f of ['collections.json', 'collections-extra-2.json', 'collections-extra-3.json', 'collections-extra-4.json', 'collections-extra-5.json']) {
    const fp = path.join(RAW, f);
    if (existsSync(fp)) collectionDefs.push(...JSON.parse(readFileSync(fp, 'utf8')).collections);
  }
  const dedup = new Map<string, ShopifyCollection>();
  for (const c of collectionDefs) if (!dedup.has(c.handle)) dedup.set(c.handle, c);

  const parentIdFor: Record<string, string> = {
    // bedroom children
    'bed-set': 'bedroom', 'double-bed-set': 'bedroom', 'king-size-beds': 'bedroom', 'queen-size-beds': 'bedroom',
    'single-beds': 'bedroom', 'bed-side-tables': 'bedroom', 'dressing-tables': 'bedroom', 'bedroom-chairs': 'bedroom',
    'wall-mirrors': 'bedroom', 'beds': 'bedroom', 'bed-sets-offer-homepage': 'bedroom',
    // living children
    'sofas-1': 'living', 'sofa-set': 'living', 'sofas-all': 'living', '2-seater-sofa': 'living', '3-seater-sofa': 'living',
    'l-shaped-sofa': 'living', 'ottoman': 'living', 'benches': 'living', 'recliners': 'living', 'sofa-cum-bed': 'living',
    'center-table': 'living', 'coffee-tables': 'living', 'side-end-tables': 'living', 'nested-tables': 'living',
    'tv-units': 'living', 'living-storage': 'living', 'living-chairs': 'living', 'seating-chairs': 'living',
    'occasional-chairs': 'living', 'relax-chairs': 'living', 'lounge-chairs': 'living', 'stools': 'living',
    'accent-chairs': 'living', 'sofa-chair': 'living', 'tables': 'living',
    // dining children
    'dining-tables': 'dining', 'dining-table-sets': 'dining', 'dining-chairs': 'dining', 'bar-stools': 'dining',
    // kids children
    'kids-bed-sets': 'kids', 'kids-single-beds': 'kids', 'bunk-beds': 'kids', 'kids-wardrobe': 'kids',
    'kids-study-tables': 'kids', 'kids-study-chairs': 'kids', 'kids-beds': 'kids', 'kids-storage': 'kids',
    'kids-seating-chairs': 'kids', 'kids-study-tables-and-chairs': 'kids',
    // study/home-office
    'study-tables': 'study', 'study-chairs': 'study', 'ergonomic-study-chairs': 'study', 'computer-tables': 'study',
    'study-bookshelves': 'study', 'wall-shelves': 'study', 'study-table-sets': 'study', 'home-office-desks': 'study',
    // decor children
    'cushions': 'decor-acc', 'table-runners': 'decor-acc', 'lamps-and-lighting': 'decor-acc', 'clocks': 'decor-acc',
    'art-frames': 'decor-acc', 'picture-frames': 'decor-acc', 'candles': 'decor-acc', 'candle-holders': 'decor-acc',
    'accent-mirrors': 'decor-acc', 'trays': 'decor-acc', 'trash-can': 'decor-acc', 'wall-paintings': 'decor-acc',
    'soft-furnishing': 'decor-acc', 'home-accessories': 'decor-acc', 'all-decor': 'decor-acc',
    // office children
    'office-tables': 'office', 'manager-tables': 'office', 'executive-tables': 'office', 'workstations': 'office',
    'workstations-layout-linear': 'office', 'workstations-layout-y': 'office', 'workstations-layout-grid': 'office',
    'office-desks': 'office', 'office-chairs': 'office', 'office-chairs-1': 'office', 'manager-chairs': 'office',
    'executive-chairs': 'office', 'ceo-chairs': 'office', 'high-back-chairs': 'office',
    'office-chairs-visitor-chairs': 'office', 'cafeteria-chairs': 'office', 'ergonomic-study-chairs-x': 'office',
    'office-sofas': 'office', 'office-sofa-set': 'office', 'office-executive-furniture-sets': 'office',
    'office-executive-furniture-sets-traditional': 'office', 'meeting-tables': 'office', 'reception-counters': 'office',
    'office-storage': 'office', 'office-storage-1': 'office', 'drawer-pedestals': 'office', 'filing-cabinets': 'office',
    'office-center-tables': 'office', 'sofa-side-tables': 'office', 'office-accessories': 'office',
    'meeting-tables-pods': 'office', 'meeting-phone-pods': 'office', 'co-working-spaces': 'office',
    'seating': 'office', 'office-seating-lounge-chairs': 'office', 'co-working-spaces-stools-chairs': 'office',
    'bean-bags': 'office',
    // kitchen children
    'kitchen-designs': 'kitchens', 'small-kitchen-design': 'kitchens', 'modern-kitchen-design-1': 'kitchens',
    'traditional-kitchen-design-1': 'kitchens', 'kitchen-accessories': 'kitchens', 'kitchen-accessories-1': 'kitchens',
    'kitchen-appliances': 'kitchens', 'kitchen-sink': 'kitchens', 'column-system-1': 'kitchens', 'basket-rack-system-2': 'kitchens',
    // wardrobes children
    'built-in-wardrobes': 'wardrobes-1', 'sliding-wardrobes': 'wardrobes-1', '2-doors-wardrobes': 'wardrobes-1',
    '3-doors-wardrobes': 'wardrobes-1', '4-doors-wardrobes': 'wardrobes-1', 'wardrobe-accessories': 'wardrobes-1',
    // doors children
    'main-doors': 'doors', 'panel-doors': 'doors', 'glass-door': 'doors', 'veneer-door': 'doors',
    'thermoset-doors': 'doors', 'painted-door': 'doors', 'laminated-door': 'doors', 'sliding-door': 'doors',
    // furniture umbrella
    'bedroom': 'furniture', 'living': 'furniture', 'dining': 'furniture', 'kids': 'furniture', 'study': 'furniture',
  };

  const handlesByTitle = new Map<string, string>();
  for (const c of dedup.values()) handlesByTitle.set(c.title.trim().toLowerCase(), c.handle);

  const collectionIdByHandle = new Map<string, number>();
  for (const c of dedup.values()) {
    if (c.handle === 'all' || c.handle === 'frontpage' || c.handle === 'all-1') continue;
    const parentHandle = parentIdFor[c.handle];
    const parent = parentHandle ? collectionIdByHandle.get(parentHandle) : null;
    const img = mapImg(c.image?.src);
    const created = await prisma.collection.create({
      data: {
        handle: c.handle,
        title: c.title.trim(),
        description: rebrand(c.body_html ?? ''),
        image: img,
        parentId: parent ?? null,
      },
    });
    collectionIdByHandle.set(c.handle, created.id);
  }
  console.log(`collections seeded: ${collectionIdByHandle.size}`);

  // product <-> collection links
  const colDir = path.join(RAW, 'collections');
  let linked = 0;
  for (const f of readdirSync(colDir)) {
    if (!f.endsWith('.json')) continue;
    const handle = f.replace('.json', '');
    const cid = collectionIdByHandle.get(handle);
    if (!cid) continue;
    const productHandles: string[] = JSON.parse(readFileSync(path.join(colDir, f), 'utf8'));
    const ids: number[] = [];
    for (const h of productHandles) {
      const p = await prisma.product.findUnique({ where: { handle: h }, select: { id: true } });
      if (p) ids.push(p.id);
    }
    if (ids.length) {
      await prisma.collection.update({ where: { id: cid }, data: { products: { connect: ids.map((id) => ({ id })) } } });
      linked += ids.length;
    }
  }
  console.log(`product-collection links: ${linked}`);

  // umbrella collections referenced by hero banners that don't exist standalone on the live site
  const umbrellas: { handle: string; title: string; from: string[]; image?: string }[] = [
    { handle: 'coalesce-office', title: 'Coalesce Office', from: ['coalesce-office-manager-desks', 'coalesce-office-workstations', 'coalesce-office-tables', 'coalesce-office-sofas', 'coalesce-office-storage'] },
    { handle: 'coalesce-home', title: 'Coalesce Home', from: ['coalesce-living', 'coalesce-dining', 'coalesce-bedroom'] },
  ];
  for (const u of umbrellas) {
    const prods = await prisma.product.findMany({
      where: { collections: { some: { handle: { in: u.from } } } },
      select: { id: true, images: { take: 1, select: { src: true }, orderBy: { position: 'asc' } } },
    });
    await prisma.collection.create({
      data: {
        handle: u.handle,
        title: u.title,
        description: `The ${u.title} collection — designed to bring it all together.`,
        image: prods.map((p) => p.images[0]?.src).find(Boolean) ?? null,
        products: { connect: prods.map((p) => ({ id: p.id })) },
      },
    });
    console.log(`umbrella ${u.handle}: ${prods.length} products`);
  }

  // ---------- pages ----------
  const pagesDir = path.join(RAW, 'pages');
  for (const f of readdirSync(pagesDir)) {
    if (!f.endsWith('.html')) continue;
    const html = readFileSync(path.join(pagesDir, f), 'utf8');
    const handle = f.replace('.html', '');
    await prisma.page.create({
      data: {
        handle,
        title: rebrand(titleFromHtml(html)),
        bodyHtml: rebrand(extractPageBody(html)),
      },
    });
  }
  // blog posts
  const blogsDir = path.join(RAW, 'blogs', 'news');
  if (existsSync(blogsDir)) {
    for (const f of readdirSync(blogsDir)) {
      if (!f.endsWith('.html')) continue;
      const html = readFileSync(path.join(blogsDir, f), 'utf8');
      const handle = f.replace('.html', '');
      await prisma.page.create({
        data: { handle: `news-${handle}`, title: rebrand(titleFromHtml(html)), bodyHtml: rebrand(extractPageBody(html)), legacyIsBlogPost: true },
      });
    }
  }
  console.log('pages seeded');

  // ---------- menus ----------
  // Live chrome menus (MAIN mega menu, footer INFORMATION / USER AREA, footer SEO link sections)
  // are shared with scripts/fidelity/global.ts so a reseed stays faithful to the live site.
  for (const [location, items] of Object.entries(GLOBAL_MENUS)) await createMenuTree(prisma, items, location);
  console.log('menus seeded');

  // ---------- featured category tiles (homepage) ----------
  const featuredSpecs: { handle: string; fallback?: string }[] = [
    { handle: 'bedroom' }, { handle: 'living' }, { handle: 'dining' }, { handle: 'kids' },
    { handle: 'office', fallback: 'office-chairs' }, { handle: 'kitchens' },
    { handle: 'wardrobes-1' }, { handle: 'doors' }, { handle: 'laminate-flooring' },
    { handle: 'decor-acc' }, { handle: 'study', fallback: 'study-tables' }, { handle: 'sale' },
  ];
  for (const spec of featuredSpecs) {
    const col = await prisma.collection.findUnique({
      where: { handle: spec.handle },
      include: { products: { take: 3, select: { images: { take: 1, select: { src: true }, orderBy: { position: 'asc' } } } } },
    });
    if (!col) continue;
    let image = col.image;
    if (!image && spec.fallback) {
      image = (await prisma.collection.findUnique({ where: { handle: spec.fallback }, select: { image: true } }))?.image ?? null;
    }
    if (!image) image = col.products.map((p) => p.images[0]?.src).find(Boolean) ?? null;
    if (image) await prisma.collection.update({ where: { handle: spec.handle }, data: { image } });
  }
  console.log('featured tiles configured');

  // ---------- banners (hero slider) ----------
  const heroBannerNames = [
    { n: 'home-02', m: 'home-03', title: 'Wedding Season Sale', href: '/collections/wedding-campaign-products' },
    { n: 'home-06', m: 'home-07', title: 'Free Nationwide Delivery', href: '/collections/all' },
    { n: 'home-10', m: 'home-11', title: 'Spaces Evolve — New Arrivals', href: '/collections/new-arrivals' },
    { n: 'home-14', m: 'home-15', title: 'Coalesce Office', href: '/collections/coalesce-office' },
    { n: 'home-18', m: 'home-19', title: 'Berlin Collection', href: '/collections/berlin' },
    { n: 'home-22', m: 'home-23', title: 'Cushions Collection', href: '/collections/cushions' },
    { n: 'home-26', m: 'home-27', title: 'Coalesce Home', href: '/collections/coalesce-home' },
  ];
  let bpos = 0;
  for (const b of heroBannerNames) {
    const local = Object.values(manifest).find((v) => v.includes(b.n));
    const mob = Object.values(manifest).find((v) => v.includes(b.m));
    if (!local) { console.log('banner image missing:', b.n); continue; }
    await prisma.banner.create({
      data: { title: b.title, href: b.href, image: local, mobileImage: mob ?? null, position: bpos++ },
    });
  }
  console.log('banners seeded');

  // ---------- reviews ----------
  const names = ['Ayesha K.', 'Hamza R.', 'Fatima S.', 'Ali R.', 'Zainab M.', 'Bilal A.', 'Sana T.', 'Usman G.', 'Maryam N.', 'Ahmed D.', 'Hira B.', 'Omar F.'];
  const cities = ['Lahore', 'Karachi', 'Islamabad', 'Faisalabad', 'Multan', 'Rawalpindi'];
  const bodies = [
    'Excellent quality, exactly as shown on the website. Delivery was quick and installation team was very professional.',
    'Very sturdy and beautiful finish. Completely transformed my room. Highly recommended!',
    'Great value for money. The fabric quality exceeded my expectations.',
    'Outstanding customer service and the product is top-notch. Will definitely buy again.',
    'Beautiful craftsmanship. The color matches perfectly with my interior.',
    'Received in perfect condition. Assembly was done by their team, very satisfied overall.',
    'Premium quality at a reasonable price. The finish looks luxurious.',
    'Been using it for months now and it still looks brand new. Very durable.',
  ];
  const hotProducts = await prisma.product.findMany({ where: { hot: true }, select: { id: true }, take: 120 });
  let ridx = 0;
  for (const p of hotProducts) {
    const n = 2 + (ridx % 3);
    for (let i = 0; i < n; i++) {
      const k = ridx * 7 + i * 3;
      await prisma.review.create({
        data: {
          productId: p.id,
          author: `${names[k % names.length]} — ${cities[(k + 1) % cities.length]}`,
          rating: 4 + ((k + 2) % 2 === 0 ? 1 : 0),
          body: bodies[k % bodies.length],
          approved: true,
        },
      });
    }
    const revs = await prisma.review.count({ where: { productId: p.id } });
    const avg = await prisma.review.aggregate({ where: { productId: p.id }, _avg: { rating: true } });
    await prisma.product.update({ where: { id: p.id }, data: { reviewCount: revs, rating: Math.round((avg._avg.rating ?? 5) * 10) / 10 } });
    ridx++;
  }
  console.log('reviews seeded');

  // ---------- settings ----------
  const settings: Record<string, string> = {
    ...GLOBAL_SETTINGS, // announcement bar copy + links (live verbatim)
    phone: '+92-42-111-269-926',
    email: 'info@cozyfurnitures.pk',
    complaintsEmail: 'complaints@cozyfurnitures.pk',
    whatsapp: '923092050463',
    address: 'Main Boulevard, Gulberg III, Lahore, Pakistan',
    facebook: '#',
    instagram: '#',
    youtube: '#',
    linkedin: '#',
  };
  for (const [key, value] of Object.entries(settings)) await prisma.siteSetting.create({ data: { key, value } });

  // ---------- fidelity (live data) + admin easy-mode migration ----------
  await applyGlobalFidelity(prisma);
  console.log('global fidelity applied');
  await applyHomeFidelity(prisma);
  await applyCatalogFidelity(prisma, { offline: true });
  await applyProductFidelity(prisma, { offline: true });
  await applyContentFidelity(prisma);
  printReport(await runAdminEasyModeMigration(prisma, { backup: false }));
  // last: every step above may update products, and the home Hot Selling row follows their last change
  await applyHomeHotSellingOrder(prisma);

  console.log('SEED COMPLETE');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
