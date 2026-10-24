/** Page kinds (client-safe). See docs/admin-easy-mode/SPEC.md §5.3.1. */
export const PAGE_KINDS = ['TEXT', 'BLOG', 'DESIGNED'] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

/**
 * Handles the easy-mode migration stores as DESIGNED pages (rendered by code: the admin edits only their SEO
 * fields and publish state). Only the rows decide which addresses are taken: a shop without, say, an "about-us"
 * row can give that address to a text page (see `savePageAction`).
 */
export const DESIGNED_PAGE_HANDLES: readonly string[] = [
  // rendered by components
  'about',
  'about-us',
  'authorized',
  'berlin',
  'catalogues',
  'contact',
  'home-furniture',
  'lead-form',
  'loyalty-form',
  'office-furniture',
  'store-locator',
  'support-complaint-form',
  'track-your-ticket',
  'wedding-package-builder',
  // legacy section markup rendered from the body as-is
  'buy-now-pay-later',
  'coalesce-collection',
  'coalesce-home',
  'coalesce-office',
  'gujranwala',
  'imagine',
  'interwood-grove-discount',
  'islamabad',
  'karachi',
  'lahore',
  'rawalpindi',
  'review',
  // redirect to WhatsApp order tracking
  'track-your-order',
];

/**
 * DESIGNED pages with no content of their own: track-your-order redirects to WhatsApp, and the live loyalty-form
 * app block renders nothing. Search engines are not sent there (sitemap, noindex).
 */
export const DESIGNED_PAGES_WITHOUT_CONTENT: readonly string[] = ['track-your-order', 'loyalty-form'];

/** DESIGNED pages that show the same page as another address (the live shop's): that one is their canonical. */
export const DESIGNED_PAGE_ALIASES: Readonly<Record<string, string>> = { about: 'about-us' };

/**
 * Page addresses the store answers from code even when no page row has them (the built-in “Contact us” page at
 * /pages/contact), so a text page can never take them.
 */
export const BUILT_IN_PAGE_HANDLES: readonly string[] = ['contact'];

/** Blog posts are stored as `news-<slug>`, so text page addresses never start with it. */
export const BLOG_HANDLE_PREFIX = 'news-';

export function blogHandle(slug: string): string {
  return BLOG_HANDLE_PREFIX + slug;
}

export function blogSlug(handle: string): string {
  return handle.startsWith(BLOG_HANDLE_PREFIX) ? handle.slice(BLOG_HANDLE_PREFIX.length) : handle;
}

export function pagePublicPath(p: { kind: string; handle: string }): string {
  return p.kind === 'BLOG' ? `/blogs/news/${blogSlug(p.handle)}` : `/pages/${p.handle}`;
}
