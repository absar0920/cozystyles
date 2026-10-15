/**
 * Helpers for DB rich-text content (static pages & blog posts).
 *
 * Blog bodies are normalised by scripts/fidelity/content.ts into:
 *   div.post-meta-wrapper (time[datetime] + aside.post-author) · div.featured-image img ·
 *   div.post-content (the article HTML) · footer.article-tags (a.tag-link…)
 * `parseArticle` reads that back; bodies without the markers (e.g. written in the admin) are
 * treated as plain article HTML with the first <img> as the featured image.
 * Rendered HTML is not sanitised — it comes from our own DB/admin.
 */

const ENTITY_MAP: Array<[RegExp, string]> = [
  [/&nbsp;/g, ' '],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&apos;|&#0?39;|&#8217;|&rsquo;/g, '’'],
  [/&#8216;|&lsquo;/g, '‘'],
  [/&#8211;|&ndash;/g, '–'],
  [/&#8212;|&mdash;/g, '—'],
  [/&hellip;/g, '…'],
  [/&amp;/g, '&'], // last, so pre-escaped entities aren't double-decoded
];

/** Decode the handful of HTML entities that appear in seeded page titles/body text. */
export function decodeEntities(input: string): string {
  let out = input;
  for (const [pattern, replacement] of ENTITY_MAP) out = out.replace(pattern, replacement);
  return out;
}

/** HTML → plain text (drops scripts/styles/links/comments first so they never leak into excerpts). */
export function stripHtml(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<link[^>]*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|li|h[1-6]|div)>/gi, ' ')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

/** Liquid `truncatewords`: first `count` words, then "..." when anything was cut. */
export function truncateWords(text: string, count: number): string {
  // The brand name replaced a one-word name on live; count it as one word so cut points match.
  const words = text
    .replace(/Cozy Furnitures/g, 'Cozy\u0000Furnitures')
    .split(/[ \t\r\n]+/)
    .filter(Boolean)
    .map((w) => w.replace('\u0000', ' '));
  return words.length > count ? `${words.slice(0, count).join(' ')}...` : words.join(' ');
}

/** Inner HTML of the first element whose opening tag matches `opener` (balanced on its tag name). */
function innerOf(html: string, opener: RegExp): string | null {
  const open = opener.exec(html);
  if (!open) return null;
  const tag = open[0].match(/^<([a-z0-9]+)/i)?.[1]?.toLowerCase();
  if (!tag) return null;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  const start = open.index + open[0].length;
  re.lastIndex = start;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index);
  }
  return html.slice(start);
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, 'i'))?.[1];
}

export type ArticleImage = { src: string; width: number; height: number; alt: string };
export type ArticleTag = { label: string; href: string };
export type ParsedArticle = {
  publishedAt: Date | null;
  author: string | null;
  image: ArticleImage | null;
  contentHtml: string;
  tags: ArticleTag[];
};

export function parseArticle(bodyHtml: string): ParsedArticle {
  const datetime = bodyHtml.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1];
  const author = bodyHtml.match(/<aside class="post-author">([\s\S]*?)<\/aside>/i)?.[1];
  const content = innerOf(bodyHtml, /<div class="post-content[^"]*"[^>]*>/i);
  const figure = innerOf(bodyHtml, /<div class="featured-image[^"]*"[^>]*>/i);
  const imgTag = (figure ?? (content === null ? bodyHtml : '')).match(/<img[^>]*>/i)?.[0];
  const src = imgTag ? attr(imgTag, 'src') : undefined;
  const tagsHtml = innerOf(bodyHtml, /<footer class="article-tags[^"]*"[^>]*>/i) ?? '';
  const tags = [...tagsHtml.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi)].map(([, href, label]) => ({
    href,
    label: decodeEntities(label.trim()),
  }));
  const date = datetime ? new Date(datetime) : null;
  return {
    publishedAt: date && !Number.isNaN(date.getTime()) ? date : null,
    author: author ? decodeEntities(author.trim()) : null,
    image:
      imgTag && src && !src.startsWith('data:')
        ? {
            src: src.startsWith('//') ? `https:${src}` : src,
            width: Number(attr(imgTag, 'width')) || 1920,
            height: Number(attr(imgTag, 'height')) || 800,
            alt: decodeEntities(attr(imgTag, 'alt') ?? ''),
          }
        : null,
    contentHtml: content ?? bodyHtml,
    tags,
  };
}

/** Index card excerpt: Shopify `article.content | strip_html | truncatewords: 30`. */
export function articleExcerpt(contentHtml: string, words = 30): string {
  // strip_html removes tags without adding spaces, and &nbsp; does not split words
  const text = decodeEntities(contentHtml.replace(/&nbsp;/g, '\u00a0').replace(/<[^>]*>/g, ''));
  return truncateWords(text, words);
}

/** Meta description fallback for articles. */
export function blogExcerpt(bodyHtml: string, max = 160): string {
  const text = stripHtml(parseArticle(bodyHtml).contentHtml);
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

/** "FEBRUARY 27 2025" source text (`%B %d %Y`; CSS uppercases it). */
export function formatIndexDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { month: 'long', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('month')} ${get('day')} ${get('year')}`;
}

/** "Feb 27, 2025" (`%b %d, %Y`). */
export function formatArticleDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);
}

/** "October 14, 2026" — the blog header shows the current date, as Shopify renders it. */
export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Karachi' }).format(date);
}

/** Blog post handle (`news-<slug>`) → storefront URL. */
export function articleHref(handle: string): string {
  return `/blogs/news/${handle.replace(/^news-/, '')}`;
}

/** Blog tags (live `/blogs/news/tagged/<handle>`). */
export const BLOG_TAGS: ArticleTag[] = [
  { label: 'Design Ideas', href: '/blogs/news/tagged/design-ideas' },
  { label: 'News', href: '/blogs/news/tagged/news' },
  { label: 'Promotions', href: '/blogs/news/tagged/promotions' },
  { label: 'Wedding Season', href: '/blogs/news/tagged/wedding-season' },
];

/**
 * Clean a stored page body for rendering: drop stylesheet links/scripts/noscript duplicates
 * and turn the theme's lazy placeholders (`_20x_crop_center` + data-srcset) into a real image.
 */
export function cleanBodyHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<img[^>]*>/gi, (tag) => {
      const srcset = attr(tag, 'data-srcset');
      if (!srcset) return tag;
      const best = srcset.split(',').map((s) => s.trim().split(/\s+/)[0]).pop() ?? '';
      return tag.replace(/\ssrc="[^"]*"/i, ` src="${best}" loading="lazy"`).replace(/\sdata-srcset="[^"]*"/i, '');
    });
}
