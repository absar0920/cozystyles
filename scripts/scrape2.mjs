#!/usr/bin/env node
/**
 * Second-pass scrape: nested sitemaps (products/pages/collections/blogs/articles),
 * additional collections.json pages, and HTML for any pages not yet saved.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://interwood.pk';
const OUT = path.resolve('data/raw');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getAbs(url, { retries = 5 } = {}) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (res.status === 429 || res.status >= 500) { await sleep(2500 * (i + 1)); continue; }
      if (!res.ok) return { status: res.status, body: null };
      return { status: res.status, body: await res.text() };
    } catch { if (i >= retries) return { status: 0, body: null }; await sleep(1500 * (i + 1)); }
  }
}
async function save(rel, content) {
  const fp = path.join(OUT, rel);
  await mkdir(path.dirname(fp), { recursive: true });
  await writeFile(fp, content);
  console.log('saved', rel);
}

// 1. nested sitemaps
const nestedNames = ['sitemap_products_1.xml', 'sitemap_pages_1.xml', 'sitemap_collections_1.xml', 'sitemap_blogs_1.xml', 'sitemap_articles_1.xml', 'sitemap_metaobject_pages_1.xml'];
const allUrls = [];
for (const n of nestedNames) {
  const fp = path.join(OUT, 'sitemaps', n);
  if (existsSync(fp)) continue;
  const r = await getAbs(`${BASE}/${n}`);
  if (!r.body) { console.log('MISS', n, r.status); continue; }
  await save(`sitemaps/${n}`, r.body);
  for (const m of r.body.matchAll(/<loc>(.*?)<\/loc>/g)) allUrls.push(m[1].replace(/https:\/\/interwood\.pk/, '').replace(BASE, ''));
  await sleep(500);
}
await save('sitemaps/all-urls.json', JSON.stringify([...new Set(allUrls)], null, 1));

// 2. extra collections.json pages
for (let pg = 2; pg <= 5; pg++) {
  const rel = `collections-extra-${pg}.json`;
  if (existsSync(path.join(OUT, rel))) break;
  const r = await getAbs(`${BASE}/collections.json?limit=250&page=${pg}`);
  if (!r.body) { console.log('collections page', pg, 'status', r.status); break; }
  const parsed = JSON.parse(r.body);
  if (!parsed.collections?.length) break;
  await save(rel, r.body);
  await sleep(500);
}

// 3. per-collection products for any collection not yet covered
const collectionSets = ['collections.json', 'collections-extra-2.json', 'collections-extra-3.json', 'collections-extra-4.json', 'collections-extra-5.json'];
const handles = new Set();
for (const f of collectionSets) {
  const fp = path.join(OUT, f);
  if (!existsSync(fp)) continue;
  const parsed = JSON.parse(await readFile(fp, 'utf8'));
  for (const c of parsed.collections ?? []) handles.add(c.handle);
}
// also collections found only in sitemap
for (const u of allUrls) {
  const m = u.match(/^\/collections\/([a-z0-9-]+)$/);
  if (m && !['all'].includes(m[1])) handles.add(m[1]);
}
let fetched = 0;
for (const h of handles) {
  const rel = `collections/${h}.json`;
  if (existsSync(path.join(OUT, rel))) continue;
  const r = await getAbs(`${BASE}/collections/${h}/products.json?limit=250`);
  if (r.body) {
    try {
      const parsed = JSON.parse(r.body);
      await save(rel, JSON.stringify(parsed.products.map((p) => p.handle)));
    } catch { console.log('BADJSON', h); }
  } else console.log('MISS', h, r.status);
  fetched++;
  await sleep(450);
}

// 4. HTML for every /pages/*, /blogs/*/* URL from sitemaps
for (const u of allUrls) {
  if (!/^\/(pages|blogs)\/[a-z0-9-]+(\/[a-z0-9-]+)?\/?$/i.test(u)) continue;
  const rel = u.replace(/^\//, '').replace(/\/$/, '') + '.html';
  if (existsSync(path.join(OUT, rel))) continue;
  const r = await getAbs(BASE + u);
  if (r.body) await save(rel, r.body);
  await sleep(450);
}

console.log('DONE pass 2. new collection fetches:', fetched, 'total handles:', handles.size);
