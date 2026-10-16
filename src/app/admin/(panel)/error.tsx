'use client';

import Link from 'next/link';

/** Something went wrong on an admin page: a calm message instead of the browser's "Application error". */
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
      <h1 className="font-heading text-lg font-bold text-ink-dark">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-600">
        This page could not finish loading. Please try again. If it keeps happening, reload the page or sign in again.
      </p>
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
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-brand hover:underline"
        >
          Go to the dashboard
        </Link>
      </div>
    </div>
  );
}
