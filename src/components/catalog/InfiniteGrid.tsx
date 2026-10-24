'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogCard } from './catalog-data';
import { ProductGrid } from './ProductGrid';
import { toast } from '@/components/toast/toast';

/**
 * Live `pagination-type--infinite`: when the (invisible) pagination block is fully in view the
 * next page is fetched and appended, keeping the current filters and sort. A spinner shows while
 * loading; without JS a plain "Load more" link to `?page=N+1` is rendered instead.
 */
export function InfiniteGrid({
  initialItems,
  page,
  pages,
  query,
  nextHref,
  loadPage,
}: {
  initialItems: CatalogCard[];
  page: number;
  pages: number;
  /** Current query string without `page` (used to fetch further pages). */
  query: string;
  nextHref: string | null;
  loadPage: (query: string, page: number) => Promise<CatalogCard[]>;
}) {
  const [items, setItems] = useState(initialItems);
  const [current, setCurrent] = useState(page);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const loadNext = useCallback(async () => {
    if (busy.current || current >= pages) return;
    busy.current = true;
    setLoading(true);
    try {
      const next = await loadPage(query, current + 1);
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.filter((p) => !seen.has(p.id))];
      });
      setCurrent((c) => c + 1);
    } catch {
      toast.error('More products could not be loaded');
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [current, pages, query, loadPage]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || current >= pages) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && void loadNext(), { rootMargin: '0px 0px 200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [current, pages, loadNext]);

  return (
    <>
      <ProductGrid items={items} />
      {pages > 1 && (
      <div ref={sentinel} className="relative block min-h-[42px] text-center">
        {loading && (
          <span
            role="status"
            aria-label="Loading"
            className="absolute left-1/2 top-1/2 -ml-4 -mt-4 h-8 w-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent"
          />
        )}
        {nextHref && current < pages && (
          <noscript>
            <a href={nextHref} className="btn">
              <span>Load more</span>
            </a>
          </noscript>
        )}
      </div>
      )}
    </>
  );
}
