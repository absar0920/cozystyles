/** Per-variant availability status (client-safe). See docs/admin-easy-mode/SPEC.md §2.2. */
export const VARIANT_STATUSES = ['READY_TO_SHIP', 'MADE_TO_ORDER', 'PRE_ORDER', 'SOLD_OUT'] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

export const VARIANT_STATUS_COPY: Record<VariantStatus, { label: string; help: string }> = {
  READY_TO_SHIP: { label: 'Ready to ship', help: 'In stock — we can deliver soon.' },
  MADE_TO_ORDER: { label: 'Made to order', help: 'We make it after the order is confirmed.' },
  PRE_ORDER: { label: 'Pre-order', help: 'Not in stock yet — customers can reserve it.' },
  SOLD_OUT: { label: 'Sold out', help: 'Not available. Customers can still ask on WhatsApp.' },
};

export function isVariantStatus(v: unknown): v is VariantStatus {
  return typeof v === 'string' && (VARIANT_STATUSES as readonly string[]).includes(v);
}

/** Only SOLD_OUT is "unavailable". */
export function isAvailable(status: string): boolean {
  return status !== 'SOLD_OUT';
}

/** PRE_ORDER | SOLD_OUT → the buy button reads "ASK ABOUT AVAILABILITY". */
export function asksAvailability(status: string): boolean {
  return status === 'PRE_ORDER' || status === 'SOLD_OUT';
}

/**
 * Product card status bar:
 * any READY_TO_SHIP → 'Ready to ship'; else any PRE_ORDER → 'Pre-Order'; else any MADE_TO_ORDER → null (no bar,
 * live parity); else (all SOLD_OUT or no variants) → 'Sold Out'.
 */
export function cardStatusLabel(statuses: readonly string[]): string | null {
  if (statuses.includes('READY_TO_SHIP')) return 'Ready to ship';
  if (statuses.includes('PRE_ORDER')) return 'Pre-Order';
  if (statuses.includes('MADE_TO_ORDER')) return null;
  return 'Sold Out';
}

/** schema.org availability URL for a product's variants (same precedence as the card label). */
export function schemaAvailability(statuses: readonly string[]): string {
  const base = 'https://schema.org/';
  if (statuses.includes('READY_TO_SHIP')) return `${base}InStock`;
  if (statuses.includes('MADE_TO_ORDER')) return `${base}MadeToOrder`;
  if (statuses.includes('PRE_ORDER')) return `${base}PreOrder`;
  return `${base}SoldOut`;
}
