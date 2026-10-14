'use client';

import { useState } from 'react';
import { useCart } from '@/lib/cart';
import type { ProductCardData } from '@/lib/queries';
import { CheckIcon, CartIcon } from '@/components/icons';

/** Quick add-to-cart button used on product cards. Adds the cheapest variant. Price-on-request items link to the enquiry form instead. */
export function QuickAdd({ product }: { product: ProductCardData }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  if (product.priceOnRequest) {
    return (
      <a
        href="/pages/contact"
        className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-full border-0 bg-cream-soft px-3 py-2 text-xs font-semibold text-ink-dark transition hover:bg-brand hover:text-white"
      >
        Enquire Now
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        addItem({
          productId: product.id,
          variantId: 0,
          handle: product.handle,
          title: product.title,
          variantTitle: '',
          price: product.price,
          compareAtPrice: product.compareAtPrice ?? null,
          image: product.image ?? '',
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 1400);
      }}
      className={`mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-full border-0 px-3 py-2 text-xs font-semibold transition ${
        added ? 'bg-brand text-white' : 'bg-cream-soft text-ink-dark hover:bg-brand hover:text-white'
      }`}
    >
      {added ? <CheckIcon className="h-3.5 w-3.5" /> : <CartIcon className="h-3.5 w-3.5" />}
      {added ? 'Added to Cart' : 'Add to Cart'}
    </button>
  );
}
