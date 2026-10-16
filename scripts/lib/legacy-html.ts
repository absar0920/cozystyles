/**
 * Private HTML helpers for scripts/migrate-admin-easy-mode.ts (legacy Shopify markup → clean rich text).
 * Regex/balanced-tag based on purpose: the inputs are our own scraped pages, and the output always goes
 * through sanitizeRichText afterwards.
 */

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

function innerOfMatch(html: string, opener: RegExp): string | null {
  const m = opener.exec(html);
  return m ? innerOf(html, m.index) : null;
}

/** Inner HTML of `<div class="page-content-width rte">`, else of `<main>` / the role=main element, else null. */
export function extractRteFromDocument(body: string): string | null {
  return (
    innerOfMatch(body, /<div class="page-content-width rte"[^>]*>/i) ??
    innerOfMatch(body, /<main\b[^>]*>/i) ??
    innerOfMatch(body, /<[a-z]+\b[^>]*\brole="main"[^>]*>/i)
  );
}

/**
 * Inner HTML of the document's main region (`<main>` or the role="main" element: the page's own sections),
 * with any header, announcement bar, footer, <title>, <head> and <script> removed. null when there is none.
 */
export function extractMainFromDocument(body: string): string | null {
  const main = innerOfMatch(body, /<main\b[^>]*>/i) ?? innerOfMatch(body, /<[a-z]+\b[^>]*\brole="main"[^>]*>/i);
  if (main == null) return null;
  return main
    .replace(/<head\b[\s\S]*?<\/head>/gi, '')
    .replace(/<title\b[\s\S]*?<\/title>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<header\b[\s\S]*?<\/header>/gi, '')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, '')
    .replace(/<div id="shopify-section-[^"]*(?:announcement|header|footer)[^"]*"[\s\S]*?<\/div>/gi, '')
    .trim();
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, 'i'))?.[1];
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
  [/&amp;/g, '&'],
];

function decodeEntities(input: string): string {
  let out = input;
  for (const [pattern, replacement] of ENTITY_MAP) out = out.replace(pattern, replacement);
  return out;
}

export type LegacyArticle = {
  publishedAt: Date | null;
  author: string | null;
  image: { src: string; width: number; height: number; alt: string } | null;
  contentHtml: string;
  tags: { label: string; href: string }[];
};

/** Copy of today's `parseArticle` (src/components/pages/content.ts): raw Shopify chrome or the normalised marker format. */
export function parseLegacyArticle(bodyHtml: string): LegacyArticle {
  const datetime = bodyHtml.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1];
  const author = bodyHtml.match(/<aside class="post-author">([\s\S]*?)<\/aside>/i)?.[1];
  const content = innerOfMatch(bodyHtml, /<div class="post-content[^"]*"[^>]*>/i);
  const figure = innerOfMatch(bodyHtml, /<div class="featured-image[^"]*"[^>]*>/i);
  const imgTag = (figure ?? (content === null ? bodyHtml : '')).match(/<img[^>]*>/i)?.[0];
  const src = imgTag ? attr(imgTag, 'src') : undefined;
  const tagsHtml = innerOfMatch(bodyHtml, /<footer class="article-tags[^"]*"[^>]*>/i) ?? '';
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

/** Cell HTML with block wrappers removed (inline formatting kept). */
function cellInline(html: string): string {
  return html
    .replace(/<\/?(p|div|h[1-6]|ul|ol|li|section|article|span)\b[^>]*>/gi, ' ')
    .replace(/(\s*<br\s*\/?>\s*)+$/i, '')
    .replace(/^(\s*<br\s*\/?>\s*)+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

/** Every cell's text wrapped in <b>/<strong>. */
function isBoldCell(html: string): boolean {
  const inner = cellInline(html);
  if (!textOf(inner)) return true;
  return /^(<(b|strong)\b[^>]*>[\s\S]*<\/\2>\s*)+$/i.test(inner) && textOf(inner.replace(/<(b|strong)\b[^>]*>[\s\S]*?<\/\1>/gi, '')) === '';
}

function stripBold(html: string): string {
  return html.replace(/<\/?(b|strong)\b[^>]*>/gi, '');
}

/**
 * Tables → lists (the editor has no tables). A header row (all <th>, or every cell bold) makes each column
 * "<p><strong>header</strong></p><ul><li>cell…</li></ul>"; otherwise each row becomes "<p>cells joined with — </p>".
 */
export function tableToLists(html: string): string {
  let out = html;
  for (let guard = 0; guard < 200; guard++) {
    const m = /<table\b[^>]*>/i.exec(out);
    if (!m) break;
    const inner = innerOf(out, m.index);
    const closeIdx = out.indexOf('</table>', m.index + m[0].length + inner.length);
    const end = closeIdx >= 0 ? closeIdx + '</table>'.length : out.length;
    const rows = [...inner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
      [...r[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => ({ th: c[1].toLowerCase() === 'th', html: c[2] })),
    ).filter((r) => r.length);
    let replacement = '';
    if (rows.length) {
      const first = rows[0];
      const header = rows.length > 1 && (first.every((c) => c.th) || first.every((c) => isBoldCell(c.html)));
      if (header) {
        replacement = first
          .map((h, j) => {
            const items = rows
              .slice(1)
              .map((r) => cellInline(r[j]?.html ?? ''))
              .filter((c) => textOf(c) !== '' || /<img\b/i.test(c));
            const title = stripBold(cellInline(h.html));
            return `${textOf(title) ? `<p><strong>${title}</strong></p>` : ''}${items.length ? `<ul>${items.map((c) => `<li>${c}</li>`).join('')}</ul>` : ''}`;
          })
          .join('');
      } else {
        replacement = rows
          .map((r) => r.map((c) => cellInline(c.html)).filter((c) => textOf(c) !== ''))
          .filter((cells) => cells.length)
          .map((cells) => `<p>${cells.join(' — ')}</p>`)
          .join('');
      }
    }
    out = out.slice(0, m.index) + replacement + out.slice(end);
  }
  return out;
}

/** YouTube iframes → Tiptap's youtube node markup (nocookie embed). */
export function youtubeIframesToTiptap(html: string): string {
  return html.replace(/(<div data-youtube-video[^>]*>\s*)?<iframe\b[^>]*>[\s\S]*?<\/iframe>(\s*<\/div>)?/gi, (whole: string) => {
    const src = attr(whole.match(/<iframe\b[^>]*>/i)![0], 'src') ?? '';
    const id = src.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,20})/)?.[1];
    if (!id) return whole;
    return `<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/${id}" width="640" height="360" allowfullscreen="true"></iframe></div>`;
  });
}

const BLOCK_TAG = /^<\/?(p|h[1-6]|ul|ol|li|div|blockquote|img|iframe)\b/i;
const INLINE_OPEN = /^<(strong|em|u|s|a|span|sup|sub)\b/i;
const INLINE_CLOSE = /^<\/(strong|em|u|s|a|span|sup|sub)>/i;

/**
 * Inline marks as the editor stores them: an empty bold/italic/underline run is dropped and two runs of the same
 * mark that touch are joined ("<strong>17.</strong><strong>NEWS</strong>" → "<strong>17.NEWS</strong>"). Idempotent.
 */
export function tidyInlineMarks(html: string): string {
  let out = html;
  for (let prev = ''; prev !== out; ) {
    prev = out;
    out = out.replace(/<(strong|em|u|s|sup|sub)><\/\1>/g, '').replace(/<\/(strong|em|u|s|sup|sub)><\1>/g, '');
  }
  return out;
}

/**
 * Sanitised rich text → only blocks at the top level, as the editor stores it. Text, bold runs and line breaks
 * left between blocks (legacy `<div class="sub-title">` lines lose their div in the sanitiser) become one
 * `<p>` per source line, so a later editor save does not merge them into a paragraph and change the page's look.
 * A line holding only `<br>` becomes `<p><br /></p>` (the editor's empty line). Idempotent.
 */
export function wrapLooseInline(html: string): string {
  const tokens = html.match(/<[^>]*>|[^<]+/g) ?? [];
  let out = '';
  let depth = 0; // open block elements
  let line = ''; // top-level inline content of the current source line
  let open = 0; // inline elements open inside `line`
  const flush = () => {
    const t = line.trim();
    out += t ? `<p>${t}</p>` : line; // blank space between blocks is kept as it is
    line = '';
  };
  for (const tok of tokens) {
    if (depth === 0 && tok.startsWith('<') && BLOCK_TAG.test(tok)) {
      flush();
      if (/^<(p|h[1-6]|ul|ol|li|div|blockquote|iframe)\b/i.test(tok) && !tok.endsWith('/>')) depth++;
      out += tok;
      continue;
    }
    if (depth > 0) {
      if (BLOCK_TAG.test(tok) && !/^<(img|br)\b/i.test(tok) && !tok.endsWith('/>')) depth += tok.startsWith('</') ? -1 : 1;
      out += tok;
      continue;
    }
    if (tok.startsWith('<')) {
      if (INLINE_OPEN.test(tok)) open++;
      else if (INLINE_CLOSE.test(tok)) open = Math.max(0, open - 1);
      line += tok;
      continue;
    }
    // top-level text: a newline outside any inline element ends the source line
    const parts = open === 0 ? tok.split(/(\r?\n)/) : [tok];
    parts.forEach((part, k) => {
      if (k % 2) {
        flush();
        out += part;
      } else line += part;
    });
  }
  flush();
  return out;
}
