#!/usr/bin/env node
/** Pass 3: follow sitemap index URLs verbatim (with query strings), save page HTML + product handles list. */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://interwood.pk';
const OUT = path.resolve('data/raw');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getAbs(url, retries = 5) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
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

// sitemap index -> exact nested URLs (keep query strings, decode &amp;)
const idx = await getAbs(`${BASE}/sitemap.xml`);
const nested = [...idx.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
console.log('nested sitemaps:', nested.length);

const allUrls = [];
for (const url of nested) {
  const name = url.replace(`${BASE}/`, '').split('?')[0];
  const r = await getAbs(url);
  if (!r.body) { console.log('MISS', url, r.status); continue; }
  await save(`sitemaps/${name}`, r.body);
  for (const m of r.body.matchAll(/<loc>(.*?)<\/loc>/g)) allUrls.push(m[1].replace(`${BASE}/`, ''));
  await sleep(500);
}
await save('sitemaps/all-urls.json', JSON.stringify([...new Set(allUrls)], null, 1));
console.log('total urls:', new Set(allUrls).size);

// fetch HTML for every /pages/* URL (skip already-saved)
let n = 0;
for (const u of allUrls) {
  if (!/^\/pages\/[a-z0-9-]+\/?$/i.test(u)) continue;
  const rel = u.replace(/^\//, '').replace(/\/$/, '') + '.html';
  if (existsSync(path.join(OUT, rel))) continue;
  const r = await getAbs(BASE + u);
  if (r.body) { await save(rel, r.body); n++; }
  await sleep(450);
}
console.log('fetched', n, 'pages');
