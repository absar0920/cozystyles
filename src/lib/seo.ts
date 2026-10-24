import type { Metadata, MetadataRoute } from 'next';
import { siteOrigin } from './site-url';

/**
 * Search engines: which deployment may be indexed, the robots.txt rules, and canonical addresses.
 *
 * Only the live shop is indexed. A copy of it (staging.cozystyle.pk, a local server) would compete with it in search
 * results, so there every page says "noindex" and robots.txt shuts crawlers out. The deployment is recognised by
 * its NEXT_PUBLIC_SITE_URL; NEXT_PUBLIC_SEARCH_INDEXING=on|off overrides that guess.
 */

const NON_PUBLIC_LABELS = new Set(['staging', 'stage', 'dev', 'test', 'preview', 'qa', 'uat']);

/** True for the live shop's address (e.g. https://cozystyle.pk); false for staging, local and unset addresses. */
export function searchIndexing(origin: string | null = siteOrigin(), override = process.env.NEXT_PUBLIC_SEARCH_INDEXING): boolean {
  const forced = override?.trim().toLowerCase();
  if (forced === 'on') return !!origin;
  if (forced === 'off') return false;
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local')) return false;
  return !NON_PUBLIC_LABELS.has(host.split('.')[0]);
}

/**
 * Addresses crawlers skip on the live shop: the admin, the API, search results, the WhatsApp order-tracking
 * redirect, and the sort / filter / preview variants of catalogue pages, also in their older forms (sort=, min=,
 * max=, stock=; see components/catalog/filters.ts). Each page's canonical address is listed in the sitemap instead.
 */
export const ROBOTS_DISALLOW = [
  '/admin',
  '/api/',
  '/search',
  '/track',
  '/*?*sort_by=',
  '/*?*sort=',
  '/*?*filter.',
  '/*?*discount=',
  '/*?*min=',
  '/*?*max=',
  '/*?*stock=',
  '/*?*layoutPreview=',
];

export function robotsRules(origin: string | null = siteOrigin(), override = process.env.NEXT_PUBLIC_SEARCH_INDEXING): MetadataRoute.Robots {
  if (!origin || !searchIndexing(origin, override)) return { rules: { userAgent: '*', disallow: '/' } };
  return { rules: { userAgent: '*', allow: '/', disallow: ROBOTS_DISALLOW }, sitemap: `${origin}/sitemap.xml` };
}

/**
 * The page's own clean address (no ?variant=, sort or filter) as its canonical URL, so search engines count every
 * variant of it as one page. Left out when NEXT_PUBLIC_SITE_URL is not set: Next.js would resolve it against
 * localhost.
 */
export function canonical(path: string): Pick<Metadata, 'alternates'> {
  return siteOrigin() ? { alternates: { canonical: path } } : {};
}

/** `?page=N` kept for page 2 onwards: those list other products, so they are their own pages. */
export function pagedPath(path: string, page: number | undefined): string {
  return page && page > 1 ? `${path}?page=${page}` : path;
}
