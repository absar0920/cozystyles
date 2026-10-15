/**
 * Department landing pages (live /pages/home-furniture, /pages/office-furniture) → section data.
 *
 *   npx tsx scripts/fidelity/landing.ts            # parse data/raw/pages + download missing images
 *   npx tsx scripts/fidelity/landing.ts --offline  # parse only (images already in public/)
 *
 * Idempotent and DB-free (re-running after `npm run db:seed` is harmless). Live renders these pages from
 * Shopify theme sections (slideshow → rich-text → image-with-text rows); the seeded `Page.bodyHtml` holds
 * only that raw markup with CDN URLs, so src/app/(store)/pages/[handle] renders them from
 * src/components/pages/landing-data.json (written here) with images self-hosted in public/images/landing/.
 * Every image was opened and checked: none carries the old brand's logo or wordmark.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const RAW = path.join(ROOT, 'data', 'raw', 'pages');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'landing');
const OUT = path.join(ROOT, 'src', 'components', 'pages', 'landing-data.json');
const PAGES = ['home-furniture', 'office-furniture'];
const offline = process.argv.includes('--offline');

export type LandingSection =
  | { kind: 'banner'; image: string; ratio: number }
  | { kind: 'richText'; heading: string | null; html: string }
  | {
      kind: 'imageText';
      image: string;
      /** image height / width × 100 */
      ratio: number;
      imageFirst: boolean;
      disableTop: boolean;
      disableBottom: boolean;
      heading: string;
      html: string;
    };

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Live absolute links → relative; drop link titles. */
function cleanHtml(html: string): string {
  return html
    .replace(/https?:\/\/(?:www\.)?interwood\.pk(?=\/)/gi, '')
    .replace(/\s+title="[^"]*"/g, '')
    .replace(/Interwood/g, 'Cozy Furnitures')
    .trim();
}

function sections(html: string): { type: string; body: string }[] {
  const re = /id="shopify-section-template--\d+__([a-z_]+?)_[A-Za-z0-9]+"/g;
  const hits = [...html.matchAll(re)];
  return hits.map((m, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index! : html.indexOf('<!-- BEGIN sections: footer-group', m.index!);
    return { type: m[1], body: html.slice(m.index!, end) };
  });
}

/** `//interwood.pk/cdn/shop/files/Name_20x15_crop_center.png?v=1` → the full-size file URL. */
function sourceUrl(src: string, size: string): string {
  const clean = src.replace(/_\d+x\d*_crop_center/, `_${size}_crop_center`);
  return `https:${clean}`;
}

async function download(url: string, file: string) {
  if (existsSync(file) || offline) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log('downloaded', path.relative(ROOT, file));
}

async function main() {
  mkdirSync(IMG_DIR, { recursive: true });
  const data: Record<string, LandingSection[]> = {};
  for (const handle of PAGES) {
    const html = readFileSync(path.join(RAW, `${handle}.html`), 'utf8');
    const out: LandingSection[] = [];
    let n = 0;
    for (const { type, body } of sections(html)) {
      if (type === 'slideshow') {
        const m = body.match(/slideshow__slide-adapt-to-image"><img src="([^"]+)"[^>]*width="(\d+)" height="(\d+)"/);
        if (!m) continue;
        const ext = path.extname(m[1].split('?')[0]);
        const local = `/images/landing/${handle}-banner${ext}`;
        await download(`https:${m[1]}`, path.join(ROOT, 'public', local));
        out.push({ kind: 'banner', image: local, ratio: (+m[3] / +m[2]) * 100 });
      } else if (type === 'rich_text') {
        const h = body.match(/<h3 class="h3"\s*>([\s\S]*?)<\/h3>/);
        const rte = body.match(/<div class="rte[^"]*"\s*>([\s\S]*?)<\/div>/);
        out.push({ kind: 'richText', heading: h ? decode(h[1].trim()) : null, html: rte ? cleanHtml(rte[1]) : '' });
      } else if (type === 'image_with_text') {
        const cls = body.match(/class="image-with-text ([^"]+)"/)?.[1] ?? '';
        const ratio = Number(body.match(/--ratio-percent:\s*([\d.]+)%/)?.[1] ?? 76.087);
        const src = body.match(/data-srcset="([^" ]+)/)?.[1] ?? body.match(/<img[^>]+src="([^"]+)"/)![1];
        const h = body.match(/<h3 class="h\d"\s*>([\s\S]*?)<\/h3>/);
        const rte = body.match(/<div class="rte"\s*>([\s\S]*?)<\/div>\s*<\/div>/);
        const ext = path.extname(src.split('?')[0]);
        const local = `/images/landing/${handle}-${++n}${ext}`;
        await download(sourceUrl(src, '920x700'), path.join(ROOT, 'public', local));
        out.push({
          kind: 'imageText',
          image: local,
          ratio,
          imageFirst: /\bimage_first\b/.test(cls),
          disableTop: /section-spacing--disable-top/.test(cls),
          disableBottom: /section-spacing--disable-bottom/.test(cls),
          heading: h ? decode(h[1].trim()) : '',
          html: rte ? cleanHtml(rte[1]) : '',
        });
      }
    }
    data[handle] = out;
    console.log(handle, out.length, 'sections');
  }
  writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n');
  console.log('wrote', path.relative(ROOT, OUT));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
