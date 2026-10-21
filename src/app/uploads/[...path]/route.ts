import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { uploadDir } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

/**
 * GET /uploads/<folder>/<yyyy>/<mm>/<file> — serves admin uploads from UPLOAD_DIR.
 * File names carry a content hash, so responses are cacheable forever by browsers and the CDN.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const root = uploadDir();
  const file = path.resolve(root, ...parts);
  const type = TYPES[path.extname(file).toLowerCase()];
  // Reject traversal outside UPLOAD_DIR and anything that isn't an image we produce.
  if (!type || !file.startsWith(root + path.sep) || parts.some((p) => p.startsWith('.'))) {
    return new Response('Not found', { status: 404 });
  }
  try {
    const body = await readFile(file);
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': type,
        'Content-Length': String(body.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
}
