'use client';

import { useEffect } from 'react';
import { toast, type ToastTone } from './toast';

/** Shows a toast when it appears (and again if `message` changes): lets a server-rendered page pop one up. */
export function ToastOnMount({ tone, message }: { tone: ToastTone; message: string }) {
  useEffect(() => {
    toast[tone](message);
  }, [tone, message]);
  return null;
}
