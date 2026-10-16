/** The 18 below-the-fold product page layouts (keys = template suffixes in components/product/data/templates.json). */
export const PRODUCT_LAYOUTS: { key: string; label: string; help: string }[] = [
  { key: 'default', label: 'General furniture (standard)', help: 'Big banner, three photo-and-text blocks, testimonials, “You may also like”, reviews.' },
  { key: 'living-products', label: 'Living room', help: 'Living room story blocks, testimonials, recommendations, reviews.' },
  { key: 'sofas', label: 'Sofas', help: 'Sofa story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'bedroom-products', label: 'Bedroom', help: 'Bedroom story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'bed-sets', label: 'Bed sets', help: 'Bed set story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'dining-products', label: 'Dining', help: 'Dining story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'study-products', label: 'Study', help: 'Study story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'kids-products', label: 'Kids', help: 'Kids room story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'office-products', label: 'Office furniture', help: 'Workspace story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'wardrobes-products', label: 'Wardrobes', help: 'Wardrobe story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'kitchens-products', label: 'Kitchens', help: 'Kitchen story blocks with icons, testimonials, recommendations (no reviews).' },
  { key: 'door-products', label: 'Doors', help: 'Door story blocks with icons, testimonials, recommendations (no reviews).' },
  { key: 'decor-products', label: 'Decor accessories', help: 'Decor story blocks with icons, testimonials, recommendations, reviews.' },
  { key: 'decor-cushions', label: 'Cushions', help: 'Starts with two cushion carousels, then the decor story blocks.' },
  { key: 'coalesce-living', label: 'Coalesce — living', help: 'Coalesce range: recommendations first, slideshow, story blocks, reviews.' },
  { key: 'coalesce-dining', label: 'Coalesce — dining', help: 'Coalesce range: recommendations first, slideshow, story blocks, reviews.' },
  { key: 'coalesce-bedroom', label: 'Coalesce — bedroom', help: 'Coalesce range: recommendations first, slideshow, story blocks, reviews.' },
  { key: 'blank-template-no-section', label: 'Simple (only “You may also like”)', help: 'No extra sections below the product.' },
];

const LAYOUT_KEYS = new Set(PRODUCT_LAYOUTS.map((l) => l.key));

export function isProductLayout(key: string): boolean {
  return LAYOUT_KEYS.has(key);
}

export function layoutLabel(key: string): string {
  return PRODUCT_LAYOUTS.find((l) => l.key === key)?.label ?? PRODUCT_LAYOUTS[0].label;
}
