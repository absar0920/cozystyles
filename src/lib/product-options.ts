/** Product options / variants helpers (client-safe). */
export const MAX_OPTIONS = 3,
  MAX_VARIANTS = 100,
  MAX_VALUE_LENGTH = 60,
  MAX_OPTION_NAME_LENGTH = 40;

export const OPTION_NAME_SUGGESTIONS = ['Size', 'Color', 'Finish', 'Material', 'Orientation', 'Seats'];

/** Options whose values get a colour swatch (admin + PDP). */
export function isSwatchOptionName(name: string): boolean {
  return /colou?r|finish/i.test(name);
}

/** Options whose values show as swatches on product cards (live parity: exact names only). */
export function isCardSwatchOptionName(name: string): boolean {
  return /^(colou?rs?|finish(es)?)$/i.test(name.trim());
}

export function variantTitle(values: string[]): string {
  return values.filter(Boolean).join(' / ') || 'Default Title';
}

/** "#ABC" / "abc" / "#aabbcc" → "#aabbcc"; anything else → null. */
export function normalizeHex(input: string): string | null {
  const m = input.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return `#${hex}`;
}

export const NEUTRAL_SWATCH = '#cccccc';
