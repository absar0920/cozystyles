/**
 * Product page fidelity data (live interwood.pk → Cozy Furnitures). Idempotent; re-run after `npm run db:seed`:
 *
 *   npx tsx scripts/fidelity/product.ts            # fetch any uncached live review widgets, then update the DB
 *   npx tsx scripts/fidelity/product.ts --offline  # DB updates only, from data/raw/reviews.json
 *
 * Reviews: prisma/seed.ts invents 2–4 reviews per "hot" product, but live product pages show the real
 * Judge.me widget — "Be the first to write a review" for most products, real reviews for a few.
 * For every product that has seeded reviews or a live rating, this script reads the Judge.me widget
 * embedded in the live product HTML (cached in data/raw/reviews.json), deletes the seeded reviews,
 * inserts the live ones (rebranded) and recomputes `Product.reviewCount` / `Product.rating`.
 * Customer-submitted reviews (from the storefront form) are left untouched.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../..');
const CACHE = path.join(ROOT, 'data/raw/reviews.json');
const LIVE_CARD_DATA = path.join(ROOT, 'src/components/catalog/live-card-data.json');

type LiveReview = { author: string; rating: number; title: string; body: string; createdAt: string };
type LiveWidget = { count: number; average: number; reviews: LiveReview[] };

/** Author/city lists used by prisma/seed.ts — seeded reviews are "Name — City". */
const SEED_NAMES = ['Ayesha K.', 'Hamza R.', 'Fatima S.', 'Ali R.', 'Zainab M.', 'Bilal A.', 'Sana T.', 'Usman G.', 'Maryam N.', 'Ahmed D.', 'Hira B.', 'Omar F.'];
const SEED_CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Faisalabad', 'Multan', 'Rawalpindi'];
const SEEDED_AUTHORS = new Set(SEED_NAMES.flatMap((n) => SEED_CITIES.map((c) => `${n} — ${c}`)));

const offline = process.argv.includes('--offline');
const prisma = new PrismaClient();

function decode(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/gi, '&');
}

function text(html: string): string {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function rebrand(s: string): string {
  return s.replace(/Interwood/g, 'Cozy Furnitures').replace(/interwood/gi, 'Cozy Furnitures');
}

/** Parses `.jdgm-rev` review blocks (live product HTML or the Judge.me pagination API html). */
function parseReviews(html: string): LiveReview[] {
  const reviews: LiveReview[] = [];
  const blocks = html.split(/<div class='jdgm-rev jdgm-divider-top'/).slice(1);
  for (const block of blocks) {
    const author = text(block.match(/class='jdgm-rev__author'>([\s\S]*?)<\/span>/)?.[1] ?? '') || 'Anonymous';
    const rating = Number(block.match(/data-score='(\d)'/)?.[1] ?? 5);
    const title = text(block.match(/class='jdgm-rev__title'>([\s\S]*?)<\/b>/)?.[1] ?? '');
    const body = text(block.match(/class='jdgm-rev__body'>([\s\S]*?)<\/div>/)?.[1] ?? '');
    const ts = block.match(/class='jdgm-rev__timestamp[^']*'[^>]*data-content='([^']+)'/)?.[1] ?? '';
    const createdAt = ts ? new Date(ts.replace(' UTC', 'Z').replace(' ', 'T')).toISOString() : new Date(0).toISOString();
    reviews.push({ author: rebrand(author), rating, title: rebrand(title), body: rebrand(body), createdAt });
  }
  return reviews;
}

const SHOP = 'interwood-pkt.myshopify.com';

/**
 * Parses the Judge.me widget (`.jdgm-rev-widg`) server-rendered into the live product HTML. Only the
 * first 5 reviews are embedded; later pages come from the public widget API like the live widget does.
 */
async function parseWidget(html: string): Promise<LiveWidget> {
  const head = html.match(/class='jdgm-rev-widg'[^>]*>/)?.[0] ?? '';
  const count = Number(head.match(/data-number-of-reviews='(\d+)'/)?.[1] ?? 0);
  const average = Number(head.match(/data-average-rating='([\d.]+)'/)?.[1] ?? 0);
  const reviews = parseReviews(html);
  const productId = html.match(/data-product-id='(\d+)'/)?.[1];
  for (let page = 2; productId && reviews.length < count && page <= 20; page++) {
    const url = `https://api.judge.me/reviews/reviews_for_widget?url=${SHOP}&shop_domain=${SHOP}&platform=shopify&page=${page}&per_page=5&product_id=${productId}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const more = parseReviews(((await res.json()) as { html?: string }).html ?? '');
    if (!more.length) break;
    reviews.push(...more);
  }
  return { count, average, reviews };
}

async function fetchWidget(handle: string): Promise<LiveWidget | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://interwood.pk/products/${handle}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (res.status === 404) return { count: 0, average: 0, reviews: [] };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await parseWidget(await res.text());
    } catch (e) {
      if (attempt === 2) {
        console.warn(`  ${handle}: ${(e as Error).message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return null;
}

async function main() {
  const cache: Record<string, LiveWidget> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
  const liveRated = Object.keys((JSON.parse(readFileSync(LIVE_CARD_DATA, 'utf8')).ratings ?? {}) as Record<string, number>);

  const seeded = await prisma.review.findMany({ select: { product: { select: { handle: true } }, author: true } });
  const targets = new Set<string>([
    ...seeded.filter((r) => SEEDED_AUTHORS.has(r.author)).map((r) => r.product.handle),
    ...liveRated,
    ...Object.keys(cache),
  ]);

  const missing = [...targets].filter((h) => !cache[h] || cache[h].reviews.length < cache[h].count);
  if (missing.length && !offline) {
    console.log(`fetching ${missing.length} live review widgets…`);
    const queue = [...missing];
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let h = queue.shift(); h; h = queue.shift()) {
          const w = await fetchWidget(h);
          if (w) cache[h] = w;
        }
      }),
    );
    const sorted = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
    writeFileSync(CACHE, JSON.stringify(sorted, null, 1) + '\n');
  }

  let cleared = 0;
  let imported = 0;
  for (const handle of targets) {
    const product = await prisma.product.findUnique({ where: { handle }, select: { id: true } });
    if (!product) continue;
    const live = cache[handle];
    if (!live) {
      console.warn(`  ${handle}: no cached live widget, leaving reviews as-is`);
      continue;
    }
    const existing = await prisma.review.findMany({ where: { productId: product.id } });
    const liveKeys = new Set(live.reviews.map((r) => `${r.author}\u0000${r.body}`));
    // seeded rows + rows imported by a previous run of this script
    const stale = existing.filter((r) => SEEDED_AUTHORS.has(r.author) || liveKeys.has(`${r.author}\u0000${r.body}`));
    if (stale.length) {
      await prisma.review.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
      cleared += stale.filter((r) => SEEDED_AUTHORS.has(r.author)).length;
    }
    for (const r of live.reviews) {
      await prisma.review.create({
        data: { productId: product.id, author: r.author, rating: r.rating, title: r.title, body: r.body, approved: true, createdAt: new Date(r.createdAt) },
      });
      imported++;
    }
    const agg = await prisma.review.aggregate({ where: { productId: product.id, approved: true }, _avg: { rating: true }, _count: true });
    await prisma.product.update({
      where: { id: product.id },
      data: {
        reviewCount: agg._count,
        rating: agg._count ? Math.round((live.average || agg._avg.rating || 5) * 100) / 100 : 4.9,
      },
    });
  }
  const partial = Object.entries(cache).filter(([, w]) => w.count > w.reviews.length);
  if (partial.length) console.log(`note: ${partial.length} products have more live reviews than the 5 embedded: ${partial.map(([h, w]) => `${h} (${w.count})`).join(', ')}`);
  console.log(`product fidelity: ${targets.size} products checked, ${cleared} seeded reviews removed, ${imported} live reviews imported`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
