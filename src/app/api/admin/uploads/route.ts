import { NextResponse, type NextRequest } from 'next/server';
import { getAdminOrNull } from '@/lib/admin-guard';
import { rateLimit } from '@/lib/ratelimit';
import { isSameOriginRequest } from '@/lib/same-origin';
import { MAX_UPLOAD_BYTES, UPLOAD_PURPOSES, UploadError, storeUploadedImage, sweepOrphanUploads, type UploadPurpose } from '@/lib/uploads';

/**
 * POST multipart/form-data { file, purpose } → { ok: true, upload } | { ok: false, error }.
 * Lives under /api (not /admin) because the /admin middleware and server actions cap bodies at ~10 MB.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
let lastSweepAt = 0;

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminOrNull();
  if (!admin) return fail(401, 'Your session has ended. Please log in again.');
  if (!isSameOriginRequest(req)) return fail(403, 'This upload was blocked for security reasons. Please reload the page and try again.');

  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return fail(413, 'This photo is bigger than 20 MB. Please choose a smaller one.');

  if (!rateLimit(`upload:${admin.id}`, 120, UPLOAD_WINDOW_MS).ok) {
    return fail(429, 'Too many uploads in a short time. Please wait a few minutes and try again.');
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, 'The upload could not be read. Please try again.');
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return fail(400, 'Please choose a photo to upload.');
  const purposeRaw = String(form.get('purpose') ?? 'product');
  const purpose: UploadPurpose = (UPLOAD_PURPOSES as readonly string[]).includes(purposeRaw) ? (purposeRaw as UploadPurpose) : 'product';

  try {
    const upload = await storeUploadedImage(file, purpose);
    const now = Date.now();
    if (now - lastSweepAt > SWEEP_INTERVAL_MS) {
      lastSweepAt = now;
      void sweepOrphanUploads().catch((e) => console.error('sweepOrphanUploads failed', e));
    }
    return NextResponse.json(
      { ok: true, upload: { id: upload.id, url: upload.url, width: upload.width, height: upload.height, bytes: upload.bytes } },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    if (e instanceof UploadError) return fail(e.status, e.message);
    console.error('upload failed', e);
    return fail(500, 'The upload failed. Please try again.');
  }
}
