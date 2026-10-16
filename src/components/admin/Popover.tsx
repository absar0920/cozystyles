'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';

/**
 * Shared popover for the admin pickers: anchored under the trigger on wide screens, a bottom sheet on
 * phones (< 640px). Rendered in a portal at z-[60]. Closes on Escape and on a click outside.
 */
export function Popover({
  open,
  anchorRef,
  onClose,
  title,
  width = 360,
  children,
  testId,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  title: string;
  width?: number;
  children: ReactNode;
  testId?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; sheet: boolean; maxH?: number }>({ top: 0, left: 0, sheet: false });
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;
    const update = (next: { top: number; left: number; sheet: boolean; maxH?: number }) =>
      setPos((p) => (p.top === next.top && p.left === next.left && p.sheet === next.sheet && p.maxH === next.maxH ? p : next));
    // Re-placed on scroll, resize and whenever the panel's content grows (e.g. search results arrive), so it
    // always fits on screen: below the trigger when there is room, otherwise above, clamped to the space left.
    const place = () => {
      const sheet = window.innerWidth < 640;
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r || sheet) {
        update({ top: 0, left: 0, sheet: true });
        return;
      }
      const vh = window.innerHeight;
      const w = Math.min(width, window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      const cap = Math.round(vh * 0.7);
      const natural = Math.min(panelRef.current?.scrollHeight ?? 360, cap);
      const spaceBelow = Math.max(0, Math.floor(vh - r.bottom - 6 - 8));
      const spaceAbove = Math.max(0, Math.floor(r.top - 6 - 8));
      if (natural <= spaceBelow || spaceBelow >= spaceAbove) {
        update({ top: Math.round(r.bottom + 6), left, sheet: false, maxH: Math.min(cap, Math.max(spaceBelow, 120)) });
      } else {
        const maxH = Math.min(cap, spaceAbove);
        update({ top: Math.round(r.top - 6 - Math.min(natural, maxH)), left, sheet: false, maxH });
      }
    };
    place();
    const raf = requestAnimationFrame(place);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => place()) : null;
    const observe = () => {
      const panel = panelRef.current;
      if (!ro || !panel) return;
      ro.disconnect();
      ro.observe(panel);
      // the panel's own box is clamped by max-height, so watch its content too
      Array.from(panel.children).forEach((c) => ro.observe(c));
    };
    observe();
    const raf2 = requestAnimationFrame(observe);
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => {
      observe();
      place();
    }) : null;
    if (panelRef.current && mo) mo.observe(panelRef.current, { childList: true, subtree: true });
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(raf2);
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchorRef, width, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        anchorRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      // clicks inside a modal opened from the popover (e.g. a confirm dialog) are not "outside"
      if ((t as Element).closest?.('[role="dialog"]')) return;
      closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, anchorRef]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="z-[60]" data-testid={testId}>
      {pos.sheet && <div className="fixed inset-0 z-[60] bg-black/40" aria-hidden onClick={() => closeRef.current()} />}
      <div
        ref={panelRef}
        role="dialog"
        aria-label={title}
        className={
          pos.sheet
            ? 'fixed inset-x-0 bottom-0 z-[60] max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-2xl'
            : 'fixed z-[60] max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xl'
        }
        style={pos.sheet ? undefined : { top: pos.top, left: pos.left, maxHeight: pos.maxH, width: Math.min(width, typeof window !== 'undefined' ? window.innerWidth - 16 : width) }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink-dark">{title}</p>
          <button
            type="button"
            onClick={() => closeRef.current()}
            aria-label="Close"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
