'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';

/**
 * A general modal (portal, z-[70]) for small forms and choices: a bottom sheet on phones, or a full-screen sheet with
 * `fullOnPhone`. Escape and the backdrop call `onClose`; focus moves into the dialog and back to the trigger.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  fullOnPhone = false,
  width = 'max-w-md',
  testId,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** buttons row */
  footer?: ReactNode;
  fullOnPhone?: boolean;
  /** Tailwind max-width class, default max-w-md */
  width?: string;
  testId?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      const first = panel.querySelector<HTMLElement>('[autofocus], input:not([type=hidden]), select, textarea, button:not([data-dialog-close])');
      (first ?? panel).focus();
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // a popover opened from inside the dialog closes first
      if (document.querySelector('[data-popover-open]')) return;
      e.preventDefault();
      closeRef.current();
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

  return createPortal(
    <div className={`fixed inset-0 z-[70] flex justify-center ${fullOnPhone ? 'items-stretch sm:items-center sm:p-4' : 'items-end sm:items-center sm:p-4'}`}>
      <div className="absolute inset-0 bg-black/50" onClick={() => closeRef.current()} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid={testId}
        className={`relative z-10 flex w-full flex-col bg-white shadow-xl outline-none ${width} ${
          fullOnPhone ? 'h-full max-h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl' : 'max-h-[90vh] rounded-t-2xl sm:rounded-2xl'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 pb-3 pt-4">
          <h2 id={titleId} className="min-w-0 font-heading text-lg font-bold text-ink-dark">
            {title}
          </h2>
          <button
            type="button"
            data-dialog-close
            onClick={() => closeRef.current()}
            aria-label="Close"
            className="-mr-2 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:flex-row sm:justify-end">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

const btn = 'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';
export const dialogButton = {
  primary: `${btn} bg-brand text-white hover:bg-brand-600`,
  secondary: `${btn} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`,
  danger: `${btn} bg-red-600 text-white hover:bg-red-700`,
};
