/**
 * The one rich-text sanitiser, shared by admin save paths, the migration and storefront rendering.
 * Exact config: docs/admin-easy-mode/SPEC.md §4.2. Must NOT import 'server-only' (scripts and the seed import it).
 */
import sanitizeHtml from 'sanitize-html';

const COLOR_RES = [/^#[0-9a-f]{3,6}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i];
const ALIGN_RE = [/^(left|center|right|justify)$/];
const YOUTUBE_EMBED_RE = /^https:\/\/www\.youtube(-nocookie)?\.com\/embed\/[A-Za-z0-9_-]{6,20}/;
const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

/** Hosts that count as "this site" (links to them are not opened in a new tab). */
function ownHosts(): Set<string> {
  const hosts = new Set<string>(['cozyfurnitures.pk', 'www.cozyfurnitures.pk']);
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) {
    try {
      hosts.add(new URL(site).host);
    } catch {
      // ignore a malformed env value
    }
  }
  return hosts;
}

function isExternal(href: string): boolean {
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    return !ownHosts().has(new URL(href).host);
  } catch {
    return false;
  }
}

function styleHasAllowedColor(style: string | undefined): boolean {
  if (!style) return false;
  return style
    .split(';')
    .map((d) => d.split(':'))
    .some(([prop, ...rest]) => prop?.trim().toLowerCase() === 'color' && COLOR_RES.some((re) => re.test(rest.join(':').trim())));
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', ...HEADINGS, 'ul', 'ol', 'li', 'a', 'img', 'span', 'div', 'iframe', 'sup', 'sub'],
  disallowedTagsMode: 'discard',
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    span: ['style'],
    p: ['style'],
    ...Object.fromEntries(HEADINGS.map((h) => [h, ['style']])),
    div: ['data-youtube-video'],
    iframe: ['src', 'width', 'height', 'allowfullscreen'],
  },
  allowedStyles: {
    span: { color: COLOR_RES },
    p: { 'text-align': ALIGN_RE },
    ...Object.fromEntries(HEADINGS.map((h) => [h, { 'text-align': ALIGN_RE }])),
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com'],
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'title', 'head', 'template'],
  transformTags: {
    // span → kept only with an allowed colour, div → kept only as a YouTube wrapper: see exclusiveFilter
    b: 'strong',
    i: 'em',
    a: (tagName, attribs) => {
      const next = { ...attribs };
      if (next.href && isExternal(next.href.trim())) {
        next.target = '_blank';
        next.rel = 'noopener noreferrer';
      } else {
        delete next.target;
      }
      return { tagName, attribs: next };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
  },
  // Unwrapping is done here ('excludeTag' drops the tag, keeps its content) rather than by renaming in
  // transformTags: sanitize-html leaks the rename of a discarded tag onto the next closing tag.
  exclusiveFilter: (frame) => {
    if (frame.tag === 'iframe') return !YOUTUBE_EMBED_RE.test(frame.attribs.src ?? '');
    if (frame.tag === 'span') return styleHasAllowedColor(frame.attribs.style) ? false : 'excludeTag';
    if (frame.tag === 'div') {
      if (!('data-youtube-video' in frame.attribs)) return 'excludeTag';
      return frame.mediaChildren.length === 0;
    }
    return false;
  },
};

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Plain text (no tags at all) → paragraphs: a blank line splits paragraphs, a single newline is a <br>. */
function plainTextToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeText(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

const EMPTY_P = '<p>(?:\\s|&nbsp;|<br\\s*/?>)*</p>';
const EMPTY_P_RUN = new RegExp(`(?:${EMPTY_P}\\s*){3,}`, 'gi');
/** The editor keeps an empty paragraph after a final video/photo so you can type below it; it isn't content. */
const TRAILING_EMPTY_P = new RegExp(`(?:\\s*${EMPTY_P})+\\s*$`, 'i');

export function sanitizeRichText(html: string): string {
  const input = (html ?? '').trim();
  if (!input) return '';
  // Tag-less text may still carry entities ("&amp;"); decode them first so they are not escaped twice.
  if (!/<[a-z!/]/i.test(input)) return plainTextToHtml(decodeEntities(input));
  return sanitizeHtml(input, OPTIONS)
    .replace(/<div data-youtube-video(?:="[^"]*")?>\s*<\/div>/g, '')
    .replace(/<img(?![^>]*\ssrc=)[^>]*>/g, '')
    .replace(/<a>([\s\S]*?)<\/a>/g, '$1')
    .replace(EMPTY_P_RUN, '<p></p>')
    .replace(TRAILING_EMPTY_P, '')
    .trim();
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** "Support &amp; Inquiries" → "Support & Inquiries" (named basics and numeric entities). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (ENTITIES[k] != null) return ENTITIES[k];
    if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (k.startsWith('#')) return String.fromCodePoint(Number(k.slice(1)));
    return m;
  });
}

/** Text content of rich text, whitespace collapsed (meta descriptions, excerpts). */
export function richTextToPlainText(html: string): string {
  return (html ?? '')
    .replace(/<(script|style|title|head|template|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|h[1-6]|li|div)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m) => decodeEntities(m))
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when the HTML has no visible text and no image or video. */
export function isRichTextEmpty(html: string): boolean {
  if (!html) return true;
  if (/<(img|iframe)\b/i.test(html)) return false;
  return richTextToPlainText(html).replace(/ /g, '').trim() === '';
}
