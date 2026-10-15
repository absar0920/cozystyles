'use client';

import { useRef, useState } from 'react';

/**
 * Pointer drag/swipe for a transform-based carousel track (Flickity "draggable").
 * `offset` is the live drag distance in px; `onRelease(dx)` fires when the pointer lets go.
 * Clicks that end a drag are swallowed so links inside slides don't navigate.
 */
export function useDragTrack(onRelease: (dx: number) => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const horizontal = useRef(false);
  const swallow = useRef(false);
  const [offset, setOffset] = useState(0);

  const end = (clientX: number) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = clientX - s.x;
    setOffset(0);
    swallow.current = horizontal.current && Math.abs(dx) > 6;
    horizontal.current = false;
    if (Math.abs(dx) > 6) onRelease(dx);
  };

  return {
    offset,
    dragging: offset !== 0,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        horizontal.current = false;
      },
      onPointerMove: (e: React.PointerEvent) => {
        const s = start.current;
        if (!s) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (!horizontal.current) {
          if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
          horizontal.current = true;
          (e.currentTarget as Element).setPointerCapture?.(s.id);
        }
        setOffset(dx);
      },
      onPointerUp: (e: React.PointerEvent) => end(e.clientX),
      onPointerCancel: () => {
        start.current = null;
        horizontal.current = false;
        setOffset(0);
      },
      onClickCapture: (e: React.MouseEvent) => {
        if (swallow.current) {
          e.preventDefault();
          e.stopPropagation();
          swallow.current = false;
        }
      },
      onDragStart: (e: React.DragEvent) => e.preventDefault(),
    },
  };
}
