/** Void elements: never closed when truncating. */
const VOID = new Set(['br', 'hr', 'img']);

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
