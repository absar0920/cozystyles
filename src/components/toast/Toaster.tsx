'use client';

import { useEffect, useState } from 'react';
import { dismiss, isToastTone, subscribe, toast, TOAST_COOKIE, TOAST_COOKIE_PATH, type FlashedToast, type Toast, type ToastTone } from './toast';

const TONES: Record<ToastTone, { box: string; icon: string; mark: string }> = {
  success: { box: 'border-emerald-200', icon: 'bg-emerald-600 text-white', mark: '✓' },
  info: { box: 'border-sky-200', icon: 'bg-sky-600 text-white', mark: 'i' },
  warning: { box: 'border-amber-300', icon: 'bg-amber-500 text-white', mark: '!' },
  error: { box: 'border-red-300', icon: 'bg-red-600 text-white', mark: '!' },
};

/** Ids of server toasts already shown: one can come back in the cookie of a request sent just before it was read. */
const shownIds = new Map<string, number>();

function fromBase64Url(value: string): string {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/**
 * Picks up the toasts left by server actions (cookie set by flashToast), then clears the cookie. Only the tab
 * the owner is looking at takes them: another open admin tab would otherwise show (and use up) the message.
 */
function readCookieToasts() {
  if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
  const raw = document.cookie.split('; ').find((c) => c.startsWith(`${TOAST_COOKIE}=`));
  if (!raw) return;
  document.cookie = `${TOAST_COOKIE}=; Max-Age=0; path=${TOAST_COOKIE_PATH}`;
  document.cookie = `${TOAST_COOKIE}=; Max-Age=0; path=/`; // the first version's cookie (lives 30 s)
  const now = Date.now();
  for (const [id, at] of shownIds) if (at < now - 60_000) shownIds.delete(id);
  try {
    const list: unknown = JSON.parse(fromBase64Url(decodeURIComponent(raw.slice(TOAST_COOKIE.length + 1))));
    for (const item of Array.isArray(list) ? (list as Partial<FlashedToast>[]) : []) {
      if (typeof item?.message !== 'string' || typeof item.id !== 'string' || shownIds.has(item.id)) continue;
      shownIds.set(item.id, now);
      toast[isToastTone(item.tone) ? item.tone : 'info'](item.message);
    }
  } catch {
    /* ignore a malformed cookie */
  }
}

/** An open dialog or phone bottom sheet (a closed drawer can stay in the page, hidden). */
function dialogOpen(): boolean {
  return [...document.querySelectorAll('[aria-modal="true"], [data-popover-open]')].some((el) =>
    typeof el.checkVisibility === 'function' ? el.checkVisibility({ checkVisibilityCSS: true }) : el.getClientRects().length > 0,
  );
}

/**
 * The toast stack: bottom-right on computers and bottom-centre on phones, above the admin save bar (and the
 * shop's WhatsApp button), or at the top while a dialog is open. Toasts never block the page: only their close
 * button takes clicks.
 */
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  const [overDialog, setOverDialog] = useState(false);

  useEffect(() => subscribe(setItems), []);

  // Server actions answer with a Set-Cookie; there is no client event for it, so check briefly and often
  // (and as soon as the owner comes back to this tab).
  useEffect(() => {
    readCookieToasts();
    const timer = window.setInterval(readCookieToasts, 400);
    window.addEventListener('focus', readCookieToasts);
    document.addEventListener('visibilitychange', readCookieToasts);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', readCookieToasts);
      document.removeEventListener('visibilitychange', readCookieToasts);
    };
  }, []);

  // a dialog (or a phone's bottom sheet) would be covered by the stack at the bottom: show it at the top then
  // (checked while toasts are on screen, as dialogs open and close)
  const showing = items.length > 0;
  useEffect(() => {
    if (!showing) {
      setOverDialog(false);
      return;
    }
    const check = () => setOverDialog(dialogOpen());
    check();
    const timer = window.setInterval(check, 300);
    return () => window.clearInterval(timer);
  }, [showing]);

  return (
    <section
      aria-label="Notifications"
      data-testid="toaster"
      style={
        overDialog
          ? { top: 'calc(0.75rem + env(safe-area-inset-top))' }
          : // clear of the save bar / undo bar (they publish their height, see useToastClearance)
            { bottom: 'max(calc(6rem + env(safe-area-inset-bottom)), calc(var(--cz-toast-clear, 0px) + 0.75rem))' }
      }
      className="pointer-events-none fixed inset-x-3 z-[90] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end"
    >
      {items.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </section>
  );
}

function ToastItem({ t }: { t: Toast }) {
  const [shown, setShown] = useState(false);
  // the text goes into the (already present) live region a frame later, so screen readers announce it
  const [entered, setEntered] = useState(false);
  const tone = TONES[t.tone];

  // the time on screen starts with the first frame drawn: a toast fired while the tab is in the background
  // waits until the owner comes back (no frames are drawn in a hidden tab)
  useEffect(() => {
    let leave = 0;
    let remove = 0;
    const enter = window.requestAnimationFrame(() => {
      setEntered(true);
      setShown(true);
      leave = window.setTimeout(() => setShown(false), t.duration);
      remove = window.setTimeout(() => dismiss(t.id), t.duration + 250);
    });
    return () => {
      window.cancelAnimationFrame(enter);
      window.clearTimeout(leave);
      window.clearTimeout(remove);
    };
  }, [t.id, t.duration]);

  return (
    <div
      role={t.tone === 'error' || t.tone === 'warning' ? 'alert' : 'status'}
      aria-atomic="true"
      data-testid="toast"
      data-tone={t.tone}
      className={`flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm text-gray-800 shadow-lg shadow-black/10 transition-all duration-200 motion-reduce:transition-none sm:w-[22rem] ${tone.box} ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${tone.icon}`}>
        {tone.mark}
      </span>
      <p className="min-w-0 flex-1 leading-snug">{entered ? t.message : null}</p>
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        aria-label="Close notification"
        className="pointer-events-auto -m-1 shrink-0 rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
      >
        ×
      </button>
    </div>
  );
}
