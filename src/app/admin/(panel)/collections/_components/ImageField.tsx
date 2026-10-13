'use client';

import { useState } from 'react';

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

/** Image URL input with a live thumbnail preview. */
export function ImageField({ initial = '' }: { initial?: string }) {
  const [src, setSrc] = useState(initial);
  return (
    <div className="flex items-start gap-3">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {src.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Collection image preview" width={80} height={80} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-gray-300">No image</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <input
          name="image"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          placeholder="/images/collections/living-room.jpg or https://…"
          className={inputCls}
        />
        <p className="mt-1 text-xs text-gray-400">Local files live under /images/… or paste a full URL. Leave blank for no image.</p>
      </div>
    </div>
  );
}
