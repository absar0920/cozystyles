import { getStorage, isUploadKey } from '@/lib/storage';

/** Public storefront images uploaded in the admin: /uploads/YYYY/MM/<name>.webp (Next does not serve runtime-added public/ files). */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const key = (path ?? []).join('/');
  if (!isUploadKey(key)) return new Response('Not found', { status: 404 });
  const file = await getStorage().get(key);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(file.body, {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(file.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Last-Modified': file.mtime.toUTCString(),
    },
  });
}
