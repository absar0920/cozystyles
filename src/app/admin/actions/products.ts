'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { slugify } from '@/lib/slug';
import { sanitizeRichText } from '@/lib/rich-text/sanitize';
import { extractUploadUrls, releaseUploads } from '@/lib/uploads';
import { DEFAULT_LAYOUT_KEY } from '@/lib/product-layouts';
import { lockLayout } from '@/lib/layout-lock';
import { MAX_OPTIONS, MAX_OPTION_NAME_LENGTH, MAX_VALUE_LENGTH, MAX_VARIANTS, normalizeHex, variantTitle } from '@/lib/product-options';
import { isVariantStatus, type VariantStatus } from '@/lib/variant-status';
import { loadProductEditorState, productDeleteConsequences } from '@/app/admin/(panel)/products/_lib/load';
import { deleteBullets } from '@/app/admin/(panel)/products/_lib/delete';
import { parseMoney } from '@/app/admin/(panel)/products/_lib/variants';
import { DISCOUNT_GROUPS, type SaveProductInput, type SaveProductResult } from '@/app/admin/(panel)/products/_lib/types';
import { ALREADY_REMOVED, flashToast } from '@/components/toast/server';

/**
 * Admin product actions (SPEC §5.1). Every save updates options, values, variants and photos in place
 * (ids, weights and unrelated columns survive), validates everything on the server, and releases
 * uploaded files that nothing references any more.
 */

const MAX_PRICE = 100_000_000;
const MAX_WEIGHT = 2_000_000;
const MAX_IMAGES = 40;
const MAX_TAGS = 50;
const MAX_TAG_LENGTH = 60;
/** keywords imported from the old Shopify store (e.g. “Category_Default Category/Office/…”) can be longer; they are kept as they are */
const MAX_LEGACY_TAG_LENGTH = 255;

class Invalid extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}
/** The chosen page layout was deleted between the check above and this save's write. */
class LayoutGone extends Error {}

class Stale extends Error {
  constructor(public currentUpdatedAt: string) {
    super('This product was changed somewhere else (another tab or person).');
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const text = (x: unknown) => (typeof x === 'string' ? x : x == null ? '' : String(x));
const idOf = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x > 0 ? x : null);
const keyOf = (x: unknown) => text(x).slice(0, 80);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const imageSrcOk = (src: string) => (src.startsWith('/uploads/') || src.startsWith('/images/')) && !src.includes('..') && src.length <= 500;

type CleanValue = { key: string; id: number | null; value: string; swatchColor: string | null; swatchImage: string | null };
type CleanOption = { key: string; id: number | null; name: string; values: CleanValue[] };
type CleanVariant = {
  key: string;
  id: number | null;
  valueKeys: string[];
  price: number;
  compareAtPrice: number | null;
  status: VariantStatus;
  sku: string;
  weightGrams: number;
  stock: number | null;
};
type CleanImage = { key: string; id: number | null; src: string; alt: string; tagKey: string | null; width: number | null; height: number | null };

function parseInput(raw: unknown) {
  if (!isObj(raw)) throw new Invalid('Something went wrong. Please reload the page and try again.');
  const intent = raw.intent === 'publish' ? 'publish' : 'draft';

  const title = text(raw.title).trim();
  if (!title) throw new Invalid('Give the product a title.', 'title');
  if (title.length > 200) throw new Invalid('Keep the title under 200 characters.', 'title');

  const handle = slugify(text(raw.handle).trim() || title);
  if (!handle) throw new Invalid('Add a title so we can make the web address.', 'title');

  const deliveryTime = text(raw.deliveryTime).trim();
  if (deliveryTime.length > 200) throw new Invalid('Keep the delivery time under 200 characters.', 'deliveryTime');

  const vendor = text(raw.vendor).trim().slice(0, 100) || 'Cozy Furnitures';
  const productType = text(raw.productType).trim().slice(0, 100);

  const tags: string[] = [];
  for (const t of arr(raw.tags)) {
    const tag = text(t).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    if (!tag) continue;
    if (tag.length > MAX_LEGACY_TAG_LENGTH) throw new Invalid(`The search keyword “${tag.slice(0, 40)}…” is too long. Remove it under Advanced.`, 'tags');
    if (!tags.some((x) => x.toLowerCase() === tag.toLowerCase())) tags.push(tag);
  }
  if (tags.length > MAX_TAGS) throw new Invalid(`Use at most ${MAX_TAGS} search keywords.`, 'tags');

  const dg = raw.discountGroup;
  const discountGroup = typeof dg === 'number' && (DISCOUNT_GROUPS as readonly number[]).includes(dg) ? dg : null;
  const trackStock = raw.trackStock === true;
  const layout = text(raw.layout).trim() || DEFAULT_LAYOUT_KEY; // checked against ProductLayout in saveProductAction

  /* options */
  const rawOptions = arr(raw.options);
  if (rawOptions.length > MAX_OPTIONS) throw new Invalid(`A product can have up to ${MAX_OPTIONS} options.`);
  const options: CleanOption[] = [];
  const valueIndex = new Map<string, { option: number; value: CleanValue }>();
  for (const ro of rawOptions) {
    if (!isObj(ro)) throw new Invalid('Something went wrong with the options. Please reload the page.');
    const key = keyOf(ro.key);
    const name = text(ro.name).trim();
    const field = `options.${key}.name`;
    if (!name) throw new Invalid('Give every option a name (for example Size or Color).', field);
    if (name.length > MAX_OPTION_NAME_LENGTH) throw new Invalid(`Keep option names under ${MAX_OPTION_NAME_LENGTH} characters.`, field);
    if (options.some((o) => o.name.toLowerCase() === name.toLowerCase())) throw new Invalid(`There are two options called “${name}”.`, field);
    const values: CleanValue[] = [];
    for (const rv of arr(ro.values)) {
      if (!isObj(rv)) continue;
      const vkey = keyOf(rv.key);
      const value = text(rv.value).trim();
      const vfield = `options.${key}.values.${vkey}`;
      if (!value) throw new Invalid(`One of the “${name}” values is empty.`, vfield);
      if (value.length > MAX_VALUE_LENGTH) throw new Invalid(`Keep values under ${MAX_VALUE_LENGTH} characters.`, vfield);
      if (values.some((v) => v.value.toLowerCase() === value.toLowerCase())) throw new Invalid(`“${value}” is in “${name}” twice.`, vfield);
      if (!vkey || valueIndex.has(vkey)) throw new Invalid('Something went wrong with the options. Please reload the page.');
      const swatchImage = text(rv.swatchImage).trim();
      const v: CleanValue = {
        key: vkey,
        id: idOf(rv.id),
        value,
        swatchColor: rv.swatchColor ? normalizeHex(text(rv.swatchColor)) : null,
        swatchImage: swatchImage && imageSrcOk(swatchImage) ? swatchImage : null,
      };
      values.push(v);
      valueIndex.set(vkey, { option: options.length, value: v });
    }
    if (!values.length) throw new Invalid(`Add at least one value to “${name}”, or remove the option.`, field);
    options.push({ key, id: idOf(ro.id), name, values });
  }
  const comboCount = options.reduce((n, o) => n * o.values.length, 1);
  if (comboCount > MAX_VARIANTS) throw new Invalid(`That makes ${comboCount} combinations — the limit is ${MAX_VARIANTS}. Remove some values first.`);

  /* variants */
  const rawVariants = arr(raw.variants);
  const structureError = () => new Invalid('The list of combinations is out of date. Please reload the page and try again.');
  if (rawVariants.length !== comboCount) throw structureError();
  const seen = new Set<string>();
  const variants: CleanVariant[] = rawVariants.map((rv) => {
    if (!isObj(rv)) throw structureError();
    const key = keyOf(rv.key);
    const valueKeys = arr(rv.valueKeys).map(keyOf);
    if (valueKeys.length !== options.length) throw structureError();
    valueKeys.forEach((k, i) => {
      if (valueIndex.get(k)?.option !== i) throw structureError();
    });
    const tuple = valueKeys.join('\u0001');
    if (seen.has(tuple)) throw structureError();
    seen.add(tuple);
    const label = valueKeys.map((k) => valueIndex.get(k)!.value.value).join(' / ') || 'this product';
    const f = (name: string) => `variants.${key}.${name}`;

    const regular = parseMoney(text(rv.regularPrice));
    if (regular == null && intent === 'publish') {
      throw new Invalid(`Enter a price for ${label} (use 0 for 'Price on request').`, f('regularPrice'));
    }
    if (regular != null && Number.isNaN(regular)) throw new Invalid(`Use whole rupees only, e.g. 45000 (row: ${label}).`, f('regularPrice'));
    const reg = regular ?? 0;
    if (reg > MAX_PRICE) throw new Invalid(`That price is too high (row: ${label}).`, f('regularPrice'));
    const sale = parseMoney(text(rv.salePrice));
    if (sale != null && Number.isNaN(sale)) throw new Invalid(`Use whole rupees only, e.g. 45000 (row: ${label}).`, f('salePrice'));
    if (sale != null && !(sale > 0 && sale < reg)) throw new Invalid(`Sale price must be lower than the regular price (row: ${label}).`, f('salePrice'));

    const status = isVariantStatus(rv.status) ? rv.status : null;
    if (!status) throw new Invalid(`Choose a status for ${label}.`, f('status'));
    const sku = text(rv.sku).trim();
    if (sku.length > 64) throw new Invalid(`Keep the SKU under 64 characters (row: ${label}).`, f('sku'));
    const wText = text(rv.weightGrams).trim();
    const weight = wText === '' ? 0 : Number(wText);
    if (!Number.isInteger(weight) || weight < 0 || weight > MAX_WEIGHT) throw new Invalid(`Check the weight (row: ${label}).`, f('weightGrams'));
    let stock: number | null = null;
    if (trackStock) {
      const sText = text(rv.stock).trim();
      if (sText !== '') {
        const n = Number(sText);
        if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new Invalid(`Stock must be a whole number, 0 or more (row: ${label}).`, f('stock'));
        stock = n;
      }
    }
    return {
      key,
      id: idOf(rv.id),
      valueKeys,
      price: sale ?? reg,
      compareAtPrice: sale != null ? reg : null,
      status,
      sku,
      weightGrams: weight,
      stock,
    };
  });

  /* images */
  const rawImages = arr(raw.images);
  if (rawImages.length > MAX_IMAGES) throw new Invalid(`A product can have up to ${MAX_IMAGES} photos.`);
  const images: CleanImage[] = rawImages.map((ri) => {
    if (!isObj(ri)) throw new Invalid('Something went wrong with the photos. Please reload the page.');
    const key = keyOf(ri.key);
    const src = text(ri.src).trim();
    if (!imageSrcOk(src)) throw new Invalid('One of the photos could not be saved. Remove it and upload it again.', `images.${key}.alt`);
    const alt = text(ri.alt).trim();
    if (alt.length > 200) throw new Invalid('Keep photo descriptions under 200 characters.', `images.${key}.alt`);
    const tagKey = ri.tagKey == null || ri.tagKey === '' ? null : keyOf(ri.tagKey);
    const dim = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x > 0 && x < 100_000 ? x : null);
    return { key, id: idOf(ri.id), src, alt, tagKey: tagKey && valueIndex.has(tagKey) ? tagKey : null, width: dim(ri.width), height: dim(ri.height) };
  });

  const collectionIds = [...new Set(arr(raw.collectionIds).map(idOf).filter((n): n is number => n != null))];
  const bodyHtml = sanitizeRichText(text(raw.bodyHtml).slice(0, 500_000));

  return {
    id: idOf(raw.id),
    updatedAt: text(raw.updatedAt),
    force: raw.force === true,
    intent,
    title,
    handle,
    deliveryTime,
    bodyHtml,
    hot: raw.hot === true,
    isNew: raw.isNew === true,
    limitedEdition: raw.limitedEdition === true,
    layout,
    vendor,
    productType,
    tags,
    discountGroup,
    trackStock,
    options,
    variants,
    images,
    collectionIds,
  };
}

async function uniqueHandle(base: string, exceptId: number | null): Promise<string> {
  let handle = base;
  for (let n = 2; ; n++) {
    const clash = await prisma.product.findFirst({
      where: { handle, ...(exceptId != null ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (!clash) return handle;
    handle = `${base.slice(0, 85)}-${n}`;
  }
}

/** Every uploaded file URL a product row (with its photos, swatches and description) refers to. */
function productUrls(p: { bodyHtml: string; images: { src: string }[]; productOptions: { values: { swatchImage: string | null }[] }[] }): Set<string> {
  return new Set([
    ...p.images.map((i) => i.src),
    ...p.productOptions.flatMap((o) => o.values.map((v) => v.swatchImage).filter((s): s is string => !!s)),
    ...extractUploadUrls(p.bodyHtml),
  ]);
}

function revalidateProduct(handles: (string | null | undefined)[]) {
  revalidatePath('/');
  for (const h of new Set(handles)) if (h) revalidatePath(`/products/${h}`);
  revalidatePath('/collections', 'layout');
  revalidatePath('/search');
  revalidatePath('/admin/products');
}

/** "Used by N products" counts changed: the layouts list/editors and every product editor's dropdown. */
function revalidateLayoutUsage() {
  revalidatePath('/admin/product-layouts', 'layout');
  revalidatePath('/admin/products', 'layout');
}

/* ------------------------------------------------------------------------------------------------ save */

export async function saveProductAction(input: SaveProductInput): Promise<SaveProductResult> {
  await requireAdmin();

  let d: ReturnType<typeof parseInput>;
  try {
    d = parseInput(input);
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, code: 'INVALID', error: e.message, ...(e.field ? { field: e.field } : {}) };
    throw e;
  }

  const existing =
    d.id != null
      ? await prisma.product.findUnique({
          where: { id: d.id },
          select: {
            id: true,
            handle: true,
            bodyHtml: true,
            tags: true,
            layout: true,
            updatedAt: true,
            variants: { select: { id: true } },
            images: { select: { id: true, src: true } },
            productOptions: { select: { id: true, values: { select: { id: true, optionId: true, swatchImage: true } } } },
          },
        })
      : null;
  if (d.id != null && !existing) {
    return { ok: false, code: 'INVALID', error: 'This product no longer exists. It may have been deleted in another tab.' };
  }

  // the 60-character limit applies to keywords added in the admin; longer ones already on the product stay
  const keptTags = new Set((existing?.tags ?? '').split(',').map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase()));
  const longTag = d.tags.find((t) => t.length > MAX_TAG_LENGTH && !keptTags.has(t.toLowerCase()));
  if (longTag) {
    return { ok: false, code: 'INVALID', error: `Keep each search keyword under ${MAX_TAG_LENGTH} characters (“${longTag.slice(0, 40)}…” is too long).`, field: 'tags' };
  }

  if (!(await prisma.productLayout.count({ where: { key: d.layout } }))) {
    return { ok: false, code: 'INVALID', error: 'That page layout no longer exists. Pick another one.', field: 'layout' };
  }

  const handle = await uniqueHandle(d.handle, d.id);
  const validCollectionIds = d.collectionIds.length
    ? (await prisma.collection.findMany({ where: { id: { in: d.collectionIds } }, select: { id: true } })).map((c) => c.id)
    : [];

  // 0. ownership: ids that are not this product's rows are treated as new
  const ownOptionIds = new Set(existing?.productOptions.map((o) => o.id) ?? []);
  const ownValueOption = new Map(existing?.productOptions.flatMap((o) => o.values.map((v) => [v.id, v.optionId] as const)) ?? []);
  const ownVariantIds = new Set(existing?.variants.map((v) => v.id) ?? []);
  const ownImageIds = new Set(existing?.images.map((i) => i.id) ?? []);

  let productId: number;
  try {
    productId = await prisma.$transaction(async (tx) => {
      // lock first and re-check: the layout may have been deleted since the check above (see lockLayout)
      if (!(await lockLayout(tx, { key: d.layout }))) throw new LayoutGone();
      if (existing && !d.force) {
        const now = await tx.product.findUnique({ where: { id: existing.id }, select: { updatedAt: true } });
        if (now && now.updatedAt.toISOString() !== d.updatedAt) throw new Stale(now.updatedAt.toISOString());
      }

      // 1. product scalars
      const data = {
        handle,
        title: d.title,
        bodyHtml: d.bodyHtml,
        vendor: d.vendor,
        productType: d.productType,
        status: d.intent === 'publish' ? 'ACTIVE' : 'DRAFT',
        hot: d.hot,
        tags: d.tags.join(','),
        isNew: d.isNew,
        limitedEdition: d.limitedEdition,
        layout: d.layout,
        deliveryTime: d.deliveryTime,
        discountGroup: d.discountGroup,
        trackStock: d.trackStock,
      };
      const p = existing ? await tx.product.update({ where: { id: existing.id }, data }) : await tx.product.create({ data });

      // 2. options and values
      const valueIds = new Map<string, number>();
      const keptOptionIds: number[] = [];
      const keptValueIds: number[] = [];
      for (const [pos, o] of d.options.entries()) {
        const optionId =
          o.id != null && ownOptionIds.has(o.id)
            ? (await tx.productOption.update({ where: { id: o.id }, data: { name: o.name, position: pos } })).id
            : (await tx.productOption.create({ data: { productId: p.id, name: o.name, position: pos } })).id;
        keptOptionIds.push(optionId);
        for (const [vpos, v] of o.values.entries()) {
          const vdata = { value: v.value, position: vpos, swatchColor: v.swatchColor, swatchImage: v.swatchImage };
          const valueId =
            v.id != null && ownValueOption.get(v.id) === optionId
              ? (await tx.productOptionValue.update({ where: { id: v.id }, data: vdata })).id
              : (await tx.productOptionValue.create({ data: { ...vdata, optionId } })).id;
          valueIds.set(v.key, valueId);
          keptValueIds.push(valueId);
        }
      }
      if (existing) {
        await tx.productOptionValue.deleteMany({ where: { option: { productId: p.id }, id: { notIn: keptValueIds } } });
        await tx.productOption.deleteMany({ where: { productId: p.id, id: { notIn: keptOptionIds } } });
      }

      // 3. variants (update in place). An empty SKU is auto-filled as CF-<productId>-<variantId>: variant ids
      // are never reused, so an auto SKU always means the same combination even after values come and go.
      const valueTextByKey = new Map(d.options.flatMap((o) => o.values.map((v) => [v.key, v.value] as const)));
      const used = new Set(d.variants.map((v) => v.sku.toLowerCase()).filter(Boolean));
      const autoSku = (variantId: number) => {
        let sku = `CF-${p.id}-${variantId}`;
        for (let n = 2; used.has(sku.toLowerCase()); n++) sku = `CF-${p.id}-${variantId}-${n}`;
        used.add(sku.toLowerCase());
        return sku;
      };
      const keptVariantIds: number[] = [];
      for (const [pos, v] of d.variants.entries()) {
        const existingId = v.id != null && ownVariantIds.has(v.id) ? v.id : null;
        const sku: string | null = v.sku || (existingId != null ? autoSku(existingId) : null);
        const values = v.valueKeys.map((k) => valueTextByKey.get(k) ?? '');
        const vdata = {
          title: variantTitle(values),
          option1: values[0] ?? null,
          option2: values[1] ?? null,
          option3: values[2] ?? null,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          status: v.status,
          sku,
          weightGrams: v.weightGrams,
          stock: v.stock,
          position: pos,
        };
        let id: number;
        if (existingId != null) id = (await tx.variant.update({ where: { id: existingId }, data: vdata })).id;
        else {
          id = (await tx.variant.create({ data: { ...vdata, productId: p.id } })).id;
          if (!sku) await tx.variant.update({ where: { id }, data: { sku: autoSku(id) } });
        }
        keptVariantIds.push(id);
      }
      await tx.variant.deleteMany({ where: { productId: p.id, id: { notIn: keptVariantIds } } });

      // 4. photos (same diff by id)
      const keptImageIds: number[] = [];
      for (const [pos, im] of d.images.entries()) {
        const idata = {
          src: im.src,
          alt: im.alt,
          position: pos,
          optionValueId: im.tagKey ? (valueIds.get(im.tagKey) ?? null) : null,
          ...(im.width && im.height ? { width: im.width, height: im.height } : {}),
        };
        const id =
          im.id != null && ownImageIds.has(im.id)
            ? (await tx.productImage.update({ where: { id: im.id }, data: idata })).id
            : (await tx.productImage.create({ data: { ...idata, productId: p.id } })).id;
        keptImageIds.push(id);
      }
      await tx.productImage.deleteMany({ where: { productId: p.id, id: { notIn: keptImageIds } } });

      // 5. collections
      await tx.product.update({ where: { id: p.id }, data: { collections: { set: validCollectionIds.map((id) => ({ id })) } } });
      return p.id;
    });
  } catch (e) {
    if (e instanceof Stale) return { ok: false, code: 'STALE', error: e.message, currentUpdatedAt: e.currentUpdatedAt };
    if (e instanceof LayoutGone) return { ok: false, code: 'INVALID', error: 'That page layout no longer exists. Pick another one.', field: 'layout' };
    console.error('[saveProductAction]', e);
    return { ok: false, code: 'INVALID', error: 'The product could not be saved. Please try again.' };
  }

  // 6. release uploads the old state referenced and the new one does not
  if (existing) {
    const before = productUrls({ bodyHtml: existing.bodyHtml, images: existing.images, productOptions: existing.productOptions });
    const after = productUrls({
      bodyHtml: d.bodyHtml,
      images: d.images,
      productOptions: d.options.map((o) => ({ values: o.values })),
    });
    const removed = [...before].filter((u) => !after.has(u));
    if (removed.length) await releaseUploads(removed);
  }

  revalidateProduct([handle, existing?.handle]);
  if (!existing || existing.layout !== d.layout) revalidateLayoutUsage();
  const state = await loadProductEditorState(productId);
  if (!state) return { ok: false, code: 'RELOAD', error: 'The product was saved but could not be reloaded. Please refresh the page.' };
  return { ok: true, state };
}

/* ------------------------------------------------------------------------------------------------ duplicate */

export async function duplicateProductAction(id: number): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  await requireAdmin();
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'That product could not be found.' };
  const src = await prisma.product.findUnique({
    where: { id },
    include: {
      productOptions: { orderBy: { position: 'asc' }, include: { values: { orderBy: { position: 'asc' } } } },
      variants: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      images: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      collections: { select: { id: true } },
    },
  });
  if (!src) return { ok: false, error: 'That product could not be found. It may have been deleted.' };

  const handle = await uniqueHandle(`${src.handle.slice(0, 80)}-copy`, null);
  const newId = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        handle,
        title: `${src.title} (copy)`.slice(0, 200),
        bodyHtml: src.bodyHtml,
        vendor: src.vendor,
        productType: src.productType,
        status: 'DRAFT',
        hot: src.hot,
        tags: src.tags,
        isNew: src.isNew,
        limitedEdition: src.limitedEdition,
        layout: src.layout,
        deliveryTime: src.deliveryTime,
        discountGroup: src.discountGroup,
        cardImageRatio: src.cardImageRatio,
        trackStock: src.trackStock,
        collections: { connect: src.collections.map((c) => ({ id: c.id })) },
      },
    });
    const valueMap = new Map<number, number>();
    for (const o of src.productOptions) {
      const no = await tx.productOption.create({ data: { productId: p.id, name: o.name, position: o.position } });
      for (const v of o.values) {
        const nv = await tx.productOptionValue.create({
          data: { optionId: no.id, value: v.value, position: v.position, swatchColor: v.swatchColor, swatchImage: v.swatchImage },
        });
        valueMap.set(v.id, nv.id);
      }
    }
    for (const v of src.variants) {
      await tx.variant.create({
        data: {
          productId: p.id,
          title: v.title,
          sku: null,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          option1: v.option1,
          option2: v.option2,
          option3: v.option3,
          position: v.position,
          weightGrams: v.weightGrams,
          status: v.status,
          stock: v.stock,
        },
      });
    }
    for (const im of src.images) {
      await tx.productImage.create({
        data: {
          productId: p.id,
          src: im.src,
          alt: im.alt,
          position: im.position,
          width: im.width,
          height: im.height,
          optionValueId: im.optionValueId != null ? (valueMap.get(im.optionValueId) ?? null) : null,
        },
      });
    }
    return p.id;
  });

  revalidatePath('/admin/products');
  revalidateLayoutUsage();
  await flashToast('success', `Copy of “${src.title}” created as a draft`);
  return { ok: true, id: newId };
}

/* ------------------------------------------------------------------------------------------------ delete */

export async function deleteProductAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id) || id <= 0) redirect('/admin/products');
  const p = await prisma.product.findUnique({
    where: { id },
    select: { handle: true, title: true, bodyHtml: true, images: { select: { src: true } }, productOptions: { select: { values: { select: { swatchImage: true } } } } },
  });
  if (!p) {
    await flashToast('warning', ALREADY_REMOVED);
    redirect('/admin/products?deleted=1');
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.delete({ where: { id } });
  });
  await releaseUploads(productUrls(p));

  revalidateProduct([p.handle]);
  revalidateLayoutUsage();
  await flashToast('success', `“${p.title}” removed`);
  redirect('/admin/products?deleted=1');
}

/** Delete-confirmation bullets for the products list (loaded when the dialog opens). */
export async function productDeleteInfoAction(id: number): Promise<string[] | null> {
  await requireAdmin();
  if (!Number.isInteger(id) || id <= 0) return null;
  const [counts, extra] = await Promise.all([
    prisma.product.findUnique({ where: { id }, select: { _count: { select: { variants: true, images: true } } } }),
    productDeleteConsequences(id),
  ]);
  if (!counts || !extra) return null;
  return deleteBullets({ combinations: counts._count.variants, photos: counts._count.images, reviews: extra.reviews, links: extra.links });
}

export async function toggleProductHotAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id) || id <= 0) return;
  const product = await prisma.product.findUnique({ where: { id }, select: { hot: true, handle: true, title: true } });
  if (!product) return await flashToast('warning', ALREADY_REMOVED);
  await prisma.product.update({ where: { id }, data: { hot: !product.hot } });
  revalidateProduct([product.handle]);
  await flashToast('success', product.hot ? `“${product.title}” removed from Hot Selling Products` : `“${product.title}” added to Hot Selling Products`);
}

