'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { normalizeHref, validateHref } from '@/lib/links';
import { releaseUploads } from '@/lib/uploads';

/** Home banners (SPEC §5.4): a desktop photo, an optional phone photo, a link, on/off and a drag order. */

export type BannerFormState = {
  ok: boolean;
  /** bumps on every completed save so the client can react once */
  savedAt?: number;
  savedId?: number;
  error?: string | null;
  fieldErrors?: Partial<Record<'title' | 'image' | 'mobileImage' | 'href', string>>;
};

/** A stored photo: an upload (/uploads/…) or a bundled store photo (/images/…). */
const IMAGE_PATH = /^\/(?:uploads|images)\/[A-Za-z0-9._~%\-/]+$/;

const str = (fd: FormData, key: string): string => {
  const v = fd.get(key);
  return v == null ? '' : String(v).trim();
};

/** Banners are rendered on the storefront home page. */
function revalidateBanners() {
  revalidatePath('/admin/banners');
  revalidatePath('/', 'layout');
}

export async function saveBannerAction(_prev: BannerFormState, formData: FormData): Promise<BannerFormState> {
  await requireAdmin();

  const idRaw = str(formData, 'id');
  const id = /^\d+$/.test(idRaw) ? Number(idRaw) : null;
  const image = str(formData, 'image');
  const mobileImage = str(formData, 'mobileImage');
  const href = normalizeHref(str(formData, 'href'));
  let title = str(formData, 'title').slice(0, 120);
  const active = formData.get('active') === 'on';

  const fieldErrors: BannerFormState['fieldErrors'] = {};
  if (!image) fieldErrors.image = 'Please upload the computer photo.';
  else if (!IMAGE_PATH.test(image)) fieldErrors.image = 'Please upload the photo again.';
  if (mobileImage && !IMAGE_PATH.test(mobileImage)) fieldErrors.mobileImage = 'Please upload the phone photo again.';
  const hrefError = validateHref(href, { allowEmpty: true });
  if (hrefError) fieldErrors.href = hrefError;
  if (Object.keys(fieldErrors).length) return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors };

  const existing =
    id != null ? await prisma.banner.findUnique({ where: { id }, select: { id: true, image: true, mobileImage: true } }) : null;
  if (id != null && !existing) return { ok: false, error: 'This banner was deleted somewhere else. Reload the page.' };

  if (!title) {
    const count = await prisma.banner.count();
    title = `Banner ${existing ? existing.id : count + 1}`;
  }

  const data = { title, image, mobileImage: mobileImage || null, href: href || null, active };

  let bannerId: number;
  if (existing) {
    await prisma.banner.update({ where: { id: existing.id }, data });
    bannerId = existing.id;
    // photos this banner no longer uses are deleted once nothing else references them
    await releaseUploads([existing.image, existing.mobileImage].filter((u): u is string => !!u && u !== image && u !== mobileImage));
  } else {
    const last = await prisma.banner.aggregate({ _max: { position: true } });
    const created = await prisma.banner.create({
      data: { ...data, position: (last._max.position ?? -1) + 1 },
      select: { id: true },
    });
    bannerId = created.id;
  }

  revalidateBanners();
  return { ok: true, savedAt: Date.now(), savedId: bannerId };
}

/** List-page On/Off switch. */
export async function toggleBannerAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id)) return;
  const banner = await prisma.banner.findUnique({ where: { id }, select: { active: true } });
  if (!banner) return;
  await prisma.banner.update({ where: { id }, data: { active: !banner.active } });
  revalidateBanners();
}

/** Sets positions 0..n-1 in the given order. Every id must be an existing banner, each exactly once. */
export async function reorderBannersAction(ids: number[]): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!Array.isArray(ids) || ids.some((n) => !Number.isInteger(n))) return { ok: false, error: 'The new order could not be read.' };
  const all = await prisma.banner.findMany({ select: { id: true } });
  const known = new Set(all.map((b) => b.id));
  if (new Set(ids).size !== ids.length || ids.length !== known.size || ids.some((n) => !known.has(n))) {
    return { ok: false, error: 'Banners were added or deleted somewhere else. Reload the page and try again.' };
  }
  await prisma.$transaction(ids.map((id, position) => prisma.banner.update({ where: { id }, data: { position } })));
  revalidateBanners();
  return { ok: true };
}

export async function deleteBannerAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id)) return;
  const banner = await prisma.banner.findUnique({ where: { id }, select: { image: true, mobileImage: true } });
  if (!banner) return;
  await prisma.banner.delete({ where: { id } });
  await releaseUploads([banner.image, banner.mobileImage].filter((u): u is string => !!u));
  revalidateBanners();
}
