'use client';

import { useSyncExternalStore } from 'react';
import type { UploadPurpose } from '@/lib/uploads';
import { toast } from '@/components/toast/toast';

export type { UploadPurpose };
export type UploadedImage = { id: number; url: string; width: number; height: number };

export const ACCEPT_IMAGES = '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const TOO_BIG_MESSAGE = 'This photo is bigger than 20 MB. Please choose a smaller one.';

// Uploads in flight on this page. Save buttons wait for them, so a photo still uploading is never lost.
let pendingUploads = 0;
const pendingListeners = new Set<() => void>();
function setPending(delta: number) {
  pendingUploads = Math.max(0, pendingUploads + delta);
  pendingListeners.forEach((l) => l());
}
function subscribePending(l: () => void) {
  pendingListeners.add(l);
  return () => {
    pendingListeners.delete(l);
  };
}
/** Number of photo uploads still in progress anywhere on the page. */
export function usePendingUploads(): number {
  return useSyncExternalStore(subscribePending, () => pendingUploads, () => 0);
}
/** Same count, read outside React (e.g. inside a click handler). */
export function pendingUploadCount(): number {
  return pendingUploads;
}
export const WAITING_FOR_UPLOAD = 'Waiting for the photo to finish uploading…';

/** Uploads one photo to /api/admin/uploads (XHR, for progress). Rejects with the server's plain-English error. */
const CANCELLED = 'The upload was cancelled.';

export function uploadImage(file: File, purpose: UploadPurpose, onProgress?: (pct: number) => void): Promise<UploadedImage> {
  setPending(1);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    setPending(-1);
  };
  return new Promise<UploadedImage>((resolve, reject) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error(TOO_BIG_MESSAGE));
      return;
    }
    const body = new FormData();
    body.append('file', file);
    body.append('purpose', purpose);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/uploads');
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      const res = (xhr.response ?? {}) as { ok?: boolean; error?: string; upload?: UploadedImage };
      if (xhr.status >= 200 && xhr.status < 300 && res.ok && res.upload) {
        onProgress?.(100);
        resolve({ id: res.upload.id, url: res.upload.url, width: res.upload.width, height: res.upload.height });
      } else {
        reject(new Error(res.error || (xhr.status === 413 ? TOO_BIG_MESSAGE : 'The upload failed. Please try again.')));
      }
    };
    xhr.onerror = () => reject(new Error('The upload failed. Check your internet connection and try again.'));
    xhr.onabort = () => reject(new Error(CANCELLED));
    xhr.send(body);
  })
    .then(
      (uploaded) => {
        toast.success('Photo uploaded');
        return uploaded;
      },
      (e: unknown) => {
        if (!(e instanceof Error && e.message === CANCELLED)) toast.error('Photo not uploaded');
        throw e;
      },
    )
    .finally(() => {
      // Count the upload as finished only after the caller has put the photo into its form and that form has
      // re-checked its unsaved state. Otherwise the page looks clean for a moment, the unsaved-changes guard
      // drops its Back-button entry, and the history step reloads the page — losing the new photo.
      window.setTimeout(finish, 150);
    });
}
