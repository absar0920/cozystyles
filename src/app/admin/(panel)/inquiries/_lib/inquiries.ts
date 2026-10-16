import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { classifyHref, hrefPathname } from '@/lib/links';
import { resolveLinkTargets } from '@/lib/link-targets';

/** WhatsApp inquiry kinds and their plain-English names (SPEC §5.8). */
export const INQUIRY_KINDS = ['ORDER', 'AVAILABILITY', 'GENERAL', 'TRACK'] as const;
export type InquiryKind = (typeof INQUIRY_KINDS)[number];

export const INQUIRY_KIND_LABEL: Record<InquiryKind, string> = {
  ORDER: 'Order',
  AVAILABILITY: 'Availability question',
  GENERAL: 'General question',
  TRACK: 'Order tracking',
};

export const INQUIRY_KIND_STYLE: Record<InquiryKind, string> = {
  ORDER: 'bg-emerald-100 text-emerald-800',
  AVAILABILITY: 'bg-amber-100 text-amber-800',
  GENERAL: 'bg-blue-100 text-blue-800',
  TRACK: 'bg-gray-100 text-gray-700',
};

export function isInquiryKind(v: unknown): v is InquiryKind {
  return typeof v === 'string' && (INQUIRY_KINDS as readonly string[]).includes(v);
}

export const INQUIRY_SELECT = {
  id: true,
  createdAt: true,
  kind: true,
  productId: true,
  productTitle: true,
  variantSummary: true,
  quantity: true,
  unitPrice: true,
  pagePath: true,
  product: { select: { id: true, title: true, handle: true } },
} satisfies Prisma.WhatsAppInquirySelect;

export type InquiryRow = Prisma.WhatsAppInquiryGetPayload<{ select: typeof INQUIRY_SELECT }>;

/** An inquiry plus its readable "From" text (never the raw path). */
export type InquiryView = InquiryRow & { source: string };

/** Named store pages that the link resolver has no title for. */
const FIXED_PAGE_NAMES: Record<string, string> = {
  '/search': 'Search results',
  '/account/login': 'Account sign-in',
  '/pages/support-complaint-form': 'Contact form',
  '/pages/contact': 'Contact page',
};

/** "Home", "Collection · Sofas", "Product · Alexa Sofa Chair"… for each pathname. */
async function pageNames(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.map((p) => hrefPathname(p || '/')))];
  const targets = await resolveLinkTargets(unique.filter((p) => !FIXED_PAGE_NAMES[p]));
  const out: Record<string, string> = {};
  for (const path of unique) {
    if (FIXED_PAGE_NAMES[path]) {
      out[path] = FIXED_PAGE_NAMES[path];
      continue;
    }
    const t = targets[path];
    const kind = classifyHref(path).kind;
    if (!t || t.missing || kind === 'external' || kind === 'none') out[path] = 'Another page';
    else if (kind === 'collection') out[path] = `Collection · ${t.label}`;
    else if (kind === 'product') out[path] = `Product · ${t.label}`;
    else if (kind === 'blogPost') out[path] = `Blog post · ${t.label}`;
    else if (kind === 'page') out[path] = `Page · ${t.label}`;
    else out[path] = t.label; // Home, All products, Collections page, Blog
  }
  return out;
}

/** Adds the readable source to each row: "Product page", "Chat button · <page>", "Order tracking link". */
export async function withSources(rows: InquiryRow[]): Promise<InquiryView[]> {
  const names = await pageNames(rows.filter((r) => r.kind === 'GENERAL').map((r) => r.pagePath));
  return rows.map((r) => {
    let source: string;
    if (r.kind === 'ORDER' || r.kind === 'AVAILABILITY') source = 'Product page';
    else if (r.kind === 'TRACK') source = 'Order tracking link';
    else source = `Chat button · ${names[hrefPathname(r.pagePath || '/')] ?? 'Another page'}`;
    return { ...r, source };
  });
}

export type TopProduct = { productId: number; title: string; handle: string; image: string | null; clicks: number };

/** The most asked-about products since `since` (null = all time), with their first photo. */
export async function topProducts(where: Prisma.WhatsAppInquiryWhereInput, take: number): Promise<TopProduct[]> {
  const grouped = await prisma.whatsAppInquiry.groupBy({
    by: ['productId'],
    where: { ...where, productId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { productId: 'desc' } },
    take,
  });
  const ids = grouped.map((g) => g.productId!).filter(Boolean);
  if (!ids.length) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, handle: true, images: { orderBy: { position: 'asc' }, take: 1, select: { src: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return grouped.flatMap((g) => {
    const p = byId.get(g.productId!);
    return p ? [{ productId: p.id, title: p.title, handle: p.handle, image: p.images[0]?.src ?? null, clicks: g._count._all }] : [];
  });
}
