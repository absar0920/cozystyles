'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Bullets: what will be lost. */
  consequences: string[];
  confirmLabel: string;
  /** default "Cancel" */
  cancelLabel?: string;
  /** danger = red confirm button */
  tone?: 'danger' | 'default';
  /** e.g. "Removed when you save." or "This can't be undone." */
  note?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Internal: lets ConfirmDelete render its submitting form as the confirm button. */
  renderConfirm?: (className: string) => ReactNode;
};

/** Modal confirmation for removals that take effect on save (no server call). Rendered in a portal at z-[70]. */
export function ConfirmDialog({
  open,
  title,
  consequences,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  note,
  onConfirm,
  onCancel,
  renderConfirm,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const cancelHandler = useRef(onCancel);
  cancelHandler.current = onCancel;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelHandler.current();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      returnTo.current?.focus?.();
    };
  }, [open]);

  if (!mounted || !open) return null;

  const confirmClass = `inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white transition ${
    tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand hover:bg-brand-600'
  }`;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="confirm-dialog"
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <h2 id={titleId} className="font-heading text-lg font-bold text-ink-dark">
          {title}
        </h2>
        {consequences.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {consequences.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        {note && <p className={`mt-3 text-sm ${tone === 'danger' ? 'font-semibold text-red-700' : 'text-gray-500'}`}>{note}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          {renderConfirm ? (
            renderConfirm(confirmClass)
          ) : (
            <button type="button" onClick={onConfirm} className={confirmClass}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
