'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { slugify } from '@/lib/slug';
import { isRichTextEmpty, sanitizeRichText } from '@/lib/rich-text/sanitize';
import { extractUploadUrls, releaseUploads } from '@/lib/uploads';
import { parseSectionData, serializeSectionData } from '@/lib/product-layout-sections';

/** Admin collection actions (SPEC §5.2). */

export type CollectionFormState = {
  ok: boolean;
  savedAt?: number;
  /** set when a new collection was created: the editor then opens it (/admin/collections/<id>?saved=1) */
  createdId?: number;
  error?: string | null;
  fieldErrors?: Partial<Record<'title' | 'handle' | 'image' | 'parentId' | 'products', string>>;
  /** what was stored, so the editor can show the cleaned values */
  saved?: { handle: string; description: string };
};

export type IndexInput = {
  cards: { id: number | null; collectionId: number | null; systemHandle: string | null; systemTitle?: string; systemImage?: string | null }[];
};

const IMAGE_PATH = /^\/(?:uploads|images)\/[A-Za-z0-9._~%\-/]+$/;

function revalidateCollection(handle: string | null) {
  revalidatePath('/', 'layout');
  if (handle) revalidatePath(`/collections/${handle}`);
  revalidatePath('/admin/collections', 'layout');
}

/* ------------------------------ Collections ------------------------------ */

export async function saveCollectionAction(_prev: CollectionFormState, formData: FormData): Promise<CollectionFormState> {
  await requireAdmin();

  const idRaw = String(formData.get('id') ?? '').trim();
  const id = /^\d+$/.test(idRaw) ? Number(idRaw) : null;
  const fe: NonNullable<CollectionFormState['fieldErrors']> = {};

  const title = String(formData.get('title') ?? '').replace(/\s+/g, ' ').trim().slice(0, 150);
  if (!title) fe.title = 'Please give the collection a name.';

  const existing =
    id != null
      ? await prisma.collection.findUnique({
          where: { id },
          select: { id: true, handle: true, image: true, description: true, indexCard: { select: { id: true } } },
        })
      : null;
  if (id != null && !existing) return { ok: false, error: 'This collection was deleted somewhere else. Go back to the list.' };

  // Web address: kept as is unless the owner changed it; new collections get one from the name.
  let handle = slugify(String(formData.get('handle') ?? ''));
  if (!handle) handle = existing?.handle ?? slugify(title);
  if (!handle && title) fe.handle = 'Use letters or numbers in the web address.';

  const image = String(formData.get('image') ?? '').trim();
  if (image && !IMAGE_PATH.test(image)) fe.image = 'Please upload the photo again.';

  const rawDescription = String(formData.get('description') ?? '');
  const cleaned = sanitizeRichText(rawDescription);
  const description = isRichTextEmpty(cleaned) ? '' : cleaned;

  // Parent: may not be the collection itself nor one of its descendants (would create a cycle).
  let parentId: number | null = null;
  const parentRaw = String(formData.get('parentId') ?? '').trim();
  if (/^\d+$/.test(parentRaw)) {
    const candidate = Number(parentRaw);
    if (id != null && candidate === id) fe.parentId = 'A collection cannot be inside itself.';
    else if (await prisma.collection.findUnique({ where: { id: candidate }, select: { id: true } })) {
      if (id != null) {
        let cursor: number | null = candidate;
        for (let depth = 0; cursor != null && depth < 50; depth++) {
          if (cursor === id) {
            fe.parentId = 'That collection is inside this one — choose another.';
            break;
          }
          const node: { parentId: number | null } | null = await prisma.collection.findUnique({ where: { id: cursor }, select: { parentId: true } });
          cursor = node?.parentId ?? null;
        }
      }
      parentId = candidate;
    }
  }

  let productIds: number[] = [];
  try {
    // hidden input written by the products picker (never typed by the user)
    const picked = formData.get('productsJson');
    const parsed: unknown = JSON.parse(typeof picked === 'string' && picked ? picked : '[]');
    if (!Array.isArray(parsed)) throw new Error();
    productIds = [...new Set(parsed.map(Number).filter((n) => Number.isInteger(n)))];
  } catch {
    fe.products = 'The product selection could not be read. Reload the page.';
  }

  if (Object.keys(fe).length) return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: fe };

  // Keep web addresses unique (append -2, -3, …).
  const baseHandle = handle;
  for (let n = 2; ; n++) {
    const clash = await prisma.collection.findFirst({ where: { handle, ...(id != null ? { id: { not: id } } : {}) }, select: { id: true } });
    if (!clash) break;
    handle = `${baseHandle}-${n}`;
  }

  const validProductIds = productIds.length
    ? (await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })).map((p) => p.id)
    : [];
  const showOnIndex = formData.get('showOnIndex') === 'on';

  let saved: { id: number; handle: string };
  try {
    saved = await prisma.$transaction(async (tx) => {
      const data = { handle, title, description, image: image || null, parentId };
      const c = existing
        ? await tx.collection.update({ where: { id: existing.id }, data, select: { id: true, handle: true } })
        : await tx.collection.create({ data, select: { id: true, handle: true } });
      await tx.collection.update({ where: { id: c.id }, data: { products: { set: validProductIds.map((pid) => ({ id: pid })) } } });
      const hasCard = !!existing?.indexCard;
      if (showOnIndex && !hasCard) {
        const last = await tx.collectionIndexCard.aggregate({ _max: { position: true } });
        await tx.collectionIndexCard.create({ data: { collectionId: c.id, position: (last._max.position ?? -1) + 1 } });
      } else if (!showOnIndex && hasCard) {
        await tx.collectionIndexCard.delete({ where: { collectionId: c.id } });
      }
      return c;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, error: 'That web address is already used. Pick a different one.', fieldErrors: { handle: 'Already used by another collection.' } };
    }
    throw err;
  }

  if (existing) {
    const before = [existing.image, ...extractUploadUrls(existing.description)].filter((u): u is string => !!u);
    const after = new Set([image, ...extractUploadUrls(description)]);
    await releaseUploads(before.filter((u) => !after.has(u)));
    if (existing.handle !== saved.handle) revalidatePath(`/collections/${existing.handle}`);
  }
  revalidateCollection(saved.handle);

  // A new collection is opened by the editor itself (router.replace to /admin/collections/<id>?saved=1), not by
  // redirect(): after a redirect from a server action Next.js fetches the target page from its own server to
  // send it along, and on Hostinger that fetch always fails ("failed to get redirect response … fetch failed").
  // The editor then got an empty answer and showed the error screen instead of the new collection (F02-2).
  return { ok: true, savedAt: Date.now(), saved: { handle: saved.handle, description }, ...(existing ? {} : { createdId: saved.id }) };
}

export async function deleteCollectionAction(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get('id'));
  if (!Number.isInteger(id)) return;
  const collection = await prisma.collection.findUnique({ where: { id }, select: { handle: true, image: true, description: true } });
  if (!collection) redirect('/admin/collections');

  let layoutSections = 0;
  await prisma.$transaction(async (tx) => {
    // sub-collections move to the top level so the parent link doesn't block the delete
    await tx.collection.updateMany({ where: { parentId: id }, data: { parentId: null } });
    // "Products from a collection" sections: their pinned order belongs to this collection; the delete sets
    // collectionId to null (the storefront then skips them and the layout editor asks for another collection)
    const sections = await tx.productLayoutSection.findMany({ where: { collectionId: id, kind: 'featuredCollection' }, select: { id: true, data: true } });
    for (const s of sections) {
      const { data } = parseSectionData('featuredCollection', s.data);
      if (data.handles.length) await tx.productLayoutSection.update({ where: { id: s.id }, data: { data: serializeSectionData('featuredCollection', { ...data, handles: [] }) } });
    }
    layoutSections = sections.length;
    await tx.collection.delete({ where: { id } }); // its Collections-page card cascades
  });
  await releaseUploads([collection.image, ...extractUploadUrls(collection.description)].filter((u): u is string => !!u));

  revalidateCollection(collection.handle);
  if (layoutSections) revalidatePath('/admin/product-layouts', 'layout');
  redirect('/admin/collections?deleted=1');
}

/* ------------------------------ Collections page (index) ------------------------------ */

/** Saves the order of the /collections page cards; positions are the array order (SPEC §5.2.2). */
export async function saveCollectionIndexAction(input: IndexInput): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const cards = Array.isArray(input?.cards) ? input.cards : null;
  if (!cards) return { ok: false, error: 'The new order could not be read.' };

  const existing = await prisma.collectionIndexCard.findMany({ select: { id: true, collectionId: true, systemHandle: true, systemImage: true } });
  const byId = new Map(existing.map((c) => [c.id, c]));

  const seenCollections = new Set<number>();
  const keepIds = new Set<number>();
  for (const c of cards) {
    const card = c.id != null ? byId.get(c.id) : undefined;
    if (card) {
      if (keepIds.has(card.id)) return { ok: false, error: 'A card appears twice. Reload the page and try again.' };
      keepIds.add(card.id);
      if (card.collectionId != null) seenCollections.add(card.collectionId);
      continue;
    }
    if (c.collectionId == null || !Number.isInteger(c.collectionId)) return { ok: false, error: 'Only collections can be added.' };
    if (seenCollections.has(c.collectionId)) return { ok: false, error: 'A collection appears twice.' };
    seenCollections.add(c.collectionId);
  }
  const newCollectionIds = cards.filter((c) => !(c.id != null && byId.has(c.id))).map((c) => c.collectionId as number);
  if (newCollectionIds.length) {
    const found = await prisma.collection.count({ where: { id: { in: newCollectionIds } } });
    if (found !== newCollectionIds.length) return { ok: false, error: 'A collection you added was deleted. Reload the page.' };
  }
  // built-in cards can never be removed
  if (existing.some((c) => c.systemHandle && !keepIds.has(c.id))) return { ok: false, error: 'Built-in cards cannot be removed.' };

  const releasedImages: string[] = [];
  await prisma.$transaction(async (tx) => {
    const removed = existing.filter((c) => !keepIds.has(c.id)).map((c) => c.id);
    if (removed.length) await tx.collectionIndexCard.deleteMany({ where: { id: { in: removed } } });
    for (let position = 0; position < cards.length; position++) {
      const c = cards[position];
      const card = c.id != null ? byId.get(c.id) : undefined;
      if (card) {
        const data: Prisma.CollectionIndexCardUpdateInput = { position };
        if (card.systemHandle) {
          const t = String(c.systemTitle ?? '').replace(/\s+/g, ' ').trim().slice(0, 150);
          if (t) data.systemTitle = t;
          const img = c.systemImage ? String(c.systemImage) : null;
          if (img === null || IMAGE_PATH.test(img)) {
            data.systemImage = img;
            if (card.systemImage && card.systemImage !== img) releasedImages.push(card.systemImage);
          }
        }
        await tx.collectionIndexCard.update({ where: { id: card.id }, data });
      } else {
        await tx.collectionIndexCard.upsert({
          where: { collectionId: c.collectionId as number },
          update: { position },
          create: { collectionId: c.collectionId as number, position, placeholder: (position % 6) + 1 },
        });
      }
    }
  });
  await releaseUploads(releasedImages);

  revalidatePath('/collections');
  revalidatePath('/admin/collections', 'layout');
  return { ok: true };
}

/* ------------------------------ Collection picker ------------------------------ */

export type CollectionChoice = { id: number; title: string; products: number };

/** Search collections by name for the CollectionPicker (20 results, with product counts). */
export async function searchCollectionsAction(q: string): Promise<CollectionChoice[]> {
  await requireAdmin();
  const query = (typeof q === 'string' ? q : '').trim().slice(0, 100);
  const rows = await prisma.collection.findMany({
    where: query ? { OR: [{ title: { contains: query } }, { handle: { contains: query } }] } : {},
    select: { id: true, title: true, _count: { select: { products: true } } },
    orderBy: { title: 'asc' },
    take: 60,
  });
  const lq = query.toLowerCase();
  const score = (t: string) => (!lq ? 0 : t.toLowerCase() === lq ? 0 : t.toLowerCase().startsWith(lq) ? 1 : 2);
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => score(a.r.title) - score(b.r.title) || a.i - b.i)
    .slice(0, 20)
    .map(({ r }) => ({ id: r.id, title: r.title.replace(/&amp;/g, '&'), products: r._count.products }));
}
