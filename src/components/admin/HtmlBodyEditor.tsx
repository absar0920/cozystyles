'use client';

import { useRef, useState } from 'react';
import { UploadIcon } from '@/components/icons';
import { ACCEPT_IMAGES, altFromFileName, imageFiles, uploadImage } from './upload';

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * HTML body textarea with an "Insert image" button: the file is uploaded and an <img> tag is
 * inserted at the cursor. The textarea stays uncontrolled so the server-action form submits it as-is.
 * The textarea comes first so a wrapping <label> (admin Field) still targets it.
 */
export function HtmlBodyEditor(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function insert(file: File | undefined) {
    const area = areaRef.current;
    if (!file || !area) return;
    setBusy(true);
    setError(null);
    try {
      const img = await uploadImage(file, 'pages');
      const tag = `<img src="${escapeAttr(img.url)}" alt="${escapeAttr(altFromFileName(file.name))}" width="${img.width}" height="${img.height}" loading="lazy" />`;
      const { selectionStart: start, selectionEnd: end, value } = area;
      area.value = `${value.slice(0, start)}${tag}${value.slice(end)}`;
      area.focus();
      area.setSelectionRange(start + tag.length, start + tag.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <textarea
        {...props}
        ref={areaRef}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 ${props.className ?? ''}`}
      />
      <span className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            fileRef.current?.click();
          }}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-brand hover:text-brand disabled:opacity-50"
        >
          <UploadIcon className="h-3.5 w-3.5" /> {busy ? 'Uploading…' : 'Insert image'}
        </button>
        <span className="text-xs font-normal normal-case tracking-normal text-gray-400">Uploads a photo and inserts an &lt;img&gt; tag at the cursor.</span>
        {error && (
          <span className="text-xs font-medium normal-case tracking-normal text-red-600" role="alert">
            {error}
          </span>
        )}
      </span>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_IMAGES}
        className="hidden"
        tabIndex={-1}
        aria-label="Choose image to insert"
        onChange={(e) => {
          insert(imageFiles(e.target.files)[0]);
          e.target.value = '';
        }}
      />
    </>
  );
}
