'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ImageIcon, TrashIcon, UploadIcon } from '@/components/icons';
import { ACCEPT_IMAGES, imageFiles, uploadImage, type UploadFolder } from './upload';

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';
const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-brand hover:text-brand disabled:opacity-50';

/**
 * Single-image field: upload (click or drag & drop) or paste a URL. The URL input carries `name`,
 * so the surrounding server-action form submits it like any other text field.
 */
export function ImageUpload({
  name,
  label,
  hint,
  folder,
  initial = '',
  required,
  placeholder = 'Upload an image, or paste /images/… or https://…',
  previewClass = 'h-24 w-24',
}: {
  name: string;
  label?: string;
  hint?: string;
  folder: UploadFolder;
  initial?: string;
  required?: boolean;
  placeholder?: string;
  previewClass?: string;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);

  // React resets a form after its server action succeeds; follow suit instead of keeping the old upload.
  useEffect(() => {
    const form = urlRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setSrc(initial);
      setError(null);
    };
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [initial]);

  async function upload(files: File[]) {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setSrc((await uploadImage(file, folder)).url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </label>
      )}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            upload(imageFiles(e.dataTransfer.files));
          }}
          disabled={busy}
          title="Click or drop an image to upload"
          aria-label={`${label ?? 'Image'} preview — click or drop to upload`}
          className={`relative shrink-0 overflow-hidden rounded-lg border-2 border-dashed bg-gray-50 transition ${previewClass} ${
            dragging ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-brand'
          }`}
        >
          {src.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] font-semibold text-gray-400">
              <ImageIcon className="h-5 w-5" />
              Drop image
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/80 text-[10px] font-semibold text-brand">
              Uploading…
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={urlRef}
            id={id}
            name={name}
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            placeholder={placeholder}
            required={required}
            className={inputCls}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={ghostBtn}>
              <UploadIcon className="h-3.5 w-3.5" /> {busy ? 'Uploading…' : src ? 'Replace image' : 'Upload image'}
            </button>
            {src && !busy && (
              <button
                type="button"
                onClick={() => setSrc('')}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <TrashIcon className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
          {error && (
            <p className="text-xs font-medium text-red-600" role="alert">
              {error}
            </p>
          )}
          {hint && <p className="text-xs text-gray-400">{hint}</p>}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_IMAGES}
        className="hidden"
        tabIndex={-1}
        aria-label={`Choose file for ${label ?? 'image'}`}
        onChange={(e) => upload(imageFiles(e.target.files))}
      />
    </div>
  );
}
