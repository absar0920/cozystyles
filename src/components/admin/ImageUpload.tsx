'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ACCEPT_IMAGES, uploadImage, type UploadPurpose } from './upload-client';
import { useUserChangeEvent } from './ui-client';
import { ImageIcon, UploadIcon } from './icons';

export type ImageUploadProps = {
  /** hidden input: the URL ('' when none) */
  name?: string;
  /** initial / controlled URL (/uploads/… or bundled /images/…) */
  value: string | null;
  onChange?: (url: string | null, meta?: { width: number; height: number }) => void;
  label: string;
  /** e.g. "Recommended 1200 × 462. Put your text inside the image." */
  hint?: string;
  purpose: UploadPurpose;
  /** CSS aspect-ratio, default '4 / 3' */
  previewAspect?: string;
  /**
   * Caps the photo preview's height (px). The preview keeps the photo's shape and narrows instead, centred, so a
   * tall photo does not fill the screen. Default: no cap (the preview is always full width).
   */
  previewMaxHeight?: number;
  /** shows "Required" and blocks the form submit when empty */
  required?: boolean;
  /** default true */
  allowRemove?: boolean;
};

const CHECKERBOARD =
  'repeating-conic-gradient(#f1f1f1 0% 25%, #ffffff 0% 50%) 50% / 16px 16px';

/** One photo: drop zone → progress → preview with Replace / Remove. Removing only clears the field. */
export function ImageUpload({
  name,
  value,
  onChange,
  label,
  hint,
  purpose,
  previewAspect = '4 / 3',
  previewMaxHeight,
  required,
  allowRemove = true,
}: ImageUploadProps) {
  const controlled = onChange !== undefined;
  const [inner, setInner] = useState<string | null>(value || null);
  const url = controlled ? value || null : inner;
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const proxyRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const { inputRef, markUserChange } = useUserChangeEvent(url);

  useEffect(() => {
    proxyRef.current?.setCustomValidity(required && !url ? 'Please upload a photo' : '');
  }, [required, url]);

  const set = (next: string | null, meta?: { width: number; height: number }) => {
    markUserChange();
    if (!controlled) setInner(next);
    onChange?.(next, meta);
    if (next) setError(null);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const res = await uploadImage(file, purpose, setProgress);
      set(res.url, { width: res.width, height: res.height });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pick = () => fileRef.current?.click();
  const uploading = progress != null;

  return (
    <div data-testid="image-upload">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span id={`${id}-label`} className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </span>
        {required && <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Required</span>}
      </div>

      {url && !uploading ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <div
            className="mx-auto flex items-center justify-center"
            data-testid="image-upload-preview"
            style={{
              aspectRatio: previewAspect,
              background: CHECKERBOARD,
              // narrower, not shorter: the box keeps the photo's shape (`a / b` is valid inside calc)
              ...(previewMaxHeight ? { width: `min(100%, calc(${previewMaxHeight}px * ${previewAspect}))` } : {}),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-gray-100 bg-white p-2">
            <button
              ref={buttonRef}
              type="button"
              onClick={pick}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <UploadIcon className="h-4 w-4" />
              Replace
            </button>
            {allowRemove && (
              <button
                type="button"
                onClick={() => set(null)}
                className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void upload(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
            over ? 'border-brand-400 bg-brand-50' : error ? 'border-red-300 bg-red-50/40' : 'border-gray-300 bg-gray-50'
          }`}
          style={{ aspectRatio: previewAspect, maxHeight: 320 }}
        >
          {uploading ? (
            <div className="w-full max-w-xs">
              <p className="mb-2 text-sm font-medium text-gray-700">Uploading… {progress}%</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-brand-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <ImageIcon className="h-8 w-8 text-gray-400" />
              <button
                ref={buttonRef}
                type="button"
                onClick={pick}
                aria-describedby={`${id}-label`}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600"
              >
                <UploadIcon className="h-4 w-4" />
                Upload photo
              </button>
              <span className="hidden text-xs text-gray-500 sm:block">or drag a photo here</span>
            </>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_IMAGES}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      {required && (
        <input
          ref={proxyRef}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          required
          // only "is there a photo" matters here; never show the address in a field
          value={url ? 'photo' : ''}
          onChange={() => {}}
          onInvalid={(e) => {
            e.preventDefault();
            setError('Please upload a photo');
            buttonRef.current?.focus();
          }}
        />
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {name && <input ref={inputRef} type="hidden" name={name} value={url ?? ''} />}
    </div>
  );
}
