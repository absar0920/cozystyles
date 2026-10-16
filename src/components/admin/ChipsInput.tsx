'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { useUserChangeEvent } from './ui-client';
import { CloseIcon } from './icons';

export type ChipsInputProps = {
  /** hidden input: JSON.stringify(string[]) */
  name?: string;
  value: string[];
  onChange?: (v: string[]) => void;
  ariaLabel: string;
  label?: string;
  hint?: string;
  placeholder?: string;
  /** dropdown filtered by what is typed */
  suggestions?: string[];
  /** default 50 */
  maxChips?: number;
  /** default 60 per chip */
  maxLength?: number;
  /** returns a plain-English reason when a chip can't be added (it is then kept in the box) */
  validate?: (chip: string) => string | null;
  /** chips with the same key count as duplicates (default: case-insensitive text); the owner is told which one it matches */
  sameKey?: (chip: string) => string;
};

/** Type a word and press Enter (or comma/Tab) to add it as a chip. Paste a comma or line separated list to add many. */
export function ChipsInput({
  name,
  value,
  onChange,
  ariaLabel,
  label,
  hint,
  placeholder = 'Type and press Enter',
  suggestions = [],
  maxChips = 50,
  maxLength = 60,
  validate,
  sameKey,
}: ChipsInputProps) {
  const keyOf = sameKey ?? ((c: string) => c.toLowerCase());
  const controlled = onChange !== undefined;
  const [inner, setInner] = useState<string[]>(value);
  const chips = controlled ? value : inner;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { inputRef: hiddenRef, markUserChange } = useUserChangeEvent(chips);

  const commit = (next: string[]) => {
    markUserChange();
    if (!controlled) setInner(next);
    onChange?.(next);
  };

  /** adds the chips; returns false when one was rejected by `validate` */
  const add = (raw: string[]): boolean => {
    const next = [...chips];
    let skipped = false;
    let shortened = false;
    let rejected: string | null = null;
    for (const r of raw) {
      const full = r.trim();
      const chip = full.slice(0, maxLength).trim();
      if (chip.length < full.length) shortened = true;
      if (!chip) continue;
      const problem = validate?.(chip) ?? null;
      if (problem) {
        rejected = problem;
        continue;
      }
      const twin = next.find((c) => keyOf(c) === keyOf(chip));
      if (twin !== undefined) {
        if (sameKey && twin !== chip) rejected = `"${chip}" is the same as "${twin}".`;
        continue;
      }
      if (next.length >= maxChips) {
        skipped = true;
        break;
      }
      next.push(chip);
    }
    setNote(
      [rejected ?? '', skipped ? `You can add up to ${maxChips}.` : '', shortened ? `Each one can be up to ${maxLength} characters, so a long one was shortened.` : '']
        .filter(Boolean)
        .join(' ') || null,
    );
    if (next.length !== chips.length) commit(next);
    return !rejected;
  };

  const remove = (i: number) => commit(chips.filter((_, j) => j !== i));

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    return suggestions
      .filter((s) => !chips.some((c) => keyOf(c) === keyOf(s)))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [suggestions, chips, text]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && text.trim())) {
      if (e.key === 'Enter' || e.key === ',' || text.trim()) e.preventDefault();
      if (text.trim() && add([text])) setText('');
    } else if (e.key === 'Backspace' && !text && chips.length) {
      remove(chips.length - 1);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (/[,\n]/.test(pasted)) {
      e.preventDefault();
      add(pasted.split(/[,\n]/));
    }
  };

  return (
    <div>
      {label && (
        <label htmlFor={`${listId}-input`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </label>
      )}
      <div
        className="relative flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20"
        onClick={() => inputRef.current?.focus()}
      >
        {chips.map((chip, i) => (
          <span key={chip} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-3 pr-1 text-sm text-brand-900">
            <span className="truncate">{chip}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(i);
              }}
              aria-label={`Remove ${chip}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-brand-700 hover:bg-brand-100"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          id={`${listId}-input`}
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
            if (text.trim() && add([text])) setText('');
          }}
          aria-label={ariaLabel}
          aria-autocomplete={suggestions.length ? 'list' : undefined}
          aria-controls={suggestions.length ? `${listId}-list` : undefined}
          placeholder={chips.length ? '' : placeholder}
          maxLength={maxLength}
          className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none focus:ring-0"
        />
        {open && filtered.length > 0 && (
          <ul
            id={`${listId}-list`}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {filtered.map((s) => (
              <li key={s} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    add([s]);
                    setText('');
                    inputRef.current?.focus();
                  }}
                  className="block min-h-10 w-full px-3 text-left text-sm hover:bg-gray-50"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {note && (
        <p role="status" className="mt-1 text-xs text-amber-700">
          {note}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {name && <input ref={hiddenRef} type="hidden" name={name} value={JSON.stringify(chips)} />}
    </div>
  );
}
