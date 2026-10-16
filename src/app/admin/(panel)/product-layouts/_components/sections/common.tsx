'use client';

import { useState, type ReactNode } from 'react';
import type { BrokenLink } from '@/lib/link-targets';
import type { LinkTarget } from '@/lib/links';
import type { SectionKind } from '@/lib/product-layout-sections';
import type { DraftSection, DraftValuesMap } from '@/lib/product-layout-draft';
import { Field } from '@/components/admin/ui';
import type { ImageMeta } from '../../_lib/load';

/** Everything a per-kind section editor gets from the layout editor. */
export type SectionEditorProps<K extends SectionKind> = {
  section: DraftSection<K>;
  /** a new value, or an update of the latest value (use the function form from async callbacks such as uploads) */
  setValues: (values: DraftValuesMap[K] | ((current: DraftValuesMap[K]) => DraftValuesMap[K])) => void;
  setBody: (html: string) => void;
  /** field errors from the last failed save (field → message) */
  errors: Record<string, string>;
  imageMeta: ImageMeta;
  addImageMeta: (url: string, w: number, h: number) => void;
  collections: Record<number, { title: string; products: number }>;
  addCollection: (id: number, title: string, products: number) => void;
  linkTargets: Record<string, LinkTarget>;
  brokenLinks: BrokenLink[];
  /** true while saving (inputs locked) */
  readOnly: boolean;
};

/** Rich text in layout sections: no headings, lists, alignment, colour, photos or videos (SPEC §3.1). */
export const LAYOUT_TEXT_FEATURES = { images: false, youtube: false, headings: false, lists: false, align: false, color: false } as const;

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-red-600">
      {message}
    </p>
  );
}

/** A labelled field with its save error underneath. `data-field` lets the editor scroll to it. */
export function EditorField({ label, hint, field, error, children, htmlFor }: { label: string; hint?: string; field: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div data-field={field}>
      <Field label={label} hint={hint} htmlFor={htmlFor}>
        {children}
      </Field>
      <FieldError message={error} />
    </div>
  );
}

/** CSS aspect-ratio for a photo preview, from its known size; `fallback` otherwise. */
export function aspectOf(meta: ImageMeta, url: string, fallback: string): string {
  const m = url ? meta[url] : undefined;
  return m && m.w > 0 && m.h > 0 ? `${m.w} / ${m.h}` : fallback;
}

/** Visible characters of rich text (counted in the browser, for the overlay's 600-character limit). */
export function richTextLength(html: string): number {
  if (!html) return 0;
  if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, '').length;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim().length;
}

export const inputError = (e?: string) => (e ? 'border-red-400' : '');

/** Small remove button for list items (set apart from the move arrows next to it). */
export function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="ml-2 inline-flex min-h-10 items-center rounded-lg border-l border-gray-200 px-3 text-sm font-semibold text-red-600 hover:bg-red-50"
    >
      Remove
    </button>
  );
}

export function AddButton({ onClick, children, disabled, disabledReason }: { onClick: () => void; children: ReactNode; disabled?: boolean; disabledReason?: string }) {
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-3.5 text-sm font-semibold text-brand-700 hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {children}
      </button>
      {disabled && disabledReason && <p className="mt-1 text-xs text-gray-500">{disabledReason}</p>}
    </div>
  );
}

let seq = 0;
/** A client key for a new nested item (block, quote, slide). */
export function itemKey(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

/**
 * Removing a quote, icon or slide takes effect at once; this keeps the last removed one so it can be put back where
 * it was, without "Discard changes" (which would also throw away every other unsaved edit).
 */
export function useUndoRemove<T extends { key: string }>(setList: (update: (current: T[]) => T[]) => void) {
  const [last, setLast] = useState<{ item: T; index: number; label: string } | null>(null);
  return {
    /** `index`: where the item is now, so Undo can put it back there */
    remove(item: T, index: number, label: string) {
      setLast({ item, index, label });
      setList((cur) => cur.filter((x) => x.key !== item.key));
    },
    notice: last ? (
      <div role="status" data-testid="undo-remove" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-700">
        <span>{last.label} removed.</span>
        <button
          type="button"
          onClick={() => {
            const { item, index } = last;
            setList((cur) => (cur.some((x) => x.key === item.key) ? cur : [...cur.slice(0, index), item, ...cur.slice(index)]));
            setLast(null);
          }}
          className="inline-flex min-h-10 items-center rounded-lg px-3 font-semibold text-brand-700 hover:bg-white"
        >
          Undo
        </button>
      </div>
    ) : null,
  };
}
