import manifest from '../../../data/image-manifest.json';

/*
 * Designed pages imported from the old site still point their pictures at the old Shopify CDN path, rebranded to
 * //cozyfurnitures.pk/cdn/shop/… — a host that does not serve them. The images that were downloaded are in
 * data/image-manifest.json (original URL → local /images/… file); this maps a CDN URL in any size variant
 * (`_20x_crop_center`, `_345x`, `_{width}x`, `_1600x616`…) to its local copy.
 */

/** Any URL on the old store CDN (whatever the host was rebranded to). */
export const LEGACY_CDN_RE = /(?:https?:)?\/\/[^/"'\s]+\/cdn\/shop\/[^"'\s)]+|https:\/\/cdn\.shopify\.com\/s\/files\/[^"'\s)]+/i;

function fileKey(url: string): string {
  const name = url.split(/[?#]/)[0].split('/').pop() ?? '';
  return decodeURIComponent(name)
    .replace(/_(?:\{width\}x|\d+x\d*|x\d+)(?:_crop_[a-z_]+)?(?=\.[a-z0-9]+$)/i, '')
    .toLowerCase();
}

let byFile: Map<string, string> | null = null;

function index(): Map<string, string> {
  if (!byFile) {
    byFile = new Map();
    for (const [original, local] of Object.entries(manifest as Record<string, string>)) {
      const key = fileKey(original);
      if (key && !byFile.has(key)) byFile.set(key, local);
    }
  }
  return byFile;
}

export function isLegacyCdnUrl(url: string): boolean {
  return LEGACY_CDN_RE.test(url);
}

/** The local copy of an old-CDN image, or null when it was never downloaded. */
export function localImageFor(url: string): string | null {
  if (!isLegacyCdnUrl(url)) return null;
  return index().get(fileKey(url)) ?? null;
}
