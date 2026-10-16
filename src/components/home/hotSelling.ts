/**
 * Live "Hot Selling Products" carousel: which products, in live order (SPEC §5.2.4). Everything on the
 * cards (price, struck price, sale %, swatches, stars, status) comes from the database. `salePercent`
 * overrides the computed sale badge only where live parity needs a different value (none today).
 */
export type HotSellingSpec = { handle: string; salePercent?: number | null };

export const HOT_SELLING: HotSellingSpec[] = [
  { handle: 'crf-2-door-sliding-wardrobe' },
  { handle: 'alexa-sofa-chair' },
  { handle: 'linea-wardrobe-3-door' },
  { handle: 'cooper-sofa' },
  { handle: 'sofa-majestic-2-seater-velvet-winter-green' },
  { handle: 'antonin-sofa' },
  { handle: 'sydney-trysil-wardrobe-3-doors-light-oak-grey-color' },
  { handle: 'marcus-visitor-chair-waffle-black' },
  { handle: 'visitor-chair-jxn-500m' },
];
