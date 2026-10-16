'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

/*
 * Keeps an owner's edits when their sign-in has ended (the 12-hour session ran out, or a password change on
 * another device signed this one out) while an editor was open.
 *
 * Every save is a server action: a fetch POST with a `Next-Action` header. Before one is sent, the session is
 * checked (GET /api/admin/session). If it has ended, the save is held — the page and everything typed stay as
 * they are — and a sign-in box opens. Once the owner signs in (here, or in another tab), the held save is sent
 * as if nothing happened. Without this the save would be answered with a redirect to the login page, which
 * either crashes the editor or navigates away, losing the changes.
 */

type GuardedFetch = typeof fetch & { __beforeSessionGuard?: typeof fetch };

const SESSION_URL = '/api/admin/session';

let held: (() => void)[] = [];
const listeners = new Set<() => void>();
let skipUntil = 0;
let baseFetch: typeof fetch | null = null;

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const heldCount = () => held.length;

/** Sign out: the session may already be gone, so don't ask to sign in first. */
export function skipSessionCheckBriefly() {
  skipUntil = Date.now() + 3000;
}

function isServerAction(input: RequestInfo | URL, init?: RequestInit): boolean {
  try {
    const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    return h.has('next-action');
  } catch {
    return false;
  }
}

/** true / false, or null when the check itself failed (offline…): then the save is sent and reports its own error */
async function isSignedIn(): Promise<boolean | null> {
  try {
    const res = await (baseFetch ?? fetch)(SESSION_URL, { cache: 'no-store', credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = (await res.json()) as { signedIn?: boolean };
    return data.signedIn === true;
  } catch {
    return null;
  }
}

function releaseHeld() {
  const waiting = held;
  held = [];
  waiting.forEach((go) => go());
  notify();
}

if (typeof window !== 'undefined') {
  // wrap once (re-wrapped, not stacked, when this module is reloaded in development)
  const original = (window.fetch as GuardedFetch).__beforeSessionGuard ?? window.fetch;
  baseFetch = original;
  const guarded: GuardedFetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    if (!isServerAction(input, init) || Date.now() < skipUntil) return original.call(window, input, init);
    return isSignedIn().then((signedIn) => {
      if (signedIn !== false) return original.call(window, input, init);
      return new Promise<Response>((resolve, reject) => {
        held.push(() => original.call(window, input, init).then(resolve, reject));
        notify();
      });
    });
  };
  guarded.__beforeSessionGuard = original;
  window.fetch = guarded;
}

/** Rendered once by the admin panel layout. Shows the sign-in box while a save is held. */
export function SessionGuard({ email: initialEmail }: { email: string }) {
  const waiting = useSyncExternalStore(subscribe, heldCount, () => 0);
  const open = waiting > 0;
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPassword('');
    const t = window.setTimeout(() => passwordRef.current?.focus(), 0);
    // signed in again in another tab: carry on with the save when the owner comes back to this one
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      void isSignedIn().then((ok) => {
        if (ok) releaseHeld();
      });
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [open]);

  if (!mounted || !open) return null;

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await (baseFetch ?? fetch)(SESSION_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (data.ok) {
        setPassword('');
        releaseHeld();
      } else {
        setError(data.error ?? 'Could not sign in. Please try again.');
      }
    } catch {
      setError('Could not reach the store. Check your internet connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-sm';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="session-expired-dialog"
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <h2 id={titleId} className="font-heading text-lg font-bold text-ink-dark">
          Please sign in again to save
        </h2>
        <p className="mt-2 text-sm text-gray-700">
          You were signed out (this happens after 12 hours, or when your password is changed on another device).
          <strong className="font-semibold"> Your changes are still here</strong> — sign in and they will be saved
          straight away.
        </p>
        <form onSubmit={signIn} className="mt-4 space-y-3" noValidate>
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <div>
            <label htmlFor={`${titleId}-email`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Email address
            </label>
            <input
              id={`${titleId}-email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${titleId}-password`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Password
            </label>
            <input
              id={`${titleId}-password`}
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
            {busy ? 'Signing in…' : 'Sign in and save'}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
