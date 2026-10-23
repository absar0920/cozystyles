/**
 * Helpers for page and blog content on the storefront (dates, excerpts, entity decoding) and the
 * legacy-markup cleaner used by custom-design pages. Blog posts keep date/author/image/tags in their own
 * fields (see blog-data.ts); text and blog bodies are sanitised rich text.
 */

import sanitizeHtml from 'sanitize-html';
import { sanitizeRichText } from '@/lib/rich-text/sanitize';
import { isLegacyCdnUrl, localImageFor } from './legacy-images';

/** Re-serialises HTML with every element closed and stray closing tags dropped (nothing else is changed). */
function balanceHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
    parseStyleAttributes: false,
    // keep <option>/<textarea> text (the defaults drop it); scripts and styles were removed before
    nonTextTags: ['script', 'style'],
    // keep SVG's camelCase (viewBox, linearGradient)
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
  });
}

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

const TEXT_BLOCK_TAG = /<\/?(?:p|div|li|ul|ol|h[1-6]|blockquote|table|tr|td|th)\b[^>]*>|<br\s*\/?>/gi;
const ENDS_SENTENCE = /[.!?:;,…][\s"'”’)\]]*$/;

/**
 * For plain-text excerpts: a heading or list item whose text ends without punctuation gets a full stop, so it
 * doesn't run into the next sentence once the tags are gone ("…fabric and frame. Measure twice. Leave at least…").
 * A list item's own text ends where a nested list starts ("Sofas. Corner sofas.").
 */
function punctuateBlockEnds(html: string): string {
  let blockStart = 0;
  return html.replace(TEXT_BLOCK_TAG, (tag: string, offset: number) => {
    const inner = html.slice(blockStart, offset);
    blockStart = offset + tag.length;
    const nestedList = /^<(?:ul|ol)\b/i.test(tag);
    if (!nestedList && !/^<\/(?:h[1-6]|li)\b/i.test(tag)) return tag;
    const text = decodeEntities(inner.replace(/<[^>]*>/g, '')).trim();
    const stop = text && !ENDS_SENTENCE.test(text) ? '.' : '';
    return nestedList ? `${stop} ${tag}` : `${stop}${tag}`;
  });
}

/** HTML → plain text (drops scripts/styles/links/comments first so they never leak into excerpts). */
export function stripHtml(html: string): string {
  const text = punctuateBlockEnds(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<link[^>]*>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' '),
  )
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

/**
 * A stored TEXT/BLOG body, sanitised for rendering or editing. (Tag-less plain text carrying entities such as
 * "&amp;" is decoded by the sanitiser itself, so it is not escaped twice.)
 */
export function storedRichText(html: string): string {
  return sanitizeRichText(html ?? '');
}

const LINE_BREAK_TAG = /^<\/?(p|div|li|ul|ol|h[1-6]|br|blockquote|table|thead|tbody|tr|td|th|figure|figcaption|section|article|header|footer|img|iframe|hr)\b/i;

/**
 * TEXT pages: the live theme draws every <strong> at 26px because its policy pages use a bold line as a heading.
 * Marks only those bold lines (a <strong> with nothing but blank space or a list number between it and the
 * surrounding line breaks or block edges), bold list numbers, and bare bold text between blocks with
 * `sf-line-strong`, so a word the owner bolds inside a sentence stays body size (content.css).
 */
export function markLineStrongs(html: string): string {
  const tokens = html.match(/<[^>]*>|[^<]+/g) ?? [];
  const text = (t: string) => (t.startsWith('<') ? '' : t.replace(/&nbsp;|&#160;|\u00a0/g, ' '));
  const lineEdge = (t: string) => t.startsWith('<') && LINE_BREAK_TAG.test(t);
  for (let i = 0; i < tokens.length; i++) {
    if (!/^<strong\s*>$/i.test(tokens[i])) continue;
    // matching close tag
    let depth = 0;
    let close = -1;
    for (let j = i; j < tokens.length; j++) {
      if (/^<strong\b/i.test(tokens[j])) depth++;
      else if (/^<\/strong>/i.test(tokens[j]) && --depth === 0) {
        close = j;
        break;
      }
    }
    if (close < 0) continue;
    // text on the same line, ignoring other bold runs ("<strong>2</strong>. <strong>BUSINESS</strong>")
    let before = '';
    let j0 = i - 1;
    for (let j = i - 1, d = 0; j >= 0 && !lineEdge(tokens[j]); j--, j0 = j) {
      if (/^<\/strong>/i.test(tokens[j])) d++;
      else if (/^<strong\b/i.test(tokens[j])) d--;
      else if (d <= 0) before = text(tokens[j]) + before;
    }
    let after = '';
    let j1 = close + 1;
    for (let j = close + 1, d = 0; j < tokens.length && !lineEdge(tokens[j]); j++, j1 = j) {
      if (/^<strong\b/i.test(tokens[j])) d++;
      else if (/^<\/strong>/i.test(tokens[j])) d--;
      else if (d <= 0) after += text(tokens[j]);
    }
    // allowed around a bold line: a list number before it ("1. "), punctuation after it
    const alone = /^[\s\d.)]*$/.test(before) && /^[\s.:]*$/.test(after);
    // the theme's bold list numbers ("<strong>1.</strong> Your contact details…")
    // (and empty bold runs around line breaks, which only set the line height)
    const number = /^\s*(\d+[.)]?)?\s*$/.test(tokens.slice(i + 1, close).map(text).join(''));
    // bare bold text between blocks (not inside a paragraph): bodies stored before the migration's page-blocks step
    const prevEdge = tokens[j0] ?? '';
    const nextEdge = tokens[j1] ?? '';
    const bare = (j0 < 0 || /^<\//.test(prevEdge)) && (j1 >= tokens.length || /^<(?!\/|br)/i.test(nextEdge));
    if (alone || number || bare) tokens[i] = '<strong class="sf-line-strong">';
  }
  return tokens.join('');
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, 'i'))?.[1];
}

export type ArticleImage = { src: string; width: number; height: number; alt: string };
export type ArticleTag = { label: string; href: string };

/** Index card excerpt: Shopify `article.content | strip_html | truncatewords: 30`. */
export function articleExcerpt(contentHtml: string, words = 30): string {
  // strip_html removes tags without adding spaces, and &nbsp; does not split words. Block ends and <br>
  // become a space first: editor-saved HTML has no newline between blocks, so words would run together.
  // A subheading or list item without punctuation also gets a full stop (unlike live), so it reads as its own
  // sentence in the preview.
  const text = decodeEntities(
    punctuateBlockEnds(contentHtml)
      .replace(/&nbsp;/g, '\u00a0')
      .replace(/<\/(p|li|h[1-6]|div|blockquote)>|<br\s*\/?>/gi, '$& ')
      .replace(/<[^>]*>/g, ''),
  );
  return truncateWords(text, words);
}

/** Meta description fallback for articles (body is sanitised rich text). */
export function blogExcerpt(contentHtml: string, max = 160): string {
  const text = stripHtml(contentHtml);
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

/** URLs named in an img/source tag: src, data-src and every srcset candidate. */
function tagImageUrls(tag: string): string[] {
  const urls: string[] = [];
  for (const name of ['src', 'data-src']) {
    const v = attr(tag, name);
    if (v) urls.push(v);
  }
  for (const name of ['data-srcset', 'srcset']) {
    const v = attr(tag, name);
    if (v) urls.push(...v.split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean).reverse());
  }
  return urls;
}

function dropAttrs(tag: string, names: string[]): string {
  let out = tag;
  for (const name of names) out = out.replace(new RegExp(`\\s${name}=(?:"[^"]*"|'[^']*')`, 'gi'), '');
  return out;
}

/**
 * Clean a stored page body for rendering: drop stylesheet links/scripts/noscript duplicates, point the old
 * store's CDN pictures (lazy `_20x_crop_center` placeholders + data-srcset) at their downloaded local copies —
 * pictures that were never downloaded are left out rather than shown broken — and re-balance the markup, so
 * the browser builds the same DOM as React expects (stray closing tags otherwise fail hydration).
 */
export function cleanBodyHtml(html: string): string {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const urls = tagImageUrls(tag);
      if (!urls.some(isLegacyCdnUrl)) return tag;
      const local = urls.map(localImageFor).find(Boolean);
      if (!local) return '';
      const rest = dropAttrs(tag, ['src', 'data-src', 'srcset', 'data-srcset', 'sizes', 'loading']);
      return rest.replace(/^<img\b/i, `<img src="${local}" loading="lazy"`);
    })
    .replace(/<source\b[^>]*>/gi, (tag) => (tagImageUrls(tag).some(isLegacyCdnUrl) ? '' : tag))
    .replace(/\sposter=(["'])([^"']*)\1/gi, (m, _q: string, url: string) => {
      if (!isLegacyCdnUrl(url)) return m;
      const local = localImageFor(url);
      return local ? ` poster="${local}"` : '';
    })
    .replace(/url\((["']?)([^)"']*)\1\)/gi, (m, _q: string, url: string) => {
      if (!isLegacyCdnUrl(url)) return m;
      const local = localImageFor(url);
      return local ? `url(${local})` : 'none';
    });
  return balanceHtml(body);
}
