#!/usr/bin/env node
/**
 * Scrape interwood.pk (Shopify storefront) into data/raw/.
 * Rate-limited, retries on 429/5xx. Idempotent: skips files that already exist.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://interwood.pk';
const OUT = path.resolve(process.argv[2] ?? 'data/raw');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let reqCount = 0;
async function get(urlPath, { retries = 5, asJson = false } = {}) {
  for (let i = 0; ; i++) {
    try {
      reqCount++;
      const res = await fetch(BASE + urlPath, {
        headers: { 'user-agent': UA, accept: asJson ? 'application/json' : 'text/html,*/*' },
      });
      if (res.status === 429 || res.status >= 500) {
        const wait = 2500 * (i + 1);
        console.log(`  ${res.status} on ${urlPath}, backing off ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) return { status: res.status, body: null };
      const body = asJson ? await res.json() : await res.text();
      return { status: res.status, body };
    } catch (e) {
      if (i >= retries) return { status: 0, body: null };
      await sleep(1500 * (i + 1));
    }
  }
}

async function save(rel, content) {
  const fp = path.join(OUT, rel);
  await mkdir(path.dirname(fp), { recursive: true });
  await writeFile(fp, typeof content === 'string' ? content : JSON.stringify(content, null, 1));
  console.log(`saved ${rel} (${reqCount} reqs so far)`);
}

async function saveIfMissing(rel, fetchFn) {
  const fp = path.join(OUT, rel);
  if (existsSync(fp)) return console.log(`skip ${rel} (exists)`);
  const r = await fetchFn();
  if (r.body == null) return console.log(`MISS ${rel} (status ${r.status})`);
  await save(rel, r.body);
  return r.body;
}

// ---------- 1. sitemap ----------
const sitemap = await saveIfMissing('sitemap.xml', () => get('/sitemap.xml', { asJson: false }));
const urls = [];
if (sitemap) {
  for (const m of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)) urls.push(m[1].replace(BASE, ''));
}
const pageUrls = urls.filter((u) => /^\/pages\/[a-z0-9-]+$/i.test(u));
const blogUrls = urls.filter((u) => /^\/blogs\/[a-z0-9-]+\/[a-z0-9-]+$/i.test(u));
const collectionUrls = urls.filter((u) => /^\/collections\/[a-z0-9-]+$/i.test(u) && !u.includes('all'));
console.log(`sitemap: ${urls.length} urls -> ${pageUrls.length} pages, ${blogUrls.length} blog posts, ${collectionUrls.length} collections`);

// ---------- 2. all products ----------
let page = 1;
let total = 0;
for (;;) {
  const rel = `products/page-${page}.json`;
  const fp = path.join(OUT, rel);
  let data;
  if (existsSync(fp)) {
    data = JSON.parse(await (await import('node:fs/promises')).readFile(fp, 'utf8'));
  } else {
    const r = await get(`/products.json?limit=250&page=${page}`, { asJson: true });
    if (!r.body || !Array.isArray(r.body.products) || r.body.products.length === 0) break;
    data = r.body;
    await save(rel, r.body);
    await sleep(450);
  }
  total += data.products.length;
  if (data.products.length < 250) break;
  page++;
}
console.log(`products: ${total} across ${page} page(s)`);

// ---------- 3. collections list ----------
let collections = null;
const cRes = await get('/collections.json?limit=250', { asJson: true });
if (cRes.body?.collections) {
  collections = cRes.body.collections;
  await save('collections.json', cRes.body);
} else {
  console.log(`collections.json unavailable (${cRes.status}); deriving from sitemap`);
  collections = collectionUrls.map((u) => ({ handle: u.replace('/collections/', ''), title: u.replace('/collections/', '').replace(/-/g, ' ') }));
  await save('collections-derived.json', collections);
}

// ---------- 4. per-collection product lists ----------
const handles = collections.map((c) => c.handle).filter(Boolean);
for (const h of handles) {
  const rel = `collections/${h}.json`;
  if (existsSync(path.join(OUT, rel))) { continue; }
  const r = await get(`/collections/${h}/products.json?limit=250`, { asJson: true });
  if (r.body?.products) await save(rel, r.body.products.map((p) => p.handle));
  else console.log(`MISS ${rel} (${r.status})`);
  await sleep(450);
}

// ---------- 5. homepage + static pages + blog posts ----------
await saveIfMissing('home.html', () => get('/', { asJson: false }));
for (const u of [...pageUrls, ...blogUrls]) {
  const rel = u.replace(/^\//, '') + '.html';
  await saveIfMissing(rel, () => get(u, { asJson: false }));
  await sleep(450);
}

console.log(`DONE. ${reqCount} total requests.`);
