/**
 * Catalog fidelity data (live interwood.pk → Cozy Furnitures). Idempotent; re-run after `npm run db:seed`:
 *
 *   npx tsx scripts/fidelity/catalog.ts            # DB updates + download any missing collection images
 *   npx tsx scripts/fidelity/catalog.ts --offline  # DB updates only (uses images already in public/)
 *   npx tsx scripts/fidelity/catalog.ts --refresh-search  # also re-snapshot the live search order
 *
 * 1. Collection descriptions: the seed reads `body_html`, but data/raw/collections.json stores the
 *    SEO HTML under `description`. Copy it (rebranded) into `Collection.description`.
 * 2. Featured order: data/raw/collections/{handle}.json is the live manual order. Store it as
 *    `Collection.metafield.productOrder` (other metafield keys are preserved).
 * 3. /collections index images: download the live collection image (800px wide) for every index card
 *    into public/images/collections/{handle}.{ext} and point `Collection.image` at it.
 *    Images that carry the old brand's logo are listed in SKIP_IMAGES and fall back to the placeholder.
 * 4. Card swatches: for every product with a colour option, the image each swatch shows and which swatch
 *    is `.active` → src/components/catalog/swatch-variants.json (read by catalog-data.ts). Live (Habitat
 *    product-card) takes the selected-or-first-available variant, and per colour value picks the variant
 *    with that colour + the selected variant's other options (else the first with that colour); its
 *    featured image is the swatch image, and the swatch is `active` only when that image is the
 *    product's featured image. Image = Shopify image position (= ProductImage.position).
 * 5. Sold out: handles whose every live variant is unavailable → src/components/catalog/live-sold-out.json.
 *    catalog-data.ts shows live's "Sold Out" status bar for them when no live status metafield is known.
 * 6. (--refresh-search only) Live search order: the product handles of the first 10 live result pages
 *    for SEARCH_QUERIES → src/components/catalog/live-search-order.json (read by catalog-data.ts).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../..');
const RAW = path.join(ROOT, 'data/raw');
const IMG_DIR = path.join(ROOT, 'public/images/collections');
const INDEX: { handle: string; title: string; image?: string; placeholder?: number }[] = JSON.parse(
  readFileSync(path.join(ROOT, 'src/components/catalog/collections-index.json'), 'utf8'),
);

/** Index images that show the old brand's logo/wordmark at full resolution (verified by eye). */
const SKIP_IMAGES = new Set<string>([]);

const offline = process.argv.includes('--offline');
const refreshSearch = process.argv.includes('--refresh-search') && !offline;
const SEARCH_ORDER_FILE = path.join(ROOT, 'src/components/catalog/live-search-order.json');
const SEARCH_QUERIES = [
  'sofa', 'bed', 'table', 'chair', 'dining', 'wardrobe', 'desk', 'mirror', 'cabinet', 'office', 'mattress', 'sofa set',
  'center table', 'dining table', 'office chair', 'bed set', 'side table', 'dresser', 'lamp', 'rug', 'cushion', 'kids',
  'outdoor', 'shelf',
];

async function snapshotSearchOrder() {
  const out: Record<string, string[]> = {};
  for (const q of SEARCH_QUERIES) {
    const seen: string[] = [];
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(`https://interwood.pk/search?${new URLSearchParams({ q, page: String(page) })}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }).catch(() => null);
      if (!res?.ok) break;
      const html = await res.text();
      const fresh = [...new Set([...html.matchAll(/href="\/products\/([^"?#/]+)/g)].map((m) => m[1]))].filter((h) => !seen.includes(h));
      if (!fresh.length) break;
      seen.push(...fresh);
    }
    out[q] = seen;
    console.log(`  search "${q}": ${seen.length} handles`);
  }
  writeFileSync(SEARCH_ORDER_FILE, `${JSON.stringify(out, null, 0)}\n`);
}
const prisma = new PrismaClient();

const SWATCH_FILE = path.join(ROOT, 'src/components/catalog/swatch-variants.json');
const COLOR_OPTION = /^colou?rs?$/i;
type RawVariant = { option1: string | null; option2: string | null; option3: string | null; available?: boolean; featured_image?: { id: number } | null };
type RawProduct = { handle: string; options: { name: string; values: string[] }[]; variants: RawVariant[]; images: { id: number; position: number }[] };

function writeSwatchVariants() {
  const dir = path.join(RAW, 'products');
  const products: RawProduct[] = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')).products);
  const out: Record<string, { active: string | null; images: Record<string, number> }> = {};
  for (const p of products) {
    const idx = p.options.findIndex((o) => COLOR_OPTION.test(o.name.trim()));
    if (idx < 0 || !p.variants.length) continue;
    const opt = (v: RawVariant, j: number) => [v.option1, v.option2, v.option3][j];
    const selected = p.variants.find((v) => v.available) ?? p.variants[0];
    const positionOf = new Map(p.images.map((im) => [im.id, im.position]));
    const featuredId = p.images[0]?.id;
    const entry: { active: string | null; images: Record<string, number> } = { active: null, images: {} };
    for (const value of p.options[idx].values) {
      const withColour = p.variants.filter((v) => opt(v, idx) === value);
      const v =
        withColour.find((c) => p.options.every((_, j) => j === idx || opt(c, j) === opt(selected, j))) ?? withColour[0];
      const imageId = v?.featured_image?.id;
      const pos = imageId != null ? positionOf.get(imageId) : undefined;
      if (pos != null) entry.images[value] = pos;
      if (imageId != null && imageId === featuredId && entry.active == null) entry.active = value;
    }
    out[p.handle] = entry;
  }
  writeFileSync(SWATCH_FILE, `${JSON.stringify(out, null, 0)}\n`);
  return Object.keys(out).length;
}

const SOLD_OUT_FILE = path.join(ROOT, 'src/components/catalog/live-sold-out.json');

function writeSoldOut() {
  const dir = path.join(RAW, 'products');
  const handles = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')).products as RawProduct[])
    .filter((p) => p.variants.length > 0 && p.variants.every((v) => v.available === false))
    .map((p) => p.handle)
    .sort();
  writeFileSync(SOLD_OUT_FILE, `${JSON.stringify(handles, null, 0)}\n`);
  return handles.length;
}

/** Same rebrand rules as prisma/seed.ts (longest patterns first). */
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
    .replace(/ {2,}/g, ' ')
    .trim();
}

function parseMeta(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** `.../Bed-Sets-Banner.jpg?v=1` → `.../Bed-Sets-Banner_800x.jpg?v=1` */
function sized(url: string): string {
  return url.replace(/(\.[a-z0-9]+)(\?|$)/i, '_800x$1$2');
}

function localImage(handle: string): string | null {
  if (!existsSync(IMG_DIR)) return null;
  const f = readdirSync(IMG_DIR).find((n) => n.replace(/\.[a-z0-9]+$/i, '') === handle);
  return f ? `/images/collections/${f}` : null;
}

async function download(handle: string, url: string): Promise<string | null> {
  const existing = localImage(handle);
  if (existing || offline) return existing;
  const ext = (url.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] ?? 'jpg').toLowerCase();
  try {
    const res = await fetch(sized(url));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    mkdirSync(IMG_DIR, { recursive: true });
    writeFileSync(path.join(IMG_DIR, `${handle}.${ext}`), Buffer.from(await res.arrayBuffer()));
    return `/images/collections/${handle}.${ext}`;
  } catch (e) {
    console.warn(`  image ${handle}: ${(e as Error).message}`);
    return null;
  }
}

async function main() {
  const raw: { handle: string; description?: string | null }[] = JSON.parse(
    readFileSync(path.join(RAW, 'collections.json'), 'utf8'),
  ).collections;
  const descByHandle = new Map(raw.map((c) => [c.handle, rebrand(c.description ?? '')]));
  const imageByHandle = new Map(INDEX.filter((c) => c.image).map((c) => [c.handle, c.image as string]));

  const collections = await prisma.collection.findMany({ select: { id: true, handle: true, image: true, metafield: true, description: true } });
  let descs = 0;
  let orders = 0;
  let images = 0;
  for (const c of collections) {
    const data: { description?: string; metafield?: string; image?: string | null } = {};

    const desc = descByHandle.get(c.handle);
    if (desc != null && desc !== c.description) {
      data.description = desc;
      descs++;
    }

    const orderFile = path.join(RAW, 'collections', `${c.handle}.json`);
    if (existsSync(orderFile)) {
      const productOrder: string[] = JSON.parse(readFileSync(orderFile, 'utf8'));
      const meta = parseMeta(c.metafield);
      if (JSON.stringify(meta.productOrder) !== JSON.stringify(productOrder)) {
        data.metafield = JSON.stringify({ ...meta, productOrder });
        orders++;
      }
    }

    const liveImage = imageByHandle.get(c.handle);
    if (liveImage && !SKIP_IMAGES.has(c.handle)) {
      const img = c.image ?? (await download(c.handle, liveImage));
      if (img && img !== c.image) {
        data.image = img;
        images++;
      }
    } else if (SKIP_IMAGES.has(c.handle) && c.image) {
      data.image = null;
      images++;
    }

    if (Object.keys(data).length) await prisma.collection.update({ where: { id: c.id }, data });
  }

  // Virtual index cards (frontpage / all / all-1) have no DB row: just make sure their image is on disk.
  const known = new Set(collections.map((c) => c.handle));
  for (const c of INDEX) {
    if (!known.has(c.handle) && c.image && !SKIP_IMAGES.has(c.handle)) await download(c.handle, c.image);
  }

  const swatchProducts = writeSwatchVariants();
  const soldOut = writeSoldOut();
  console.log(
    `catalog fidelity: ${descs} descriptions, ${orders} product orders, ${images} images updated, ${swatchProducts} swatch products, ${soldOut} sold out`,
  );
  if (refreshSearch) await snapshotSearchOrder();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
