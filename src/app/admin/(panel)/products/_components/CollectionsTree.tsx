'use client';

import { useMemo, useState } from 'react';
import { CloseIcon, SearchIcon } from '@/components/admin/icons';
import type { CollectionRow } from '../_lib/types';

/** Searchable checkbox tree of collections; the ticked ones show as chips at the top. */
export function CollectionsTree({ rows, value, onChange }: { rows: CollectionRow[]; value: number[]; onChange: (ids: number[]) => void }) {
  const [q, setQ] = useState('');
  const selected = useMemo(() => new Set(value), [value]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const query = q.trim().toLowerCase();
  const visible = query ? rows.filter((r) => r.title.toLowerCase().includes(query)) : rows;

  const toggle = (id: number) => onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div>
      {value.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Chosen collections">
          {value.map((id) => {
            const r = byId.get(id);
            if (!r) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-3 pr-1 text-sm text-brand-900">
                {r.title}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${r.title}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-brand-100"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="mb-3 text-sm text-gray-500">Not in any collection yet.</p>
      )}

      <label className="relative block">
        <span className="sr-only">Search collections</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search collections…"
          className="min-h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>

      <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-gray-200 p-1" role="group" aria-label="Collections">
        {visible.length === 0 && <p className="px-3 py-4 text-sm text-gray-400">No collections match “{q}”.</p>}
        {visible.map((r) => (
          <label
            key={r.id}
            className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-gray-50 ${r.depth === 0 && !query ? 'font-semibold text-ink-dark' : 'text-gray-700'}`}
            style={{ paddingLeft: query ? undefined : `${0.5 + Math.min(r.depth, 4) * 1.1}rem` }}
          >
            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-5 w-5 shrink-0 rounded border-gray-300" />
            <span className="min-w-0 truncate text-sm">{r.title}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
