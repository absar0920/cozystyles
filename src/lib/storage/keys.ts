import 'server-only';

const KEY_RE = /^\d{4}\/\d{2}\/[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}\.webp$/;

/** The only key shape stored or served: "YYYY/MM/<slug>-<8 hex>.webp". */
export function isUploadKey(key: string): boolean {
  return typeof key === 'string' && KEY_RE.test(key);
}
