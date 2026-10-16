'use client';

import { useEffect, useState } from 'react';
import { usePendingUploads, WAITING_FOR_UPLOAD } from './upload-client';

export type SaveBarAction = {
  label: string;
  /** used below 400px wide (e.g. "Draft" / "Publish") */
  shortLabel?: string;
  variant?: 'primary' | 'secondary';
  type?: 'submit' | 'button';
  /** id of the form to submit when the bar is outside it */
  form?: string;
  name?: string;
  value?: string;
  onClick?: () => void;
  disabled?: boolean;
};

/**
 * Save bar fixed to the bottom of the viewport (beside the sidebar on desktop). The page using it adds `pb-28`.
 * On touch screens it hides while the on-screen keyboard is open over a text field or the editor, and comes back
 * as soon as the keyboard closes (even if the field keeps focus).
 */
export function StickySaveBar({
  dirty,
  saving,
  status,
  error,
  actions,
}: {
  dirty: boolean;
  saving?: boolean;
  status?: string;
  error?: string | null;
  actions: SaveBarAction[];
}) {
  const [typing, setTyping] = useState(false);
  const uploading = usePendingUploads() > 0;

  // while a photo is uploading, no form on the page may submit (Enter in a field included)
  useEffect(() => {
    if (!uploading) return;
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('submit', block, true);
    return () => document.removeEventListener('submit', block, true);
  }, [uploading]);

  // Hide only while the on-screen keyboard is actually open (text field focused AND the visible viewport
  // shrank). Android's Back key closes the keyboard but leaves focus in the field, so focus alone is not enough.
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const isTextTarget = (el: Element | null) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      if (el instanceof HTMLTextAreaElement) return true;
      if (el instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'submit', 'file', 'color', 'range'].includes(el.type);
      return false;
    };
    // tallest viewport seen at this width = height with no keyboard (reset on rotation / resize of width)
    // (height × scale, so pinch-zoom is not mistaken for the keyboard)
    const visible = () => vv.height * vv.scale;
    let width = window.innerWidth;
    let full = Math.max(visible(), window.innerHeight);
    const update = () => {
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        full = visible();
      }
      full = Math.max(full, visible());
      const keyboardOpen = full - visible() > 120;
      setTyping(keyboardOpen && isTextTarget(document.activeElement));
    };
    // focus changes settle before the keyboard animates, so re-check on the next frame as well
    const onFocus = () => {
      update();
      requestAnimationFrame(update);
    };
    vv.addEventListener('resize', update);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onFocus);
    return () => {
      vv.removeEventListener('resize', update);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onFocus);
    };
  }, []);

  const text = error ? (
    <span className="font-semibold text-red-600">{error}</span>
  ) : uploading ? (
    <span className="text-gray-600">{WAITING_FOR_UPLOAD}</span>
  ) : saving ? (
    <span className="text-gray-600">Saving…</span>
  ) : dirty ? (
    <span className="inline-flex items-center gap-2 font-medium text-amber-700">
      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
      Unsaved changes
    </span>
  ) : status ? (
    <span className="text-gray-500">{status}</span>
  ) : null;

  return (
    <div
      data-testid="save-bar"
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] transition-transform pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-6 lg:left-64 lg:px-8 ${
        typing ? 'translate-y-full' : ''
      }`}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between">
        <div role="status" aria-live="polite" className="min-h-5 min-w-0 truncate text-sm">
          {text}
        </div>
        <div className="flex shrink-0 gap-2">
          {actions.map((a) => {
            const primary = (a.variant ?? 'primary') === 'primary';
            return (
              <button
                key={a.label}
                type={a.type ?? 'submit'}
                form={a.form}
                name={a.name}
                value={a.value}
                onClick={a.onClick}
                // every action waits for uploads: a save (or undo) mid-upload would drop the photo
                disabled={a.disabled || saving || uploading}
                className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 min-[400px]:flex-none ${
                  primary ? 'bg-brand text-white hover:bg-brand-600' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {a.shortLabel ? (
                  <>
                    <span className="min-[400px]:hidden">{a.shortLabel}</span>
                    <span className="hidden min-[400px]:inline">{a.label}</span>
                  </>
                ) : (
                  a.label
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
