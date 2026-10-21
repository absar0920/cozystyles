'use client';

import { useState } from 'react';
import { PlusIcon, TrashIcon } from '@/components/icons';

export type VariantInit = {
  title?: string | null;
  sku?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  price?: number | string | null;
  compareAtPrice?: number | string | null;
  inventory?: number | string | null;
  position?: number | string | null;
};

type Row = {
  key: string;
  title: string;
  sku: string;
  option1: string;
  option2: string;
  option3: string;
  price: string;
  compareAtPrice: string;
  inventory: string;
  position: string;
};

let seq = 0;
const nextKey = () => `v${++seq}`;

const str = (v: string | number | null | undefined) => (v == null ? '' : String(v));

function toRow(v: VariantInit, index: number): Row {
  return {
    key: nextKey(),
    title: str(v.title),
    sku: str(v.sku),
    option1: str(v.option1),
    option2: str(v.option2),
    option3: str(v.option3),
    price: str(v.price),
    compareAtPrice: str(v.compareAtPrice),
    inventory: v.inventory == null || v.inventory === '' ? '50' : str(v.inventory),
    position: v.position == null || v.position === '' ? String(index) : str(v.position),
  };
}

function blankRow(index: number): Row {
  return {
    key: nextKey(),
    title: 'Default Title',
    sku: '',
    option1: '',
    option2: '',
    option3: '',
    price: '',
    compareAtPrice: '',
    inventory: '50',
    position: String(index),
  };
}

/** Non-negative whole rupees, thousands separators allowed ("84000" or "84,000"). */
const WHOLE_RUPEES = '\\d[\\d,]*';

const GRID = 'grid grid-cols-[1.35fr_1fr_1fr_1fr_1fr_0.85fr_0.85fr_0.65fr_0.55fr_2rem] gap-2 items-center';
const COLS = ['Title', 'SKU', 'Option 1', 'Option 2', 'Option 3', 'Price (PKR)', 'Compare at', 'Inventory', 'Pos', ''];
const cellCls =
  'w-full min-w-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-ink outline-none transition focus:border-brand focus:ring-1 focus:ring-brand/20';

/**
 * Variant rows editor — rows are serialized to the hidden `variantsJson` input
 * (always in sync because React re-renders it from state on every keystroke).
 */
export function VariantsEditor({ initial = [] }: { initial?: VariantInit[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length > 0 ? initial.map((v, i) => toRow(v, i)) : [blankRow(0)],
  );

  const update = (key: string, field: keyof Omit<Row, 'key'>, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));
  const add = () => setRows((rs) => [...rs, blankRow(rs.length)]);

  return (
    <div>
      <input type="hidden" name="variantsJson" value={JSON.stringify(rows.map(({ key, ...rest }) => rest))} />
      <div className="overflow-x-auto">
        <div className="min-w-[660px]">
          <div className={`${GRID} px-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500`}>
            {COLS.map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={r.key} className={GRID}>
                <input className={cellCls} value={r.title} onChange={(e) => update(r.key, 'title', e.target.value)} placeholder="Default Title" aria-label={`Variant ${i + 1} title`} />
                <input className={cellCls} value={r.sku} onChange={(e) => update(r.key, 'sku', e.target.value)} placeholder="SKU" aria-label={`Variant ${i + 1} SKU`} />
                <input className={cellCls} value={r.option1} onChange={(e) => update(r.key, 'option1', e.target.value)} placeholder="e.g. 2-Seater" aria-label={`Variant ${i + 1} option 1`} />
                <input className={cellCls} value={r.option2} onChange={(e) => update(r.key, 'option2', e.target.value)} aria-label={`Variant ${i + 1} option 2`} />
                <input className={cellCls} value={r.option3} onChange={(e) => update(r.key, 'option3', e.target.value)} aria-label={`Variant ${i + 1} option 3`} />
                <input className={cellCls} value={r.price} onChange={(e) => update(r.key, 'price', e.target.value)} inputMode="numeric" required pattern={WHOLE_RUPEES} title="Whole PKR rupees, e.g. 84000" placeholder="84000" aria-label={`Variant ${i + 1} price`} />
                <input className={cellCls} value={r.compareAtPrice} onChange={(e) => update(r.key, 'compareAtPrice', e.target.value)} inputMode="numeric" pattern={WHOLE_RUPEES} title="Whole PKR rupees, e.g. 99000" aria-label={`Variant ${i + 1} compare-at price`} />
                <input className={cellCls} value={r.inventory} onChange={(e) => update(r.key, 'inventory', e.target.value)} inputMode="numeric" pattern="\d+" title="0 or more" aria-label={`Variant ${i + 1} inventory`} />
                <input className={cellCls} value={r.position} onChange={(e) => update(r.key, 'position', e.target.value)} inputMode="numeric" aria-label={`Variant ${i + 1} position`} />
                <button
                  type="button"
                  onClick={() => remove(r.key)}
                  title="Remove variant"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-brand hover:text-brand"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Add variant
        </button>
        <p className="text-xs text-gray-400">Prices are integer PKR rupees — at least one variant is required.</p>
      </div>
    </div>
  );
}
