'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

/**
 * Admin catalog actions — products, collections, reviews.
 * All mutations require a logged-in admin and revalidate affected storefront paths.
 */

const PRODUCT_STATUSES = new Set(['ACTIVE', 'DRAFT', 'ARCHIVED']);
const COLLECTION_KINDS = new Set(['CATEGORY', 'ROOM', 'LOOKBOOK', 'HELPER']);

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function asInt(value: FormDataEntryValue | null, fallback: number): number {
  const n = Math.round(Number(String(value ?? '').trim()));
  return Number.isFinite(n) ? n : fallback;
}

function parseJsonArray(value: FormDataEntryValue | null, label: string): unknown[] {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  throw new Error(`${label} must be a valid JSON array.`);
}

/** Re-rate a product's denormalized rating/reviewCount from its approved reviews. */
async function syncProductReviewStats(productId: number) {
  const agg = await prisma.review.aggregate({
    where: { productId, approved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const count = agg._count._all;
  await prisma.product.update({
    where: { id: productId },
    data: count > 0 ? { reviewCount: count, rating: Math.round((agg._avg.rating ?? 5) * 10) / 10 } : { reviewCount: 0 },
  });
}

/* ------------------------------- Products ------------------------------- */

export async function saveProductAction(formData: FormData) {
  await requireAdmin();

  const idRaw = String(formData.get('id') ?? '').trim();
  const id = /^\d+$/.test(idRaw) ? Number(idRaw) : null;
  const back: (msg: string) => never = (msg) =>
    redirect(`/admin/products/${id ?? 'new'}?error=${encodeURIComponent(msg)}`);

  let payload: {
    title: string;
    handle: string;
    status: string;
    hot: boolean;
    vendor: string;
    productType: string;
    tags: string;
    bodyHtml: string;
    options: string;
    variants: {
      title: string;
      sku: string | null;
      option1: string | null;
      option2: string | null;
      option3: string | null;
      price: number;
      compareAtPrice: number | null;
      inventory: number;
      position: number;
    }[];
    images: { src: string; alt: string; position: number }[];
    collectionIds: number[];
  };

  try {
    const title = String(formData.get('title') ?? '').trim();
    if (!title) throw new Error('Title is required.');

    let handle = slugify(String(formData.get('handle') ?? ''));
    if (!handle) handle = slugify(title);
    if (!handle) throw new Error('Could not derive a handle — enter one manually (letters, numbers, dashes).');

    const status = String(formData.get('status') ?? 'ACTIVE');
    if (!PRODUCT_STATUSES.has(status)) throw new Error('Invalid status.');

    // Options JSON (optional — stored as a compact JSON string)
    const optionsRaw = String(formData.get('options') ?? '').trim();
    let options = '[]';
    if (optionsRaw) {
      const parsedOptions = parseJsonArray(optionsRaw, 'Options');
      options = JSON.stringify(
        parsedOptions.map((o) => {
          const row = (o ?? {}) as Record<string, unknown>;
          return {
            name: String(row.name ?? ''),
            values: Array.isArray(row.values) ? row.values.map(String) : [],
          };
        }),
      );
    }

    // Variants (JSON rows from the client editor)
    const rawVariants = parseJsonArray(formData.get('variantsJson'), 'Variants');
    const variants: typeof payload.variants = [];
    for (let i = 0; i < rawVariants.length; i++) {
      const r = (rawVariants[i] ?? {}) as Record<string, unknown>;
      const str = (k: string) => String(r[k] ?? '').trim();
      const title2 = str('title');
      const sku = str('sku');
      const option1 = str('option1');
      const option2 = str('option2');
      const option3 = str('option3');
      const priceRaw = str('price').replace(/,/g, '');
      const compareRaw = str('compareAtPrice').replace(/,/g, '');
      if (!title2 && !sku && !priceRaw && !compareRaw && !option1 && !option2 && !option3) continue; // fully blank row
      const price = Number(priceRaw);
      if (!priceRaw || !Number.isFinite(price)) throw new Error(`Variant ${i + 1}: price must be a whole number of PKR rupees.`);
      const compare = compareRaw ? Number(compareRaw) : null;
      if (compare != null && !Number.isFinite(compare)) throw new Error(`Variant ${i + 1}: compare-at price must be a number.`);
      const inventoryRaw = str('inventory');
      const inventory = inventoryRaw === '' ? 50 : Math.round(Number(inventoryRaw));
      if (!Number.isFinite(inventory) || inventory < 0) throw new Error(`Variant ${i + 1}: inventory must be 0 or more.`);
      const posRaw = str('position');
      const position = posRaw === '' ? i : Math.round(Number(posRaw));
      variants.push({
        title: title2 || 'Default Title',
        sku: sku || null,
        option1: option1 || null,
        option2: option2 || null,
        option3: option3 || null,
        price: Math.round(price),
        compareAtPrice: compare != null ? Math.round(compare) : null,
        inventory,
        position: Number.isFinite(position) ? position : i,
      });
    }
    if (variants.length === 0) throw new Error('Add at least one variant with a price.');

    // Images (JSON rows)
    const rawImages = parseJsonArray(formData.get('imagesJson'), 'Images');
    const images: typeof payload.images = [];
    for (let i = 0; i < rawImages.length; i++) {
      const r = (rawImages[i] ?? {}) as Record<string, unknown>;
      const src = String(r.src ?? '').trim();
      if (!src) continue;
      const pos = Math.round(Number(String(r.position ?? '').trim()));
      images.push({ src, alt: String(r.alt ?? '').trim(), position: Number.isFinite(pos) ? pos : i });
    }

    // Linked collections (checkbox group)
    const collectionIds = formData
      .getAll('collectionIds')
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));

    payload = {
      title,
      handle,
      status,
      hot: formData.get('hot') === 'on',
      vendor: String(formData.get('vendor') ?? '').trim() || 'Interwood',
      productType: String(formData.get('productType') ?? '').trim(),
      tags: String(formData.get('tags') ?? '').trim(),
      bodyHtml: String(formData.get('bodyHtml') ?? ''),
      options,
      variants,
      images,
      collectionIds,
    };
  } catch (err) {
    back(err instanceof Error ? err.message : 'Invalid product data.');
  }

  if (id != null) {
    const exists = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!exists) redirect(`/admin/products?error=${encodeURIComponent('This product no longer exists.')}`);
  }

  // Keep handles unique (append -2, -3, … on collision)
  let handle = payload.handle;
  for (let n = 2; ; n++) {
    const clash = await prisma.product.findFirst({
      where: { handle, ...(id != null ? { id: { not: id } } : {}) },
      select: { id: true },
    });
    if (!clash) break;
    handle = `${payload.handle}-${n}`;
  }

  const validCollectionIds = payload.collectionIds.length
    ? (
        await prisma.collection.findMany({
          where: { id: { in: payload.collectionIds } },
          select: { id: true },
        })
      ).map((c) => c.id)
    : [];

  const product = await prisma.$transaction(async (tx) => {
    const data = {
      handle,
      title: payload.title,
      bodyHtml: payload.bodyHtml,
      vendor: payload.vendor,
      productType: payload.productType,
      status: payload.status,
      hot: payload.hot,
      tags: payload.tags,
      options: payload.options,
    };
    const p =
      id != null
        ? await tx.product.update({ where: { id }, data })
        : await tx.product.create({ data });

    // Replace variants + images wholesale (seed-scale catalogs make diffing pointless)
    if (id != null) {
      await tx.variant.deleteMany({ where: { productId: p.id } });
      await tx.productImage.deleteMany({ where: { productId: p.id } });
    }
    await tx.variant.createMany({
      data: payload.variants.map((v) => ({ ...v, productId: p.id })),
    });
    if (payload.images.length) {
      await tx.productImage.createMany({
        data: payload.images.map((im) => ({ ...im, productId: p.id })),
      });
    }
    await tx.product.update({
      where: { id: p.id },
      data: { collections: { set: validCollectionIds.map((cid) => ({ id: cid })) } },
    });
    return p;
  });

  revalidatePath('/');
  revalidatePath(`/products/${product.handle}`);
  revalidatePath('/products');
  revalidatePath('/admin/products');
  redirect(`/admin/products/${product.id}?saved=1`);
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;
  const product = await prisma.product.findUnique({ where: { id }, select: { handle: true } });
  if (!product) return;

  await prisma.product.delete({ where: { id } });

  revalidatePath('/');
  revalidatePath(`/products/${product.handle}`);
  revalidatePath('/admin/products');
  redirect('/admin/products?deleted=1');
}

export async function toggleProductHotAction(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;
  const product = await prisma.product.findUnique({ where: { id }, select: { hot: true, handle: true } });
  if (!product) return;

  await prisma.product.update({ where: { id }, data: { hot: !product.hot } });

  revalidatePath('/');
  revalidatePath(`/products/${product.handle}`);
  revalidatePath('/admin/products');
}

/* ------------------------------ Collections ------------------------------ */

export async function saveCollectionAction(formData: FormData) {
  await requireAdmin();

  const idRaw = String(formData.get('id') ?? '').trim();
  const id = /^\d+$/.test(idRaw) ? Number(idRaw) : null;
  const back: (msg: string) => never = (msg) =>
    redirect(`/admin/collections/${id ?? 'new'}?error=${encodeURIComponent(msg)}`);

  const title = String(formData.get('title') ?? '').trim();
  if (!title) back('Title is required.');

  let handle = slugify(String(formData.get('handle') ?? ''));
  if (!handle) handle = slugify(title);
  if (!handle) back('Could not derive a handle — enter one manually (letters, numbers, dashes).');

  const kind = String(formData.get('kind') ?? 'CATEGORY');
  if (!COLLECTION_KINDS.has(kind)) back('Invalid collection kind.');

  const image = String(formData.get('image') ?? '').trim() || null;

  // Parent (may not be itself)
  let parentId: number | null = null;
  const parentRaw = String(formData.get('parentId') ?? '').trim();
  if (parentRaw && /^\d+$/.test(parentRaw)) {
    const candidate = Number(parentRaw);
    if (id == null || candidate !== id) {
      const parent = await prisma.collection.findUnique({ where: { id: candidate }, select: { id: true } });
      if (parent) parentId = candidate;
    }
  }

  // Linked products (JSON array of ids from the client picker)
  let productIds: number[] = [];
  try {
    productIds = parseJsonArray(formData.get('productsJson'), 'Products').map((v) => Number(v)).filter((n) => Number.isFinite(n));
  } catch (err) {
    back(err instanceof Error ? err.message : 'Invalid products selection.');
  }

  if (id != null) {
    const exists = await prisma.collection.findUnique({ where: { id }, select: { id: true } });
    if (!exists) redirect(`/admin/collections?error=${encodeURIComponent('This collection no longer exists.')}`);
  }

  for (let n = 2; ; n++) {
    const clash = await prisma.collection.findFirst({
      where: { handle, ...(id != null ? { id: { not: id } } : {}) },
      select: { id: true },
    });
    if (!clash) break;
    handle = `${handle}-${n}`;
  }

  const validProductIds = productIds.length
    ? (await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })).map((p) => p.id)
    : [];

  const collection = await prisma.$transaction(async (tx) => {
    const data = {
      handle,
      title,
      description: String(formData.get('description') ?? '').trim(),
      image,
      parentId,
      kind,
      featured: formData.get('featured') === 'on',
      showInNav: formData.get('showInNav') === 'on',
      position: Math.max(0, asInt(formData.get('position'), 0)),
    };
    const c =
      id != null
        ? await tx.collection.update({ where: { id }, data })
        : await tx.collection.create({ data });
    await tx.collection.update({
      where: { id: c.id },
      data: { products: { set: validProductIds.map((pid) => ({ id: pid })) } },
    });
    return c;
  });

  // Nav, menus and collection pages all read collections.
  revalidatePath('/', 'layout');
  revalidatePath(`/collections/${collection.handle}`);
  revalidatePath('/admin/collections');
  redirect(`/admin/collections/${collection.id}?saved=1`);
}

export async function deleteCollectionAction(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;
  const collection = await prisma.collection.findUnique({ where: { id }, select: { handle: true } });
  if (!collection) return;

  await prisma.$transaction(async (tx) => {
    // Re-parent children so the FK doesn't block the delete.
    await tx.collection.updateMany({ where: { parentId: id }, data: { parentId: null } });
    await tx.collection.delete({ where: { id } });
  });

  revalidatePath('/', 'layout');
  revalidatePath('/admin/collections');
  redirect('/admin/collections?deleted=1');
}

/* -------------------------------- Reviews -------------------------------- */

export async function toggleReviewApprovedAction(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;
  const review = await prisma.review.findUnique({ where: { id }, select: { approved: true, productId: true } });
  if (!review) return;

  await prisma.review.update({ where: { id }, data: { approved: !review.approved } });
  await syncProductReviewStats(review.productId);

  const product = await prisma.product.findUnique({ where: { id: review.productId }, select: { handle: true } });
  revalidatePath('/admin/reviews');
  revalidatePath('/');
  if (product) revalidatePath(`/products/${product.handle}`);
}

export async function deleteReviewAction(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;
  const review = await prisma.review.findUnique({ where: { id }, select: { productId: true } });
  if (!review) return;

  await prisma.review.delete({ where: { id } });
  await syncProductReviewStats(review.productId);

  const product = await prisma.product.findUnique({ where: { id: review.productId }, select: { handle: true } });
  revalidatePath('/admin/reviews');
  revalidatePath('/');
  if (product) revalidatePath(`/products/${product.handle}`);
}
