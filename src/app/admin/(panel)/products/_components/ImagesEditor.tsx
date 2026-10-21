'use client';

import { useRef, useState } from 'react';
import { PlusIcon, TrashIcon, UploadIcon } from '@/components/icons';
import { ACCEPT_IMAGES, altFromFileName, imageFiles, uploadImage } from '@/components/admin/upload';

export type ImageInit = { src?: string | null; alt?: string | null; position?: number | string | null };

type Row = { key: string; src: string; alt: string; position: string };

let seq = 0;
const nextKey = () => `i${++seq}`;

const str = (v: string | number | null | undefined) => (v == null ? '' : String(v));

const inputBase =
  'min-w-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-ink outline-none transition focus:border-brand focus:ring-1 focus:ring-brand/20';
const inputCls = `w-full ${inputBase}`;

/**
 * Image rows editor — src + alt + position, live thumbnail, serialized to hidden `imagesJson`.
 * Images can be uploaded (button, or drag & drop anywhere on the editor) or added by URL.
 */
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

  const filesRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceKey = useRef<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  /** Upload one by one so each file gets its own row (or error) as soon as it's done. */
  async function uploadMany(files: File[]) {
    if (files.length === 0) return;
    const failed: string[] = [];
    for (const [n, file] of files.entries()) {
      setStatus(`Uploading ${n + 1} of ${files.length}…`);
      try {
        const img = await uploadImage(file, 'products');
        setRows((rs) => [...rs, { key: nextKey(), src: img.url, alt: altFromFileName(file.name), position: String(rs.length) }]);
      } catch (err) {
        failed.push(err instanceof Error ? err.message : `${file.name}: upload failed.`);
      }
    }
    setStatus(null);
    setErrors(failed);
  }

  async function replace(key: string, file: File | undefined) {
    if (!file) return;
    setStatus('Uploading…');
    try {
      const img = await uploadImage(file, 'products');
      update(key, 'src', img.url);
      setErrors([]);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Upload failed.']);
    }
    setStatus(null);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        uploadMany(imageFiles(e.dataTransfer.files));
      }}
      className={`rounded-lg transition ${dragging ? 'bg-brand/5 ring-2 ring-brand ring-offset-4' : ''}`}
    >
      <input
        ref={filesRef}
        type="file"
        accept={ACCEPT_IMAGES}
        multiple
        className="hidden"
        tabIndex={-1}
        aria-label="Choose product images"
        onChange={(e) => {
          uploadMany(imageFiles(e.target.files));
          e.target.value = '';
        }}
      />
      <input
        ref={replaceRef}
        type="file"
        accept={ACCEPT_IMAGES}
        className="hidden"
        tabIndex={-1}
        aria-label="Choose replacement image"
        onChange={(e) => {
          if (replaceKey.current) replace(replaceKey.current, imageFiles(e.target.files)[0]);
          e.target.value = '';
        }}
      />
      <input type="hidden" name="imagesJson" value={JSON.stringify(rows.map(({ key, ...rest }) => rest))} />
      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-xs text-gray-400">
          No images yet — drop photos here or use Upload images below.
        </p>
      )}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                replaceKey.current = r.key;
                replaceRef.current?.click();
              }}
              disabled={status != null}
              title="Upload a replacement image"
              aria-label={`Replace image ${i + 1}`}
              className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition hover:border-brand"
            >
              {r.src.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.src} alt={r.alt || 'Preview'} className="h-full w-full object-cover" width={56} height={56} />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[9px] text-gray-300">IMG</span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
                <UploadIcon className="h-4 w-4" />
              </span>
            </button>
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
          onClick={() => filesRef.current?.click()}
          disabled={status != null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          <UploadIcon className="h-3.5 w-3.5" /> {status ?? 'Upload images'}
        </button>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-brand hover:text-brand"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Add image URL
        </button>
        <p className="text-xs text-gray-400">JPG, PNG, WebP, GIF or AVIF up to 15 MB each — you can select several at once or drag them here. Click a thumbnail to replace it.</p>
      </div>
      {errors.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs font-medium text-red-600" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
