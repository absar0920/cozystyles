import Link from 'next/link';
import { formatPKR, discountPercent } from '@/lib/money';
import type { ProductCardData } from '@/lib/queries';
import { Stars } from '@/components/ui/Stars';
import { CartIcon } from '@/components/icons';
import { QuickAdd } from '@/components/catalog/QuickAdd';

export function ProductCard({ product }: { product: ProductCardData & { compareAtPrice?: number | null } }) {
  const off = discountPercent(product.price, product.compareAtPrice ?? null);
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-cream-border bg-white shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-hover">
      <Link href={`/products/${product.handle}`} className="relative block aspect-square overflow-hidden bg-cream-soft">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-cream-border">IW</div>
        )}
        {off != null && (
          <span className="absolute left-3 top-3 rounded-md bg-sale px-2 py-0.5 text-[11px] font-bold text-white shadow">
            -{off}% OFF
          </span>
        )}
        {product.inventory === 0 ? (
          <span className="absolute bottom-3 left-3 rounded-md bg-ink-dark/80 px-2 py-0.5 text-[11px] font-medium text-white">
            Made to Order
          </span>
        ) : (
          <span className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-medium text-brand-700 shadow-sm backdrop-blur-sm">
            Ready to ship
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <Stars rating={product.rating} count={product.reviewCount} />
        <Link
          href={`/products/${product.handle}`}
          className="line-clamp-2 min-h-[2.6rem] text-[13px] font-medium leading-snug text-ink-dark transition hover:text-brand"
          title={product.title}
        >
          {product.title}
        </Link>
        <div className="mt-auto flex items-baseline gap-2">
          {product.priceOnRequest ? (
            <span className="text-[13px] font-semibold text-ink-dark">Price on Request</span>
          ) : (
            <>
              <span className="text-[15px] font-bold text-brand">{formatPKR(product.price)}</span>
              {product.compareAtPrice != null && product.compareAtPrice > product.price && (
                <span className="text-xs text-ink-light line-through">{formatPKR(product.compareAtPrice)}</span>
              )}
            </>
          )}
        </div>
        <QuickAdd product={product} />
      </div>
      <span className="hidden" aria-hidden>
        <CartIcon className="h-4 w-4" />
      </span>
    </div>
  );
}
