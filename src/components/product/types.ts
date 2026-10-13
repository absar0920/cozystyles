/** Serializable product types shared between the product detail page (server) and its client components. */

export type ProductOption = {
  name: string;
  values: string[];
};

export type VariantInfo = {
  id: number;
  title: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  inventory: number;
  option1: string | null;
  option2: string | null;
  option3: string | null;
};

/** Value of a variant at option position 0|1|2 → option1|option2|option3. */
export function optionAt(variant: VariantInfo, index: number): string {
  if (index === 0) return variant.option1 ?? '';
  if (index === 1) return variant.option2 ?? '';
  if (index === 2) return variant.option3 ?? '';
  return '';
}
