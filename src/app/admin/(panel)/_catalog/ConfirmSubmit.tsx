'use client';

import type { ReactNode } from 'react';

/** Submit button that asks for a JS confirm() before running the surrounding form's server action. */
export function ConfirmSubmit({
  message,
  children,
  className = '',
  title,
}: {
  message: string;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="submit"
      title={title}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
