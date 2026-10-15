import type { CardSwatch } from '@/components/catalog/ProductCard';

/**
 * Live "Hot Selling Products" carousel, in live order. Per-card extras mirror what the live
 * Shopify card shows (sale % is the max over variants, Judge.me stars only for products with
 * real reviews, status "Sold out" when nothing is in stock).
 */
export type HotSellingSpec = {
  handle: string;
  salePercent: number | null;
  /** `null` hides the struck compare-at price (live shows none for Antonin / Alexa / Majestic). */
  compareAt?: number | null;
  rating?: number;
  /**
   * Index of the ringed swatch = the variant whose image the card shows (default 0). `null` = none
   * ringed (live: Alexa rings Maroon, the 3rd; Cooper rings Rose Hip, the 1st; Majestic and
   * Antonin ring nothing).
   */
  activeSwatch?: number | null;
  swatches?: CardSwatch[];
};

export const HOT_SELLING: HotSellingSpec[] = [
  { handle: 'crf-2-door-sliding-wardrobe', salePercent: 30 },
  {
    handle: 'alexa-sofa-chair',
    salePercent: null,
    compareAt: null,
    rating: 5,
    activeSwatch: 2,
    swatches: [
      { name: 'Winter Blue', color: '#2377a4' },
      { name: 'Rose Hip Velvet', color: '#af6f70' },
      { name: 'Maroon', color: 'maroon' },
    ],
  },
  { handle: 'linea-wardrobe-3-door', salePercent: 20 },
  {
    handle: 'cooper-sofa',
    salePercent: 20,
    compareAt: 105000,
    swatches: [
      { name: 'Rose Hip', color: '#af6f70' },
      { name: 'Waffle Black', color: '#000000' },
      { name: 'Ivory Velvet', color: '#a19a7e' },
    ],
  },
  {
    handle: 'sofa-majestic-2-seater-velvet-winter-green',
    salePercent: null,
    compareAt: null,
    activeSwatch: null,
    swatches: [
      { name: 'Ivory Velvet', color: '#a19a7e' },
      { name: 'Green Velvet', color: '#acac98' },
    ],
  },
  {
    handle: 'antonin-sofa',
    salePercent: 30,
    compareAt: null,
    activeSwatch: null,
    swatches: [
      { name: 'Velvet Winter Green', color: '#acac98' },
      { name: 'Ivory Velvet', color: '#a19a7e' },
      { name: 'Mid Brown', color: '#7f5112' },
    ],
  },
  { handle: 'sydney-trysil-wardrobe-3-doors-light-oak-grey-color', salePercent: 10, rating: 4 },
  { handle: 'marcus-visitor-chair-waffle-black', salePercent: 30 },
  { handle: 'visitor-chair-jxn-500m', salePercent: 40 },
];
