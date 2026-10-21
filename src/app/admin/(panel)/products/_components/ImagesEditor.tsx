'use client';

import { useState } from 'react';
import { PlusIcon, TrashIcon } from '@/components/icons';

export type ImageInit = { src?: string | null; alt?: string | null; position?: number | string | null };

type Row = { key: string; src: string; alt: string; position: string };

let seq = 0;
const nextKey = () => `i${++seq}`;

const str = (v: string | number | null | undefined) => (v == null ? '' : String(v));

const inputBase =
  'min-w-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-ink outline-none transition focus:border-brand focus:ring-1 focus:ring-brand/20';
const inputCls = `w-full ${inputBase}`;

/** Image rows editor — src + alt + position, live thumbnail, serialized to hidden `imagesJson`. */
export function ImagesEditor({ initial = [] }: { initial?: ImageInit[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length > 0
      ? initial.map((im, i) => ({ key: nextKey(), src: str(im.src), alt: str(im.alt), position: im.position == null || im.position === '' ? String(i) : str(im.position) }))
      : [],
  );

  const update = (key: string, field: keyof Omit<Row, 'key'>, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));
  const add = () => setRows((rs) => [...rs, { key: nextKey(), src: '', alt: '', position: String(rs.length) }]);

  return (
    <div>
      <input type="hidden" name="imagesJson" value={JSON.stringify(rows.map(({ key, ...rest }) => rest))} />
      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-xs text-gray-400">
          No images yet — add the first one below.
        </p>
      )}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center gap-2">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {r.src.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.src} alt={r.alt || 'Preview'} className="h-full w-full object-cover" width={56} height={56} />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[9px] text-gray-300">IMG</span>
              )}
            </div>
            <input
              className={inputCls}
              style={{ flex: '1.4 1 0%' }}
              value={r.src}
              onChange={(e) => update(r.key, 'src', e.target.value)}
              placeholder="/images/products/alexa-sofa-chair-1.jpg"
              aria-label={`Image ${i + 1} source`}
            />
            <input
              className={inputCls}
              style={{ flex: '1 1 0%' }}
              value={r.alt}
              onChange={(e) => update(r.key, 'alt', e.target.value)}
              placeholder="Alt text"
              aria-label={`Image ${i + 1} alt text`}
            />
            <input
              className={`${inputBase} w-16 shrink-0`}
              value={r.position}
              onChange={(e) => update(r.key, 'position', e.target.value)}
              inputMode="numeric"
              placeholder={`${i}`}
              aria-label={`Image ${i + 1} position`}
            />
            <button
              type="button"
              onClick={() => remove(r.key)}
              title="Remove image"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-brand hover:text-brand"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Add image
        </button>
        <p className="text-xs text-gray-400">Existing images live under <span className="font-mono">/images/products/…</span> — or paste a full https:// URL.</p>
      </div>
    </div>
  );
}
