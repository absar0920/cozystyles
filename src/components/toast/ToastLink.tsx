'use client';

import { toast, type ToastTone } from './toast';

/** A plain link (e.g. a file download) that also pops up a toast when clicked; usable from server components. */
export function ToastLink({ tone = 'info', toastMessage, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { tone?: ToastTone; toastMessage: string }) {
  return <a {...props} onClick={() => toast[tone](toastMessage)} />;
}
