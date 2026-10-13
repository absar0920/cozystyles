#!/usr/bin/env node
/**
 * Download product/collection/banner images from interwood CDN to public/images,
 * at bounded width. Writes data/image-manifest.json (original src -> local path).
 * Idempotent: skips files that already exist on disk.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const WIDTH = 1200;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const manifestPath = 'data/image-manifest.json';
let manifest = {};
if (existsSync(manifestPath)) manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function localFor(src, folder, nameHint) {
  const clean = src.replace(/^https?:/, '').replace(/^\/\/interwood\.pk\/cdn\/shop\//, '');
  const ext = (clean.match(/\.(jpe?g|png|webp|gif|svg)(?=$|\?)/i)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
  const base = (nameHint ?? clean.split('/').pop() ?? 'img')
    .replace(/\.(jpe?g|png|webp|gif|svg)$/i, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .slice(0, 80);
  return `images/${folder}/${base}.${ext}`;
}

async function download(src, localRel) {
  const fp = path.join('public', localRel);
  if (existsSync(fp)) {
    manifest[src] = '/' + localRel;
    return true;
  }
  const url = src.startsWith('//') ? 'https:' + src : src.startsWith('http') ? src : 'https://interwood.pk/cdn/shop/' + src.replace(/^\//, '');
  const sized = url + (url.includes('?') ? '&' : '?') + 'width=' + WIDTH;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(sized, { headers: { 'user-agent': UA } });
      if (res.status === 429 || res.status >= 500) { await sleep(2500 * (i + 1)); continue; }
      if (!res.ok) { console.log('MISS', res.status, sized.slice(0, 90)); return false; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) { console.log('TINY', sized.slice(0, 90)); return false; }
      await mkdir(path.dirname(fp), { recursive: true });
      await writeFile(fp, buf);
      manifest[src] = '/' + localRel;
      return true;
    } catch (e) { await sleep(1500 * (i + 1)); }
  }
  return false;
}

// ---- collect tasks ----
const tasks = []; // {src, folder, nameHint}
const productFiles = [1, 2, 3, 4, 5].map((n) => `data/raw/products/page-${n}.json`).filter(existsSync);
const productsByHandle = new Map();
for (const f of productFiles) {
  const parsed = JSON.parse(await readFile(f, 'utf8'));
  for (const p of parsed.products ?? []) productsByHandle.set(p.handle, p);
}
console.log('products to process:', productsByHandle.size);
for (const p of productsByHandle.values()) {
  (p.images ?? []).forEach((img, i) => {
    tasks.push({ src: img.src, folder: 'products', nameHint: `${p.handle}-${i + 1}` });
  });
}

// collections
for (const f of ['collections.json', 'collections-extra-2.json', 'collections-extra-3.json', 'collections-extra-4.json', 'collections-extra-5.json']) {
  const fp = `data/raw/${f}`;
  if (!existsSync(fp)) continue;
  const parsed = JSON.parse(await readFile(fp, 'utf8'));
  for (const c of parsed.collections ?? []) {
    if (c.image?.src) tasks.push({ src: c.image.src, folder: 'collections', nameHint: c.handle });
  }
}

// hero banners + misc homepage images (from home.html)
const homeHtml = await readFile('data/raw/home.html', 'utf8');
const bannerSrcs = [...new Set([...homeHtml.matchAll(/<img[^>]*?src="(\/\/interwood\.pk\/cdn\/shop\/files\/[^"]+)"/g)].map((m) => m[1]))]
  .filter((u) => !/_20x_/.test(u)); // skip lazy thumbnails
console.log('home images found:', bannerSrcs.length);
bannerSrcs.forEach((u, i) => tasks.push({ src: u, folder: 'banners', nameHint: `home-${String(i + 1).padStart(2, '0')}` }));

// ---- run with concurrency 4 ----
let done = 0, fail = 0;
const CONC = 4;
let idx = 0;
async function worker() {
  while (idx < tasks.length) {
    const t = tasks[idx++];
    const ok = await download(t.src, localFor(t.src, t.folder, t.nameHint));
    ok ? done++ : fail++;
    if (done % 100 === 0) {
      console.log(`progress: ${done}/${tasks.length} (fail ${fail})`);
      await writeFile(manifestPath, JSON.stringify(manifest, null, 1));
    }
    await sleep(120);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
await writeFile(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`DONE images: ${done} ok, ${fail} failed of ${tasks.length}`);
