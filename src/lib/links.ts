/** Link helpers shared by the LinkPicker, the save actions and the link resolvers (client-safe). */
export type LinkKind =
  | 'home'
  | 'collection'
  | 'collectionsIndex'
  | 'allProducts'
  | 'product'
  | 'page'
  | 'blogPost'
  | 'blogIndex'
  | 'external'
  | 'email'
  | 'phone'
  | 'none';

export type LinkTarget = { href: string; kind: LinkKind; label: string; detail?: string; missing?: boolean };

export const STATIC_LINK_TARGETS: LinkTarget[] = [
  { href: '/', kind: 'home', label: 'Home' },
  { href: '/collections/all', kind: 'allProducts', label: 'All products' },
  { href: '/collections', kind: 'collectionsIndex', label: 'Collections page' },
  { href: '/blogs/news', kind: 'blogIndex', label: 'Blog' },
];

/** Human name of each kind, as shown before the target name ("Collection · Sofas"). */
export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  home: 'Shortcut',
  collection: 'Collection',
  collectionsIndex: 'Shortcut',
  allProducts: 'Shortcut',
  product: 'Product',
  page: 'Page',
  blogPost: 'Blog post',
  blogIndex: 'Shortcut',
  external: 'Web address',
  email: 'Email',
  phone: 'Phone',
  none: 'No link',
};

const SITE_ORIGINS = ['https://cozyfurnitures.pk', 'https://www.cozyfurnitures.pk', 'http://cozyfurnitures.pk', 'http://www.cozyfurnitures.pk'];

function siteOrigins(): string[] {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  const list = [...SITE_ORIGINS];
  if (env) list.push(env.replace(/\/+$/, ''));
  if (typeof window !== 'undefined') list.push(window.location.origin);
  return list;
}

/** Pathname of an internal href ("/collections/kitchens?page=1#x" → "/collections/kitchens"). */
export function hrefPathname(href: string): string {
  const p = href.split(/[?#]/)[0] || '/';
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

/** Trims, strips the site's own origin, "#" → "". */
export function normalizeHref(href: string): string {
  let h = (href ?? '').trim();
  if (h === '#') return '';
  for (const origin of siteOrigins()) {
    if (h.toLowerCase().startsWith(origin.toLowerCase())) {
      h = h.slice(origin.length) || '/';
      if (!h.startsWith('/')) h = `/${h}`;
      break;
    }
  }
  return h;
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

/** What an href points at. Matches on the pathname only (query and hash are ignored). */
export function classifyHref(href: string): { kind: LinkKind; handle?: string } {
  const h = (href ?? '').trim();
  if (!h || h === '#') return { kind: 'none' };
  if (/^mailto:/i.test(h)) return { kind: 'email' };
  if (/^tel:/i.test(h)) return { kind: 'phone' };
  if (isExternalHref(h)) return { kind: 'external' };
  const path = hrefPathname(h);
  if (path === '/') return { kind: 'home' };
  if (path === '/collections') return { kind: 'collectionsIndex' };
  if (path === '/collections/all') return { kind: 'allProducts' };
  if (path === '/blogs/news' || path === '/blogs') return { kind: 'blogIndex' };
  let m = path.match(/^\/collections\/[^/]+\/products\/([^/]+)$/) ?? path.match(/^\/products\/([^/]+)$/);
  if (m) return { kind: 'product', handle: decodeURIComponent(m[1]) };
  m = path.match(/^\/collections\/([^/]+)$/);
  if (m) return { kind: 'collection', handle: decodeURIComponent(m[1]) };
  m = path.match(/^\/blogs\/news\/([^/]+)$/);
  if (m) return { kind: 'blogPost', handle: decodeURIComponent(m[1]) };
  m = path.match(/^\/pages\/([^/]+)$/);
  if (m) return { kind: 'page', handle: decodeURIComponent(m[1]) };
  return { kind: 'external' };
}

const INTERNAL_RE = /^\/(?:[a-z0-9\-._~%/]*)(?:\?[^#\s]*)?(?:#[\w-]*)?$/i;

/** Returns an error message, or null when the href is acceptable. */
export function validateHref(
  href: string,
  opts: { allowEmpty?: boolean; allowInternal?: boolean; allowExternal?: boolean } = {},
): string | null {
  const { allowEmpty = true, allowInternal = true, allowExternal = true } = opts;
  const h = (href ?? '').trim();
  if (!h) return allowEmpty ? null : 'Please choose a link.';
  if (h.startsWith('/')) {
    if (h.startsWith('//')) return 'That web address is not valid.';
    if (!allowInternal) return 'Please enter a full web address starting with https://';
    return INTERNAL_RE.test(h) ? null : 'That link is not valid.';
  }
  if (!allowExternal) return 'Please pick a page from this store.';
  if (/^mailto:/i.test(h)) return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(h) ? null : 'That email address is not valid.';
  if (/^tel:/i.test(h)) return /^tel:\+?\d{6,15}$/.test(h.replace(/[\s-]/g, '')) ? null : 'That phone number is not valid.';
  if (/^https?:\/\//i.test(h)) {
    try {
      const u = new URL(h);
      return u.hostname.includes('.') ? null : 'That web address is not valid.';
    } catch {
      return 'That web address is not valid.';
    }
  }
  return 'Web addresses must start with https://';
}

/** Short readable form of an external URL: "facebook.com/cozy…" (max 40 chars). */
export function externalLabel(href: string): string {
  try {
    const u = new URL(href);
    const s = `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`;
    return s.length > 40 ? `${s.slice(0, 39)}…` : s;
  } catch {
    return href.length > 40 ? `${href.slice(0, 39)}…` : href;
  }
}
