'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useFormDirty } from '@/components/admin/UnsavedChangesGuard';
import type { ContentFormState } from '@/app/admin/actions/pages';
import { useResultToast } from '@/components/toast/useResultToast';

type SaveAction = (prev: ContentFormState, fd: FormData) => Promise<ContentFormState>;

const INITIAL_STATE: ContentFormState = { ok: true };

/**
 * `useActionState` + dirty tracking for the page and blog editors. The form is submitted through `onSubmit`
 * (not `<form action>`) so React doesn't reset the fields after a save. After a successful save the form is
 * re-snapshotted, so the unsaved-changes guard and the save bar go quiet, and the status reads "Saved".
 */
export function useEditorSave(action: SaveAction, noun: string) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rawState, formAction, pending] = useActionState(action, INITIAL_STATE);
  // Next.js resolves an action with undefined when its answer is a redirect it could not render: never crash on it
  const state = rawState ?? INITIAL_STATE;
  const router = useRouter();
  const pathname = usePathname();
  // a new row was created: its own edit page is opening (keep the save bar busy until it does)
  const opening = state.ok && state.createdId != null;
  const { dirty, markClean } = useFormDirty(formRef);
  const [savedOnce, setSavedOnce] = useState(false);

  useResultToast(state, (s) =>
    s.ok && s.savedAt ? { tone: 'success', message: s.createdId != null ? `${noun} added` : `${noun} saved` } : null,
  );

  useEffect(() => {
    if (!state.ok || !state.savedAt) return;
    setSavedOnce(true);
    if (state.createdId != null) {
      router.replace(`${pathname.replace(/\/new$/, '')}/${state.createdId}?created=1`, { scroll: false });
      return;
    }
    // let the hidden inputs settle (fields re-render after the action result) before re-snapshotting
    const t = window.setTimeout(markClean, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, markClean]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };

  // a failed save leaves the changes unsaved (the dirty tracker pauses while a save is in flight)
  const failed = !state.ok;

  return {
    formRef,
    onSubmit,
    state,
    pending: pending || opening,
    dirty: dirty || (failed && !pending),
    status: savedOnce && !dirty ? 'Saved. The store is updated.' : undefined,
    fieldError: (field: string) => (!state.ok && state.field === field ? (state.error ?? null) : null),
  };
}
