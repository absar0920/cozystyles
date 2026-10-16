import { prisma } from '@/lib/db';
import { countLinkReferences } from '@/lib/link-references';
import { isProductLayout } from '@/lib/product-layouts';
import { isVariantStatus } from '@/lib/variant-status';
import type { OptionState, ProductEditorState, ProductStatus, VariantState } from './types';
import { fillMissingCombos, toRegularSale } from './variants';

/**
 * Server loaders for the product editor. Keys are rebuilt from ids ('o<id>', 'v<id>', 'var<id>', 'img<id>')
 * so a reload after save hands the client real ids (SPEC §5.1.2).
 */

const STATUSES: ProductStatus[] = ['ACTIVE', 'DRAFT', 'ARCHIVED'];

export function newProductState(): ProductEditorState {
  return {
    id: null,
    updatedAt: null,
    title: '',
    handle: '',
    handleTouched: false,
    deliveryTime: '',
    bodyHtml: '',
    hot: false,
    isNew: false,
    limitedEdition: false,
    layout: 'default',
    vendor: 'Cozy Furnitures',
    productType: '',
    tags: [],
    discountGroup: null,
    trackStock: false,
    options: [],
    variants: [
      { key: 'new-variant', id: null, valueKeys: [], regularPrice: '', salePrice: '', status: 'READY_TO_SHIP', sku: '', weightGrams: '', stock: '' },
    ],
    images: [],
    collectionIds: [],
    status: 'DRAFT',
  };
}

export async function loadProductEditorState(id: number): Promise<ProductEditorState | null> {
  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      productOptions: { orderBy: [{ position: 'asc' }, { id: 'asc' }], include: { values: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } } },
      variants: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      images: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      collections: { select: { id: true } },
    },
  });
  if (!p) return null;

  let fresh = 0;
  const newKey = () => `n${++fresh}`;

  const options: OptionState[] = p.productOptions.map((o) => ({
    key: `o${o.id}`,
    id: o.id,
    name: o.name,
    values: o.values.map((v) => ({ key: `v${v.id}`, id: v.id, value: v.value, swatchColor: v.swatchColor, swatchImage: v.swatchImage })),
  }));

  const variants: VariantState[] = p.variants.map((v) => {
    const raw = [v.option1, v.option2, v.option3];
    const valueKeys = options.map((o, i) => {
      const text = (raw[i] ?? '').trim();
      const hit =
        o.values.find((x) => x.value === text) ?? o.values.find((x) => x.value.toLowerCase() === text.toLowerCase());
      if (hit) return hit.key;
      if (!text) return o.values[0]?.key ?? '';
      // self-heal data written outside the editor: the variant's value becomes a value of the option
      const added = { key: newKey(), id: null, value: text, swatchColor: null, swatchImage: null };
      o.values.push(added);
      return added.key;
    });
    return {
      key: `var${v.id}`,
      id: v.id,
      valueKeys,
      ...toRegularSale(v.price, v.compareAtPrice),
      status: isVariantStatus(v.status) ? v.status : 'READY_TO_SHIP',
      sku: v.sku ?? '',
      weightGrams: v.weightGrams ? String(v.weightGrams) : '',
      stock: v.stock == null ? '' : String(v.stock),
    };
  });

  const structure = fillMissingCombos({ options, variants }, newKey);

  return {
    id: p.id,
    updatedAt: p.updatedAt.toISOString(),
    title: p.title,
    handle: p.handle,
    handleTouched: true,
    deliveryTime: p.deliveryTime,
    bodyHtml: p.bodyHtml,
    hot: p.hot,
    isNew: p.isNew,
    limitedEdition: p.limitedEdition,
    layout: isProductLayout(p.layout) ? p.layout : 'default',
    vendor: p.vendor,
    productType: p.productType,
    tags: p.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    discountGroup: p.discountGroup,
    trackStock: p.trackStock,
    options: structure.options,
    variants: structure.variants,
    images: p.images.map((im) => ({
      key: `img${im.id}`,
      id: im.id,
      src: im.src,
      alt: im.alt,
      tagKey: im.optionValueId != null ? `v${im.optionValueId}` : null,
      width: im.width,
      height: im.height,
    })),
    collectionIds: p.collections.map((c) => c.id),
    status: (STATUSES as string[]).includes(p.status) ? (p.status as ProductStatus) : 'DRAFT',
  };
}

/** Everything the editor needs besides the product itself. */
export async function loadEditorLookups() {
  const [collections, types] = await Promise.all([
    prisma.collection.findMany({ select: { id: true, title: true, parentId: true } }),
    prisma.product.findMany({ where: { productType: { not: '' } }, distinct: ['productType'], select: { productType: true }, orderBy: { productType: 'asc' } }),
  ]);
  return { collections, productTypes: types.map((t) => t.productType) };
}

/** Delete-confirmation bullets that need the database (SPEC §5.1.8); combinations/photos are counted by the caller. */
export async function productDeleteConsequences(id: number): Promise<{ reviews: number; links: string[] } | null> {
  const p = await prisma.product.findUnique({ where: { id }, select: { handle: true, _count: { select: { reviews: true } } } });
  if (!p) return null;
  const refs = await countLinkReferences([`/products/${p.handle}`], { productId: id });
  const links: string[] = [];
  if (refs.menuItems || refs.banners) {
    links.push(
      `${refs.menuItems} menu link${refs.menuItems === 1 ? '' : 's'} and ${refs.banners} banner${refs.banners === 1 ? '' : 's'} that point to this product will stop working`,
    );
  }
  if (refs.richText) links.push(`${refs.richText} page${refs.richText === 1 ? '' : 's'} or descriptions link here; those links will stop working`);
  return { reviews: p._count.reviews, links };
}
