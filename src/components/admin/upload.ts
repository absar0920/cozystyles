/** Client helper for POST /api/admin/uploads. Folder names mirror UPLOAD_FOLDERS in lib/storage. */
export type UploadFolder = 'products' | 'collections' | 'banners' | 'pages';
export type UploadedImage = { url: string; width: number; height: number; bytes: number; name: string };

export const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
const MAX_BYTES = 15 * 1024 * 1024;

export async function uploadImage(file: File, folder: UploadFolder): Promise<UploadedImage> {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 15 MB.`);
  const body = new FormData();
  body.set('folder', folder);
  body.append('file', file);
  const res = await fetch('/api/admin/uploads', { method: 'POST', body });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; files?: UploadedImage[] } | null;
  if (!res.ok || !json?.ok || !json.files?.[0]) {
    throw new Error(json?.error ?? `Upload failed (HTTP ${res.status}).`);
  }
  return json.files[0];
}

/** "alexa_sofa-chair-1.JPG" → "Alexa sofa chair 1" — a starting point for alt text. */
export function altFromFileName(name: string) {
  const words = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1).toLowerCase() : '';
}

/** Files from an input or drop. Not filtered here — the server checks the bytes and explains rejections. */
export function imageFiles(list: FileList | null | undefined) {
  return Array.from(list ?? []);
}
