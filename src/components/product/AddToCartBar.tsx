'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import type { CartItem } from '@/lib/cart';
import { CartIcon, CheckIcon } from '@/components/icons';

/** Add to Cart + Buy Now actions. Receives only plain serializable props. */
export function AddToCartBar({ item, qty }: { item: Omit<CartItem, 'key' | 'qty'>; qty: number }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [buying, setBuying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleAdd = () => {
    addItem(item, qty);
    setAdded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAdded(false), 1600);
  };

  const handleBuyNow = () => {
    if (buying) return;
    setBuying(true);
    addItem(item, qty);
    router.push('/checkout');
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={handleAdd}
        className={`btn-primary flex-1 ${added ? 'bg-brand-600' : ''}`}
      >
        {added ? <CheckIcon className="h-4 w-4" strokeWidth={2.4} /> : <CartIcon className="h-4.5 w-4.5" />}
        {added ? 'Added to Cart' : 'Add to Cart'}
      </button>
      <button type="button" onClick={handleBuyNow} disabled={buying} className="btn-dark flex-1">
        {buying ? 'Taking you to checkout…' : 'Buy Now'}
      </button>
    </div>
  );
}
