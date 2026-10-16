'use client';

import { useId, useLayoutEffect, useState } from 'react';
import { ToggleSwitch } from '@/components/admin/ui';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { ArrowDownIcon, ArrowUpIcon } from '@/components/admin/icons';
import { newKey } from '@/components/admin/ImageGallery';
import { paletteColorFor } from '@/components/admin/ColorSwatchPicker';
import { MAX_OPTIONS, MAX_OPTION_NAME_LENGTH, OPTION_NAME_SUGGESTIONS, isSwatchOptionName } from '@/lib/product-options';
import type { OptionState } from '../_lib/types';
import {
  addOption,
  addValue,
  comboLabel,
  combosRemovedBy,
  moveOption,
  optionNameError,
  patchValue,
  removeOption,
  removeOptionImpact,
  removeValue,
  renameValue,
  reorderValues,
  type GenResult,
  type Structure,
} from '../_lib/variants';
import { OptionValuesEditor } from './OptionValuesEditor';
import { useReportPending } from './pending';

type Confirm = { title: string; consequences: string[]; confirmLabel: string; run: () => void };

/**
 * "Options & prices" top half: the options toggle and up to 3 option cards (name + value chips).
 * Every change goes through `update`, which applies a generator function to the current structure and
 * returns its error (if any).
 */
export function OptionsEditor({
  structure,
  update,
  taggedValueKeys,
  onApplyTo,
  fieldError,
}: {
  structure: Structure;
  update: (fn: (s: Structure) => GenResult | Structure) => string | null;
  /** value keys that some photo "Shows" */
  taggedValueKeys: ReadonlySet<string>;
  onApplyTo: (valueKey: string) => void;
  fieldError: (field: string) => string | null;
}) {
  const { options } = structure;
  const [draft, setDraft] = useState<{ name: string; error: string | null } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [nameErrors, setNameErrors] = useState<Record<string, string | null>>({});
  /** the option just created from the draft card: its value input gets focus and any leftover text */
  const [carry, setCarry] = useState<{ optionKey: string; text: string; error: string | null } | null>(null);
  /** after a value is added to a product that already had combinations: which new ones copied whose prices */
  const [copyNote, setCopyNote] = useState<{ optionKey: string; text: string } | null>(null);
  const listId = useId();
  const hasOptions = options.length > 0 || draft !== null;
  const reportPending = useReportPending();

  // a new option card that is open but has no values yet is unfinished: saving would drop it silently
  const draftName = draft?.name.trim() ?? null;
  useLayoutEffect(() => {
    reportPending(
      'option-draft',
      draftName !== null
        ? {
            message: draftName
              ? `Finish the new option “${draftName}”: type its values and press Enter, or click Cancel.`
              : 'Finish the new option: name it, type its values and press Enter, or click Cancel.',
            field: 'pending.draft',
          }
        : null,
    );
    return () => reportPending('option-draft', null);
  }, [draftName, reportPending]);

  const toggle = (on: boolean) => {
    if (on) {
      setDraft({ name: options.length ? '' : 'Size', error: null });
      return;
    }
    if (!options.length) {
      setDraft(null);
      return;
    }
    const tagged = taggedValueKeys.size > 0;
    setConfirm({
      title: 'Remove all options?',
      consequences: [
        `Keeps one price (from ${comboLabel(options, structure.variants[0]?.valueKeys ?? [])})`,
        `Removes ${structure.variants.length - 1} combination${structure.variants.length - 1 === 1 ? '' : 's'}`,
        ...(tagged ? ['Photo “Shows” tags are cleared'] : []),
      ],
      confirmLabel: 'Remove all options',
      run: () => {
        update((cur) => {
          let next = cur;
          while (next.options.length) next = removeOption(next, next.options[next.options.length - 1].key);
          return next;
        });
        setDraft(null);
      },
    });
  };

  const askRemoveValue = (o: OptionState, valueKey: string) => {
    const v = o.values.find((x) => x.key === valueKey);
    if (!v) return;
    const removed = combosRemovedBy(structure, o.key, valueKey);
    const last = o.values.length === 1;
    setConfirm({
      title: last ? `Remove “${v.value}” and the option “${o.name || 'Option'}”?` : `Remove “${v.value}”?`,
      consequences: [
        ...(removed.length
          ? [`This also removes ${removed.length} combination${removed.length === 1 ? '' : 's'}: ${removed.join(', ')}.`]
          : []),
        ...(taggedValueKeys.has(valueKey) ? [`Photos that show “${v.value}” go back to “Any option”.`] : []),
      ],
      confirmLabel: 'Remove',
      run: () => update((cur) => removeValue(cur, o.key, valueKey)),
    });
  };

  const askRemoveOption = (o: OptionState) => {
    const n = removeOptionImpact(structure, o.key);
    const tagged = o.values.some((v) => taggedValueKeys.has(v.key));
    setConfirm({
      title: `Remove the option “${o.name || 'Option'}”?`,
      consequences: [
        n ? `Removes ${n} combination${n === 1 ? '' : 's'} (the first one of each kind keeps its price)` : 'Its values are removed from every combination',
        ...(tagged ? ['Photo “Shows” tags for its values are cleared'] : []),
      ],
      confirmLabel: 'Remove option',
      run: () => update((cur) => removeOption(cur, o.key)),
    });
  };

  /**
   * The draft card's first Enter creates the option with every value typed so far in one step (the draft
   * card is then replaced by a real card, so values can't be added one call at a time). Values that don't
   * fit (duplicates, too many combinations) and their error are carried over to the new card's input.
   */
  const addDraftValues = (parts: string[]): { rest: string[]; error: string | null } => {
    if (!draft) return { rest: parts, error: null };
    const name = draft.name.trim();
    if (!name) return { rest: parts, error: 'Name the option first (for example Size or Color).' };
    const optionKey = newKey();
    const swatch = isSwatchOptionName(name);
    const val = (value: string) => ({ key: newKey(), id: null, value, swatchColor: swatch ? paletteColorFor(value) : null, swatchImage: null });
    let rest: string[] = [];
    let restError: string | null = null;
    const err = update((cur) => {
      const first = addOption(cur, { key: optionKey, id: null, name, values: [val(parts[0])] }, newKey);
      if (!first.ok) return first;
      let next: Structure = first;
      for (let i = 1; i < parts.length; i++) {
        const r = addValue(next, optionKey, val(parts[i]), newKey);
        if (!r.ok) {
          rest = parts.slice(i);
          restError = r.error;
          break;
        }
        next = r;
      }
      return next;
    });
    if (err) return { rest: parts, error: err };
    setCarry({ optionKey, text: rest.join(', '), error: restError });
    setDraft(null);
    return { rest: [], error: null };
  };

  /**
   * Adds one value to a saved option. A colour named like a palette colour gets that swatch. When the product
   * already had combinations, the new ones copy the prices and status of the first value's combinations, which
   * the owner is told about (they are live as soon as the product is saved).
   */
  const addOneValue = (o: OptionState, text: string): string | null => {
    const key = newKey();
    let added = 0;
    let fromValue = '';
    const err = update((cur) => {
      const r = addValue(
        cur,
        o.key,
        { key, id: null, value: text, swatchColor: isSwatchOptionName(o.name) ? paletteColorFor(text) : null, swatchImage: null },
        newKey,
      );
      if (r.ok && cur.variants.length > 0) {
        added = r.variants.length - cur.variants.length;
        fromValue = cur.options.find((x) => x.key === o.key)?.values[0]?.value ?? '';
      }
      return r;
    });
    if (!err && added > 0 && fromValue) {
      const n = `${added} new combination${added === 1 ? '' : 's'}`;
      setCopyNote({
        optionKey: o.key,
        text: `${n} for “${text.trim()}” copied the prices and status of “${fromValue}”. Check them in the table below before saving.`,
      });
    }
    return err;
  };

  return (
    <div className="space-y-4">
      <ToggleSwitch
        label="This product has options like size or colour"
        hint="Each combination (for example Grey / 3 Seater) gets its own price and status."
        checked={hasOptions}
        onChange={toggle}
      />

      <datalist id={listId}>
        {OPTION_NAME_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {options.map((o, i) => {
        const nameField = `options.${o.key}.name`;
        const serverValueError = o.values
          .map((v) => ({ valueKey: v.key, message: fieldError(`options.${o.key}.values.${v.key}`) }))
          .find((x) => x.message);
        const nameError = nameErrors[o.key] ?? fieldError(nameField);
        return (
          <div key={o.key} data-testid="option-card" className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Option name</span>
                <input
                  data-field={nameField}
                  value={o.name}
                  list={listId}
                  maxLength={MAX_OPTION_NAME_LENGTH}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNameErrors((m) => ({ ...m, [o.key]: optionNameError(options, name, o.key) }));
                    update((cur) => ({ ...cur, options: cur.options.map((x) => (x.key === o.key ? { ...x, name } : x)) }));
                  }}
                  placeholder="e.g. Size"
                  className={`min-h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 ${
                    nameError ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
              </label>
              {options.length > 1 && (
                <span className="inline-flex shrink-0">
                  <button
                    type="button"
                    aria-label={`Move ${o.name || 'option'} up`}
                    disabled={i === 0}
                    onClick={() => update((cur) => moveOption(cur, i, i - 1))}
                    className="inline-flex h-11 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ArrowUpIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${o.name || 'option'} down`}
                    disabled={i === options.length - 1}
                    onClick={() => update((cur) => moveOption(cur, i, i + 1))}
                    className="inline-flex h-11 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ArrowDownIcon className="h-4 w-4" />
                  </button>
                </span>
              )}
            </div>
            {nameError && (
              <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                {nameError}
              </p>
            )}
            <div className="mt-3">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Values{isSwatchOptionName(o.name) ? ' (tap the circle to pick a colour or photo)' : ''}
              </span>
              <OptionValuesEditor
                option={o}
                swatches={isSwatchOptionName(o.name)}
                onAdd={(t) => addOneValue(o, t)}
                onRename={(k, t) => update((cur) => renameValue(cur, o.key, k, t))}
                onRemove={(k) => askRemoveValue(o, k)}
                onReorder={(values) => update((cur) => reorderValues(cur, o.key, values))}
                onSwatch={(k, sw) => update((cur) => patchValue(cur, o.key, k, { swatchColor: sw.color, swatchImage: sw.image }))}
                onApplyTo={onApplyTo}
                error={serverValueError ? { valueKey: serverValueError.valueKey, message: serverValueError.message! } : null}
                autoFocusInput={carry?.optionKey === o.key}
                initialText={carry?.optionKey === o.key ? carry.text : ''}
                initialError={carry?.optionKey === o.key ? carry.error : null}
              />
              {copyNote?.optionKey === o.key && (
                <p data-testid="combos-copied-note" className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  <span className="min-w-0 flex-1">{copyNote.text}</span>
                  <button type="button" onClick={() => setCopyNote(null)} className="-my-1 min-h-8 shrink-0 rounded px-2 font-semibold hover:bg-amber-100">
                    OK
                  </button>
                </p>
              )}
            </div>
            <button type="button" onClick={() => askRemoveOption(o)} className="mt-2 min-h-10 text-sm font-semibold text-red-600 hover:underline">
              Remove option
            </button>
          </div>
        );
      })}

      {draft && (
        <div data-testid="option-card" className="rounded-xl border border-dashed border-brand-300 bg-white p-3 sm:p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Option name</span>
            <input
              autoFocus
              value={draft.name}
              list={listId}
              maxLength={MAX_OPTION_NAME_LENGTH}
              onChange={(e) => setDraft({ name: e.target.value, error: optionNameError(options, e.target.value) })}
              placeholder="e.g. Size, Color, Finish"
              className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          {draft.error && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-600">
              {draft.error}
            </p>
          )}
          <div className="mt-3">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Values</span>
            <OptionValuesEditor
              option={{ key: 'draft', id: null, name: draft.name, values: [] }}
              swatches={false}
              onAdd={() => null}
              onAddMany={addDraftValues}
              onRename={() => null}
              onRemove={() => undefined}
              onReorder={() => undefined}
              onSwatch={() => undefined}
              onApplyTo={() => undefined}
            />
          </div>
          <button type="button" onClick={() => setDraft(null)} className="mt-2 min-h-10 text-sm font-semibold text-gray-500 hover:underline">
            Cancel
          </button>
        </div>
      )}

      {hasOptions && !draft && options.length < MAX_OPTIONS && (
        <button
          type="button"
          onClick={() => setDraft({ name: '', error: null })}
          className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          + Add another option
        </button>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        consequences={confirm?.consequences ?? []}
        confirmLabel={confirm?.confirmLabel ?? 'Remove'}
        tone="danger"
        note="Removed when you save."
        onConfirm={() => {
          confirm?.run();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
