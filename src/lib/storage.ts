import { createHash } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Admin image uploads.
 *
 * Files are normalised to WebP (auto-rotated, metadata stripped, capped in size) and written to
 * UPLOAD_DIR under `<folder>/<yyyy>/<mm>/<name>-<contenthash>.webp`. The content hash makes every
 * URL immutable, so the app and any CDN in front of it can cache uploads forever.
 *
 * UPLOAD_DIR must live outside the deployed app folder in production — Hostinger replaces the
 * build directory on every deploy.
 */

export const UPLOAD_FOLDERS = ['products', 'collections', 'banners', 'pages'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/** Longest edge per folder: banners are full-bleed, everything else tops out at product-zoom size. */
const MAX_EDGE: Record<UploadFolder, number> = { products: 1800, collections: 1200, banners: 2400, pages: 1600 };

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff']);

export function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || 'uploads');
}

/** Public URL prefix stored in the database. Defaults to the app's own /uploads route. */
function publicBase() {
  return (process.env.UPLOAD_PUBLIC_URL || '/uploads').replace(/\/+$/, '');
}

export class UploadError extends Error {}

export function isUploadFolder(v: unknown): v is UploadFolder {
  return typeof v === 'string' && (UPLOAD_FOLDERS as readonly string[]).includes(v);
}

const slugify = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';

export type StoredImage = { url: string; width: number; height: number; bytes: number; name: string };

export async function storeImage(file: File, folder: UploadFolder): Promise<StoredImage> {
  if (process.env.NODE_ENV === 'production' && !process.env.UPLOAD_DIR) {
    throw new UploadError('UPLOAD_DIR is not configured on the server, so uploads would be lost on the next deploy.');
  }
  if (file.size === 0) throw new UploadError(`${file.name} is empty.`);
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(`${file.name} is larger than 15 MB.`);

  const input = Buffer.from(await file.arrayBuffer());
  // Trust the decoded bytes, not the browser-reported MIME type or extension.
  const meta = await sharp(input).metadata().catch(() => null);
  if (!meta?.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new UploadError(`${file.name} is not a supported image (use JPG, PNG, WebP, GIF or AVIF).`);
  }

  const max = MAX_EDGE[folder];
  const { data, info } = await sharp(input, { animated: meta.format === 'gif' })
    .rotate()
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const hash = createHash('sha256').update(data).digest('hex').slice(0, 12);
  const now = new Date();
  const rel = path.posix.join(
    folder,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'),
    `${slugify(file.name)}-${hash}.webp`,
  );
  const abs = path.join(uploadDir(), rel);
  await mkdir(path.dirname(abs), { recursive: true });
  // Same bytes → same name, so a re-upload of an identical image is a no-op.
  const exists = await stat(abs).then(() => true, () => false);
  if (!exists) await writeFile(abs, data);

  return {
    url: `${publicBase()}/${rel}`,
    width: info.width,
    height: info.pageHeight ?? info.height,
    bytes: data.length,
    name: file.name,
  };
}
