'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Popover } from './Popover';
import { DotsIcon } from './icons';

export type MenuItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** shown under the label while disabled */
  disabledReason?: string;
  tone?: 'danger';
  /** second, smaller line */
  detail?: string;
};

/** A "⋯" button that opens a short list of actions (a bottom sheet on phones). */
export function MenuButton({
  label,
  title,
  items,
  trigger,
  testId,
}: {
  /** accessible name of the trigger, e.g. "More actions for Photo and text 1" */
  label: string;
  /** heading of the popover */
  title?: string;
  items: MenuItem[];
  /** custom trigger content (default: the ⋯ icon) */
  trigger?: ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid={testId}
        onClick={() => setOpen((o) => !o)}
        className={
          trigger
            ? 'inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50'
            : 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-ink-dark'
        }
      >
        {trigger ?? <DotsIcon className="h-5 w-5" />}
      </button>
      <Popover open={open} anchorRef={ref} onClose={() => setOpen(false)} title={title ?? 'Actions'} width={280}>
        <ul className="-mx-1">
          {items.map((it) => (
            <li key={it.label}>
              <button
                type="button"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={`flex min-h-11 w-full flex-col items-start justify-center rounded-lg px-3 py-1.5 text-left text-sm font-semibold hover:bg-gray-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
                  it.disabled ? 'text-gray-400' : it.tone === 'danger' ? 'text-red-600' : 'text-ink-dark'
                }`}
              >
                {it.label}
                {(it.disabled ? it.disabledReason : it.detail) && (
                  <span className="mt-0.5 text-xs font-normal text-gray-500">{it.disabled ? it.disabledReason : it.detail}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    </>
  );
}
