'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

/**
 * Client children of the admin primitives in ui.tsx (kept separate so ui.tsx stays usable from server
 * components). Import them through ui.tsx.
 */

/** "42 / 160" under the preceding input/textarea; amber past the limit. */
export function CharCount({ max }: { max: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const field = ref.current?.parentElement?.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
    if (!field) return;
    const update = () => setCount(field.value.length);
    update();
    field.addEventListener('input', update);
    return () => field.removeEventListener('input', update);
  }, []);
  const over = count != null && count > max;
  return (
    <span
      ref={ref}
      data-testid="char-count"
      aria-live="polite"
      className={`mt-1 block text-right text-xs tabular-nums ${over ? 'font-semibold text-amber-600' : 'text-gray-400'}`}
    >
      {count ?? 0} / {max}
      {over && <span className="sr-only"> (longer than recommended)</span>}
    </span>
  );
}

/** Dispatches a bubbling `input` event on a hidden input after a user-initiated value change (SPEC §4.4). */
export function useUserChangeEvent<T>(value: T) {
  const inputRef = useRef<HTMLInputElement>(null);
  const userChanged = useRef(false);
  useEffect(() => {
    if (!userChanged.current) return;
    userChanged.current = false;
    inputRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [value]);
  return { inputRef, markUserChange: () => (userChanged.current = true) };
}

type ToggleProps = {
  name?: string;
  label: string;
  hint?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  formAction?: (fd: FormData) => void | Promise<void>;
  fields?: Record<string, string>;
};

function SwitchVisual({ on, pending }: { on: boolean; pending?: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${on ? 'bg-brand-400' : 'bg-gray-300'} ${pending ? 'opacity-60' : ''}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </span>
  );
}

function FormToggleButton({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-testid="toggle-switch"
      onClick={onClick}
      disabled={pending}
      className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-lg px-1 disabled:cursor-wait"
    >
      <SwitchVisual on={on} pending={pending} />
    </button>
  );
}

/** On/Off switch. With `formAction` it renders its own tiny <form> (list-page toggles): never place that inside another form. */
export function ToggleSwitch({ name, label, hint, checked, defaultChecked, onChange, formAction, fields }: ToggleProps) {
  const controlled = checked !== undefined && onChange !== undefined;
  const [inner, setInner] = useState<boolean>(checked ?? defaultChecked ?? false);
  const on = controlled ? !!checked : inner;
  const { inputRef, markUserChange } = useUserChangeEvent(on);

  // a server re-render after a list toggle passes the new `checked`
  useEffect(() => {
    if (!controlled && checked !== undefined) setInner(checked);
  }, [checked, controlled]);

  if (formAction) {
    return (
      <form action={formAction} className="inline-flex items-center gap-2">
        {Object.entries(fields ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <FormToggleButton on={on} label={label} onClick={() => setInner(!on)} />
        <span className="sr-only">{label}</span>
      </form>
    );
  }

  const toggle = () => {
    markUserChange();
    if (controlled) onChange!(!on);
    else {
      setInner(!on);
      onChange?.(!on);
    }
  };

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        data-testid="toggle-switch"
        onClick={toggle}
        className="-m-2 inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg p-2 outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      >
        <SwitchVisual on={on} />
      </button>
      <span className="min-w-0 pt-0.5">
        <span className="block cursor-pointer text-sm font-medium text-ink-dark" onClick={toggle}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>}
      </span>
      {name && <input ref={inputRef} type="hidden" name={name} value={on ? 'on' : ''} />}
    </div>
  );
}

/** A row of 2–4 choices (`role="radiogroup"`, 40px buttons) that wraps on narrow screens instead of scrolling. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  name,
  hint,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  name?: string;
  hint?: string;
}) {
  const id = useId();
  const pick = (v: T) => {
    if (v !== value) onChange(v);
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = options[(i + dir + options.length) % options.length];
    pick(next.value);
    (e.currentTarget.parentElement?.children[(i + dir + options.length) % options.length] as HTMLElement | undefined)?.focus();
  };
  return (
    <div>
      <span id={`${id}-label`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} data-testid="segmented-control" className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => pick(o.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={`min-h-10 flex-1 basis-[8rem] rounded-md px-3 text-sm font-semibold transition ${on ? 'bg-white text-ink-dark shadow-sm ring-1 ring-brand-200' : 'text-gray-500 hover:text-ink-dark'}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
