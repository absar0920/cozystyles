import 'server-only';
import { randomBytes } from 'node:crypto';
import sharp, { type OutputInfo, type Sharp } from 'sharp';
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/slug';
import { UPLOAD_URL_PREFIX, getStorage, keyFromUrl, urlForKey } from '@/lib/storage';

/**
 * Image upload pipeline: sniff → (HEIC decode) → sharp (rotate, resize, WebP, no metadata) → Upload row → storage.
 * Plus reference tracking: a stored upload is deleted once nothing in the database points at it. SPEC §3.
 */

export type UploadPurpose = 'product' | 'swatch' | 'banner' | 'collection' | 'blog' | 'editor';
export const UPLOAD_PURPOSES: readonly UploadPurpose[] = ['product', 'swatch', 'banner', 'collection', 'blog', 'editor'];
export type StoredImage = { id: number; url: string; width: number; height: number; bytes: number };

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_INPUT_PIXELS = 270_000_000;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export class UploadError extends Error {
  constructor(
    public status: 400 | 413 | 415 | 422 | 429,
    message: string,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

const MSG_TOO_BIG = 'This photo is bigger than 20 MB. Please choose a smaller one.';
const MSG_TYPE = 'Only JPG, PNG, WebP or iPhone (HEIC) photos can be uploaded.';
const MSG_PIXELS = 'This photo is too large in pixels. Please resize it below 200 megapixels and try again.';
const MSG_UNREADABLE = 'This photo could not be read. Try exporting it as JPG.';

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

export function sniffImageType(head: Uint8Array): 'jpeg' | 'png' | 'webp' | 'heic' | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => head[i] === b)) return 'png';
  if (head.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (head.length >= 12 && ascii(4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(8, 12))) return 'heic';
  return null;
}

/** HEIC decodes use hundreds of MB each, so they run one at a time per process. */
let heicQueue: Promise<unknown> = Promise.resolve();
function decodeHeic(buf: Buffer): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const run = heicQueue.then(async () => {
    const { default: decode } = await import('heic-decode');
    return decode({ buffer: buf });
  });
  heicQueue = run.catch(() => undefined);
  return run;
}

function newKey(originalName: string): string {
  const now = new Date();
  const base = originalName.replace(/\.[^.]*$/, '');
  const slug = slugify(base, 40).replace(/-+$/g, '') || 'photo';
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}/${month}/${slug}-${randomBytes(4).toString('hex')}.webp`;
}

export async function storeUploadedImage(file: File, purpose: UploadPurpose): Promise<StoredImage> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(413, MSG_TOO_BIG);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_UPLOAD_BYTES) throw new UploadError(413, MSG_TOO_BIG);
  const type = sniffImageType(buf.subarray(0, 32));
  if (!type) throw new UploadError(415, MSG_TYPE);

  let input: Sharp;
  if (type === 'heic') {
    let decoded;
    try {
      decoded = await decodeHeic(buf);
    } catch {
      throw new UploadError(422, MSG_UNREADABLE);
    }
    if (decoded.width * decoded.height > MAX_INPUT_PIXELS) throw new UploadError(422, MSG_PIXELS);
    input = sharp(Buffer.from(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength), {
      raw: { width: decoded.width, height: decoded.height, channels: 4 },
      limitInputPixels: MAX_INPUT_PIXELS,
    });
  } else {
    input = sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' });
  }

  const maxSide = purpose === 'swatch' ? 400 : 2000;
  let out: { data: Buffer; info: OutputInfo };
  try {
    // .rotate() applies EXIF orientation; metadata (EXIF, GPS) is dropped because withMetadata() is never called.
    out = await input
      .rotate()
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch (e) {
    if (/pixel limit/i.test((e as Error).message ?? '')) throw new UploadError(422, MSG_PIXELS);
    throw new UploadError(422, MSG_UNREADABLE);
  }

  const key = newKey(file.name || 'photo');
  const url = urlForKey(key);
  const row = await prisma.upload.create({
    data: {
      key,
      url,
      originalName: (file.name || '').slice(0, 200),
      mime: 'image/webp',
      width: out.info.width,
      height: out.info.height,
      bytes: out.data.length,
      purpose,
    },
  });
  try {
    await getStorage().put(key, out.data, 'image/webp');
  } catch (e) {
    await prisma.upload.delete({ where: { id: row.id } }).catch(() => undefined);
    throw e;
  }
  return { id: row.id, url, width: row.width, height: row.height, bytes: row.bytes };
}

/** Every "/uploads/…" URL in src/href attributes of an HTML string. */
export function extractUploadUrls(html: string): string[] {
  if (!html) return [];
  const out = new Set<string>();
  for (const m of html.matchAll(/\s(?:src|href)\s*=\s*["']((?:https?:\/\/[^/"']+)?\/uploads\/[^"'?#\s]+)/gi)) {
    out.add(m[1].replace(/^https?:\/\/[^/]+/i, ''));
  }
  return [...out];
}

/** True when any stored record still points at `url`. Any new image column must be added here (SPEC §3.3). */
export async function isUploadReferenced(url: string): Promise<boolean> {
  const checks = await Promise.all([
    prisma.productImage.count({ where: { src: url } }),
    prisma.productOptionValue.count({ where: { swatchImage: url } }),
    prisma.collection.count({ where: { OR: [{ image: url }, { description: { contains: url } }] } }),
    prisma.collectionIndexCard.count({ where: { systemImage: url } }),
    prisma.banner.count({ where: { OR: [{ image: url }, { mobileImage: url }] } }),
    prisma.page.count({ where: { OR: [{ featuredImage: url }, { bodyHtml: { contains: url } }] } }),
    prisma.product.count({ where: { bodyHtml: { contains: url } } }),
    prisma.siteSetting.count({ where: { value: { contains: url } } }),
  ]);
  return checks.some((n) => n > 0);
}

/**
 * Deletes every upload in `urls` that nothing references any more. Anything not under /uploads/ (bundled
 * /images/…) is ignored. Call after the save transaction commits. Returns the number of files deleted.
 */
export async function releaseUploads(urls: Iterable<string>): Promise<number> {
  const storage = getStorage();
  let deleted = 0;
  for (const url of new Set(urls)) {
    if (typeof url !== 'string' || !url.startsWith(UPLOAD_URL_PREFIX)) continue;
    const key = keyFromUrl(url);
    if (!key) continue;
    try {
      if (await isUploadReferenced(url)) continue;
      await storage.delete(key);
      await prisma.upload.deleteMany({ where: { key } });
      deleted++;
    } catch (e) {
      console.error(`releaseUploads: could not delete ${url}`, e);
    }
  }
  return deleted;
}

let lastSweepAt = 0;

/**
 * Removes uploads that are older than `minAgeMs` (default 24 h) and unreferenced: first by Upload row, then by
 * reconciling the disk (files with no row). Throttled to once an hour per process unless `force` is set.
 */
export async function sweepOrphanUploads(opts: { minAgeMs?: number; force?: boolean } = {}): Promise<number> {
  const now = Date.now();
  if (!opts.force && now - lastSweepAt < SWEEP_INTERVAL_MS) return 0;
  lastSweepAt = now;
  const minAgeMs = opts.minAgeMs ?? DAY_MS;
  const cutoff = new Date(now - minAgeMs);
  const storage = getStorage();
  let rows = 0;
  let files = 0;

  const old = await prisma.upload.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true, key: true, url: true } });
  for (const u of old) {
    try {
      if (await isUploadReferenced(u.url)) continue;
      await storage.delete(u.key);
      await prisma.upload.delete({ where: { id: u.id } });
      rows++;
    } catch (e) {
      console.error(`sweepOrphanUploads: ${u.key}`, e);
    }
  }

  const known = new Set((await prisma.upload.findMany({ select: { key: true } })).map((u) => u.key));
  for await (const { key, mtime } of storage.list()) {
    if (known.has(key) || mtime.getTime() >= cutoff.getTime()) continue;
    try {
      if (await isUploadReferenced(urlForKey(key))) continue;
      await storage.delete(key);
      files++;
    } catch (e) {
      console.error(`sweepOrphanUploads: ${key}`, e);
    }
  }
  if (rows || files) console.log(`sweepOrphanUploads: removed ${rows} unused uploads and ${files} stray files`);
  return rows + files;
}
