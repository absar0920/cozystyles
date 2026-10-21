'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { blogSlug } from '@/components/pages/content';

/* ------------------------------------------------------------------ helpers */

/** These live as plain consts (not exports) because a 'use server' module may only export async functions. */
const BANNER_LOCATIONS = ['HOME_HERO', 'HOME_STRIP_1', 'HOME_STRIP_2'];
const MENU_LOCATIONS = ['MAIN', 'TOPBAR', 'FOOTER_1', 'FOOTER_2', 'FOOTER_3'];

const str = (fd: FormData, key: string): string => {
  const v = fd.get(key);
  return v == null ? '' : String(v).trim();
};

/** Empty string → null (for optional columns). */
const nullable = (v: string): string | null => (v === '' ? null : v);

const int = (v: string, fallback = 0): number => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const checkbox = (fd: FormData, key: string): boolean => {
  const v = fd.get(key);
  return v === 'on' || v === 'true' || v === '1';
};

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90)
  );
}

/** Banners and menus are rendered on the storefront shell/home, so flush the whole tree. */
function revalidateStorefront() {
  revalidatePath('/', 'layout');
}

/* ------------------------------------------------------------------ banners */

export async function saveBannerAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const idRaw = str(formData, 'id');
  const id = idRaw === '' ? null : Number(idRaw);
  const back: (msg: string) => never = (msg) => redirect(`/admin/banners?error=${encodeURIComponent(msg)}`);

  const location = str(formData, 'location');
  const image = str(formData, 'image');
  const title = str(formData, 'title');

  // Validation errors bounce back to the banners page with a descriptive message
  // (same pattern as saveProductAction).
  if (!BANNER_LOCATIONS.includes(location)) back(`“${location || '—'}” is not a valid banner location.`);
  if (image === '') back('A desktop image URL is required.');

  const data = {
    location,
    title,
    subtitle: str(formData, 'subtitle'),
    ctaLabel: nullable(str(formData, 'ctaLabel')),
    href: nullable(str(formData, 'href')),
    image,
    mobileImage: nullable(str(formData, 'mobileImage')),
    position: int(str(formData, 'position'), 0),
    active: checkbox(formData, 'active'),
    textColor: str(formData, 'textColor') || '#ffffff',
    overlay: Math.min(90, Math.max(0, int(str(formData, 'overlay'), 20))),
  };

  let bannerId: number;
  if (id != null && Number.isFinite(id)) {
    const existing = await prisma.banner.findUnique({ where: { id }, select: { id: true } });
    if (!existing) back('This banner no longer exists.');
    await prisma.banner.update({ where: { id }, data });
    bannerId = id;
  } else {
    const created = await prisma.banner.create({ data, select: { id: true } });
    bannerId = created.id;
  }

  revalidatePath('/admin/banners');
  revalidateStorefront();
  redirect(`/admin/banners?saved=1&location=${data.location}#banner-${bannerId}`);
}

export async function toggleBannerAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;

  const banner = await prisma.banner.findUnique({ where: { id }, select: { id: true, active: true, location: true } });
  if (!banner) return;

  await prisma.banner.update({ where: { id }, data: { active: !banner.active } });
  revalidatePath('/admin/banners');
  revalidateStorefront();
}

export async function deleteBannerAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;

  const banner = await prisma.banner.findUnique({ where: { id }, select: { id: true, location: true } });
  if (!banner) redirect(`/admin/banners?location=HOME_HERO`);

  await prisma.banner.delete({ where: { id } });
  revalidatePath('/admin/banners');
  revalidateStorefront();
  redirect(`/admin/banners?deleted=1&location=${banner.location}`);
}

/* -------------------------------------------------------------------- menus */

/** Walk up from `parentId` and return false if `excludeId` appears (i.e. the move would create a cycle). */
async function isSafeParent(parentId: number, excludeId: number | null): Promise<boolean> {
  let cursor: number | null = parentId;
  let guard = 0;
  while (cursor != null && guard++ < 100) {
    if (excludeId != null && cursor === excludeId) return false;
    const node: { id: number; parentId: number | null } | null = await prisma.menuItem.findUnique({
      where: { id: cursor },
      select: { id: true, parentId: true },
    });
    cursor = node?.parentId ?? null;
  }
  return true;
}

export async function saveMenuItemAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const idRaw = str(formData, 'id');
  const id = idRaw === '' ? null : Number(idRaw);

  const label = str(formData, 'label');
  const href = str(formData, 'href') || '/';
  const location = str(formData, 'location');
  if (label === '' || !MENU_LOCATIONS.includes(location)) return;

  // Parent must live in the same location and must not be the item itself or one of its descendants.
  let parentId: number | null = null;
  const parentRaw = str(formData, 'parentId');
  if (parentRaw !== '') {
    const pid = Number(parentRaw);
    if (Number.isFinite(pid)) {
      const parent = await prisma.menuItem.findUnique({ where: { id: pid }, select: { id: true, location: true } });
      if (parent && parent.location === location && (await isSafeParent(pid, id))) parentId = pid;
    }
  }

  const data = {
    label,
    href,
    location,
    parentId,
    position: int(str(formData, 'position'), 0),
    badge: nullable(str(formData, 'badge')),
    enabled: checkbox(formData, 'enabled'),
  };

  if (id != null && Number.isFinite(id)) {
    const existing = await prisma.menuItem.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return;
    await prisma.menuItem.update({ where: { id }, data });
  } else {
    await prisma.menuItem.create({ data });
  }

  revalidatePath('/admin/menus');
  revalidateStorefront();
  redirect(`/admin/menus?location=${location}&saved=1`);
}

export async function toggleMenuItemAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;

  const item = await prisma.menuItem.findUnique({ where: { id }, select: { id: true, enabled: true, location: true } });
  if (!item) return;

  await prisma.menuItem.update({ where: { id }, data: { enabled: !item.enabled } });
  revalidatePath('/admin/menus');
  revalidateStorefront();
}

export async function deleteMenuItemAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;

  const item = await prisma.menuItem.findUnique({
    where: { id },
    select: { id: true, location: true, children: { select: { id: true } } },
  });
  if (!item) redirect('/admin/menus?location=MAIN');

  // Child items cascade — surface that in the redirect so the admin understands what happened.
  const childCount = item.children.length;
  await prisma.menuItem.delete({ where: { id } });

  revalidatePath('/admin/menus');
  revalidateStorefront();
  redirect(`/admin/menus?location=${item.location}&deleted=${childCount + 1}`);
}

/* -------------------------------------------------------------------- pages */

async function uniqueHandle(base: string, excludeId: number | null): Promise<string> {
  let candidate = base;
  let n = 2;
  for (;;) {
    const clash = await prisma.page.findUnique({ where: { handle: candidate }, select: { id: true } });
    if (!clash || clash.id === excludeId) return candidate;
    candidate = `${base}-${n++}`;
  }
}

export async function savePageAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const idRaw = str(formData, 'id');
  const id = idRaw === '' ? null : Number(idRaw);

  const title = str(formData, 'title');
  if (title === '') redirect(id != null ? `/admin/pages/${id}?error=title` : '/admin/pages/new?error=title');

  const baseHandle = slugify(str(formData, 'handle') || title) || 'page';
  const handle = await uniqueHandle(baseHandle, id);

  const bodyRaw = formData.get('bodyHtml');
  const bodyHtml = bodyRaw == null ? '' : String(bodyRaw);

  const data = {
    title,
    handle,
    bodyHtml,
    published: checkbox(formData, 'published'),
    isBlogPost: checkbox(formData, 'isBlogPost'),
    seoTitle: nullable(str(formData, 'seoTitle')),
    seoDescription: nullable(str(formData, 'seoDescription')),
  };

  let pageId: number;
  if (id != null && Number.isFinite(id)) {
    const existing = await prisma.page.findUnique({ where: { id }, select: { id: true } });
    if (!existing) redirect('/admin/pages');
    await prisma.page.update({ where: { id }, data });
    pageId = id;
  } else {
    const created = await prisma.page.create({ data, select: { id: true } });
    pageId = created.id;
  }

  revalidatePath('/admin/pages');
  revalidatePath(`/pages/${handle}`);
  revalidatePath('/blogs');
  revalidatePath('/blogs/news');
  revalidatePath(`/blogs/news/${blogSlug(handle)}`);
  revalidateStorefront();
  redirect(`/admin/pages/${pageId}?saved=1`);
}

export async function togglePagePublishedAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;

  const page = await prisma.page.findUnique({ where: { id }, select: { id: true, published: true, handle: true, isBlogPost: true } });
  if (!page) return;

  await prisma.page.update({ where: { id }, data: { published: !page.published } });

  revalidatePath('/admin/pages');
  revalidatePath(`/admin/pages/${id}`);
  revalidatePath(`/pages/${page.handle}`);
  revalidatePath(`/blogs/news/${blogSlug(page.handle)}`);
  revalidateStorefront();
}

export async function deletePageAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;

  const page = await prisma.page.findUnique({ where: { id }, select: { id: true, handle: true } });
  if (!page) redirect('/admin/pages');

  await prisma.page.delete({ where: { id } });

  revalidatePath('/admin/pages');
  revalidatePath(`/pages/${page.handle}`);
  revalidatePath('/blogs');
  revalidatePath('/blogs/news');
  revalidateStorefront();
  redirect('/admin/pages?deleted=1');
}
