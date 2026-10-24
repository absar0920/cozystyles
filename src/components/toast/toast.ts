/**
 * Toast notifications: short, self-dismissing confirmations ("Product saved", "Banner hidden from the store")
 * shown by <Toaster /> (root layout) on top of the inline messages pages already show.
 *
 *   toast.success('Product saved')        // from any client code
 *   flashToast('success', 'Page published') // from a server action (src/components/toast/server.ts)
 *
 * Toast texts are short summaries, deliberately different from the inline notices ("Saved. The store is
 * updated."), so a page never shows the same sentence twice.
 */

export type ToastTone = 'success' | 'error' | 'info' | 'warning';
export type Toast = { id: number; tone: ToastTone; message: string; duration: number };
/** One toast left in the cookie by a server action (see server.ts). */
export type FlashedToast = { id: string; tone: ToastTone; message: string };

/** Server actions leave toasts for the browser in this cookie (read and cleared by <Toaster />). */
export const TOAST_COOKIE = 'cz_toast';
/** Only admin actions leave toasts: shop tabs never see (or use up) the cookie. */
export const TOAST_COOKIE_PATH = '/admin';

const DURATIONS: Record<ToastTone, number> = { success: 4000, info: 4500, warning: 6500, error: 7500 };
/** The same toast twice within this window is shown once (effects can fire twice). */
const DEDUPE_MS = 1500;
const MAX_VISIBLE = 4;

let nextId = 1;
let toasts: Toast[] = [];
const recent = new Map<string, number>();
const listeners = new Set<(t: Toast[]) => void>();

function emit() {
  for (const l of listeners) l(toasts);
}

export function subscribe(listener: (t: Toast[]) => void): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function show(tone: ToastTone, message: string, opts: { duration?: number } = {}): number | null {
  const text = message.trim();
  if (!text) return null;
  const key = `${tone}:${text}`;
  const now = Date.now();
  for (const [k, at] of recent) if (at <= now - DEDUPE_MS) recent.delete(k);
  if (recent.has(key)) return null;
  recent.set(key, now);
  const t: Toast = { id: nextId++, tone, message: text, duration: opts.duration ?? DURATIONS[tone] };
  toasts = [...toasts, t].slice(-MAX_VISIBLE);
  emit();
  return t.id;
}

export const toast = Object.assign((message: string, opts?: { duration?: number }) => show('info', message, opts), {
  success: (message: string, opts?: { duration?: number }) => show('success', message, opts),
  error: (message: string, opts?: { duration?: number }) => show('error', message, opts),
  info: (message: string, opts?: { duration?: number }) => show('info', message, opts),
  warning: (message: string, opts?: { duration?: number }) => show('warning', message, opts),
});

export function isToastTone(v: unknown): v is ToastTone {
  return v === 'success' || v === 'error' || v === 'info' || v === 'warning';
}
