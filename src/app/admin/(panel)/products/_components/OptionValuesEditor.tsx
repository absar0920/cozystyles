'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { SortableList } from '@/components/admin/SortableList';
import { ColorSwatchPicker, type SwatchValue } from '@/components/admin/ColorSwatchPicker';
import { Popover } from '@/components/admin/Popover';
import { CloseIcon } from '@/components/admin/icons';
import { MAX_VALUE_LENGTH } from '@/lib/product-options';
import type { OptionState, OptionValueState } from '../_lib/types';
import { useReportPending } from './pending';

/**
 * The value chips of one option: type + Enter (or comma) adds a value, click a chip to rename it,
 * × removes it (the parent confirms), drag or the ⋯ menu reorders, swatch options get a colour picker.
 */
export function OptionValuesEditor({
  option,
  swatches,
  onAdd,
  onRename,
  onRemove,
  onReorder,
  onSwatch,
  onApplyTo,
  error,
  onAddMany,
  initialText = '',
  initialError = null,
  autoFocusInput = false,
}: {
  option: OptionState;
  swatches: boolean;
  /** returns an error message, or null when added */
  onAdd: (text: string) => string | null;
  onRename: (valueKey: string, text: string) => string | null;
  onRemove: (valueKey: string) => void;
  onReorder: (values: OptionValueState[]) => void;
  onSwatch: (valueKey: string, v: SwatchValue) => void;
  onApplyTo: (valueKey: string) => void;
  /** server error for one of the values */
  error?: { valueKey: string; message: string } | null;
  /** adds several values in one go; returns the values that could not be added and why */
  onAddMany?: (parts: string[]) => { rest: string[]; error: string | null };
  /** text and error carried over from the card this one replaced (a new option's first values) */
  initialText?: string;
  initialError?: string | null;
  autoFocusInput?: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [addError, setAddError] = useState<string | null>(initialError);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const menuAnchor = useRef<HTMLButtonElement | null>(null);
  const label = option.name.trim() || 'this option';
  const pendingId = useId();
  const reportPending = useReportPending();
  const pendingField = `pending.${option.key}`;

  // typed-but-not-added text counts as an unsaved change and blocks saving until it is added or cleared
  useLayoutEffect(() => {
    const t = text.trim();
    reportPending(pendingId, t ? { message: `Press Enter to add “${t}” to ${label}, or clear that box.`, field: pendingField } : null);
    return () => reportPending(pendingId, null);
  }, [text, label, pendingField, pendingId, reportPending]);

  const add = () => {
    const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return;
    let rest: string[] = [];
    if (onAddMany) {
      const r = onAddMany(parts);
      setAddError(r.error);
      setText(r.rest.join(', '));
      return;
    }
    for (let i = 0; i < parts.length; i++) {
      const err = onAdd(parts[i]);
      if (err) {
        setAddError(err);
        rest = parts.slice(i);
        break;
      }
    }
    if (!rest.length) setAddError(null);
    setText(rest.join(', '));
  };

  const startRename = (v: OptionValueState) => {
    setEditing(v.key);
    setEditText(v.value);
    setEditError(null);
  };
  const commitRename = () => {
    if (!editing) return;
    const current = option.values.find((v) => v.key === editing);
    if (current && editText.trim() === current.value) {
      setEditing(null);
      return;
    }
    const err = onRename(editing, editText);
    if (err) setEditError(err);
    else setEditing(null);
  };

  const move = (key: string, delta: number) => {
    const i = option.values.findIndex((v) => v.key === key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= option.values.length) return;
    const next = [...option.values];
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next);
  };

  const menuValue = option.values.find((v) => v.key === menu);
  const noSwatch = swatches ? option.values.filter((v) => !v.swatchColor && !v.swatchImage) : [];

  return (
    <div>
      {option.values.length > 0 && (
        <SortableList
          items={option.values}
          getKey={(v) => v.key}
          onReorder={onReorder}
          ariaLabel={`Values of ${label}`}
          layout="horizontal"
          renderItem={(v, ctl) => {
            const bad = error?.valueKey === v.key;
            return (
              <div
                data-testid="option-value"
                data-field={`options.${option.key}.values.${v.key}`}
                className={`inline-flex min-h-11 max-w-full items-center rounded-full border bg-white pr-1 ${bad ? 'border-red-400' : 'border-gray-300'} ${
                  ctl.dragging ? 'shadow-lg' : ''
                }`}
              >
                <span className="-mr-1 [&>button]:h-10 [&>button]:w-8">{ctl.handle}</span>
                {swatches && (
                  <ColorSwatchPicker
                    value={{ color: v.swatchColor, image: v.swatchImage }}
                    onChange={(sw) => onSwatch(v.key, sw)}
                    valueLabel={v.value}
                  />
                )}
                {editing === v.key ? (
                  <input
                    autoFocus
                    value={editText}
                    maxLength={MAX_VALUE_LENGTH}
                    aria-label={`Rename ${v.value}`}
                    onChange={(e) => {
                      setEditText(e.target.value);
                      setEditError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitRename();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditing(null);
                      }
                    }}
                    onBlur={commitRename}
                    className="mx-1 w-32 rounded-md border border-brand px-2 py-1 text-sm outline-none ring-2 ring-brand/20"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startRename(v)}
                    title="Click to rename"
                    className="min-h-10 max-w-[12rem] truncate px-2 text-sm font-medium text-ink-dark hover:underline"
                  >
                    {v.value}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`More for ${v.value}`}
                  aria-haspopup="dialog"
                  onClick={(e) => {
                    menuAnchor.current = e.currentTarget;
                    setMenu(menu === v.key ? null : v.key);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none text-gray-500 hover:bg-gray-100"
                >
                  ⋯
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${v.value}`}
                  onClick={() => onRemove(v.key)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-600"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            );
          }}
        />
      )}
      {noSwatch.length > 0 && (
        <p data-testid="missing-swatch-note" className="mt-1 text-xs font-medium text-amber-700">
          No colour picked for {noSwatch.map((v) => `“${v.value}”`).join(', ')}: the store shows a plain grey circle. Tap the dashed
          circle to pick a colour or photo.
        </p>
      )}
      {editing && editError && (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600">
          {editError}
        </p>
      )}
      {error && !editing && (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error.message}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <input
          autoFocus={autoFocusInput}
          data-field={pendingField}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAddError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={() => {
            // leaving the box (e.g. straight to Save) adds what was typed; a new option's card waits for Enter
            // because its Cancel button would otherwise create the option
            if (!onAddMany && text.trim()) add();
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text');
            if (/[,\n]/.test(pasted)) {
              e.preventDefault();
              setText((t) => [t, ...pasted.split(/[,\n]/)].map((x) => x.trim()).filter(Boolean).join(', '));
            }
          }}
          aria-label={`Add a value to ${label}`}
          placeholder={option.values.length ? 'Add another value' : 'Type a value, e.g. 3 Seater'}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Add
        </button>
      </div>
      {addError ? (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600">
          {addError}
        </p>
      ) : (
        <p className="mt-1 text-xs text-gray-400">Press Enter or comma after each value. Click a value to rename it.</p>
      )}

      <Popover open={!!menuValue} anchorRef={menuAnchor} onClose={() => setMenu(null)} title={menuValue ? `“${menuValue.value}”` : ''} width={260}>
        {menuValue && (
          <div className="flex flex-col">
            {[
              { label: 'Rename', run: () => startRename(menuValue) },
              { label: `Apply prices to all “${menuValue.value}”`, run: () => onApplyTo(menuValue.key) },
              { label: 'Move left', run: () => move(menuValue.key, -1), disabled: option.values[0]?.key === menuValue.key },
              { label: 'Move right', run: () => move(menuValue.key, 1), disabled: option.values[option.values.length - 1]?.key === menuValue.key },
              { label: 'Remove', run: () => onRemove(menuValue.key), danger: true },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setMenu(null);
                  item.run();
                }}
                className={`min-h-11 rounded-lg px-3 text-left text-sm font-medium hover:bg-gray-50 disabled:opacity-40 ${item.danger ? 'text-red-600' : 'text-ink-dark'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </Popover>
    </div>
  );
}
