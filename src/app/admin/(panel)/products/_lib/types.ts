import type { GalleryItem } from '@/components/admin/ImageGallery';
import type { VariantStatus } from '@/lib/variant-status';

/** Product editor state and save contract (SPEC §5.1.2). Client-safe: types only. */

export type OptionValueState = { key: string; id: number | null; value: string; swatchColor: string | null; swatchImage: string | null };

export type OptionState = { key: string; id: number | null; name: string; values: OptionValueState[] };

export type VariantState = {
  key: string;
  id: number | null;
  /** one value key per option, in option order ([] when no options) */
  valueKeys: string[];
  /** strings while editing; '' allowed for sale */
  regularPrice: string;
  salePrice: string;
  status: VariantStatus;
  sku: string;
  weightGrams: string;
  stock: string;
};

export type ProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

export type ProductEditorState = {
  id: number | null;
  updatedAt: string | null;
  title: string;
  handle: string;
  handleTouched: boolean;
  deliveryTime: string;
  bodyHtml: string;
  hot: boolean;
  isNew: boolean;
  limitedEdition: boolean;
  layout: string;
  vendor: string;
  productType: string;
  tags: string[];
  discountGroup: number | null;
  trackStock: boolean;
  options: OptionState[];
  variants: VariantState[];
  images: GalleryItem[];
  collectionIds: number[];
  status: ProductStatus;
};

export type SaveProductInput = Omit<ProductEditorState, 'handleTouched' | 'status'> & { intent: 'draft' | 'publish'; force?: boolean };

export type SaveProductResult =
  | { ok: true; state: ProductEditorState }
  | { ok: false; code: 'INVALID'; error: string; field?: string }
  | { ok: false; code: 'STALE'; error: string; currentUpdatedAt: string };

/** A collection row for the checkbox tree (DFS order with depth). */
export type CollectionRow = { id: number; title: string; depth: number };

export const DISCOUNT_GROUPS = [10, 20, 30, 40, 50] as const;
