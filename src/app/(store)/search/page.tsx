import type { Metadata } from 'next';
import { FilterBar } from '@/components/catalog/FilterBar';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { Pagination } from '@/components/catalog/Pagination';
import { EmptyState } from '@/components/catalog/EmptyState';
import { SearchHeader } from '@/components/catalog/SearchHeader';
import { getCatalog } from '@/components/catalog/catalog-data';
import { SEARCH_PER_PAGE } from '@/components/catalog/constants';
import { filterParams, parseCatalogFilters, SEARCH_SORTS, type RawSearchParams } from '@/components/catalog/filters';

export const dynamic = 'force-dynamic';

function search(filters: ReturnType<typeof parseCatalogFilters>) {
  return getCatalog({ q: filters.q, filters, perPage: SEARCH_PER_PAGE, defaultSort: 'relevance' });
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const filters = parseCatalogFilters(await searchParams);
  if (!filters.q) return { title: 'Search', robots: { index: false } };
  const { total } = await search(filters);
  return { title: `Search: ${total} results found for "${filters.q}"`, robots: { index: false } };
}

/**
 * Live search template: page header (title, field, "N results found for …") → facets toolbar → 4-up
 * grid, 12 per page, numbered circle pagination. No results (even when caused by filters) →
 * illustration + one sentence, no toolbar.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const filters = parseCatalogFilters(await searchParams);
  const q = filters.q;

  if (!q) {
    return (
      <div className="container-iw">
        <SearchHeader q="" summary={null} />
      </div>
    );
  }

  const result = await search(filters);
  const summary = `${result.total} ${result.total === 1 ? 'result' : 'results'} found for “${q}”`;

  // Live: zero results — from the query or from the active filters — drops the toolbar and shows only
  // the illustration + sentence; the section keeps its bottom spacing (50px mobile / 100px desktop).
  if (result.total === 0) {
    return (
      <div className="container-iw mb-[50px] md:mb-[100px]">
        <SearchHeader q={q} summary={summary} />
        <EmptyState>
          <p>No results found for “{q}”. Check the spelling or use a different word or phrase.</p>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container-iw md:mb-[38px]">
      <SearchHeader q={q} summary={summary} />
      <FilterBar
        basePath="/search"
        filters={filters}
        sortOptions={SEARCH_SORTS}
        defaultSort="relevance"
        noun="results"
        total={result.total}
        inStockCount={result.inStockCount}
        outOfStockCount={result.outOfStockCount}
        maxPrice={result.maxPrice}
      />
      <ProductGrid items={result.items} />
      <Pagination page={result.page} pages={result.pages} basePath="/search" params={filterParams(filters)} />
    </div>
  );
}
