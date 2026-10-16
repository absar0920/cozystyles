/**
 * Content pages + blog fidelity data (live interwood.pk → Cozy Furnitures).
 *
 * Part of `npm run db:seed` only (applyContentFidelity runs before the admin easy-mode migration, which
 * turns these bodies into clean rich text and blog fields). Running it on its own after the migration would
 * overwrite the clean blog bodies, so the standalone run is disabled. What it fixes in `Page`:
 *  - Rich-text pages (privacy, payment, rewards, shipping, terms…): the seed stored the whole
 *    Shopify HTML document. Replace it with the inner HTML of the theme's `.page-content-width.rte`.
 *  - Blog posts: the seed stored the article chrome (breadcrumbs, sticky nav, share bar…) and the
 *    SEO <title>. Store the article title (`h1.entry-title`), `createdAt` = `<time datetime>`, and a
 *    normalised body: meta (date/author) + local featured image + `.post-content` + tags.
 *  - Text: only the plain "Interwood" → "Cozy Furnitures" swap (the seed's paraphrase of the about
 *    copy is undone); URLs/slugs are left alone, absolute interwood.pk links become relative.
 *
 * Featured images were downloaded once to public/images/blog/<handle>.jpg (logo-checked; the
 * installment banner's shop sign is blurred).
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const RAW = path.join(ROOT, 'data', 'raw');

const RICH_TEXT_PAGES = [
  'privacy-policy',
  'payment',
  'rewards',
  'shipping-and-delivery',
  'terms-of-use',
  'terms-of-offers-for-sale',
];

/** Inner HTML of the element whose opening tag starts at `start` (balanced on the same tag name). */
export function innerOf(html: string, start: number): string {
  const open = html.slice(start).match(/^<([a-z0-9]+)[^>]*>/i);
  if (!open) return '';
  const tag = open[1].toLowerCase();
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = start + open[0].length;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start + open[0].length, m.index);
  }
  return html.slice(start + open[0].length);
}

function findTag(html: string, classFragment: RegExp): number {
  const m = html.match(classFragment);
  return m?.index ?? -1;
}

/**
 * Grammar/domain repairs for an already-swapped "Cozy Furnitures" (also run over every Page, since
 * pages outside this script were rebranded by the seed): "Cozy Furnituresmobel.com" → the store
 * domain, "an Cozy Furnitures" → "a …". Possessives stay a verbatim swap ("Interwood’s" →
 * "Cozy Furnitures’s"); a bare "Cozy Furnitures’ word" left by an earlier run of this script is
 * restored to that (live copy never has a bare "Interwood’ ").
 */
export function fixBrandGrammar(text: string): string {
  return text
    .replace(/Cozy Furnitures ?mobel\.com/gi, 'cozyfurnitures.pk')
    .replace(/\b([Aa])n (Cozy Furnitures|COZY FURNITURES)\b/g, '$1 $2')
    .replace(/(Cozy Furnitures|COZY FURNITURES)(['’])(?= [A-Za-z])/g, (_m, brand: string, q: string) =>
      `${brand}${q}${brand === 'COZY FURNITURES' ? 'S' : 's'}`,
    );
}

/** Brand swap in visible text; links lose the live domain, slugs are untouched. */
function rebrandText(text: string): string {
  return fixBrandGrammar(rebrandWords(text));
}

function rebrandWords(text: string): string {
  return text
    .replace(/Interwood ?mobel\.com/gi, 'cozyfurnitures.pk')
    .replace(/Interwood Mobel (?:\(Pvt\.?\)|Pvt\.?) ?Ltd\.?/gi, 'Cozy Furnitures Pvt Ltd')
    .replace(/Interwood Mobel/gi, 'Cozy Furnitures')
    .replace(/Interwood\.pk/gi, 'cozyfurnitures.pk')
    .replace(/INTERWOOD/g, 'COZY FURNITURES')
    .replace(/interwood/gi, 'Cozy Furnitures');
}

function rewriteUrl(url: string): string {
  let u = url
    .replace(/^https?:\/\/(?:careers|corporate)\.interwood\.pk\/?.*$/i, '/pages/contact')
    .replace(/^(?:https?:)?\/\/(?:www\.)?interwood\.pk/i, '');
  if (u === '') u = '/';
  // product links are flat locally; drop Shopify search-tracking params
  u = u.replace(/^\/collections\/[^/]+\/products\//, '/products/').replace(/[?&]_pos=[^"]*$/, '');
  u = u.replace(/^\/page\/interwood-stores$/i, '/pages/store-locator').replace(/^\/store-locator$/, '/pages/store-locator');
  return u.replace(/mailto:[\w.+-]+@[\w.-]*interwood[\w.-]*/i, 'mailto:complaints@cozyfurnitures.pk');
}

/** Rebrand an HTML fragment: text nodes + alt/title attributes; href/src only lose the live domain. */
export function rebrandHtml(html: string): string {
  return html
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (!part.startsWith('<')) return rebrandText(part.replace(/[\w.+-]+@[\w-]*interwood[\w.-]*\.com/gi, 'complaints@cozyfurnitures.pk'));
      return part
        .replace(/\s(href)="([^"]*)"/gi, (_m, attr: string, url: string) => ` ${attr}="${rewriteUrl(url)}"`)
        .replace(/\s(alt|title)="([^"]*)"/gi, (_m, attr: string, v: string) => ` ${attr}="${rebrandText(v)}"`);
    })
    .join('');
}

/** Drop scripts, styles, stylesheet links, noscript duplicates, empty spans and dead legacy images. */
function cleanFragment(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Magento-era images 404 on live too (interwood.pk/media/…)
    .replace(/<img[^>]+src="[^"]*\/media\/[^"]*"[^>]*>/gi, '')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function decode(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&#039;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Width/height of a baseline or progressive JPEG (SOFn marker), no deps. */
function jpegSize(file: string): { width: number; height: number } | null {
  const buf = readFileSync(file);
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function richTextBody(handle: string): string | null {
  const file = path.join(RAW, 'pages', `${handle}.html`);
  if (!existsSync(file)) return null;
  const html = readFileSync(file, 'utf8');
  const start = findTag(html, /<div class="page-content-width rte"[^>]*>/);
  if (start < 0) return null;
  return rebrandHtml(cleanFragment(innerOf(html, start)));
}

type Article = { title: string; createdAt: Date; body: string };

function articleFromRaw(handle: string): Article | null {
  const file = path.join(RAW, 'blogs', 'news', `${handle}.html`);
  if (!existsSync(file)) return null;
  const html = readFileSync(file, 'utf8');
  const detail = html.slice(Math.max(0, html.indexOf('<article class="blog-post-detail')));
  const title = rebrandText(decode(detail.match(/<h1 class="entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? handle));
  const datetime = detail.match(/<time datetime="([^"]+)"/)?.[1];
  const author = decode(detail.match(/<aside class="post-author">([\s\S]*?)<\/aside>/)?.[1] ?? '');
  const contentStart = findTag(detail, /<div class="post-content[^"]*"[^>]*>/);
  const content = contentStart >= 0 ? rebrandHtml(cleanFragment(innerOf(detail, contentStart))) : '';
  const tags = [...detail.matchAll(/<a href="(\/blogs\/news\/tagged\/[^"]+)" class="tag-link[^"]*">([^<]+)<\/a>/g)].map(
    ([, href, label]) => ({ href, label: decode(label) }),
  );

  const image = `/images/blog/${handle}.jpg`;
  const size = existsSync(path.join(ROOT, 'public', image)) ? jpegSize(path.join(ROOT, 'public', image)) : null;
  const date = datetime ? new Date(datetime) : new Date();
  const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);

  const parts = [
    `<div class="post-meta-wrapper"><aside class="post-meta"><time datetime="${datetime ?? date.toISOString()}">${shortDate}</time></aside>${author ? `<aside class="post-author">${author}</aside>` : ''}</div>`,
    size ? `<div class="featured-image"><img src="${image}" width="${size.width}" height="${size.height}" alt="${title.replace(/"/g, '&quot;')}"></div>` : '',
    `<div class="post-content">\n${content}\n</div>`,
    tags.length
      ? `<footer class="article-tags"><span>Tags:</span> ${tags.map((t) => `<a href="${t.href}" class="tag-link">${t.label}</a>`).join(', ')}</footer>`
      : '',
  ];
  return { title, createdAt: date, body: parts.filter(Boolean).join('\n') };
}

/** Undo the seed's paraphrase of the about-us opening sentence (only the brand swap is allowed). */
function restoreVerbatim(html: string): string {
  return html.replace(
    /Cozy Furnitures grew from a small Lahore workshop into one of Pakistan’s most loved furniture brands\.\s*/g,
    'Cozy Furnitures began as a humble carpentry shop ',
  );
}

export async function applyContentFidelity(prisma: PrismaClient) {
  let pages = 0;
  for (const handle of RICH_TEXT_PAGES) {
    const body = richTextBody(handle);
    if (!body) continue;
    await prisma.page.updateMany({ where: { handle }, data: { bodyHtml: body } });
    pages++;
  }

  const verbatim = await prisma.page.findMany({ where: { bodyHtml: { contains: 'grew from a small Lahore workshop' } } });
  for (const p of verbatim) await prisma.page.update({ where: { id: p.id }, data: { bodyHtml: restoreVerbatim(p.bodyHtml) } });

  let grammar = 0;
  for (const p of await prisma.page.findMany({ select: { id: true, title: true, bodyHtml: true } })) {
    const title = fixBrandGrammar(p.title);
    const bodyHtml = fixBrandGrammar(p.bodyHtml);
    if (title === p.title && bodyHtml === p.bodyHtml) continue;
    await prisma.page.update({ where: { id: p.id }, data: { title, bodyHtml } });
    grammar++;
  }

  let posts = 0;
  const dir = path.join(RAW, 'blogs', 'news');
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    if (!f.endsWith('.html')) continue;
    const handle = f.replace(/\.html$/, '');
    const article = articleFromRaw(handle);
    if (!article) continue;
    const existing = await prisma.page.findUnique({ where: { handle: `news-${handle}` } });
    if (!existing) continue;
    await prisma.page.update({
      where: { id: existing.id },
      data: {
        title: article.title,
        createdAt: article.createdAt,
        bodyHtml: article.body,
        // keep the live SEO <title> as metadata
        seoTitle: existing.seoTitle ?? (existing.title !== article.title ? decode(existing.title) : null),
      },
    });
    posts++;
  }
  console.log(
    `content fidelity: ${pages} rich-text pages, ${verbatim.length} verbatim fixes, ${grammar} brand-grammar fixes, ${posts} blog posts`,
  );
}

if (require.main === module) {
  console.log('Run npm run db:seed (content fidelity is part of the seed now).');
  process.exit(1);
}
