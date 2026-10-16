'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { useFormDirty } from '@/components/admin/UnsavedChangesGuard';
import type { ContentFormState } from '@/app/admin/actions/pages';

type SaveAction = (prev: ContentFormState, fd: FormData) => Promise<ContentFormState>;

/**
 * `useActionState` + dirty tracking for the page and blog editors. The form is submitted through `onSubmit`
 * (not `<form action>`) so React doesn't reset the fields after a save. After a successful save the form is
 * re-snapshotted, so the unsaved-changes guard and the save bar go quiet, and the status reads "Saved".
 */
export function useEditorSave(action: SaveAction) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, { ok: true });
  const { dirty, markClean } = useFormDirty(formRef);
  const [savedOnce, setSavedOnce] = useState(false);

  useEffect(() => {
    if (!state.ok || !state.savedAt) return;
    setSavedOnce(true);
    // let the hidden inputs settle (fields re-render after the action result) before re-snapshotting
    const t = window.setTimeout(markClean, 0);
    return () => window.clearTimeout(t);
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
    pending,
    dirty: dirty || (failed && !pending),
    status: savedOnce && !dirty ? 'Saved. The store is updated.' : undefined,
    fieldError: (field: string) => (!state.ok && state.field === field ? (state.error ?? null) : null),
  };
}
