'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { CopyIcon, TrashIcon } from '@/components/admin/icons';
import { deleteProductAction, duplicateProductAction, productDeleteInfoAction } from '@/app/admin/actions/products';
import { toast } from '@/components/toast/toast';
import { actionFailed, NETWORK_ERROR } from '@/components/admin/action-failed';

function SubmitDelete({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? 'Deleting…' : 'Delete permanently'}
    </button>
  );
}

const iconBtn = 'inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-ink-dark disabled:opacity-40';

/** Duplicate + Delete for one row of the products list. The delete bullets are loaded when the dialog opens. */
export function ProductRowActions({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'dup' | 'del' | null>(null);
  const [bullets, setBullets] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const duplicate = async () => {
    setBusy('dup');
    const res = await duplicateProductAction(id).catch(actionFailed);
    setBusy(null);
    if (res.ok) router.push(`/admin/products/${res.id}?duplicated=1`);
    else {
      setError(res.error);
      toast.error('Copy not made');
    }
  };

  const askDelete = async () => {
    setBusy('del');
    const b = await productDeleteInfoAction(id).catch((e: unknown) => {
      actionFailed(e); // a redirect (signed out) goes through
      return undefined;
    });
    setBusy(null);
    if (b) setBullets(b);
    else if (b === undefined) {
      setError(NETWORK_ERROR);
      toast.error('Could not reach the store');
    } else {
      setError('This product no longer exists.');
      toast.error('Product not found');
    }
  };

  return (
    <span className="inline-flex items-center">
      <button type="button" onClick={duplicate} disabled={busy != null} aria-label={`Duplicate ${title}`} title="Duplicate" className={iconBtn}>
        <CopyIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={askDelete}
        disabled={busy != null}
        aria-label={`Delete ${title}`}
        title="Delete"
        data-testid="confirm-delete"
        className={`${iconBtn} hover:bg-red-50 hover:text-red-600`}
      >
        <TrashIcon className="h-4 w-4" />
      </button>
      {error && (
        <span role="alert" className="ml-1 text-xs text-red-600">
          {error}
        </span>
      )}
      <ConfirmDialog
        open={bullets != null}
        title={`Delete “${title}”?`}
        consequences={bullets ?? []}
        confirmLabel="Delete permanently"
        tone="danger"
        note="This can't be undone."
        onConfirm={() => undefined}
        onCancel={() => setBullets(null)}
        renderConfirm={(className) => (
          <form action={deleteProductAction} className="contents">
            <input type="hidden" name="id" value={id} />
            <SubmitDelete className={className} />
          </form>
        )}
      />
    </span>
  );
}
