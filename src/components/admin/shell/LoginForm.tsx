'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from '@/app/admin/actions/auth';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { useResultToast } from '@/components/toast/useResultToast';

const INITIAL: LoginState = { error: null };

export function LoginForm({ next = '/admin' }: { next?: string }) {
  const [state, formAction] = useActionState(loginAction, INITIAL);
  useResultToast(state, (s) => (s.error ? { tone: 'error', message: 'Sign-in failed' } : null));

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="admin@example.com"
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-gray-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••••••"
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-gray-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <SubmitButton className="w-full py-2.5">Sign in to Dashboard</SubmitButton>
    </form>
  );
}
