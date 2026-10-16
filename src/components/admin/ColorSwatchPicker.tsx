'use client';

import { useRef, useState } from 'react';
import { normalizeHex } from '@/lib/product-options';
import { ImageUpload } from './ImageUpload';
import { Popover } from './Popover';

export type SwatchValue = { color: string | null; image: string | null };
export type ColorSwatchPickerProps = { value: SwatchValue; onChange: (v: SwatchValue) => void; valueLabel: string };

export const SWATCH_PALETTE: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#ededed' },
  { name: 'Off-white', hex: '#f3efe7' },
  { name: 'Beige', hex: '#c7aa82' },
  { name: 'Sand', hex: '#b7a89d' },
  { name: 'Taupe', hex: '#ccc7bb' },
  { name: 'Grey', hex: '#808080' },
  { name: 'Dark grey', hex: '#605959' },
  { name: 'Navy', hex: '#000080' },
  { name: 'Blue', hex: '#2377a4' },
  { name: 'Green', hex: '#81864a' },
  { name: 'Olive', hex: '#857c56' },
  { name: 'Mustard', hex: '#ffdb58' },
  { name: 'Pink', hex: '#e493a3' },
  { name: 'Maroon', hex: '#800000' },
  { name: 'Rose', hex: '#af6f70' },
  { name: 'Brown', hex: '#7f5112' },
  { name: 'Walnut', hex: '#5a3a22' },
];

/** The palette colour whose name matches a typed value ("green", "Gray" → Grey), or null. */
export function paletteColorFor(value: string): string | null {
  const v = value.trim().toLowerCase().replace(/gray/g, 'grey').replace(/[\s_]+/g, ' ');
  const hit = SWATCH_PALETTE.find((c) => c.name.toLowerCase() === v || c.name.toLowerCase().replace('-', ' ') === v);
  return hit ? hit.hex : null;
}

/** A 32px swatch circle; opens a palette, a custom colour, "Use a photo instead" and "Clear". */
export function ColorSwatchPicker({ value, onChange, valueLabel }: ColorSwatchPickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const color = value.color ? normalizeHex(value.color) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Swatch for ${valueLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="swatch-trigger"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        {value.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.image} alt="" className="h-8 w-8 rounded-full border border-gray-300 object-cover" />
        ) : color ? (
          <span className="h-8 w-8 rounded-full border border-gray-300" style={{ background: color }} />
        ) : (
          <span className="h-8 w-8 rounded-full border-2 border-dashed border-gray-300 bg-white" />
        )}
      </button>
      <Popover open={open} anchorRef={triggerRef} onClose={() => setOpen(false)} title={`Swatch for ${valueLabel}`} width={320} testId="swatch-popover">
        <div className="grid grid-cols-6 gap-1.5">
          {SWATCH_PALETTE.map((c) => {
            const selected = !value.image && color === c.hex;
            return (
              <button
                key={c.hex}
                type="button"
                title={c.name}
                aria-label={c.name}
                aria-pressed={selected}
                onClick={() => {
                  onChange({ color: c.hex, image: null });
                  setOpen(false);
                }}
                className={`flex h-11 items-center justify-center rounded-lg ${selected ? 'ring-2 ring-brand-400' : 'hover:bg-gray-100'}`}
              >
                <span className="h-8 w-8 rounded-full border border-gray-300" style={{ background: c.hex }} />
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-200 px-3">
          <span className="text-sm font-medium text-ink-dark">Custom colour</span>
          <input
            type="color"
            value={color ?? '#cccccc'}
            onChange={(e) => onChange({ color: normalizeHex(e.target.value), image: null })}
            className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
            aria-label="Custom colour"
          />
        </label>
        <div className="mt-3">
          <ImageUpload
            label="Use a photo instead"
            hint="A close-up of the fabric or finish. Shown as a small circle."
            purpose="swatch"
            previewAspect="1 / 1"
            value={value.image}
            onChange={(url) => onChange({ color: value.color, image: url })}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            onChange({ color: null, image: null });
            setOpen(false);
          }}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Clear
        </button>
      </Popover>
    </>
  );
}
