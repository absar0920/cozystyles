import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { FilterBar } from '@/components/catalog/FilterBar';
import { InfiniteGrid } from '@/components/catalog/InfiniteGrid';
import { ExpandableRte } from '@/components/catalog/ExpandableRte';
import { EmptyState } from '@/components/catalog/EmptyState';
import { getCatalog, getCatalogCollection } from '@/components/catalog/catalog-data';
import { COLLECTION_PER_PAGE } from '@/components/catalog/constants';
import { truncateRte } from '@/components/catalog/rte';
import { sanitizeRichText } from '@/lib/rich-text/sanitize';
import { stripHtml } from '@/components/pages/content';
import {
  catalogHref,
  COLLECTION_SORTS,
  filterParams,
  parseCatalogFilters,
  type RawSearchParams,
} from '@/components/catalog/filters';
import { loadCollectionPage } from './actions';
import { canonical, pagedPath } from '@/lib/seo';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type PageParams = Promise<{ handle: string }>;

/**
 * Sorted / filtered views count as the collection itself. Unfiltered page 2 onwards lists other products, so it is
 * its own page — up to the last one (a higher number shows the last page).
 */
async function canonicalCollectionPath(handle: string, sp: RawSearchParams): Promise<string> {
  const path = `/collections/${handle}`;
  const filters = parseCatalogFilters(sp);
  if (filterParams({ ...filters, q: '' }).length || filters.page <= 1) return path;
  const total = await prisma.product.count({ where: { status: 'ACTIVE', ...(handle === 'all' ? {} : { collections: { some: { handle } } }) } });
  return pagedPath(path, Math.min(filters.page, Math.max(1, Math.ceil(total / COLLECTION_PER_PAGE))));
}

export async function generateMetadata({ params, searchParams }: { params: PageParams; searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const { handle } = await params;
  const self = canonical(await canonicalCollectionPath(handle, await searchParams));
  if (handle === 'all') return { title: 'Products', ...self };
  const collection = await getCatalogCollection(handle);
  if (!collection) return { title: 'Collection not found' };
  const desc = stripHtml(collection.description);
  return {
    ...self,
    title: collection.title,
    description: desc
      ? desc.slice(0, 160)
      : `Shop ${collection.title} at Cozy Furnitures — Pakistan's largest furniture manufacturer. Free delivery & installation nationwide.`,
  };
}

/**
 * Live read-more cuts `.page-header__inner` innerHTML at 500 chars, and that HTML starts with the
 * hidden `<h1 class="thb-shop-title">{title}</h1>` + whitespace + an empty `<p></p>` (57 chars + title).
 */
function previewLimit(title: string): number {
  return Math.max(100, 500 - 57 - title.length);
}

/** Live collection description typography (`.page-header__inner` + `.rte`), mobile → desktop. */
const RTE_CLASS = [
  'px-[15px] text-left text-[14px] leading-[1.7] text-black md:px-10 md:text-[17px]',
  '[&_p]:mb-5 [&_p]:text-black [&_ul]:mb-5 [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:mb-5 [&_ol]:ml-5 [&_ol]:list-decimal',
  '[&_a]:underline [&_strong]:font-semibold',
  '[&_h1]:mb-5 [&_h1]:text-[24px] [&_h1]:font-semibold [&_h1]:leading-normal md:[&_h1]:text-[40px]',
  '[&_h2]:mb-5 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:leading-normal md:[&_h2]:text-[32px]',
  '[&_h3]:mb-5 [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:leading-normal md:[&_h3]:text-[26px]',
  '[&_h4]:mb-5 [&_h4]:text-[18px] [&_h4]:font-semibold [&_h4]:leading-normal',
  '[&>*:last-child]:mb-0',
].join(' ');

/**
 * Live collection template: breadcrumbs → facets toolbar → 4-up product grid with infinite
 * scroll → (optional) SEO description with "Show more". No banner and no visible title.
 */
export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: Promise<RawSearchParams>;
}) {
  const { handle } = await params;
  const filters = { ...parseCatalogFilters(await searchParams), q: '' };

  // `/collections/all` lists every product (live title "Products").
  const collection = handle === 'all' ? null : await getCatalogCollection(handle);
  if (!collection && handle !== 'all') notFound();
  const title = collection?.title ?? 'Products';

  const result = await getCatalog({
    collectionHandle: collection?.handle,
    productOrder: collection?.productOrder,
    filters,
    perPage: COLLECTION_PER_PAGE,
    defaultSort: 'manual',
  });

  const basePath = `/collections/${handle}`;
  const params_ = filterParams(filters);
  const query = new URLSearchParams(params_).toString();
  const description = sanitizeRichText(collection?.description ?? '');

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Shop', href: '/collections/all' },
          { label: title, href: basePath },
        ]}
      />
      <h1 className="sr-only">{title}</h1>

      <div className="container-iw mb-[30px]">
        <FilterBar
          basePath={basePath}
          filters={filters}
          sortOptions={COLLECTION_SORTS}
          defaultSort="manual"
          noun="products"
          total={result.total}
          inStockCount={result.inStockCount}
          outOfStockCount={result.outOfStockCount}
          maxPrice={result.maxPrice}
        />

        {result.items.length === 0 ? (
          <EmptyState>
            {/* Live: just the sentence, no "remove all" link (the active-filter pills above clear filters). */}
            <p>No products found</p>
          </EmptyState>
        ) : (
          <InfiniteGrid
            key={`${handle}?${query}&p=${result.page}`}
            initialItems={result.items}
            page={result.page}
            pages={result.pages}
            query={query}
            nextHref={result.page < result.pages ? catalogHref(basePath, params_, result.page + 1) : null}
            loadPage={loadCollectionPage.bind(null, handle)}
          />
        )}
      </div>

      {description && (
        <div className="flex flex-col px-0 pb-[30px] pt-5 text-center md:px-[60px] md:pb-[60px]">
          <ExpandableRte
            full={description}
            preview={truncateRte(description, previewLimit(title))}
            className={RTE_CLASS}
          />
        </div>
      )}
    </>
  );
}
