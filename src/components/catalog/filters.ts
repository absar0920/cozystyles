/**
 * Shared helpers for catalog listing pages (/collections/[handle], /search).
 * Uses the live Shopify query params — `sort_by`, `filter.v.availability`, `filter.v.price.gte|lte`,
 * `page`, `q` — plus `discount` (mobile drawer "DISCOUNT %" links). Legacy `sort / min / max / stock`
 * params are still understood so old links keep working.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type SortOption = { value: string; label: string };

/** Collection sort menu, in live order. */
export const COLLECTION_SORTS: SortOption[] = [
  { value: 'manual', label: 'Featured' },
  { value: 'relevance', label: 'Most relevant' },
  { value: 'best-selling', label: 'Best selling' },
  { value: 'title-ascending', label: 'Alphabetically, A-Z' },
  { value: 'title-descending', label: 'Alphabetically, Z-A' },
  { value: 'price-ascending', label: 'Price, low to high' },
  { value: 'price-descending', label: 'Price, high to low' },
  { value: 'created-ascending', label: 'Date, old to new' },
  { value: 'created-descending', label: 'Date, new to old' },
];

/** Search sort menu (live offers only these three). */
export const SEARCH_SORTS: SortOption[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price-ascending', label: 'Price, low to high' },
  { value: 'price-descending', label: 'Price, high to low' },
];

const SORT_VALUES = new Set(COLLECTION_SORTS.map((s) => s.value));
const LEGACY_SORTS: Record<string, string> = {
  'price-asc': 'price-ascending',
  'price-desc': 'price-descending',
  newest: 'created-descending',
  'created-asc': 'created-ascending',
  'title-asc': 'title-ascending',
  'title-desc': 'title-descending',
};

export const DISCOUNT_STEPS = [50, 40, 30, 20, 10] as const;

export type CatalogFilters = {
  sort: string | undefined;
  min: number | undefined;
  max: number | undefined;
  /** '1' = in stock, '0' = out of stock (Shopify `filter.v.availability`). */
  availability: ('0' | '1')[];
  discount: number | undefined;
  page: number;
  q: string;
};

export function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function allValues(v: string | string[] | undefined): string[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

const MAX_PRICE_FILTER = 10_000_000;
const MAX_PAGE = 100_000;

function parseIntParam(v: string | undefined, max: number): number | undefined {
  if (v == null) return undefined;
  const n = Number.parseInt(v.replace(/,/g, '').trim(), 10);
  // rejects NaN / negatives and caps huge values so they can't overflow downstream
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : undefined;
}

export function parseCatalogFilters(sp: RawSearchParams): CatalogFilters {
  const rawSort = firstValue(sp.sort_by) ?? firstValue(sp.sort);
  const sort = rawSort && SORT_VALUES.has(rawSort) ? rawSort : rawSort ? LEGACY_SORTS[rawSort] : undefined;
  const availability = new Set<'0' | '1'>();
  for (const v of allValues(sp['filter.v.availability'])) if (v === '0' || v === '1') availability.add(v);
  if (firstValue(sp.stock) === '1') availability.add('1');
  const discount = parseIntParam(firstValue(sp.discount), 100);
  return {
    sort,
    min: parseIntParam(firstValue(sp['filter.v.price.gte']) ?? firstValue(sp.min), MAX_PRICE_FILTER),
    max: parseIntParam(firstValue(sp['filter.v.price.lte']) ?? firstValue(sp.max), MAX_PRICE_FILTER),
    availability: [...availability].sort().reverse() as ('0' | '1')[],
    discount: discount && (DISCOUNT_STEPS as readonly number[]).includes(discount) ? discount : undefined,
    page: Math.min(MAX_PAGE, Math.max(1, parseIntParam(firstValue(sp.page), MAX_PAGE) ?? 1)),
    q: (firstValue(sp.q) ?? '').trim(),
  };
}

export type ParamList = [string, string][];

/** Current filter params (without page) as an ordered list, for link building. */
export function filterParams(f: CatalogFilters, opts: { sort?: boolean; q?: boolean } = {}): ParamList {
  const out: ParamList = [];
  if (opts.q !== false && f.q) out.push(['q', f.q]);
  for (const a of f.availability) out.push(['filter.v.availability', a]);
  if (f.min != null) out.push(['filter.v.price.gte', String(f.min)]);
  if (f.max != null) out.push(['filter.v.price.lte', String(f.max)]);
  if (f.discount) out.push(['discount', String(f.discount)]);
  if (opts.sort !== false && f.sort) out.push(['sort_by', f.sort]);
  return out;
}

/** Builds `basePath?...` from an ordered param list; `page` is only added when > 1. */
export function catalogHref(basePath: string, params: ParamList, page?: number): string {
  const usp = new URLSearchParams();
  for (const [key, value] of params) if (value !== '') usp.append(key, value);
  if (page != null && page > 1) usp.set('page', String(page));
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
