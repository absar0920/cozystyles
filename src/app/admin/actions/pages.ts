'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { slugify } from '@/lib/slug';
import { BLOG_HANDLE_PREFIX, DESIGNED_PAGE_HANDLES, blogHandle, blogSlug, pagePublicPath } from '@/lib/page-kinds';
import { sanitizeRichText } from '@/lib/rich-text/sanitize';
import { extractUploadUrls, releaseUploads } from '@/lib/uploads';

/**
 * Pages (TEXT + DESIGNED) and blog posts (BLOG). SPEC §5.3.
 * Editors use `useActionState`: a save returns a `ContentFormState`; creating a new row redirects to its edit page.
 */

export type ContentFormState = {
  ok: boolean;
  /** shown in the save bar and above the form */
  error?: string;
  /** form field the error belongs to (`title`, `handle`, `date`, …) */
  field?: string;
  /** Date.now() of the last successful save (lets the client tell saves apart) */
  savedAt?: number;
  /** the stored slug after the save (without `news-` for blog posts) */
  slug?: string;
};

/* ------------------------------------------------------------------ helpers */

const str = (fd: FormData, key: string): string => {
  const v = fd.get(key);
  return v == null ? '' : String(v).trim();
};

/** Empty string → null (for optional columns). */
const nullable = (v: string): string | null => (v === '' ? null : v);

const on = (fd: FormData, key: string): boolean => {
  const v = fd.get(key);
  return v === 'on' || v === 'true' || v === '1';
};

const MAX_TITLE = 200;
const MAX_SEO = 300;
const MAX_AUTHOR = 80;
const MAX_TAGS = 20;
const BUILT_IN_ERROR = 'That web address is used by a built-in page. Please choose another.';

const isReservedPageHandle = (handle: string) =>
  DESIGNED_PAGE_HANDLES.includes(handle) || handle.startsWith(BLOG_HANDLE_PREFIX);

/** `base`, `base-2`, `base-3`, … — the first handle no other page (of any kind) uses. */
async function uniqueHandle(base: string, excludeId: number | null): Promise<string> {
  let candidate = base;
  let n = 2;
  for (;;) {
    const clash = await prisma.page.findUnique({ where: { handle: candidate }, select: { id: true } });
    if (!clash || clash.id === excludeId) return candidate;
    candidate = `${base}-${n++}`;
  }
}

function seoFields(fd: FormData) {
  return {
    seoTitle: nullable(str(fd, 'seoTitle').slice(0, MAX_SEO)),
    seoDescription: nullable(str(fd, 'seoDescription').replace(/\s+/g, ' ').slice(0, MAX_SEO)),
  };
}

function revalidateContent(paths: string[]) {
  revalidatePath('/admin/pages');
  revalidatePath('/admin/blog');
  revalidatePath('/blogs/news', 'layout');
  for (const p of paths) revalidatePath(p);
}

function parseId(fd: FormData): number | null {
  const raw = str(fd, 'id');
  if (raw === '') return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Uploads the old row held that the new one doesn't (released after the write commits). */
function removedUploads(before: (string | null | undefined)[], beforeHtml: string, after: (string | null | undefined)[], afterHtml: string) {
  const keep = new Set([...after.filter(Boolean), ...extractUploadUrls(afterHtml)] as string[]);
  return [...before.filter(Boolean), ...extractUploadUrls(beforeHtml)].filter((u) => !keep.has(u as string)) as string[];
}

/* -------------------------------------------------------------------- pages */

export async function savePageAction(_prev: ContentFormState, formData: FormData): Promise<ContentFormState> {
  await requireAdmin();

  const id = parseId(formData);
  const existing = id
    ? await prisma.page.findUnique({ where: { id }, select: { id: true, kind: true, handle: true, bodyHtml: true } })
    : null;
  if (id && !existing) return { ok: false, error: 'This page no longer exists. It may have been deleted.' };
  if (existing?.kind === 'BLOG') return { ok: false, error: 'This is a blog post. Edit it under Blog posts.' };

  const seo = seoFields(formData);
  const published = on(formData, 'published');

  // DESIGNED: only the search listing and visibility, whatever else is posted.
  if (existing?.kind === 'DESIGNED') {
    await prisma.page.update({ where: { id: existing.id }, data: { ...seo, published } });
    revalidateContent([pagePublicPath(existing), `/admin/pages/${existing.id}`]);
    return { ok: true, savedAt: Date.now(), slug: existing.handle };
  }

  const title = str(formData, 'title');
  if (title === '') return { ok: false, field: 'title', error: 'Please give the page a title.' };
  if (title.length > MAX_TITLE) return { ok: false, field: 'title', error: `The title can be at most ${MAX_TITLE} characters.` };

  let base: string;
  if (on(formData, 'handleTouched')) {
    base = slugify(str(formData, 'handle'));
    if (!base) return { ok: false, field: 'handle', error: 'Please enter a web address (letters and numbers).' };
    if (isReservedPageHandle(base)) return { ok: false, field: 'handle', error: BUILT_IN_ERROR };
  } else {
    base = existing ? existing.handle : slugify(title);
    if (!base) return { ok: false, field: 'title', error: 'Add a title so we can make the web address.' };
    if (DESIGNED_PAGE_HANDLES.includes(base)) base = `${base}-page`;
    else if (base.startsWith(BLOG_HANDLE_PREFIX)) base = `page-${base}`;
  }
  const handle = await uniqueHandle(base, existing?.id ?? null);
  const bodyHtml = sanitizeRichText(String(formData.get('content') ?? ''));

  const data = { title, handle, bodyHtml, published, kind: 'TEXT', ...seo };

  if (existing) {
    await prisma.page.update({ where: { id: existing.id }, data });
    await releaseUploads(removedUploads([], existing.bodyHtml, [], bodyHtml));
    revalidateContent([pagePublicPath(existing), `/pages/${handle}`, `/admin/pages/${existing.id}`]);
    return { ok: true, savedAt: Date.now(), slug: handle };
  }

  const created = await prisma.page.create({ data, select: { id: true } });
  revalidateContent([`/pages/${handle}`]);
  redirect(`/admin/pages/${created.id}?created=1`);
}

export async function togglePagePublishedAction(formData: FormData) {
  await requireAdmin();
  const id = parseId(formData);
  if (!id) return;
  const page = await prisma.page.findUnique({ where: { id }, select: { id: true, published: true, handle: true, kind: true } });
  if (!page || page.kind === 'BLOG') return;
  await prisma.page.update({ where: { id }, data: { published: !page.published } });
  revalidateContent([pagePublicPath(page), `/admin/pages/${id}`]);
}

export async function deletePageAction(formData: FormData) {
  await requireAdmin();
  const id = parseId(formData);
  if (!id) return;
  const page = await prisma.page.findUnique({ where: { id }, select: { id: true, handle: true, kind: true, bodyHtml: true } });
  if (!page) redirect('/admin/pages');
  // custom-design pages can be hidden but never deleted; blog posts have their own delete
  if (page.kind !== 'TEXT') return;

  await prisma.page.delete({ where: { id } });
  await releaseUploads(extractUploadUrls(page.bodyHtml));
  revalidateContent([pagePublicPath(page)]);
  redirect('/admin/pages?deleted=1');
}

/* --------------------------------------------------------------- blog posts */

/** "2025-02-27" → that day at midday UTC (no day shift in any time zone near Pakistan). */
function parseDay(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : d;
}

function todayInStore(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** ChipsInput posts JSON; tags are stored comma separated, so commas inside a tag are dropped. */
function parseTags(raw: string): string[] {
  let list: unknown = [];
  try {
    list = raw ? JSON.parse(raw) : [];
  } catch {
    list = raw.split(',');
  }
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const t of list) {
    if (typeof t !== 'string') continue;
    const tag = t.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!tag || !slugify(tag)) continue;
    // one tag page per address: "Living Room" and "living-room" are the same tag
    if (out.some((o) => slugify(o) === slugify(tag))) continue;
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** Featured photo: an uploaded or bundled image path only. */
function parseImage(v: string): string | null {
  if (!v) return null;
  return /^\/(uploads|images)\/[^\s"'<>]+$/.test(v) ? v : null;
}

const positiveInt = (v: string): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export async function saveBlogPostAction(_prev: ContentFormState, formData: FormData): Promise<ContentFormState> {
  await requireAdmin();

  const id = parseId(formData);
  const existing = id
    ? await prisma.page.findUnique({
        where: { id },
        select: { id: true, kind: true, handle: true, bodyHtml: true, featuredImage: true, publishedAt: true, createdAt: true },
      })
    : null;
  if (id && !existing) return { ok: false, error: 'This post no longer exists. It may have been deleted.' };
  if (existing && existing.kind !== 'BLOG') return { ok: false, error: 'This is not a blog post.' };

  const title = str(formData, 'title');
  if (title === '') return { ok: false, field: 'title', error: 'Please give the post a title.' };
  if (title.length > MAX_TITLE) return { ok: false, field: 'title', error: `The title can be at most ${MAX_TITLE} characters.` };

  const dateRaw = str(formData, 'date') || todayInStore();
  let publishedAt = parseDay(dateRaw);
  if (!publishedAt) return { ok: false, field: 'date', error: 'Please pick a valid date.' };
  // same day as before: keep the stored time, so posts from one day keep their order
  const before = existing ? (existing.publishedAt ?? existing.createdAt) : null;
  if (before && before.toISOString().slice(0, 10) === dateRaw) publishedAt = before;

  const author = str(formData, 'author').replace(/\s+/g, ' ').slice(0, MAX_AUTHOR);

  const imageRaw = str(formData, 'featuredImage');
  const featuredImage = parseImage(imageRaw);
  if (imageRaw && !featuredImage) return { ok: false, field: 'featuredImage', error: 'Please upload the featured photo again.' };
  const featuredImageWidth = featuredImage ? positiveInt(str(formData, 'featuredImageWidth')) : null;
  const featuredImageHeight = featuredImage ? positiveInt(str(formData, 'featuredImageHeight')) : null;

  let slug: string;
  if (on(formData, 'handleTouched')) {
    slug = slugify(str(formData, 'handle'));
    if (!slug) return { ok: false, field: 'handle', error: 'Please enter a web address (letters and numbers).' };
  } else {
    slug = existing ? blogSlug(existing.handle) : slugify(title);
    if (!slug) return { ok: false, field: 'title', error: 'Add a title so we can make the web address.' };
  }
  const handle = await uniqueHandle(blogHandle(slug), existing?.id ?? null);

  const bodyHtml = sanitizeRichText(String(formData.get('content') ?? ''));
  const tags = parseTags(String(formData.get('tags') ?? ''));

  const data = {
    kind: 'BLOG',
    title,
    handle,
    bodyHtml,
    publishedAt,
    author,
    featuredImage,
    featuredImageWidth,
    featuredImageHeight,
    tags: tags.join(','),
    published: on(formData, 'published'),
    ...seoFields(formData),
  };

  if (existing) {
    await prisma.page.update({ where: { id: existing.id }, data });
    await releaseUploads(removedUploads([existing.featuredImage], existing.bodyHtml, [featuredImage], bodyHtml));
    revalidateContent([pagePublicPath(existing), pagePublicPath({ kind: 'BLOG', handle }), `/admin/blog/${existing.id}`]);
    return { ok: true, savedAt: Date.now(), slug: blogSlug(handle) };
  }

  const created = await prisma.page.create({ data, select: { id: true } });
  revalidateContent([pagePublicPath({ kind: 'BLOG', handle })]);
  redirect(`/admin/blog/${created.id}?created=1`);
}

export async function toggleBlogPostPublishedAction(formData: FormData) {
  await requireAdmin();
  const id = parseId(formData);
  if (!id) return;
  const post = await prisma.page.findUnique({ where: { id }, select: { id: true, published: true, handle: true, kind: true } });
  if (!post || post.kind !== 'BLOG') return;
  await prisma.page.update({ where: { id }, data: { published: !post.published } });
  revalidateContent([pagePublicPath(post), `/admin/blog/${id}`]);
}

export async function deleteBlogPostAction(formData: FormData) {
  await requireAdmin();
  const id = parseId(formData);
  if (!id) return;
  const post = await prisma.page.findUnique({ where: { id }, select: { id: true, handle: true, kind: true, bodyHtml: true, featuredImage: true } });
  if (!post) redirect('/admin/blog');
  if (post.kind !== 'BLOG') return;

  await prisma.page.delete({ where: { id } });
  await releaseUploads([...(post.featuredImage ? [post.featuredImage] : []), ...extractUploadUrls(post.bodyHtml)]);
  revalidateContent([pagePublicPath(post)]);
  redirect('/admin/blog?deleted=1');
}
