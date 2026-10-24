'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ToastOnMount } from '@/components/toast/ToastOnMount';

/** Something went wrong on an admin page: a calm message instead of the browser's "Application error". */
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // On a "New …" page (/admin/collections/new, /admin/blog/new…) the error may have come right after Create, when
  // the item was already saved: reloading opens an empty form again, so point to the list before it is re-entered.
  const pathname = usePathname() ?? '';
  const list = /^\/admin\/[a-z-]+\/new$/.test(pathname) ? pathname.slice(0, -'/new'.length) : null;

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
      <ToastOnMount tone="error" message="That didn’t work" />
      <h1 className="font-heading text-lg font-bold text-ink-dark">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-600">
        This page could not finish loading. Please try again. If it keeps happening, reload the page or sign in again.
      </p>
      {list && (
        <p className="mt-2 text-sm text-gray-600">
          If you had just clicked Create, it may already be saved. Open the list to check before adding it again.
        </p>
      )}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Reload the page
        </button>
        {list ? (
          <a
            href={list}
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-brand hover:underline"
          >
            Open the list
          </a>
        ) : (
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-brand hover:underline"
          >
            Go to the dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
