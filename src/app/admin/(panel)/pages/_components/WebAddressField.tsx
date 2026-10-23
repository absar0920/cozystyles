'use client';

import { useEffect, useRef, useState } from 'react';
import { slugify } from '@/lib/slug';
import { useSiteHost } from '@/lib/use-site-host';
import { Field, FormError } from '@/components/admin/ui';

/**
 * The editable end of a page's web address (shop host + "/pages/" + slug). For a new page it follows the
 * title until the user types in it; `handleTouched` tells the server whether to use the typed value.
 *
 * The input is uncontrolled on purpose: the form's dirty tracker re-renders the editor from a native `input`
 * listener, which would reset a controlled input before React saw the first keystroke.
 */
export function WebAddressField({
  path,
  slug,
  title,
  isNew,
  error,
}: {
  /** the address before the slug, e.g. "/pages/" — shown after the shop's host (NEXT_PUBLIC_SITE_URL) */
  path: string;
  /** the stored slug ('' for a new page) */
  slug: string;
  /** current title, for the automatic address of a new page */
  title: string;
  isNew: boolean;
  error?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const touchedRef = useRef(false);
  const [touched, setTouched] = useState(false);
  const [shown, setShown] = useState(slug);
  const prefix = `${useSiteHost()}${path}`;

  const show = (v: string) => {
    if (inputRef.current) inputRef.current.value = v;
    setShown(v);
  };

  // a save can change the stored slug (made unique); show what was stored
  useEffect(() => {
    touchedRef.current = false;
    setTouched(false);
    if (!isNew) show(slug);
  }, [slug, isNew]);

  // a new page's address follows its title until the user edits it
  useEffect(() => {
    if (isNew && !touchedRef.current) show(slugify(title));
  }, [title, isNew]);

  return (
    <Field
      label="Web address"
      htmlFor="web-address"
      hint={
        isNew
          ? 'Made from the title. Change it only if you need a different address.'
          : 'Changing the web address breaks links that people have saved or shared.'
      }
    >
      <div className="flex min-w-0 items-stretch overflow-hidden rounded-lg border border-gray-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        <span className="hidden shrink-0 items-center bg-gray-50 px-3 text-sm text-gray-500 min-[480px]:flex">{prefix}</span>
        <input
          ref={inputRef}
          id="web-address"
          name="handle"
          defaultValue={slug}
          onChange={(e) => {
            touchedRef.current = true;
            setTouched(true);
            setShown(e.target.value);
          }}
          onBlur={(e) => touchedRef.current && show(slugify(e.target.value))}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 px-3 py-2 text-sm outline-none"
        />
      </div>
      <p className="mt-1 break-all text-xs text-gray-500 min-[480px]:hidden">
        {prefix}
        {shown}
      </p>
      <input type="hidden" name="handleTouched" value={touched ? 'on' : ''} />
      <FormError message={error} />
    </Field>
  );
}
