/** Page kinds (client-safe). See docs/admin-easy-mode/SPEC.md §5.3.1. */
export const PAGE_KINDS = ['TEXT', 'BLOG', 'DESIGNED'] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

/** Pages rendered by code: the admin edits only their SEO fields and publish state. */
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
