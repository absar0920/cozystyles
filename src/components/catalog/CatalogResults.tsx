import type { ProductListResult } from '@/lib/queries';
import { ProductGrid } from './ProductGrid';
import { Pagination } from './Pagination';
import { EmptyState, type EmptyStateAction } from './EmptyState';

/**
 * Shared results block for catalog pages: "Showing X–Y of Z products",
 * the product grid, pagination, or an empty state when nothing matches.
 */
export function CatalogResults({
  result,
  basePath,
  params,
  empty,
}: {
  result: ProductListResult;
  basePath: string;
  /** Current query params (without page) so pagination preserves filters. */
  params: Record<string, string | undefined>;
  empty: { title: string; message: string; action?: EmptyStateAction; secondary?: EmptyStateAction; icon?: 'search' | 'package' };
}) {
  if (result.items.length === 0) {
    return <EmptyState icon={empty.icon ?? 'search'} title={empty.title} message={empty.message} action={empty.action} secondary={empty.secondary} />;
  }

  const from = (result.page - 1) * result.perPage + 1;
  const to = Math.min(result.page * result.perPage, result.total);

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-muted">
        Showing <span className="font-semibold text-ink-dark">{from}–{to}</span> of{' '}
        <span className="font-semibold text-ink-dark">{result.total}</span> products
      </p>
      <ProductGrid items={result.items} />
      <Pagination page={result.page} pages={result.pages} basePath={basePath} params={params} className="pt-2" />
    </div>
  );
}
