import Link from 'next/link';
import { discountPercent } from '@/lib/money';
import type { ProductCardData } from '@/lib/queries';
import { Price } from '@/components/ui/Price';

/**
 * `active` mirrors live `.product-card-swatch.active` (ringed); when no swatch says, see `activeSwatch`.
 * `swatchImage` (a fabric/finish photo) wins over `color`.
 */
export type CardSwatch = { name: string; color: string; swatchImage?: string | null; active?: boolean };

/** Optional extras a page can attach to the base card data (all default to the live "plain" card). */
export type ProductCardExtras = {
  compareAtPrice?: number | null;
  /** 2nd product image: cross-fades in on hover (live `.thb-hover`). */
  hoverImage?: string | null;
  /** Red "NEW" label above the title (live: products tagged "New Arrivals"). */
  isNew?: boolean;
  /** Yellow "Limited Edition" bar stacked above the status bar. */
  limitedEdition?: boolean;
  /** Overrides the status bar text. Default: the card data's `statusLabel` (from the variant statuses). */
  statusLabel?: string | null;
  /** Sale circle %: the card's own variant discount (cardPrice). Default: computed from price vs compareAtPrice. */
  salePercent?: number | null;
  /** Judge.me text stars under the price — live shows them only for products with reviews. */
  showRating?: boolean;
  /** Colour swatches. The ringed one is the swatch flagged `active`, else index `activeSwatch`. */
  swatches?: CardSwatch[];
  /** Ringed swatch index when the swatches carry no `active` flag: undefined = first, null = none. */
  activeSwatch?: number | null;
  /** Image box ratio (height / width). Default 700/920 like most live product photos. */
  imageRatio?: number;
};

/**
 * The live product card (Habitat `product-card`): flat 920:700 image, sale circle top-right,
 * dark status strip bottom-left, 13.4px title, `Rs.` price with struck compare-at, optional
 * teal stars + swatches. No buttons, radius, border or shadow. Server-safe (pure CSS hover).
 *
 * Grid spacing is the caller's job: live uses 4 columns with 30px gutters and 30px row gap
 * (≥768) / 2 columns, 15px gutters, 20px row gap (<768).
 */
export function ProductCard({
  product,
  className = '',
  priority = false,
}: {
  product: ProductCardData & ProductCardExtras;
  className?: string;
  priority?: boolean;
}) {
  const href = `/products/${product.handle}`;
  const pct = product.salePercent !== undefined ? product.salePercent : discountPercent(product.price, product.compareAtPrice ?? null);
  const status = product.statusLabel;
  const ratio = product.imageRatio ?? 700 / 920;
  const hover = product.hoverImage && product.hoverImage !== product.image ? product.hoverImage : null;
  const ratingPct = `${Math.max(0, Math.min(5, product.rating)) * 20}%`;
  const swatches = product.swatches ?? [];
  const flagged = swatches.some((s) => s.active !== undefined);
  const ringed = flagged ? swatches.findIndex((s) => s.active) : product.activeSwatch === undefined ? 0 : product.activeSwatch;

  return (
    <div className={`product-card group/card relative block text-left leading-[1.7] ${className}`}>
      <figure className="relative m-0">
        {pct != null && pct > 0 && (
          <span className="absolute right-px top-px z-30 inline-flex h-7 w-7 flex-col items-center justify-center whitespace-nowrap rounded-full bg-accent2 text-center text-[8px] font-normal uppercase leading-none tracking-badge text-white md:h-[35px] md:w-[35px] md:text-[10px] md:font-bold">
            {pct}%<br />off
          </span>
        )}
        {(status || product.limitedEdition) && (
          <span className="absolute bottom-0 left-0 z-30 flex w-[93.5px] flex-col items-start">
            {product.limitedEdition && <StatusBar className="bg-limited text-accent">Limited Edition</StatusBar>}
            {status && <StatusBar className="bg-accent text-white">{status}</StatusBar>}
          </span>
        )}
        <Link href={href} className="relative block h-0 overflow-hidden" style={{ paddingBottom: `${ratio * 100}%` }} tabIndex={-1} aria-hidden>
          {product.image ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.image}
                alt={product.title}
                loading={priority ? 'eager' : 'lazy'}
                className={`absolute inset-0 z-[5] h-full w-full object-contain transition-opacity duration-[250ms] ease-theme ${hover ? 'group-hover/card:opacity-0' : ''}`}
              />
              {hover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hover}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 z-10 h-full w-full object-contain opacity-0 transition-opacity duration-[250ms] ease-theme group-hover/card:opacity-100"
                />
              )}
            </>
          ) : (
            <span className="absolute inset-0 bg-cream" />
          )}
        </Link>
      </figure>

      {/* live <768: `.product-card-info { min-height: 4.4em; display: flex; flex-flow: column }` (17px) */}
      <div className="product-card-info relative max-md:flex max-md:min-h-[74.8px] max-md:flex-col">
        <div className="pl-[.3em] leading-[17px] md:pl-0">
          {/* inline 8.5px label on the 17px strut, like live `span.tagbase_Label` */}
          <span className={`text-[8.5px] font-medium leading-[8.5px] text-[#ff0000] ${product.isNew ? '' : 'invisible'}`} aria-hidden={!product.isNew}>
            NEW
          </span>
          <Link
            href={href}
            className="mb-[5.9px] block text-[11.8px] font-normal leading-[15.34px] text-accent hover:text-accent2 md:mb-0 md:text-[13.4px] md:leading-[20.1px]"
          >
            {product.title}
          </Link>
        </div>
        {!product.priceOnRequest && (
          <Price
            price={product.price}
            compareAt={product.compareAtPrice}
            className="relative block pb-[2.8px] pl-[5.6px] leading-[12.6px] md:pb-0 md:pl-0 md:leading-[23.8px] md:[&_del]:leading-[1.7]"
          />
        )}
        {product.showRating && product.reviewCount > 0 && (
          <div
            className="star-rating ml-[5.76px] block md:ml-0 md:mt-[5px] md:inline-block"
            style={{ ['--rating' as string]: ratingPct }}
            aria-label={`${product.rating.toFixed(1)} out of 5 stars`}
            role="img"
          >
            ★★★★★
          </div>
        )}
        {swatches.length > 0 && (
          <div className="mt-[9px] flex gap-[4.5px] leading-none" aria-label="Colours">
            {swatches.map((s, i) => (
              <span
                key={`${s.name}-${i}`}
                title={s.name}
                className={`relative inline-flex h-[18px] w-[18px] rounded-[7px] p-[3px] ${i === ringed ? 'shadow-[inset_0_0_0_1px_#103a3a]' : ''}`}
              >
                <span
                  className="h-full w-full rounded-full"
                  style={{ background: s.swatchImage ? `center / cover no-repeat url("${s.swatchImage.replace(/"/g, '%22')}")` : s.color }}
                />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBar({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`block h-[17px] w-full overflow-visible whitespace-nowrap px-[3px] text-[8.5px] font-normal uppercase leading-[17px] tracking-badge md:px-[10px] md:font-bold ${className}`}
    >
      {children}
    </span>
  );
}
