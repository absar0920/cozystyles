/**
 * The ready-made icon set for "Icons row" sections (docs/product-layouts/SPEC.md §4). Pure: imported by the section
 * helpers, the migration and the admin picker. The drawings live in src/components/product/pdp-icons.tsx.
 */
export const ICON_KEYS = [
  'delivery',
  'support',
  'quality',
  'assembly',
  'warranty',
  'returns',
  'payment',
  'cash',
  'measure',
  'leaf',
  'phone',
  'chat',
  'star',
  'store',
  'clock',
  'gift',
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

export const ICON_LABELS: Record<IconKey, string> = {
  delivery: 'Delivery van',
  support: 'After-sales support (stopwatch)',
  quality: 'Quality standard (box)',
  assembly: 'Assembly (recycle arrows)',
  warranty: 'Warranty (shield with tick)',
  returns: 'Easy returns (circular arrow)',
  payment: 'Card payment',
  cash: 'Cash on delivery (banknote)',
  measure: 'Made to measure (ruler)',
  leaf: 'Natural materials (leaf)',
  phone: 'Call us (phone)',
  chat: 'Message us (speech bubble)',
  star: 'Top rated (star)',
  store: 'Visit our showroom (shopfront)',
  clock: 'Quick turnaround (clock)',
  gift: 'Gift ready (gift box)',
};

export const DEFAULT_ICON: IconKey = 'delivery';

const KEYS = new Set<string>(ICON_KEYS);

export function isIconKey(v: unknown): v is IconKey {
  return typeof v === 'string' && KEYS.has(v);
}

/** The icon the old renderer picked by block position (0 delivery, 1 support, 2 quality, 3 assembly, ≥4 delivery). */
export function legacyIconAt(index: number): IconKey {
  return (['delivery', 'support', 'quality', 'assembly'] as const)[index] ?? 'delivery';
}
