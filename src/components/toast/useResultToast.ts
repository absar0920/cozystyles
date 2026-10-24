'use client';

import { useEffect, useRef } from 'react';
import { toast, type ToastTone } from './toast';

/**
 * One toast per action result. useActionState hands back a new state object for every submission, so this
 * fires once per save (not on the first render, and not again on re-renders).
 */
export function useResultToast<S>(state: S, pick: (state: S) => { tone: ToastTone; message: string } | null | undefined) {
  const seen = useRef(state);
  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    const t = pick(state);
    if (t) toast[t.tone](t.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
