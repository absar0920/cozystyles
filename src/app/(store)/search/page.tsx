import type { Metadata } from 'next';
import { listProducts } from '@/lib/queries';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { FilterBar } from '@/components/catalog/FilterBar';
import { CatalogResults } from '@/components/catalog/CatalogResults';
import { EmptyState } from '@/components/catalog/EmptyState';
import {
  activeFilterParams,
  firstValue,
  hasActiveFilters,
  parseCatalogFilters,
  type RawSearchParams,
} from '@/components/catalog/filters';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const sp = await searchParams;
  const q = (firstValue(sp.q) ?? '').trim();
  return {
    title: q ? `Search results for “${q}”` : 'Search Products',
    robots: { index: false },
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const filters = parseCatalogFilters(await searchParams);
  const q = filters.q;

  if (!q) {
    return (
      <div className="container-iw py-8 sm:py-12">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Search' }]} className="mb-6" />
        <EmptyState
          title="Search our store"
          message="Type a keyword — like “sofa”, “wardrobe” or “dining table” — in the search bar above, or browse our full catalogue by category."
          action={{ href: '/collections', label: 'Browse all categories' }}
        />
      </div>
    );
  }

  const result = await listProducts({
    q,
    sort: filters.sort,
    page: filters.page,
    perPage: 24,
    minPrice: filters.min,
    maxPrice: filters.max,
    inStockOnly: filters.inStock,
  });

  const filtered = hasActiveFilters(filters);

  return (
    <div className="container-iw space-y-5 py-5 sm:space-y-6 sm:py-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Search' }]} />

      <section className="rounded-2xl bg-cream p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">Search</p>
        <h1 className="mt-1.5 text-2xl font-bold text-ink-dark sm:text-3xl">
          Search results for <span className="text-brand">“{q}”</span>
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {result.total} {result.total === 1 ? 'product' : 'products'} found for “{q}”
        </p>
      </section>

      <FilterBar basePath="/search" q={q} sort={filters.sort} min={filters.min} max={filters.max} stock={filters.inStock} />

      <CatalogResults
        result={result}
        basePath="/search"
        params={activeFilterParams(filters)}
        empty={{
          title: `No products found for “${q}”`,
          message: filtered
            ? 'No products match your filters. Try clearing them or widening the price range.'
            : 'Check the spelling or try a more general keyword — e.g. “bed” instead of “king size bed frame”.',
          action: filtered
            ? { href: `/search?q=${encodeURIComponent(q)}`, label: 'Clear filters' }
            : { href: '/collections', label: 'Browse all categories' },
          secondary: filtered ? { href: '/collections', label: 'Browse categories' } : undefined,
        }}
      />
    </div>
  );
}
