import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.resolve(__dirname, '../../test-results/fixtures');

/** Writes a solid-colour test photo into test-results/fixtures/ and returns its path. */
export async function makeImage(
  name: string,
  opts: { width: number; height: number; color?: string; format?: 'jpeg' | 'png'; exif?: boolean },
): Promise<string> {
  mkdirSync(DIR, { recursive: true });
  const format = opts.format ?? 'jpeg';
  const file = path.join(DIR, `${name}.${format === 'jpeg' ? 'jpg' : 'png'}`);
  let img = sharp({ create: { width: opts.width, height: opts.height, channels: 3, background: opts.color ?? '#6b8e8e' } });
  img = format === 'png' ? img.png() : img.jpeg({ quality: 80 });
  if (opts.exif) img = img.withMetadata({ exif: { IFD3: { GPSLatitude: '31/1 31/1 0/1', GPSLatitudeRef: 'N' } } });
  await img.toFile(file);
  return file;
}

/** A ".jpg" that is really text. */
export function makeTextFileNamedJpg(name = 'not-a-photo'): string {
  mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `${name}.jpg`);
  writeFileSync(file, 'this is not an image, just some text pretending to be one\n');
  return file;
}

/** A committed photo from tests/fixtures/ (small JPEGs made with sharp: sofa-grey, sofa-blue, banner-*, blog-cover). */
export function fixture(name: string): string {
  return path.resolve(__dirname, '../fixtures', name);
}
