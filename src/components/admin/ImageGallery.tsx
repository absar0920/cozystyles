'use client';

import { useRef, useState } from 'react';
import { SortableList } from './SortableList';
import { ACCEPT_IMAGES, uploadImage, type UploadPurpose } from './upload-client';
import { useUserChangeEvent } from './ui-client';
import { CloseIcon, UploadIcon } from './icons';

export type GalleryItem = {
  key: string;
  id: number | null;
  src: string;
  alt: string;
  tagKey: string | null;
  width?: number | null;
  height?: number | null;
};

export type ImageGalleryProps = {
  items: GalleryItem[];
  onChange: (items: GalleryItem[]) => void;
  /** e.g. [{key:'v12', label:'Color: Grey'}]; omit → no "Shows" selector */
  tagOptions?: { key: string; label: string }[];
  /** default 'product' */
  purpose?: UploadPurpose;
  /** default 40 */
  maxItems?: number;
  /** optional hidden JSON input */
  name?: string;
};

type Pending = { key: string; file: File; name: string; progress: number; error: string | null };

export function newKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

const PARALLEL = 3;

/** Product photos: multi-upload (3 at a time), drag or arrows to reorder, first = main photo, per-photo "Shows" tag. */
export function ImageGallery({ items, onChange, tagOptions, purpose = 'product', maxItems = 40, name }: ImageGalleryProps) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const latest = useRef(items);
  latest.current = items;
  const queue = useRef<Pending[]>([]);
  const active = useRef(0);
  const { inputRef, markUserChange } = useUserChangeEvent(items);

  const commit = (next: GalleryItem[]) => {
    markUserChange();
    latest.current = next;
    onChange(next);
  };

  const patchPending = (key: string, patch: Partial<Pending>) =>
    setPending((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  // Photos join the gallery in the order they were picked, not the order their uploads finish: a finished
  // upload waits until every photo picked before it has finished (or failed).
  const order = useRef<string[]>([]);
  const done = useRef(new Map<string, GalleryItem>());
  const failed = useRef(new Set<string>());

  const flush = () => {
    const ready: GalleryItem[] = [];
    const landed: string[] = [];
    while (order.current.length) {
      const key = order.current[0];
      const item = done.current.get(key);
      if (item) {
        ready.push(item);
        landed.push(key);
        done.current.delete(key);
      } else if (!failed.current.has(key)) break; // still uploading: later photos wait for it
      order.current.shift();
    }
    if (!ready.length) return;
    setPending((list) => list.filter((p) => !landed.includes(p.key)));
    commit([...latest.current, ...ready]);
  };

  const pump = () => {
    while (active.current < PARALLEL && queue.current.length) {
      const job = queue.current.shift()!;
      active.current++;
      uploadImage(job.file, purpose, (pct) => patchPending(job.key, { progress: pct }))
        .then((res) => {
          done.current.set(job.key, { key: newKey(), id: null, src: res.url, alt: '', tagKey: null, width: res.width, height: res.height });
        })
        .catch((e: Error) => {
          failed.current.add(job.key);
          patchPending(job.key, { error: e.message, progress: 0 });
        })
        .finally(() => {
          active.current--;
          flush();
          pump();
        });
    }
  };

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const room = maxItems - latest.current.length - pending.filter((p) => !p.error).length;
    const list = Array.from(files);
    const accepted = list.slice(0, Math.max(0, room));
    setNote(accepted.length < list.length ? `You can have up to ${maxItems} photos.` : null);
    const jobs = accepted.map((file) => ({ key: newKey(), file, name: file.name, progress: 0, error: null }));
    setPending((p) => [...p, ...jobs]);
    order.current.push(...jobs.map((j) => j.key));
    queue.current.push(...jobs);
    pump();
    if (fileRef.current) fileRef.current.value = '';
  };

  const retry = (job: Pending) => {
    patchPending(job.key, { error: null, progress: 0 });
    failed.current.delete(job.key);
    // a retried photo goes after the ones already waiting
    if (!order.current.includes(job.key)) order.current.push(job.key);
    queue.current.push({ ...job, error: null, progress: 0 });
    pump();
  };

  const dismiss = (key: string) => {
    failed.current.delete(key);
    setPending((l) => l.filter((x) => x.key !== key));
  };

  const update = (key: string, patch: Partial<GalleryItem>) => commit(latest.current.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const remove = (key: string) => commit(latest.current.filter((it) => it.key !== key));
  const makeMain = (key: string) => {
    const it = latest.current.find((x) => x.key === key);
    if (it) commit([it, ...latest.current.filter((x) => x.key !== key)]);
  };

  return (
    <div data-testid="image-gallery">
      {items.length > 0 && (
        <SortableList
          items={items}
          getKey={(it) => it.key}
          onReorder={commit}
          ariaLabel="Photos"
          layout="grid"
          renderItem={(it, ctl) => (
            <div data-testid="gallery-item" data-image-id={it.id ?? ''} className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="relative aspect-square bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.src} alt={it.alt} className="h-full w-full object-contain" />
                {ctl.isFirst && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Main photo
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(it.key)}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow hover:text-red-600"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 px-1">
                {ctl.handle}
                {ctl.arrows}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {!ctl.isFirst && (
                  <button type="button" onClick={() => makeMain(it.key)} className="min-h-9 rounded-lg text-left text-xs font-semibold text-brand-600 hover:underline">
                    Make main photo
                  </button>
                )}
                <label className="block">
                  <span className="block text-[11px] font-semibold text-gray-600">Describe the photo</span>
                  <input
                    value={it.alt}
                    onChange={(e) => update(it.key, { alt: e.target.value })}
                    maxLength={200}
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    placeholder="e.g. Grey sofa, front view"
                  />
                  <span className="mt-0.5 block text-[10px] leading-tight text-gray-400">Helps Google and people using screen readers</span>
                </label>
                {tagOptions && (
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-gray-600">Shows</span>
                    <select
                      data-testid="gallery-tag-select"
                      value={it.tagKey ?? ''}
                      onChange={(e) => update(it.key, { tagKey: e.target.value || null })}
                      className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand"
                    >
                      <option value="">Any option (always shown)</option>
                      {tagOptions.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
          )}
        />
      )}

      {pending.length > 0 && (
        <ul className="mt-3 space-y-2">
          {pending.map((p) => (
            <li key={p.key} className={`rounded-lg border px-3 py-2 text-sm ${p.error ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{p.name}</span>
                {p.error ? (
                  <span className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => retry(p)} className="min-h-9 rounded-md px-2 text-xs font-semibold text-brand-600 hover:bg-white">
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(p.key)}
                      className="min-h-9 rounded-md px-2 text-xs font-semibold text-gray-500 hover:bg-white"
                    >
                      Dismiss
                    </button>
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-gray-500">{p.progress}%</span>
                )}
              </div>
              {p.error ? (
                <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                  {p.error}
                </p>
              ) : (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-brand-400 transition-all" style={{ width: `${p.progress}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        className="mt-3 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center"
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={items.length >= maxItems}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          <UploadIcon className="h-4 w-4" />
          {items.length ? 'Add more photos' : 'Upload photos'}
        </button>
        <span className="text-xs text-gray-500">
          <span className="hidden sm:inline">or drag photos here · </span>JPG, PNG, WebP or iPhone photos, up to 20 MB each
        </span>
        <input ref={fileRef} type="file" multiple accept={ACCEPT_IMAGES} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => addFiles(e.target.files)} />
      </div>
      {note && <p className="mt-1 text-xs text-amber-700">{note}</p>}
      {name && <input ref={inputRef} type="hidden" name={name} value={JSON.stringify(items)} />}
    </div>
  );
}
