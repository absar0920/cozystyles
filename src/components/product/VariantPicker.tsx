'use client';

import { CheckIcon } from '@/components/icons';
import type { ProductOption, VariantInfo } from './types';
import { optionAt } from './types';

export type OptionGroup = ProductOption & { index: number };

/**
 * Controlled option-button picker (Size / Fabric / Colour …).
 * Values not carried by any variant are filtered out by the parent.
 */
export function VariantPicker({
  groups,
  variants,
  selected,
  onSelect,
}: {
  groups: OptionGroup[];
  variants: VariantInfo[];
  selected: Record<number, string>;
  onSelect: (optionIndex: number, value: string) => void;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.index}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {group.name}
            <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-dark">
              {selected[group.index] ? `— ${selected[group.index]}` : ''}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {group.values.map((value) => {
              const isActive = selected[group.index] === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSelect(group.index, value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border-0 px-4 py-2 text-[13px] font-medium transition ${
                    isActive
                      ? 'bg-brand text-white shadow-card'
                      : 'bg-cream-soft text-ink-dark hover:bg-brand hover:text-white'
                  }`}
                >
                  {isActive && <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.4} />}
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Variant resolution hint when the exact combination is missing from the matrix */}
      {groups.length > 0 && variants.length > 1 && !exactMatchExists(groups, variants, selected) && (
        <p className="text-xs text-ink-muted">
          This combination is available as <span className="font-semibold text-ink-dark">{nearestVariant(groups, variants, selected).title}</span>.
          Price shown is for that variant.
        </p>
      )}
    </div>
  );
}

export function exactMatchExists(groups: OptionGroup[], variants: VariantInfo[], selected: Record<number, string>): boolean {
  return variants.some((v) => groups.every((g) => optionAt(v, g.index) === (selected[g.index] ?? '')));
}

export function nearestVariant(groups: OptionGroup[], variants: VariantInfo[], selected: Record<number, string>): VariantInfo {
  const first = groups[0];
  return (
    variants.find((v) => groups.every((g) => optionAt(v, g.index) === (selected[g.index] ?? ''))) ??
    variants.find((v) => first && optionAt(v, first.index) === (selected[first.index] ?? '')) ??
    variants[0]
  );
}
