'use client';

import { useRef, useState } from 'react';
import { ICON_KEYS, ICON_LABELS, type IconKey } from '@/lib/product-layout-icons';
import { PDP_ICONS } from '@/components/product/pdp-icons';
import { Popover } from './Popover';

/** Pick one of the ready-made icons (SPEC product-layouts §4): a 48px button that opens a grid of named icons. */
export function IconPicker({ value, onChange }: { value: IconKey; onChange: (icon: IconKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const Current = PDP_ICONS[value] ?? PDP_ICONS.delivery;
  return (
    <div data-testid="icon-picker">
      <button
        ref={ref}
        type="button"
        aria-label={`Choose icon: ${ICON_LABELS[value] ?? ICON_LABELS.delivery}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-gray-300 bg-[#f5f1ea] text-ink-dark hover:border-brand-400"
      >
        <Current className="h-7 w-7" />
      </button>
      <Popover open={open} anchorRef={ref} onClose={() => setOpen(false)} title="Choose an icon" width={340} testId="icon-picker-popover">
        <ul className="grid grid-cols-4 gap-1.5">
          {ICON_KEYS.map((k) => {
            const Icon = PDP_ICONS[k];
            const on = k === value;
            return (
              <li key={k}>
                <button
                  type="button"
                  data-icon={k}
                  aria-pressed={on}
                  aria-label={ICON_LABELS[k]}
                  title={ICON_LABELS[k]}
                  onClick={() => {
                    onChange(k);
                    setOpen(false);
                    ref.current?.focus();
                  }}
                  className={`flex min-h-[56px] w-full flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-center hover:bg-gray-50 ${
                    on ? 'bg-brand-50 ring-2 ring-brand-400' : ''
                  }`}
                >
                  <Icon className="h-6 w-6 text-ink-dark" />
                  <span className="line-clamp-2 text-[10px] leading-tight text-gray-600">{ICON_LABELS[k].replace(/\s*\(.*\)$/, '')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    </div>
  );
}
