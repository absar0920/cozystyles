import 'server-only';
import { isUploadKey } from '@/lib/storage/keys';
import { localDiskStorage } from '@/lib/storage/local-disk';

/**
 * Where uploaded files live. Today: the server's own disk (storage/uploads, or UPLOADS_DIR).
 * A cloud backend only has to implement StorageBackend and be returned from getStorage().
 */
export interface StorageBackend {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** null when missing */
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; size: number; contentType: string; mtime: Date } | null>;
  /** missing = no-op */
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Every stored key under `prefix` ('' = all), with its last-modified time. Used only by the orphan sweep. */
  list(prefix?: string): AsyncIterable<{ key: string; mtime: Date }>;
}

export const UPLOAD_URL_PREFIX = '/uploads/';

export { isUploadKey };

export function urlForKey(key: string): string {
  return UPLOAD_URL_PREFIX + key;
}

export function keyFromUrl(url: string): string | null {
  if (typeof url !== 'string' || !url.startsWith(UPLOAD_URL_PREFIX)) return null;
  const key = url.slice(UPLOAD_URL_PREFIX.length).split(/[?#]/)[0];
  return isUploadKey(key) ? key : null;
}

export function getStorage(): StorageBackend {
  return localDiskStorage();
}
