'use server';

import { getCatalog, getCatalogCollection, type CatalogCard } from '@/components/catalog/catalog-data';
import { parseCatalogFilters, type RawSearchParams } from '@/components/catalog/filters';
import { COLLECTION_PER_PAGE } from '@/components/catalog/constants';

/** Infinite scroll: the cards of `page` for a collection, with the same filters / sort as the URL. */
export async function loadCollectionPage(handle: string, query: string, page: number): Promise<CatalogCard[]> {
  if (typeof handle !== 'string' || typeof query !== 'string' || !Number.isInteger(page) || page < 2) return [];
  const sp: RawSearchParams = {};
  for (const [k, v] of new URLSearchParams(query.slice(0, 2000))) {
    const prev = sp[k];
    sp[k] = prev == null ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  const filters = { ...parseCatalogFilters(sp), page, q: '' };
  const collection = handle === 'all' ? null : await getCatalogCollection(handle);
  if (!collection && handle !== 'all') return [];
  const result = await getCatalog({
    collectionHandle: collection?.handle,
    productOrder: collection?.productOrder,
    filters,
    perPage: COLLECTION_PER_PAGE,
    defaultSort: 'manual',
  });
  return result.page === page ? result.items : [];
}
