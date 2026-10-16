/**
 * Product page layouts live in the database (`ProductLayout` + `ProductLayoutSection`, docs/product-layouts/SPEC.md).
 * This module keeps only pure helpers for keys and names (no `server-only`: scripts and tests import it).
 */
import { slugify } from './slug';

/** The layout used whenever a product's key matches no layout. */
export const DEFAULT_LAYOUT_KEY = 'default';

/** Layouts that can never be deleted. */
export const PROTECTED_LAYOUT_KEYS: readonly string[] = [DEFAULT_LAYOUT_KEY];

export const MAX_LAYOUT_NAME = 60;
export const MAX_LAYOUT_KEY = 60;

/** The DB-enforced case-insensitive name key (`ProductLayout.nameKey`). */
export function layoutNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * A new, unused key slugged from `name` ("Sofas copy" → "sofas-copy", then "sofas-copy-2", "-3" …). An empty slug
 * (Urdu name, emoji) becomes "layout". The base is cut to 56 characters so keys stay ≤ 60.
 */
export function layoutKeyFromName(name: string, taken: Set<string>): string {
  const base = slugify(name, 56).replace(/-+$/g, '') || 'layout';
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const key = `${base}-${n}`;
    if (!taken.has(key)) return key;
  }
}

/**
 * "Copy of <base>", then "Copy of <base> 2", "3" … — the first one whose name key is not taken. The base is cut (ending
 * with "…") so the whole name fits in 60 characters.
 */
export function copyName(base: string, takenNameKeys: Set<string>): string {
  const trimmed = base.trim();
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '' : ` ${n}`;
    const room = MAX_LAYOUT_NAME - 'Copy of '.length - suffix.length;
    const cut = trimmed.length > room ? `${trimmed.slice(0, room - 1).trimEnd()}…` : trimmed;
    const name = `Copy of ${cut}${suffix}`;
    if (!takenNameKeys.has(layoutNameKey(name))) return name;
  }
}
