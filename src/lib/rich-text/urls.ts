/**
 * Pure URL helpers for rich-text HTML (no `server-only`: the migration, the seed and tests import them).
 * `src/lib/uploads.ts` re-exports `extractUploadUrls` for its existing importers.
 */

/** Every "/uploads/…" URL in src/href attributes of an HTML string. */
export function extractUploadUrls(html: string): string[] {
  if (!html) return [];
  const out = new Set<string>();
  for (const m of html.matchAll(/\s(?:src|href)\s*=\s*["']((?:https?:\/\/[^/"']+)?\/uploads\/[^"'?#\s]+)/gi)) {
    out.add(m[1].replace(/^https?:\/\/[^/]+/i, ''));
  }
  return [...out];
}

/** Every `href` value of the `<a>` tags in an HTML string, entity-decoded for `&amp;`, in document order, unique. */
export function extractHrefs(html: string): string[] {
  if (!html) return [];
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const href = (m[1] ?? m[2] ?? '').replace(/&amp;/g, '&').trim();
    if (href) out.add(href);
  }
  return [...out];
}
