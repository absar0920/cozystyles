'use client';

import { useFormStatus } from 'react-dom';
import { logoutAction } from '@/app/admin/actions/auth';
import { skipSessionCheckBriefly } from '@/components/admin/SessionGuard';

function SubmitInner() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white/80" aria-hidden />
      )}
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

/** Sign-out button for the admin sidebar (posts to the logout server action). */
export function LogoutButton() {
  return (
    <form action={logoutAction} onSubmit={skipSessionCheckBriefly}>
      <SubmitInner />
    </form>
  );
}
