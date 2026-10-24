'use client';

import { useEffect, type RefObject } from 'react';

/** How far up from the bottom of the screen each mounted bar reaches; the toasts stay above the highest. */
const reach = new Map<number, number>();
let nextId = 1;

function publish() {
  const px = Math.max(0, ...reach.values());
  if (px > 0) document.documentElement.style.setProperty('--cz-toast-clear', `${px}px`);
  else document.documentElement.style.removeProperty('--cz-toast-clear');
}

/**
 * For UI fixed to the bottom of the screen (the save bar, the "Moved · Undo" bar): while `active`, toasts are
 * shown above it instead of over it. Measured from its height and CSS `bottom`, so slide animations don't matter.
 */
export function useToastClearance(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const id = nextId++;
    const measure = () => {
      reach.set(id, el.offsetHeight + (parseFloat(getComputedStyle(el).bottom) || 0));
      publish();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      reach.delete(id);
      publish();
    };
  }, [ref, active]);
}
