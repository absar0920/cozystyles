/**
 * Allow-list sanitiser for scraped/admin rich text (collection descriptions). Keeps basic
 * formatting tags, `href` (http/https/relative/mailto/tel only), `target`, and `text-align` from
 * inline styles; drops scripts, styles, iframes, comments, event handlers and every other attribute.
 */
const ALLOWED = new Set([
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li',
  'span', 'div', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
]);
const VOID = new Set(['br', 'hr']);

function escAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function sanitizeRte(html: string): string {
  if (!html) return '';
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|noscript|template)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|noscript|template)\b[^>]*>/gi, '');
  return cleaned.replace(/<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^>]*)>/gi, (_m, slash: string, rawTag: string, rest: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED.has(tag)) return '';
    if (slash) return VOID.has(tag) ? '' : `</${tag}>`;
    const attrs: string[] = [];
    const re = /([a-z-:]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest))) {
      const name = m[1].toLowerCase();
      const value = (m[3] ?? m[4] ?? m[5] ?? '').trim();
      if (name === 'href' && tag === 'a' && /^(https?:|\/|#|mailto:|tel:)/i.test(value)) attrs.push(`href="${escAttr(value)}"`);
      else if (name === 'target' && tag === 'a' && value === '_blank') attrs.push('target="_blank" rel="noopener noreferrer"');
      else if (name === 'style') {
        const align = value.match(/text-align\s*:\s*(left|right|center|justify)/i);
        if (align) attrs.push(`style="text-align: ${align[1].toLowerCase()};"`);
      }
    }
    return `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
  });
}

/**
 * Live read-more preview: `innerHTML.substring(0, 500) + "..."`, made markup-safe — a cut inside
 * a tag or entity is dropped and still-open elements are closed after the "...".
 */
export function truncateRte(html: string, limit = 500): string {
  if (html.length <= limit) return html;
  let cut = html.slice(0, limit);
  const lt = cut.lastIndexOf('<');
  if (lt > cut.lastIndexOf('>')) cut = cut.slice(0, lt);
  cut = cut.replace(/&[a-z0-9#]*$/i, '');
  const stack: string[] = [];
  for (const m of cut.matchAll(/<\s*(\/?)([a-z][a-z0-9]*)\b[^>]*>/gi)) {
    const tag = m[2].toLowerCase();
    if (VOID.has(tag)) continue;
    if (m[1]) {
      const i = stack.lastIndexOf(tag);
      if (i >= 0) stack.splice(i);
    } else stack.push(tag);
  }
  return `${cut}...${stack.reverse().map((t) => `</${t}>`).join('')}`;
}
