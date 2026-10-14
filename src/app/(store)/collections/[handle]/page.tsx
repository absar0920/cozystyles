import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCollectionByHandle, listProducts } from '@/lib/queries';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { FilterBar } from '@/components/catalog/FilterBar';
import { CatalogResults } from '@/components/catalog/CatalogResults';
import { ExpandableRte } from '@/components/catalog/ExpandableRte';
import {
  activeFilterParams,
  hasActiveFilters,
  parseCatalogFilters,
  type RawSearchParams,
} from '@/components/catalog/filters';

export const dynamic = 'force-dynamic';

type PageParams = Promise<{ handle: string }>;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { handle } = await params;
  if (handle === 'all') {
    return {
      title: 'All Products',
      description:
        'Browse the complete Cozy Furnitures catalogue — bedroom, living, dining and office furniture, doors, kitchens and decor.',
    };
  }
  const collection = await getCollectionByHandle(handle);
  if (!collection) return { title: 'Collection not found' };
  const desc = stripHtml(collection.description);
  return {
    title: collection.title,
    description: desc
      ? desc.slice(0, 160)
      : `Shop ${collection.title} at Cozy Furnitures — Pakistan's largest furniture manufacturer. Free delivery & installation nationwide.`,
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: Promise<RawSearchParams>;
}) {
  const { handle } = await params;
  const filters = parseCatalogFilters(await searchParams);

  // `/collections/all` is a special route listing every product.
  const collection = handle === 'all' ? null : await getCollectionByHandle(handle);
  if (!collection && handle !== 'all') notFound();

  const title = collection?.title ?? 'All Products';
  const description = collection?.description ?? '';
  const children = collection?.children ?? [];

  const result = await listProducts({
    collectionHandle: handle === 'all' ? undefined : handle,
    sort: filters.sort,
    page: filters.page,
    perPage: 24,
    minPrice: filters.min,
    maxPrice: filters.max,
    inStockOnly: filters.inStock,
  });

  const basePath = `/collections/${handle}`;
  const linkParams = activeFilterParams(filters);
  const filtered = hasActiveFilters(filters);

  return (
    <div className="container-iw space-y-5 py-5 sm:space-y-6 sm:py-8">
      <Breadcrumbs
        items={[{ label: 'Home', href: '/' }, { label: 'Collections', href: '/collections' }, { label: title }]}
      />

      {/* Collection banner */}
      <section className="relative overflow-hidden rounded-2xl bg-brand-900">
        {collection?.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={collection.image}
            alt={title}
            width={1200}
            height={480}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div
          className={`absolute inset-0 ${
            collection?.image
              ? 'bg-gradient-to-r from-brand-900/95 via-brand-900/60 to-brand-900/15'
              : 'bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600'
          }`}
        />
        <div className="relative flex min-h-[190px] flex-col justify-end gap-1.5 p-6 sm:min-h-[250px] sm:p-10">
          <h1 className="text-2xl font-bold text-white sm:text-4xl">{title}</h1>
          <p className="text-sm text-white/80">
            {result.total} {result.total === 1 ? 'product' : 'products'} · Free Delivery &amp; Installation
          </p>
        </div>
      </section>

      {description.trim() !== '' && (
        <section className="rounded-xl border border-cream-border bg-white p-5 sm:p-6">
          <ExpandableRte html={description} />
        </section>
      )}

      {children.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Subcategories</h2>
          <div className="flex flex-wrap gap-2">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/collections/${child.handle}`}
                className="rounded-full border border-cream-border bg-white px-4 py-2 text-xs font-medium text-ink-dark transition hover:border-brand hover:bg-brand hover:text-white"
              >
                {child.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <FilterBar basePath={basePath} sort={filters.sort} min={filters.min} max={filters.max} stock={filters.inStock} />

      <CatalogResults
        result={result}
        basePath={basePath}
        params={linkParams}
        empty={{
          icon: 'package',
          title: filtered ? 'No products match your filters' : 'No products here yet',
          message: filtered
            ? 'Try widening the price range or clearing the in-stock filter to see more products.'
            : 'We are restocking this category. Browse our other collections in the meantime.',
          action: filtered
            ? { href: basePath, label: 'Clear filters' }
            : { href: '/collections', label: 'Browse all categories' },
          secondary: filtered ? { href: '/collections/all', label: 'View all products' } : undefined,
        }}
      />
    </div>
  );
}
