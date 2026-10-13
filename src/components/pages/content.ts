/**
 * Shared helpers for DB rich-text content (static pages & blog posts).
 * The seeded bodies are scraped storefront HTML: they keep breadcrumb/nav chrome
 * around the real article text, so excerpts need light structural cleanup.
 * Per spec, rendered HTML itself is NOT sanitized — it comes from our own DB/admin.
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
    .replace(/<[^>]*>/g, ' ');
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

/**
 * Article bodies keep storefront chrome (breadcrumbs, "Now Reading" nav, author line)
 * before the real text, which starts inside a `post-content` block. Slice from there
 * when present; otherwise fall back to the full stripped body.
 */
export function blogExcerpt(bodyHtml: string, max = 140): string {
  const tag = bodyHtml.match(/<[^>]*class=["'][^"']*post-content[^>]*>/i);
  const source = tag?.index !== undefined ? bodyHtml.slice(tag.index + tag[0].length) : bodyHtml;
  const text = stripHtml(source);
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

/** First image of a body as a card/cover image; upgrades protocol-relative CDN URLs. */
export function coverImage(bodyHtml: string): string | null {
  const match = bodyHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
  const src = match?.[1];
  if (!src || src.startsWith('data:')) return null;
  return src.startsWith('//') ? `https:${src}` : src;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "13 Jul 2023" — UTC so server-rendered dates are deterministic. */
export function formatDate(date: Date): string {
  return DATE_FORMAT.format(date);
}
