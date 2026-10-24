'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePendingUploads } from './upload-client';
// SessionGuard wraps window.fetch when its module runs. Importing it here makes it run before this module's own
// wrapper, so the save tracker below is always the outer wrapper and counts a save from the click. With the
// order reversed (it depended on script load order), the tracker only saw a save after the session check, the
// guard's history.back() ran in between and the router dropped the save's result (F02-2).
import './SessionGuard';

const DEFAULT_MESSAGE = 'You have unsaved changes. Leave this page and lose them?';

const SENTINEL = '__unsavedGuard';

/** set while the guard's own `history.back()` (dropping the extra entry) has not landed yet */
let dropping: Promise<void> | null = null;

function dropSentinel() {
  dropping = new Promise<void>((resolve) => {
    const done = () => {
      window.removeEventListener('popstate', done);
      window.clearTimeout(t);
      dropping = null;
      resolve();
    };
    const t = window.setTimeout(done, 1000);
    window.addEventListener('popstate', done);
  });
  window.history.back();
}

/*
 * Dropping the extra entry is a real `history.back()`, and the Next.js router treats it as a Back navigation.
 * If a server action (a save) is still running at that moment, the router discards the action's result and
 * refetches the page — possibly before the save has written, so the page shows the old data (e.g. a new
 * banner stays missing from the list until a reload). Forms become "clean" the moment they submit, so the
 * drop waits until no server action is in flight. Server actions are fetch POSTs with a `Next-Action` header.
 * A navigation started right after a save (a new product moving to its own page) would be cancelled the same
 * way, so router page fetches (`RSC` header) count too; once one lands the address has changed and the drop
 * is skipped.
 */
let actionsInFlight = 0;
let idleWaiters: (() => void)[] = [];
/** guards currently dirty on this page; a waiting drop is skipped when one is armed again */
let armedGuards = 0;
let dropScheduled = false;

/** A server action (save), or a router navigation / refresh fetching the page (not a link prefetch). */
function isRouterWork(init?: RequestInit): boolean {
  try {
    if (!init?.headers) return false;
    const h = new Headers(init.headers);
    return h.has('next-action') || (h.has('rsc') && !h.has('next-router-prefetch'));
  } catch {
    return false;
  }
}

type TrackedFetch = typeof fetch & { __untracked?: typeof fetch };

if (typeof window !== 'undefined') {
  // wrap the browser's own fetch (re-wrapped, not stacked, when this module is reloaded in development)
  const original = (window.fetch as TrackedFetch).__untracked ?? window.fetch;
  const tracked: TrackedFetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    const p = original.call(window, input, init);
    if (!isRouterWork(init)) return p;
    actionsInFlight++;
    const settle = () =>
      // the router still decodes and commits the response (and may start a navigation) after the body arrives
      window.setTimeout(() => {
        actionsInFlight--;
        if (actionsInFlight === 0) {
          const waiters = idleWaiters;
          idleWaiters = [];
          waiters.forEach((w) => w());
        }
      }, 500);
    p.then((res) => res.clone().arrayBuffer()).then(settle, settle);
    return p;
  };
  tracked.__untracked = original;
  window.fetch = tracked;
}

/** a full page load has started (typed address, reload): a late `history.back()` would cancel it */
let unloading = false;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    unloading = true;
    // the page stayed (another prompt was cancelled)
    window.setTimeout(() => (unloading = false), 5000);
  });
}

function whenActionsIdle(fn: () => void) {
  // one tick first: a submit starts its fetch in the same task that makes the form clean
  window.setTimeout(() => (actionsInFlight === 0 ? fn() : idleWaiters.push(fn)), 0);
}

function scheduleDrop(guardedHref: string) {
  if (dropScheduled) return;
  dropScheduled = true;
  // Back pressed before the drop ran: that step only left the extra entry, so take the step the user meant
  const onUserBack = () => {
    if (!dropScheduled || armedGuards > 0 || onSentinel() || window.location.href !== guardedHref) return;
    dropScheduled = false;
    window.removeEventListener('popstate', onUserBack);
    window.history.back();
  };
  window.addEventListener('popstate', onUserBack);
  whenActionsIdle(() => {
    window.removeEventListener('popstate', onUserBack);
    if (!dropScheduled) return;
    dropScheduled = false;
    if (!unloading && armedGuards === 0 && !dropping && onSentinel() && window.location.href === guardedHref) dropSentinel();
  });
}

/**
 * The extra entry this page pushed and is still on. Tracked here as well as in `history.state`, because the
 * router replaces the state object after a save (wiping our flag) while the entry itself stays.
 */
let sentinelHref: string | null = null;
/**
 * Every `history.pushState` (ours and the router's) is counted; a later push means the owner navigated on, a
 * replace does not. Not `history.length`: browsers stop it at 50, so in a long session every later page at the
 * same address looked like the extra entry and the late drop sent a fresh New page back to the list.
 */
let pushCount = 0;
let sentinelPush = -1;
type CountedPush = History['pushState'] & { __uncounted?: History['pushState'] };
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => (sentinelHref = null));
  const original = (window.history.pushState as CountedPush).__uncounted ?? window.history.pushState;
  const counted: CountedPush = function (this: History, ...args: Parameters<History['pushState']>) {
    pushCount++;
    return original.apply(this, args);
  };
  counted.__uncounted = original;
  window.history.pushState = counted;
}

function onSentinel(): boolean {
  if (sentinelHref !== null && sentinelHref === window.location.href && sentinelPush === pushCount) return true;
  const st = window.history.state as Record<string, unknown> | null;
  return !!st && st[SENTINEL] === true;
}

/**
 * While `dirty`: warns before closing/reloading the tab (beforeunload), before following any same-origin
 * link (capture-phase click listener → window.confirm; cancelling stops the navigation), and before the
 * browser Back button / Android back gesture (an extra history entry for the same page is pushed; stepping
 * back off it asks first, and cancelling pushes it again). The extra entry is removed once the form is clean.
 */
export function UnsavedChangesGuard({ dirty, message = DEFAULT_MESSAGE }: { dirty: boolean; message?: string }): null {
  // A photo still uploading is not in the form yet, so closing the tab or following a link now would lose it.
  // Only those two are guarded for it: adding and dropping the Back-button entry around every upload makes
  // router history steps that reset the editor and lose the photo. Once it lands the form is dirty anyway.
  const uploading = usePendingUploads() > 0;
  useEffect(() => {
    if (!uploading || dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      if (new URL(a.href, window.location.href).origin !== window.location.origin) return;
      if (!window.confirm('A photo is still uploading. Leave this page and lose it?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [uploading, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // same page, only the hash changes: nothing is lost
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    // Back button: client-side history steps don't unload the page, so guard them with a sentinel entry.
    const guardedHref = window.location.href;
    const pushSentinel = () => {
      window.history.pushState({ ...(window.history.state ?? {}), [SENTINEL]: true }, '', guardedHref);
      sentinelHref = guardedHref;
      sentinelPush = pushCount;
    };
    let leaving = false;
    let active = true;
    if (dropping) {
      // dirty again before the previous extra entry was dropped: push a fresh one once that lands
      void dropping.then(() => {
        if (active && !onSentinel() && window.location.href === guardedHref) pushSentinel();
      });
    } else if (!onSentinel()) pushSentinel();
    const onPopState = () => {
      if (leaving || dropping || onSentinel()) return;
      // stepped back more than one entry (long-press history menu): the app is already leaving
      if (window.location.href !== guardedHref) return;
      if (window.confirm(message)) {
        leaving = true;
        window.history.back();
      } else {
        pushSentinel();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    armedGuards++;
    return () => {
      armedGuards--;
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
      // clean again (saved / reverted) while still on this page: drop the extra entry
      active = false;
      if (!leaving && !dropping && onSentinel() && window.location.href === guardedHref) scheduleDrop(guardedHref);
    };
  }, [dirty, message]);
  return null;
}

function serialize(form: HTMLFormElement): string {
  const parts: string[] = [];
  new FormData(form).forEach((value, key) => {
    parts.push(`${key}=${typeof value === 'string' ? value : `[file:${value.name}:${value.size}]`}`);
  });
  return parts.join('\u0000');
}

function useDirtyForForm(getForm: () => HTMLFormElement | null) {
  const [dirty, setDirty] = useState(false);
  const snapshot = useRef<string | null>(null);
  const submitting = useRef(false);
  const getFormRef = useRef(getForm);
  getFormRef.current = getForm;

  const markClean = useCallback(() => {
    const form = getFormRef.current();
    submitting.current = false;
    snapshot.current = form ? serialize(form) : null;
    setDirty(false);
  }, []);

  useEffect(() => {
    const form = getFormRef.current();
    if (!form) return;
    // after mount: client children have rendered their hidden inputs
    const t = window.setTimeout(() => {
      snapshot.current = serialize(form);
    }, 0);
    let pending: number | undefined;
    // Deferred: setting state synchronously inside a native input listener re-renders before React handles
    // the same event, which resets a controlled input and loses the first keystroke.
    const check = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => {
        if (submitting.current || snapshot.current == null) return;
        setDirty(serialize(form) !== snapshot.current);
      }, 0);
    };
    const onSubmit = () => {
      submitting.current = true;
      setDirty(false);
    };
    form.addEventListener('input', check);
    form.addEventListener('change', check);
    form.addEventListener('submit', onSubmit);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(pending);
      form.removeEventListener('input', check);
      form.removeEventListener('change', check);
      form.removeEventListener('submit', onSubmit);
    };
  }, []);

  return { dirty, markClean };
}

/**
 * Dirty state of a form: snapshots `new FormData(form)` after mount and compares on bubbling input/change
 * events (the shared hidden-input components dispatch `input` after user changes). Submitting the form
 * clears it; call `markClean()` after a successful useActionState save to re-snapshot.
 */
export function useFormDirty(formRef: React.RefObject<HTMLFormElement | null>): { dirty: boolean; markClean: () => void } {
  return useDirtyForForm(() => formRef.current);
}

/** For a server-rendered <form id=…>: tracks its dirty state and guards navigation. */
export function FormDirtyGuard({ formId, message }: { formId: string; message?: string }): null {
  const { dirty } = useDirtyForForm(() => document.getElementById(formId) as HTMLFormElement | null);
  return UnsavedChangesGuard({ dirty, message });
}
