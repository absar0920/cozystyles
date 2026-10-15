'use client';

import { useCart } from '@/lib/cart';
import type { ProductCardData } from '@/lib/queries';

/**
 * Add-to-cart button in the live `.button` style (52px, 13px/700 uppercase, .2em tracking, radius 3px).
 * Adds the cheapest variant and opens the cart drawer. Live product cards do NOT render this —
 * it is only for contexts that need a direct add (e.g. custom landing sections).
 * Price-on-request items link to the contact form instead.
 */
export function QuickAdd({ product, className = '' }: { product: ProductCardData; className?: string }) {
  const { addItem } = useCart();

  if (product.priceOnRequest) {
    return (
      <a href="/pages/contact" className={`btn-outline btn-full ${className}`}>
        Enquire Now
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        addItem({
          productId: product.id,
          variantId: 0,
          handle: product.handle,
          title: product.title,
          variantTitle: '',
          price: product.price,
          compareAtPrice: product.compareAtPrice ?? null,
          image: product.image ?? '',
        })
      }
      className={`btn btn-full ${className}`}
    >
      <span>Add to cart</span>
    </button>
  );
}
