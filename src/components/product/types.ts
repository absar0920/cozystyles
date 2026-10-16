/** Serializable product types shared between the product detail page (server) and its client components. */
import { isAvailable } from '@/lib/variant-status';

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
  /** READY_TO_SHIP | MADE_TO_ORDER | PRE_ORDER | SOLD_OUT */
  status: string;
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

/** A product photo; `tag` = the option value it shows ("Shows: Color: Grey"), null = any option. */
export type ProductImageInfo = { src: string; alt: string; tag: { optionIndex: number; value: string } | null };

/** Swatch per option position → value: colour (neutral fallback) or photo. Only colour/finish options. */
export type SwatchMap = Record<number, Record<string, { color: string; image: string | null }>>;

/**
 * Option values to strike through (live Habitat `createAvailableOptionsTree`): a value is available
 * when some available (not sold out) variant carries it and matches all but at most one of the current selections;
 * a first-option value is available when any in-stock variant carries it; and while the current
 * variant is sold out, its selected values are marked unavailable (first option excepted when
 * another in-stock variant carries it). Returns option position → unavailable values.
 */
export function unavailableValues(
  variants: VariantInfo[],
  selected: { index: number; value: string }[],
  currentAvailable: boolean,
): Record<number, Set<string>> {
  const state = new Map<number, Map<string, boolean>>();
  for (const v of variants) {
    const available = isAvailable(v.status);
    const matches = selected.reduce((n, s) => (optionAt(v, s.index) === s.value ? n + 1 : n), 0);
    for (const index of [0, 1, 2]) {
      const value = index === 0 ? v.option1 : index === 1 ? v.option2 : v.option3;
      if (value == null) continue;
      const entries = state.get(index) ?? new Map<string, boolean>();
      state.set(index, entries);
      let unavailable = entries.get(value) ?? true;
      if (matches >= selected.length - 1 && available) unavailable = false;
      if (!currentAvailable && selected.some((s) => s.index === index && s.value === value)) unavailable = true;
      if (index === 0 && available) unavailable = false;
      entries.set(value, unavailable);
    }
  }
  const out: Record<number, Set<string>> = {};
  state.forEach((entries, index) => {
    out[index] = new Set([...entries].filter(([, u]) => u).map(([value]) => value));
  });
  return out;
}
