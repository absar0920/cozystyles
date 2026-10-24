'use client';

import { useActionState, useEffect, useState } from 'react';
import { changePasswordAction, type ChangePasswordState } from '@/app/admin/actions/auth';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { Field, FormError, Notice } from '@/components/admin/ui';
import { useResultToast } from '@/components/toast/useResultToast';
import { EyeIcon } from '@/components/admin/icons';

const INITIAL: ChangePasswordState = { ok: false, error: null };

function PasswordInput({
  id,
  name,
  value,
  onChange,
  autoComplete,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  invalid?: boolean;
  describedBy?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        required
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`min-h-11 w-full rounded-lg border px-3 py-2 pr-20 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 ${
          invalid ? 'border-red-400' : 'border-gray-300'
        }`}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex min-w-[72px] items-center justify-center gap-1 rounded-r-lg px-3 text-xs font-semibold text-gray-500 hover:text-ink-dark"
      >
        <EyeIcon className="h-4 w-4" />
        {shown ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, INITIAL);
  useResultToast(state, (s) => (s.ok ? { tone: 'success', message: 'Your new password is saved' } : s.error ? { tone: 'error', message: 'Password not changed' } : null));
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  // Clear the fields once the password has changed.
  useEffect(() => {
    if (state.ok) {
      setCurrent('');
      setNext('');
      setConfirm('');
    }
  }, [state]);

  const errorFor = (f: ChangePasswordState['field']) => (state.field === f ? state.error : null);
  const confirmMismatch = confirm !== '' && next !== '' && confirm !== next;

  return (
    <form action={formAction} className="space-y-5" noValidate data-testid="password-form">
      {state.ok && (
        <Notice tone="success" title="Password changed.">
          Other devices have been logged out. You stay signed in here.
        </Notice>
      )}
      {state.error && !state.field && (
        <Notice tone="error">{state.error}</Notice>
      )}

      <Field label="Current password" htmlFor="currentPassword">
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          invalid={!!errorFor('current')}
          describedBy={errorFor('current') ? 'currentPassword-error' : undefined}
        />
        <span id="currentPassword-error">
          <FormError message={errorFor('current')} />
        </span>
      </Field>

      <Field label="New password" htmlFor="newPassword" hint="At least 10 characters.">
        <PasswordInput
          id="newPassword"
          name="newPassword"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          invalid={!!errorFor('next')}
          describedBy={errorFor('next') ? 'newPassword-error' : undefined}
        />
        <span id="newPassword-error">
          <FormError message={errorFor('next')} />
        </span>
      </Field>

      <Field label="Confirm new password" htmlFor="confirmPassword" hint="Type the new password again.">
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          invalid={!!errorFor('confirm') || confirmMismatch}
          describedBy="confirmPassword-error"
        />
        <span id="confirmPassword-error">
          <FormError message={errorFor('confirm') ?? (confirmMismatch ? 'The two new passwords do not match yet.' : null)} />
        </span>
      </Field>

      <SubmitButton className="min-h-11 w-full sm:w-auto">Change password</SubmitButton>
    </form>
  );
}
