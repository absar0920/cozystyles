'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ConfirmDialog } from './ConfirmDialog';
import { TrashIcon } from './icons';

export type ConfirmDeleteProps = {
  action: (formData: FormData) => void | Promise<void>;
  /** hidden inputs (e.g. { id: '12' }) */
  fields: Record<string, string>;
  /** "Delete “Alexa Sofa Chair”?" */
  title: string;
  /** bullets: what will be lost (computed by the caller) */
  consequences: string[];
  /** default "Delete permanently" */
  confirmLabel?: string;
  /** default "Delete" */
  triggerLabel?: string;
  trigger?: 'button' | 'icon' | 'link';
  disabled?: boolean;
  disabledReason?: string;
};

function SubmitDelete({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending && <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
      {pending ? 'Deleting…' : label}
    </button>
  );
}

/**
 * A delete button that asks first and says what will be lost. The confirm button submits its own
 * <form action={action}> rendered in a portal, so the trigger is safe inside an edit page's form.
 */
export function ConfirmDelete({
  action,
  fields,
  title,
  consequences,
  confirmLabel = 'Delete permanently',
  triggerLabel = 'Delete',
  trigger = 'button',
  disabled,
  disabledReason,
}: ConfirmDeleteProps) {
  const [open, setOpen] = useState(false);
  const triggerClass =
    trigger === 'icon'
      ? 'inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600'
      : trigger === 'link'
        ? 'inline-flex min-h-10 items-center text-sm font-semibold text-red-600 hover:underline'
        : 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50';

  return (
    <>
      <button
        type="button"
        data-testid="confirm-delete"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        aria-label={trigger === 'icon' ? triggerLabel : undefined}
        className={`${triggerClass} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {trigger === 'icon' ? <TrashIcon className="h-[18px] w-[18px]" /> : triggerLabel}
      </button>
      {disabled && disabledReason && trigger !== 'icon' && <span className="ml-2 text-xs text-gray-500">{disabledReason}</span>}
      <ConfirmDialog
        open={open}
        title={title}
        consequences={consequences}
        confirmLabel={confirmLabel}
        tone="danger"
        note="This can't be undone."
        onConfirm={() => undefined}
        onCancel={() => setOpen(false)}
        renderConfirm={(className) => (
          <form action={action} className="contents">
            {Object.entries(fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <SubmitDelete label={confirmLabel} className={className} />
          </form>
        )}
      />
    </>
  );
}
