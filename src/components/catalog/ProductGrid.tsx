import { ProductCard } from '@/components/catalog/ProductCard';
import type { CatalogCard } from './catalog-data';

/**
 * Live `#product-grid` (`small-up-2 medium-up-4`): 2 columns under 768 (15px gutter, 20px row gap),
 * 4 columns from 768 (30px gutter, 30px row gap). Place inside `.container-iw`.
 */
export function ProductGrid({ items, eagerCount = 4 }: { items: CatalogCard[]; eagerCount?: number }) {
  return (
    <ul id="product-grid" className="m-0 mb-5 grid list-none grid-cols-2 gap-x-[15px] gap-y-5 p-0 pb-5 md:grid-cols-4 md:pb-[30px] md:gap-x-[30px] md:gap-y-[30px]">
      {items.map((product, i) => (
        <li key={product.id}>
          <ProductCard product={product} priority={i < eagerCount} />
        </li>
      ))}
    </ul>
  );
}
