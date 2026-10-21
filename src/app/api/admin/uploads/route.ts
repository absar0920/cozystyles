import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { isUploadFolder, storeImage, UploadError, type StoredImage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const MAX_FILES = 20;

/**
 * POST /api/admin/uploads — multipart form with `folder` and one or more `file` fields.
 * Admin only. Responds `{ ok, files: [{ url, width, height, bytes, name }] }`.
 */
export async function POST(request: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ ok: false, error: 'Your session has expired — please sign in again.' }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const folder = form?.get('folder');
  if (!form || !isUploadFolder(folder)) {
    return NextResponse.json({ ok: false, error: 'Invalid upload request.' }, { status: 400 });
  }
  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ ok: false, error: 'No file was selected.' }, { status: 400 });
  if (files.length > MAX_FILES) {
    return NextResponse.json({ ok: false, error: `Upload at most ${MAX_FILES} images at a time.` }, { status: 400 });
  }

  const stored: StoredImage[] = [];
  try {
    for (const file of files) stored.push(await storeImage(file, folder));
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ ok: false, error: err.message, files: stored }, { status: 400 });
    console.error('[uploads] failed to store image', err);
    return NextResponse.json({ ok: false, error: 'The image could not be saved on the server.', files: stored }, { status: 500 });
  }
  return NextResponse.json({ ok: true, files: stored });
}
