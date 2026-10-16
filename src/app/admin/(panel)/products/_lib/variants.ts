/**
 * Options → variants generator (SPEC §5.1.5). Pure functions over `{ options, variants }`:
 * a variant's identity is its `valueKeys` tuple (one value key per option, in option order),
 * so renames never touch variants and ids survive every edit that keeps the tuple.
 */
import { MAX_OPTIONS, MAX_OPTION_NAME_LENGTH, MAX_VALUE_LENGTH, MAX_VARIANTS } from '@/lib/product-options';
import type { VariantStatus } from '@/lib/variant-status';
import type { OptionState, OptionValueState, VariantState } from './types';

export type Structure = { options: OptionState[]; variants: VariantState[] };
export type GenResult = ({ ok: true } & Structure) | { ok: false; error: string };

const SEP = '\u0001';
const tupleId = (keys: string[]) => keys.join(SEP);

/** R1: cartesian product of the value keys, in option order and value order. */
export function combos(options: OptionState[]): string[][] {
  return options.reduce<string[][]>((acc, o) => acc.flatMap((t) => o.values.map((v) => [...t, v.key])), [[]]);
}

export function countCombos(options: { values: unknown[] }[]): number {
  return options.reduce((n, o) => n * o.values.length, 1);
}

export function valueText(options: OptionState[], key: string): string {
  for (const o of options) for (const v of o.values) if (v.key === key) return v.value;
  return '';
}

/** "Grey / 3 Seater" (values in option order); "Default" when there are no options. */
export function comboLabel(options: OptionState[], valueKeys: string[]): string {
  return valueKeys.map((k) => valueText(options, k)).filter(Boolean).join(' / ') || 'Default';
}

export function blankVariant(key: string, valueKeys: string[] = []): VariantState {
  return { key, id: null, valueKeys, regularPrice: '', salePrice: '', status: 'READY_TO_SHIP', sku: '', weightGrams: '', stock: '' };
}

function fromTemplate(key: string, valueKeys: string[], t: VariantState | undefined): VariantState {
  return {
    ...blankVariant(key, valueKeys),
    ...(t ? { regularPrice: t.regularPrice, salePrice: t.salePrice, status: t.status, weightGrams: t.weightGrams } : {}),
  };
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** R9 + length checks for a value being added or renamed. */
export function valueError(option: OptionState, text: string, exceptKey?: string): string | null {
  const v = text.trim();
  if (!v) return 'Type a value first.';
  if (v.length > MAX_VALUE_LENGTH) return `Keep values under ${MAX_VALUE_LENGTH} characters.`;
  if (option.values.some((x) => x.key !== exceptKey && sameName(x.value, v))) return `“${v}” is already in this option.`;
  return null;
}

export function optionNameError(options: OptionState[], name: string, exceptKey?: string): string | null {
  const n = name.trim();
  if (n.length > MAX_OPTION_NAME_LENGTH) return `Keep option names under ${MAX_OPTION_NAME_LENGTH} characters.`;
  if (n && options.some((o) => o.key !== exceptKey && sameName(o.name, n))) return `There is already an option called “${n}”.`;
  return null;
}

const limitError = (n: number) => `That would make ${n} combinations — the limit is ${MAX_VARIANTS}. Remove some values first.`;

/** R2: add value `value` to option `optionKey`; new combinations copy prices/status/weight from a template. */
export function addValue(s: Structure, optionKey: string, value: OptionValueState, newKey: () => string): GenResult {
  const i = s.options.findIndex((o) => o.key === optionKey);
  if (i < 0) return { ok: false, error: 'That option no longer exists.' };
  const err = valueError(s.options[i], value.value);
  if (err) return { ok: false, error: err };
  const options = s.options.map((o, j) => (j === i ? { ...o, values: [...o.values, { ...value, value: value.value.trim() }] } : o));
  const n = countCombos(options);
  if (n > MAX_VARIANTS) return { ok: false, error: limitError(n) };
  const first = s.options[i].values[0]?.key;
  const have = new Set(s.variants.map((v) => tupleId(v.valueKeys)));
  const added = combos(options)
    .filter((c) => c[i] === value.key && !have.has(tupleId(c)))
    .map((c) => {
      const t =
        s.variants.find((v) => v.valueKeys[i] === first && v.valueKeys.every((k, j) => j === i || k === c[j])) ?? s.variants[0];
      return fromTemplate(newKey(), c, t);
    });
  return { ok: true, options, variants: [...s.variants, ...added] };
}

/** R3: add an option with its first value; every existing variant takes that value and keeps its id. */
export function addOption(s: Structure, option: OptionState, newKey: () => string): GenResult {
  if (s.options.length >= MAX_OPTIONS) return { ok: false, error: `A product can have up to ${MAX_OPTIONS} options.` };
  const nameErr = optionNameError(s.options, option.name);
  if (nameErr) return { ok: false, error: nameErr };
  const [v0, ...rest] = option.values;
  if (!v0) return { ok: false, error: 'Add a value first.' };
  const v0Err = valueError({ ...option, values: [] }, v0.value);
  if (v0Err) return { ok: false, error: v0Err };
  const opt: OptionState = { ...option, name: option.name.trim(), values: [{ ...v0, value: v0.value.trim() }] };
  // with no options there is exactly one variant; keep the first if the data had more
  const base = s.options.length === 0 ? s.variants.slice(0, 1) : s.variants;
  let next: GenResult = {
    ok: true,
    options: [...s.options, opt],
    variants: (base.length ? base : [blankVariant(newKey())]).map((v) => ({ ...v, valueKeys: [...v.valueKeys, v0.key] })),
  };
  for (const v of rest) {
    if (!next.ok) break;
    next = addValue(next, opt.key, v, newKey);
  }
  return next;
}

/** R5: remove option `optionKey`; per reduced tuple the first variant (current order) survives. */
export function removeOption(s: Structure, optionKey: string): Structure {
  const i = s.options.findIndex((o) => o.key === optionKey);
  if (i < 0) return s;
  const seen = new Set<string>();
  const variants: VariantState[] = [];
  for (const v of s.variants) {
    const reduced = v.valueKeys.filter((_, j) => j !== i);
    const id = tupleId(reduced);
    if (seen.has(id)) continue;
    seen.add(id);
    variants.push({ ...v, valueKeys: reduced });
  }
  const options = s.options.filter((_, j) => j !== i);
  return { options, variants: options.length === 0 ? variants.slice(0, 1) : variants };
}

/** How many combinations removing an option deletes. */
export function removeOptionImpact(s: Structure, optionKey: string): number {
  return s.variants.length - removeOption(s, optionKey).variants.length;
}

/** R4: remove a value and every combination containing it (the last value of an option = R5). */
export function removeValue(s: Structure, optionKey: string, valueKey: string): Structure {
  const i = s.options.findIndex((o) => o.key === optionKey);
  if (i < 0) return s;
  if (s.options[i].values.length <= 1) return removeOption(s, optionKey);
  return {
    options: s.options.map((o, j) => (j === i ? { ...o, values: o.values.filter((v) => v.key !== valueKey) } : o)),
    variants: s.variants.filter((v) => v.valueKeys[i] !== valueKey),
  };
}

/** Labels of the combinations that removing a value would delete. */
export function combosRemovedBy(s: Structure, optionKey: string, valueKey: string): string[] {
  const i = s.options.findIndex((o) => o.key === optionKey);
  if (i < 0) return [];
  if (s.options[i].values.length <= 1) {
    const kept = new Set(removeOption(s, optionKey).variants.map((v) => v.key));
    return s.variants.filter((v) => !kept.has(v.key)).map((v) => comboLabel(s.options, v.valueKeys));
  }
  return s.variants.filter((v) => v.valueKeys[i] === valueKey).map((v) => comboLabel(s.options, v.valueKeys));
}

/** R6: rename a value (text only; keys, variants and photo tags follow). */
export function renameValue(s: Structure, optionKey: string, valueKey: string, text: string): GenResult {
  const o = s.options.find((x) => x.key === optionKey);
  if (!o) return { ok: false, error: 'That option no longer exists.' };
  const err = valueError(o, text, valueKey);
  if (err) return { ok: false, error: err };
  return {
    ok: true,
    variants: s.variants,
    options: s.options.map((x) =>
      x.key === optionKey ? { ...x, values: x.values.map((v) => (v.key === valueKey ? { ...v, value: text.trim() } : v)) } : x,
    ),
  };
}

export function patchValue(s: Structure, optionKey: string, valueKey: string, patch: Partial<OptionValueState>): Structure {
  return {
    variants: s.variants,
    options: s.options.map((x) => (x.key === optionKey ? { ...x, values: x.values.map((v) => (v.key === valueKey ? { ...v, ...patch } : v)) } : x)),
  };
}

/** R7: reorder an option's values (the variant list order is unchanged). */
export function reorderValues(s: Structure, optionKey: string, values: OptionValueState[]): Structure {
  return { variants: s.variants, options: s.options.map((o) => (o.key === optionKey ? { ...o, values } : o)) };
}

/** R7: move an option; every valueKeys tuple is permuted the same way. */
export function moveOption(s: Structure, from: number, to: number): Structure {
  if (from === to || to < 0 || to >= s.options.length || from < 0 || from >= s.options.length) return s;
  const order = s.options.map((_, j) => j);
  const [m] = order.splice(from, 1);
  order.splice(to, 0, m);
  return {
    options: order.map((j) => s.options[j]),
    variants: s.variants.map((v) => ({ ...v, valueKeys: order.map((j) => v.valueKeys[j]) })),
  };
}

/** "Sort by option order": variants in cartesian order. */
export function sortByOptionOrder(s: Structure): Structure {
  const pos = new Map(combos(s.options).map((c, n) => [tupleId(c), n]));
  const at = (v: VariantState) => pos.get(tupleId(v.valueKeys)) ?? Number.MAX_SAFE_INTEGER;
  return { options: s.options, variants: [...s.variants].sort((a, b) => at(a) - at(b)) };
}

/** Makes loaded data consistent: every combination exists exactly once (missing ones copy the first variant). */
export function fillMissingCombos(s: Structure, newKey: () => string): Structure {
  if (s.options.length === 0) return { options: s.options, variants: s.variants.length ? s.variants.slice(0, 1) : [blankVariant(newKey())] };
  const have = new Set(s.variants.map((v) => tupleId(v.valueKeys)));
  const missing = combos(s.options).filter((c) => !have.has(tupleId(c)));
  if (!missing.length || countCombos(s.options) > MAX_VARIANTS) return s;
  return { options: s.options, variants: [...s.variants, ...missing.map((c) => fromTemplate(newKey(), c, s.variants[0]))] };
}

/* ------------------------------------------------------------------------------------------------ bulk edit */

export type BulkTarget = { kind: 'all' } | { kind: 'selected' } | { kind: 'value'; valueKey: string };
export type BulkFields = { regularPrice?: string; salePrice?: string; clearSale?: boolean; status?: VariantStatus | '' };

export function bulkMatches(v: VariantState, target: BulkTarget, selected: ReadonlySet<string>): boolean {
  if (target.kind === 'all') return true;
  if (target.kind === 'selected') return selected.has(v.key);
  return v.valueKeys.includes(target.valueKey);
}

/** Applies only the fields that were filled. */
export function applyBulk(variants: VariantState[], target: BulkTarget, selected: ReadonlySet<string>, f: BulkFields): VariantState[] {
  const regular = f.regularPrice?.trim();
  const sale = f.salePrice?.trim();
  return variants.map((v) => {
    if (!bulkMatches(v, target, selected)) return v;
    return {
      ...v,
      ...(regular ? { regularPrice: regular } : {}),
      ...(f.clearSale ? { salePrice: '' } : sale ? { salePrice: sale } : {}),
      ...(f.status ? { status: f.status } : {}),
    };
  });
}

/* ------------------------------------------------------------------------------------------------ money */

/**
 * "45,000" → 45000; "Rs. 45,000.00" → 45000; '' → null; anything else (e.g. "45,000.50") → NaN.
 * Whole rupees only: a ".0" / ".00" ending is accepted, any other decimal is an error — never silently dropped.
 */
export function parseMoney(text: string): number | null {
  const t = text.replace(/[,\s]/g, '').replace(/^rs\.?/i, '');
  if (!t) return null;
  const m = /^(\d+)(?:\.0{1,2})?$/.exec(t);
  return m ? Number(m[1]) : Number.NaN;
}

/** Inline message for a price box, or null when the text is empty or a valid whole-rupee amount. */
export function priceTextError(text: string): string | null {
  return Number.isNaN(parseMoney(text)) ? 'Whole rupees only, e.g. 45000' : null;
}

/** Stored price/compareAt → the admin's Regular/Sale (SPEC §2.2). */
export function toRegularSale(price: number, compareAtPrice: number | null): { regularPrice: string; salePrice: string } {
  if (compareAtPrice != null && compareAtPrice > price) return { regularPrice: String(compareAtPrice), salePrice: String(price) };
  return { regularPrice: String(price), salePrice: '' };
}
