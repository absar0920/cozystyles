'use client';

import { useEffect, useState } from 'react';

/**
 * Infinite ("wrapAround") position for a track that renders its `count` items three times.
 * `pos` indexes the tripled list and lives in the middle copy at rest; after a transition ends
 * outside the middle copy it jumps back by one copy with transitions disabled.
 */
export function useWrapPosition(count: number) {
  const [pos, setPos] = useState(count);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    if (animate) return;
    // Re-enable transitions only after the instant jump has painted.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setAnimate(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [animate]);

  const normalize = () => {
    if (count === 0) return;
    if (pos < count || pos >= 2 * count) {
      setAnimate(false);
      setPos((((pos - count) % count) + count) % count + count);
    }
  };

  return {
    pos,
    animate,
    /** Index of the current item in the original list. */
    current: count ? (((pos - count) % count) + count) % count : 0,
    move: (steps: number) => {
      const s = Math.max(-(count - 1), Math.min(count - 1, steps));
      setAnimate(true);
      setPos((p) => p + s);
    },
    goTo: (i: number) => {
      setAnimate(true);
      setPos(count + i);
    },
    onTransitionEnd: (e: React.TransitionEvent) => {
      if (e.target === e.currentTarget) normalize();
    },
  };
}
