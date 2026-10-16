import 'server-only';
import { prisma } from '@/lib/db';
import { blogHandle, blogSlug } from '@/lib/page-kinds';
import { STATIC_LINK_TARGETS, classifyHref, externalLabel, hrefPathname, type LinkTarget } from '@/lib/links';
import { decodeEntities } from '@/lib/rich-text/sanitize';

/** Stored titles imported from the old site may still hold entities ("Support &amp; Inquiries"). */
function readable(title: string): string {
  return decodeEntities(title).replace(/\s+/g, ' ').trim();
}

/**
 * Some collections share a name ("Living" / living-1, "Sofas" / "SOFAS"). For those, a short detail that tells
 * them apart in the picker: product count, plus the parent collection when there is one. Keys are handles.
 */
async function clashingCollectionDetails(titles: string[]): Promise<Map<string, string>> {
  const wanted = new Set(titles.map((t) => readable(t).toLowerCase()));
  const out = new Map<string, string>();
  if (!wanted.size) return out;
  const all = await prisma.collection.findMany({
    select: { handle: true, title: true, parent: { select: { title: true } }, _count: { select: { products: true } } },
  });
  const groups = new Map<string, typeof all>();
  for (const c of all) {
    const key = readable(c.title).toLowerCase();
    if (!wanted.has(key)) continue;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const details = group.map((c) => {
      const n = c._count.products;
      return `${n} product${n === 1 ? '' : 's'}${c.parent ? ` · in ${readable(c.parent.title)}` : ''}`;
    });
    group.forEach((c, i) => {
      // still the same as another one: the web address is the only difference left
      const same = details.filter((d) => d === details[i]).length > 1;
      out.set(c.handle, same ? `${details[i]} · /${c.handle}` : details[i]);
    });
  }
  return out;
}

/** exact title match first, then startsWith, then the rest (stable). */
function rank<T extends { label: string }>(items: T[], q: string): T[] {
  const lq = q.toLowerCase();
  const score = (t: T) => (t.label.toLowerCase() === lq ? 0 : t.label.toLowerCase().startsWith(lq) ? 1 : 2);
  return items.map((t, i) => ({ t, i, s: score(t) })).sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.t);
}

/** Search collections, products, pages, blog posts and shortcuts for the LinkPicker. */
export async function searchLinkTargets(query: string, limit = 20): Promise<LinkTarget[]> {
  const q = query.trim().slice(0, 100);
  const statics = STATIC_LINK_TARGETS.filter((t) => !q || t.label.toLowerCase().includes(q.toLowerCase()));
  const contains = q ? { contains: q } : undefined;
  const [collections, products, pages, posts] = await Promise.all([
    prisma.collection.findMany({
      where: q ? { OR: [{ title: contains }, { handle: contains }] } : {},
      select: { handle: true, title: true },
      orderBy: { title: 'asc' },
      take: 30,
    }),
    prisma.product.findMany({
      where: q ? { title: contains } : {},
      select: { handle: true, title: true, status: true },
      orderBy: { title: 'asc' },
      take: 30,
    }),
    prisma.page.findMany({
      where: { kind: { in: ['TEXT', 'DESIGNED'] }, ...(q ? { title: contains } : {}) },
      select: { handle: true, title: true, published: true },
      orderBy: { title: 'asc' },
      take: 20,
    }),
    prisma.page.findMany({
      where: { kind: 'BLOG', ...(q ? { title: contains } : {}) },
      select: { handle: true, title: true, published: true },
      orderBy: { title: 'asc' },
      take: 20,
    }),
  ]);
  const clash = await clashingCollectionDetails(collections.map((c) => c.title));
  const out: LinkTarget[] = [
    ...rank(
      collections.map((c) => {
        const detail = clash.get(c.handle);
        return { href: `/collections/${c.handle}`, kind: 'collection' as const, label: readable(c.title), ...(detail ? { detail } : {}) };
      }),
      q,
    ).slice(0, 6),
    ...rank(
      products.map((p) => ({
        href: `/products/${p.handle}`,
        kind: 'product' as const,
        label: readable(p.title),
        ...(p.status !== 'ACTIVE' ? { detail: p.status === 'ARCHIVED' ? 'Archived' : 'Draft' } : {}),
      })),
      q,
    ).slice(0, 6),
    ...rank(
      pages.map((p) => ({ href: `/pages/${p.handle}`, kind: 'page' as const, label: readable(p.title), ...(p.published ? {} : { detail: 'Hidden' }) })),
      q,
    ).slice(0, 4),
    ...rank(
      posts.map((p) => ({ href: `/blogs/news/${blogSlug(p.handle)}`, kind: 'blogPost' as const, label: readable(p.title), ...(p.published ? {} : { detail: 'Hidden' }) })),
      q,
    ).slice(0, 4),
    ...statics,
  ];
  return out.slice(0, Math.max(limit, statics.length));
}

const MISSING_NOUN: Partial<Record<LinkTarget['kind'], string>> = {
  collection: 'collection',
  product: 'product',
  page: 'page',
  blogPost: 'blog post',
};

/** Resolve hrefs to readable targets (batched: one IN query per kind). Keys are the hrefs as given. */
export async function resolveLinkTargets(hrefs: string[]): Promise<Record<string, LinkTarget>> {
  const unique = [...new Set(hrefs.filter((h) => typeof h === 'string'))];
  const classified = unique.map((href) => ({ href, ...classifyHref(href) }));
  const handles = (kind: string) => [...new Set(classified.filter((c) => c.kind === kind && c.handle).map((c) => c.handle!))];

  const [collections, products, pages, posts] = await Promise.all([
    handles('collection').length
      ? prisma.collection.findMany({ where: { handle: { in: handles('collection') } }, select: { handle: true, title: true } })
      : [],
    handles('product').length
      ? prisma.product.findMany({ where: { handle: { in: handles('product') } }, select: { handle: true, title: true, status: true } })
      : [],
    handles('page').length
      ? prisma.page.findMany({ where: { handle: { in: handles('page') } }, select: { handle: true, title: true, published: true, kind: true } })
      : [],
    handles('blogPost').length
      ? prisma.page.findMany({
          where: { handle: { in: handles('blogPost').map(blogHandle) } },
          select: { handle: true, title: true, published: true },
        })
      : [],
  ]);
  const colBy = new Map(collections.map((c) => [c.handle, c]));
  const clash = await clashingCollectionDetails(collections.map((c) => c.title));
  const prodBy = new Map(products.map((p) => [p.handle, p]));
  const pageBy = new Map(pages.map((p) => [p.handle, p]));
  const postBy = new Map(posts.map((p) => [blogSlug(p.handle), p]));

  const out: Record<string, LinkTarget> = {};
  for (const c of classified) {
    const { href, kind, handle } = c;
    const missing = (): LinkTarget => ({ href, kind, label: `Missing ${MISSING_NOUN[kind] ?? 'page'} “${handle ?? href}”`, missing: true });
    switch (kind) {
      case 'none':
        out[href] = { href, kind, label: 'No link' };
        break;
      case 'home':
      case 'collectionsIndex':
      case 'allProducts':
      case 'blogIndex':
        out[href] = { ...STATIC_LINK_TARGETS.find((t) => t.kind === kind)!, href };
        break;
      case 'collection': {
        if (handle === 'frontpage' || handle === 'all-1') {
          out[href] = { ...STATIC_LINK_TARGETS.find((t) => t.kind === 'allProducts')!, href };
          break;
        }
        const row = colBy.get(handle!);
        const detail = clash.get(handle!);
        out[href] = row ? { href, kind, label: readable(row.title), ...(detail ? { detail } : {}) } : missing();
        break;
      }
      case 'product': {
        const row = prodBy.get(handle!);
        out[href] = row
          ? { href, kind, label: readable(row.title), ...(row.status !== 'ACTIVE' ? { detail: row.status === 'ARCHIVED' ? 'Archived' : 'Draft' } : {}) }
          : missing();
        break;
      }
      case 'page': {
        const row = pageBy.get(handle!);
        out[href] = row ? { href, kind, label: readable(row.title), ...(row.published ? {} : { detail: 'Hidden' }) } : missing();
        break;
      }
      case 'blogPost': {
        const row = postBy.get(handle!);
        out[href] = row ? { href, kind, label: readable(row.title), ...(row.published ? {} : { detail: 'Hidden' }) } : missing();
        break;
      }
      case 'email':
        out[href] = { href, kind, label: href.replace(/^mailto:/i, '') };
        break;
      case 'phone':
        out[href] = { href, kind, label: href.replace(/^tel:/i, '') };
        break;
      default:
        out[href] = isAbsolute(href) ? { href, kind: 'external', label: externalLabel(href) } : storePathTarget(href);
    }
  }
  return out;
}

function isAbsolute(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * A relative href that is not a collection / product / page / post: a few real store addresses get a readable
 * name; anything else (e.g. old Magento links like /living-room-furniture/recliners.html) leads nowhere and is
 * flagged as missing so the owner picks another target.
 */
function storePathTarget(href: string): LinkTarget {
  const path = hrefPathname(href);
  const query = new URLSearchParams(href.split('#')[0].split('?')[1] ?? '');
  const store = (label: string): LinkTarget => ({ href, kind: 'external', label });
  if (path === '/search') {
    const q = (query.get('q') ?? '').trim();
    return store(q ? `Search results for “${q}”` : 'Search page');
  }
  const tag = path.match(/^\/blogs\/news\/tagged\/([^/]+)$/);
  if (tag) return store(`Blog posts tagged “${safeDecode(tag[1]).replace(/-/g, ' ')}”`);
  if (path === '/blogs/blog') return store('Blog');
  if (path === '/account/login') return store('Account login');
  if (path === '/track') return store('Order tracking on WhatsApp');
  if (path.startsWith('/uploads/') || path.startsWith('/images/')) return store('Uploaded file');
  return { href, kind: 'external', label: 'Old link', missing: true };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export type BrokenLink = { text: string; label: string; count: number };

/** Links inside saved rich text that lead nowhere (deleted targets, old site addresses), grouped by link text. */
export async function findBrokenLinks(html: string | null | undefined): Promise<BrokenLink[]> {
  if (!html) return [];
  const links: { href: string; text: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].replace(/&amp;/g, '&').trim();
    if (!href || isAbsolute(href) || /^(mailto|tel):/i.test(href) || href.startsWith('#')) continue;
    const text = m[2].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    links.push({ href, text: text || '(no text)' });
  }
  if (!links.length) return [];
  const targets = await resolveLinkTargets(links.map((l) => l.href));
  const grouped = new Map<string, BrokenLink>();
  for (const l of links) {
    const t = targets[l.href];
    if (!t?.missing) continue;
    const key = `${l.text}\u0000${t.label}`;
    const g = grouped.get(key);
    if (g) g.count++;
    else grouped.set(key, { text: l.text, label: t.label, count: 1 });
  }
  return [...grouped.values()];
}
