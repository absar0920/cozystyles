import { ProductCard } from '@/components/catalog/ProductCard';
import type { ProductCardData } from '@/lib/queries';

/** Responsive product grid: 2 columns on mobile, 3 on tablet, 4 on desktop. */
export function ProductGrid({ items }: { items: (ProductCardData & { compareAtPrice?: number | null })[] }) {
  return (
    <div className="animate-fadeIn grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
      {items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
