/**
 * Shared helpers for catalog listing pages (/collections/[handle], /search).
 * Parses `sort / min / max / stock / page / q` search params and builds
 * filter-preserving hrefs for pagination and "clear" links.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const SORT_KEYS = ['price-asc', 'price-desc', 'newest', 'title-asc'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export type CatalogFilters = {
  sort: SortKey | undefined;
  min: number | undefined;
  max: number | undefined;
  inStock: boolean;
  page: number;
  q: string;
};

export function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseIntParam(v: string | undefined): number | undefined {
  if (v == null || v.trim() === '') return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseCatalogFilters(sp: RawSearchParams): CatalogFilters {
  const sortRaw = firstValue(sp.sort);
  return {
    sort: SORT_KEYS.find((s) => s === sortRaw),
    min: parseIntParam(firstValue(sp.min)),
    max: parseIntParam(firstValue(sp.max)),
    inStock: firstValue(sp.stock) === '1',
    page: Math.max(1, parseIntParam(firstValue(sp.page)) ?? 1),
    q: (firstValue(sp.q) ?? '').trim(),
  };
}

export function hasActiveFilters(f: CatalogFilters): boolean {
  return Boolean(f.sort || f.min != null || f.max != null || f.inStock);
}

/** Current filter params (without page) as a plain record, for link building. */
export function activeFilterParams(f: CatalogFilters): Record<string, string | undefined> {
  return {
    sort: f.sort,
    min: f.min != null ? String(f.min) : undefined,
    max: f.max != null ? String(f.max) : undefined,
    stock: f.inStock ? '1' : undefined,
    q: f.q || undefined,
  };
}

/** Builds `basePath?...` preserving given params; `page` is only added when > 1. */
export function catalogHref(
  basePath: string,
  params: Record<string, string | number | undefined>,
  page?: number,
): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    usp.set(key, String(value));
  }
  if (page != null && page > 1) usp.set('page', String(page));
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
