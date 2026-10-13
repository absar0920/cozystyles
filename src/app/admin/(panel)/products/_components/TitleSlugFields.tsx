'use client';

import { useState } from 'react';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

/**
 * Title + handle pair. When `auto` is set (create mode) the handle slugifies the
 * title live until the handle is manually edited; after that it stays untouched.
 */
export function TitleSlugFields({
  initialTitle = '',
  initialHandle = '',
  auto = false,
}: {
  initialTitle?: string;
  initialHandle?: string;
  auto?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [handle, setHandle] = useState(initialHandle);
  const [handleEdited, setHandleEdited] = useState(!auto);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          required
          value={title}
          onChange={(e) => {
            const v = e.target.value;
            setTitle(v);
            if (!handleEdited) setHandle(slugify(v));
          }}
          placeholder="e.g. Alexa Sofa Chair"
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Handle (URL slug)</label>
        <input
          name="handle"
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value);
            setHandleEdited(true);
          }}
          placeholder="auto-generated-from-title"
          className={inputCls}
        />
        <p className="mt-1 text-xs text-gray-400">
          Store URL: <span className="font-mono text-gray-500">/products/{handle || '…'}</span>
        </p>
      </div>
    </div>
  );
}
