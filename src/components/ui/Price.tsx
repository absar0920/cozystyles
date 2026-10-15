/** Live storefront money format: "Rs.84,000" (no space after "Rs.", comma grouping, no decimals). */
export function formatRs(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}Rs.${Math.abs(Math.round(amount)).toLocaleString('en-US')}`;
}

/**
 * Live `.price` block: `<ins>Rs.84,000</ins> <del>Rs.120,000</del>` — sale price first, the
 * struck compare-at price after it at 90% size with its amount at 40% opacity.
 * Base look is 14px/500, letter-spacing .02em, accent colour; pass className to resize (e.g. PDP 20px).
 */
export function Price({
  price,
  compareAt,
  className = '',
}: {
  price: number;
  compareAt?: number | null;
  className?: string;
}) {
  const onSale = compareAt != null && compareAt > price;
  return (
    <span className={`price ${className}`}>
      <ins className="no-underline">{formatRs(price)}</ins>
      {onSale && (
        <>
          {' '}
          <del>
            <span>{formatRs(compareAt)}</span>
          </del>
        </>
      )}
    </span>
  );
}
