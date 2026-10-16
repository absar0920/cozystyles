/** The one product-card swatch builder (client-safe, pure). Used by catalog cards and the home hot-selling carousel. */
import type { Prisma } from '@prisma/client';
import { NEUTRAL_SWATCH, isCardSwatchOptionName } from '@/lib/product-options';

export type CardSwatchData = { name: string; color: string; swatchImage: string | null; image: string | null; active: boolean };

export type CardSwatchSource = {
  /** values in position order */
  productOptions: { name: string; values: { id: number; value: string; swatchColor: string | null; swatchImage: string | null }[] }[];
  /** in position order */
  images: { src: string; optionValueId: number | null }[];
};

/**
 * Option = the first card-swatch option (Color/Colour/Finish…); none → [].
 * Per value: colour (neutral fallback), photo swatch, the first photo tagged with the value, and `active`
 * when the product's first photo is tagged with it.
 */
export function buildCardSwatches(p: CardSwatchSource): CardSwatchData[] {
  const option = p.productOptions.find((o) => isCardSwatchOptionName(o.name));
  if (!option) return [];
  const leadTag = p.images[0]?.optionValueId ?? null;
  return option.values.map((v) => ({
    name: v.value,
    color: v.swatchColor ?? NEUTRAL_SWATCH,
    swatchImage: v.swatchImage,
    image: p.images.find((im) => im.optionValueId === v.id)?.src ?? null,
    active: leadTag != null && leadTag === v.id,
  }));
}

/** The productOptions + images select that feeds buildCardSwatches. */
export const CARD_SWATCH_SELECT = {
  productOptions: {
    orderBy: { position: 'asc' },
    select: {
      name: true,
      values: { orderBy: { position: 'asc' }, select: { id: true, value: true, swatchColor: true, swatchImage: true } },
    },
  },
  images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { src: true, optionValueId: true } },
} satisfies Prisma.ProductSelect;
