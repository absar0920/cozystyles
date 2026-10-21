/**
 * Admin Easy Mode data migration (docs/admin-easy-mode/SPEC.md §2.5). Idempotent.
 *
 *   npm run db:migrate-easy-mode                 # back up the DB, then apply every step not applied yet
 *   npx tsx scripts/migrate-admin-easy-mode.ts --dry-run       # run everything, print the report, roll back
 *   npx tsx scripts/migrate-admin-easy-mode.ts --no-backup
 *   npx tsx scripts/migrate-admin-easy-mode.ts --export-orders # write prisma/backups/orders-<ts>.json (raw SQL)
 *
 * Moves behaviour that used to live in hard-coded JSON files and magic strings into the database:
 * option rows, variant status, product flags, layouts, swatch colours, photo tags, card ratios, the
 * /collections index, page kinds + clean rich text, menus, banners and settings. Each step runs once:
 * a `MigrationStep` row marks it applied, so a second run prints "skipped" for every step.
 * prisma/seed.ts calls `runAdminEasyModeMigration(prisma, { backup: false })` as its last step.
 *
 * Inputs: the database, prisma/easy-mode-data/*.json and public/ (local images). Must not import src/components.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { decodeEntities, sanitizeRichText } from '../src/lib/rich-text/sanitize';
import { legacyIconAt } from '../src/lib/product-layout-icons';
import {
  parseSectionData,
  sectionRefs,
  serializeSectionData,
  serializeSnapshot,
  isSectionKind,
  type SectionKind,
  type SnapshotSection,
} from '../src/lib/product-layout-sections';
import { isCardSwatchOptionName, isSwatchOptionName, normalizeHex } from '../src/lib/product-options';
import { DESIGNED_PAGE_HANDLES, BLOG_HANDLE_PREFIX } from '../src/lib/page-kinds';
import { backupDatabase } from './backup-db';
import { CSS_COLORS } from './lib/css-colors';
import {
  extractMainFromDocument,
  extractRteFromDocument,
  parseLegacyArticle,
  tableToLists,
  tidyInlineMarks,
  wrapLooseInline,
  youtubeIframesToTiptap,
} from './lib/legacy-html';

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'prisma', 'easy-mode-data');
const PUBLIC = path.join(ROOT, 'public');

type Tx = Prisma.TransactionClient;
export type MigrationReport = { steps: { id: string; status: 'applied' | 'skipped'; summary: string }[] };
type Opts = { backup?: boolean; dryRun?: boolean; log?: (s: string) => void };

class DryRunRollback extends Error {
  constructor(public report: MigrationReport) {
    super('dry run: rolled back');
  }
}

function readData<T>(file: string, fallback: T): T {
  const p = path.join(DATA, file);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : fallback;
}

const DOC_RE = /<!doctype|<html[\s>]/i;

/* ----------------------------------------------------------------------------------------- steps */

type Step = { id: string; run: (tx: Tx, log: (s: string) => void) => Promise<string> };

/** 1. Legacy `Product.options` JSON → ProductOption / ProductOptionValue rows. */
async function optionsToRows(tx: Tx, log: (s: string) => void): Promise<string> {
  const products = await tx.product.findMany({
    where: { productOptions: { none: {} } },
    select: {
      id: true,
      handle: true,
      legacyOptions: true,
      variants: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, option1: true, option2: true, option3: true } },
    },
  });
  let created = 0;
  let values = 0;
  let appended = 0;
  let remapped = 0;
  for (const p of products) {
    let legacy: { name?: unknown; values?: unknown; position?: unknown }[] = [];
    try {
      const parsed = JSON.parse(p.legacyOptions || '[]');
      if (Array.isArray(parsed)) legacy = parsed.filter((o) => o && typeof o === 'object');
    } catch {
      log(`  options-to-rows: ${p.handle}: unreadable options JSON, ignored`);
    }
    const col = (v: (typeof p.variants)[number], i: number) => [v.option1, v.option2, v.option3][i] ?? null;
    const clean = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

    // Which variant column (0..2) each legacy option describes. Shopify positions are 1-based; the seed dropped
    // single-value options, so position 2 can be the first remaining option. Fall back to array order.
    let opts = legacy
      .map((o, i) => {
        const pos = Number(o.position);
        return {
          name: clean(o.name) || `Option ${i + 1}`,
          values: Array.isArray(o.values) ? o.values.map(clean) : [],
          srcCol: Number.isInteger(pos) && pos >= 1 && pos <= 3 ? pos - 1 : i,
          order: i,
        };
      })
      .slice(0, 3);
    if (new Set(opts.map((o) => o.srcCol)).size !== opts.length) opts = opts.map((o, i) => ({ ...o, srcCol: i }));
    opts.sort((a, b) => a.srcCol - b.srcCol || a.order - b.order);

    if (!opts.length) {
      for (let i = 0; i < 3; i++) {
        const distinct = [...new Set(p.variants.map((v) => clean(col(v, i))).filter((s) => s && s !== 'Default Title'))];
        if (distinct.length) opts.push({ name: `Option ${i + 1}`, values: distinct, srcCol: i, order: i });
      }
    }
    if (!opts.length) continue;

    // Variant columns follow the option positions (0..n-1). Remap when the legacy columns were not 0..n-1.
    const identity = opts.every((o, k) => o.srcCol === k);
    const variantValues = p.variants.map((v) => opts.map((o) => clean(col(v, o.srcCol))));
    if (!identity) {
      remapped++;
      log(`  options-to-rows: ${p.handle}: variant option columns ${opts.map((o) => o.srcCol + 1).join(',')} → ${opts.map((_, k) => k + 1).join(',')}`);
    }

    for (let k = 0; k < opts.length; k++) {
      const o = opts[k];
      const list: string[] = [];
      const seen = new Map<string, string>();
      for (const v of o.values) {
        if (!v || v === 'Default Title' || seen.has(v.toLowerCase())) continue;
        seen.set(v.toLowerCase(), v);
        list.push(v);
      }
      for (const row of variantValues) {
        const v = row[k];
        if (!v || v === 'Default Title') continue;
        const canonical = seen.get(v.toLowerCase());
        if (canonical) {
          row[k] = canonical;
          continue;
        }
        seen.set(v.toLowerCase(), v);
        list.push(v);
        appended++;
        log(`  options-to-rows: ${p.handle}: "${o.name}" value "${v}" found on a variant only, appended`);
      }
      await tx.productOption.create({
        data: {
          productId: p.id,
          name: o.name,
          position: k,
          values: { create: list.map((value, position) => ({ value, position })) },
        },
      });
      created++;
      values += list.length;
    }

    for (let i = 0; i < p.variants.length; i++) {
      const v = p.variants[i];
      const row = variantValues[i];
      const next = [0, 1, 2].map((k) => (k < row.length && row[k] && row[k] !== 'Default Title' ? row[k] : null));
      if (next[0] !== v.option1 || next[1] !== v.option2 || next[2] !== v.option3) {
        await tx.variant.update({ where: { id: v.id }, data: { option1: next[0], option2: next[1], option3: next[2] } });
      }
    }
  }
  return `${products.length} products checked → ${created} options, ${values} values (${appended} appended from variants, ${remapped} products remapped)`;
}

/** 2. Variant status from inventory + the sold-out / pre-order / live-status data files. */
async function variantStatus(tx: Tx): Promise<string> {
  const soldOut = new Set(readData<string[]>('live-sold-out.json', []));
  const preorder = readData<Record<string, string[]>>('preorder-variants.json', {});
  const statuses = readData<{ statuses?: Record<string, string | null> }>('live-card-data.json', {}).statuses ?? {};
  const products = await tx.product.findMany({ select: { handle: true, variants: { select: { id: true, sku: true, legacyInventory: true } } } });
  const counts: Record<string, number> = { READY_TO_SHIP: 0, PRE_ORDER: 0, MADE_TO_ORDER: 0, SOLD_OUT: 0 };
  const byStatus: Record<string, number[]> = { READY_TO_SHIP: [], PRE_ORDER: [], MADE_TO_ORDER: [], SOLD_OUT: [] };
  let total = 0;
  for (const p of products) {
    const pre = new Set(preorder[p.handle] ?? []);
    const hasStatus = Object.prototype.hasOwnProperty.call(statuses, p.handle);
    for (const v of p.variants) {
      let s = 'READY_TO_SHIP';
      if (v.legacyInventory <= 0 || soldOut.has(p.handle)) s = 'SOLD_OUT';
      else if (v.sku && pre.has(v.sku)) s = 'PRE_ORDER';
      else if (hasStatus && statuses[p.handle] === null) s = 'MADE_TO_ORDER';
      else if (statuses[p.handle] === 'Coming Soon') s = 'PRE_ORDER';
      byStatus[s].push(v.id);
      counts[s]++;
      total++;
    }
  }
  for (const [status, ids] of Object.entries(byStatus)) {
    for (let i = 0; i < ids.length; i += 500) {
      await tx.variant.updateMany({ where: { id: { in: ids.slice(i, i + 500) } }, data: { status, stock: null } });
    }
  }
  return `${total} variants → READY_TO_SHIP ${counts.READY_TO_SHIP}, PRE_ORDER ${counts.PRE_ORDER}, MADE_TO_ORDER ${counts.MADE_TO_ORDER}, SOLD_OUT ${counts.SOLD_OUT}`;
}

/** 3. Magic tags → isNew / limitedEdition / deliveryTime / discountGroup (consumed tags are removed). */
async function productFlags(tx: Tx): Promise<string> {
  const products = await tx.product.findMany({ select: { id: true, tags: true } });
  let isNew = 0;
  let limited = 0;
  let delivery = 0;
  let discount = 0;
  for (const p of products) {
    const tags = p.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const data: Prisma.ProductUpdateInput = {};
    const keep: string[] = [];
    for (const t of tags) {
      if (t === 'New Arrivals') {
        if (!data.isNew) isNew++;
        data.isNew = true;
      } else if (t === 'limited-edition') {
        if (!data.limitedEdition) limited++;
        data.limitedEdition = true;
      } else if (/^delivered in /i.test(t)) {
        if (data.deliveryTime == null) {
          data.deliveryTime = t;
          delivery++;
        }
      } else if (/^discount=(\d+)$/.test(t) && [10, 20, 30, 40, 50].includes(Number(t.slice('discount='.length)))) {
        if (data.discountGroup == null) {
          data.discountGroup = Number(t.slice('discount='.length));
          discount++;
        }
      } else {
        keep.push(t);
      }
    }
    if (keep.length !== tags.length) {
      data.tags = keep.join(',');
      await tx.product.update({ where: { id: p.id }, data });
    }
  }
  return `${isNew} new, ${limited} limited, ${delivery} delivery, ${discount} discount`;
}

/** The 18 migrated layouts, verbatim from the old templates.json (docs/product-layouts/SPEC.md §7.1). */
type FrozenLayout = { key: string; name: string; description: string; sections: Record<string, unknown>[] };

function frozenLayouts(): FrozenLayout[] {
  const file = readData<{ layouts?: unknown }>('product-layouts.json', {});
  if (!Array.isArray(file.layouts) || !file.layouts.length) throw new Error('prisma/easy-mode-data/product-layouts.json is missing');
  return file.layouts as FrozenLayout[];
}

/** 4a. product-layouts.json → ProductLayout + ProductLayoutSection rows (per key; existing keys are skipped). */
async function productLayoutContent(tx: Tx, log: (s: string) => void): Promise<string> {
  const layouts = frozenLayouts();
  const existing = await tx.productLayout.findMany({ select: { key: true, nameKey: true, position: true } });
  const keys = new Set(existing.map((l) => l.key));
  const nameKeys = new Set(existing.map((l) => l.nameKey));
  let position = existing.length ? Math.max(...existing.map((l) => l.position)) + 1 : 0;
  const collections = new Map((await tx.collection.findMany({ select: { id: true, handle: true } })).map((c) => [c.handle, c.id]));
  const sizes = new Map<string, { width: number; height: number } | null>();
  let created = 0;
  let skipped = 0;
  let sectionCount = 0;
  let missingImages = 0;
  let missingCollections = 0;

  const dims = async (src: unknown): Promise<{ width: number | null; height: number | null }> => {
    if (typeof src !== 'string' || !src) return { width: null, height: null };
    if (!sizes.has(src)) {
      const size = await imageSize(src, { width: 0, height: 0 });
      sizes.set(src, size.width && size.height ? size : null);
      if (!size.width) {
        missingImages++;
        log(`  product-layout-content: image ${src} not found`);
      }
    }
    const size = sizes.get(src);
    return { width: size?.width ?? null, height: size?.height ?? null };
  };

  for (const layout of layouts) {
    if (keys.has(layout.key)) {
      skipped++;
      log(`  product-layout-content: skipped ${layout.key}: already present`);
      continue;
    }
    let name = layout.name;
    if (nameKeys.has(name.trim().toLowerCase())) {
      name = `${name} (original)`;
      log(`  product-layout-content: ${layout.key}: name taken, saved as "${name}"`);
    }
    const row = await tx.productLayout.create({
      data: { key: layout.key, name, nameKey: name.trim().toLowerCase(), description: layout.description ?? '', position: position++ },
    });
    keys.add(layout.key);
    nameKeys.add(row.nameKey);

    const written: SnapshotSection[] = [];
    for (const [i, raw] of layout.sections.entries()) {
      const kind = raw.kind;
      if (!isSectionKind(kind)) throw new Error(`product-layouts.json: ${layout.key} section ${i}: unknown kind ${String(kind)}`);
      let built: Record<string, unknown> = {};
      let bodyHtml = '';
      let collectionId: number | null = null;
      switch (kind as SectionKind) {
        case 'overlay': {
          const d = await dims(raw.image);
          built = { image: raw.image, imageWidth: d.width, imageHeight: d.height, subheading: raw.subheading, heading: raw.heading, headingClass: raw.headingClass };
          bodyHtml = sanitizeRichText(String(raw.html ?? ''));
          break;
        }
        case 'imageText': {
          const d = await dims(raw.image);
          const button = raw.button as { href?: string; label?: string } | null;
          built = {
            ...raw,
            imageWidth: d.width,
            imageHeight: d.height,
            button: button ? { href: button.href === '#' ? '' : (button.href ?? ''), label: button.label ?? '' } : null,
          };
          bodyHtml = sanitizeRichText(String(raw.html ?? ''));
          break;
        }
        case 'icons':
          built = {
            blocks: ((raw.blocks as { title: string; text: string }[]) ?? []).map((b, j) => ({ icon: legacyIconAt(j), title: b.title, text: b.text })),
          };
          break;
        case 'testimonials':
          built = raw;
          break;
        case 'slideshow': {
          const dd = await dims(raw.desktop);
          const md = await dims(raw.mobile);
          built = {
            slides: [
              {
                desktop: raw.desktop,
                desktopWidth: dd.width,
                desktopHeight: dd.height,
                desktopRatio: raw.desktopRatio,
                mobile: raw.mobile ?? null,
                mobileWidth: md.width,
                mobileHeight: md.height,
                mobileRatio: raw.mobileRatio ?? null,
              },
            ],
          };
          break;
        }
        case 'featuredCollection': {
          built = { heading: raw.heading, collection: raw.collection ?? null, handles: raw.handles ?? [], limit: null };
          collectionId = typeof raw.collection === 'string' ? (collections.get(raw.collection) ?? null) : null;
          if (collectionId == null) {
            missingCollections++;
            log(`  product-layout-content: ${layout.key}: collection "${String(raw.collection)}" not found`);
          }
          break;
        }
        default:
          built = {};
      }
      const parsed = parseSectionData(kind, JSON.stringify(built));
      const data = serializeSectionData(kind, parsed.data);
      await tx.productLayoutSection.create({
        data: { layoutId: row.id, position: i, kind, hidden: false, bodyHtml, data, refs: sectionRefs(kind, parsed.data, bodyHtml), collectionId },
      });
      written.push({ kind, hidden: false, bodyHtml, data, collectionId });
      sectionCount++;
    }
    await tx.productLayout.update({
      where: { id: row.id },
      data: { originalVersion: serializeSnapshot({ name: row.name, description: row.description, sections: written }) },
    });
    created++;
  }

  const reset = (await tx.product.updateMany({ where: { layout: { notIn: [...keys] } }, data: { layout: 'default' } })).count;
  return (
    `${created} layouts (${skipped} skipped), ${sectionCount} sections, ${missingImages} missing images, ` +
    `${missingCollections} missing collections, ${reset} products reset to default`
  );
}

/** 4. product-templates.json → Product.layout (keys checked against product-layouts.json). */
async function productLayouts(tx: Tx, log: (s: string) => void): Promise<string> {
  const map = readData<Record<string, string>>('product-templates.json', {});
  const layoutKeys = new Set(frozenLayouts().map((l) => l.key));
  const handles = new Set((await tx.product.findMany({ select: { handle: true } })).map((p) => p.handle));
  const byLayout = new Map<string, string[]>();
  let unknownHandles = 0;
  let unknownKeys = 0;
  for (const [handle, key] of Object.entries(map)) {
    if (!layoutKeys.has(key)) {
      unknownKeys++;
      log(`  product-layouts: unknown layout "${key}" for ${handle}`);
      continue;
    }
    if (!handles.has(handle)) {
      unknownHandles++;
      continue;
    }
    byLayout.set(key, [...(byLayout.get(key) ?? []), handle]);
  }
  let set = 0;
  for (const [layout, list] of byLayout) {
    set += (await tx.product.updateMany({ where: { handle: { in: list } }, data: { layout } })).count;
  }
  if (unknownHandles) log(`  product-layouts: ${unknownHandles} handles not in the database`);
  return `${set} products got a layout (${unknownHandles} unknown handles, ${unknownKeys} unknown layouts)`;
}

function toHex(value: string, table: Record<string, string>): string | null {
  const raw = table[value] ?? (/^[a-z]+$/i.test(value) ? value : null);
  if (!raw) return null;
  const hex = normalizeHex(raw);
  if (hex) return hex;
  const named = CSS_COLORS[raw.trim().toLowerCase()];
  return named ? normalizeHex(named) : null;
}

/** 5. Swatch colours for Color/Colour/Finish option values. */
async function swatches(tx: Tx): Promise<string> {
  const table = readData<Record<string, string>>('swatch-colors.json', {});
  const options = await tx.productOption.findMany({ select: { name: true, values: { select: { id: true, value: true } } } });
  let set = 0;
  let missing = 0;
  for (const o of options) {
    if (!isSwatchOptionName(o.name)) continue;
    for (const v of o.values) {
      const hex = toHex(v.value, table);
      if (hex) {
        await tx.productOptionValue.update({ where: { id: v.id }, data: { swatchColor: hex } });
        set++;
      } else missing++;
    }
  }
  return `${set} swatch colours set, ${missing} values left neutral`;
}

/** 6. variant-images.json + swatch-variants.json → ProductImage.optionValueId ("Shows: value"). */
async function photoTags(tx: Tx, log: (s: string) => void): Promise<string> {
  const variantImages = readData<Record<string, Record<string, number>>>('variant-images.json', {});
  const swatchVariants = readData<Record<string, { images?: Record<string, number> }>>('swatch-variants.json', {});
  const handles = [...new Set([...Object.keys(variantImages), ...Object.keys(swatchVariants)])];
  const products = await tx.product.findMany({
    where: { handle: { in: handles } },
    select: {
      handle: true,
      images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, position: true, optionValueId: true } },
      variants: { select: { sku: true, option1: true, option2: true, option3: true } },
      productOptions: { orderBy: { position: 'asc' }, select: { name: true, position: true, values: { select: { id: true, value: true } } } },
    },
  });
  let tagged = 0;
  let conflicts = 0;
  for (const p of products) {
    const tags = new Map(p.images.map((im) => [im.id, im.optionValueId]));
    const tag = async (imageId: number, valueId: number) => {
      const current = tags.get(imageId);
      if (current != null) {
        if (current !== valueId) {
          conflicts++;
          log(`  photo-tags: ${p.handle}: photo ${imageId} already shows another value, kept`);
        }
        return;
      }
      await tx.productImage.update({ where: { id: imageId }, data: { optionValueId: valueId } });
      tags.set(imageId, valueId);
      tagged++;
    };
    const valueId = (optIndex: number, value: string | null | undefined) =>
      value ? p.productOptions[optIndex]?.values.find((v) => v.value === value)?.id ?? null : null;
    const col = (v: (typeof p.variants)[number], i: number) => [v.option1, v.option2, v.option3][i];

    const map = variantImages[p.handle];
    if (map && p.productOptions.length) {
      const mapped = Object.keys(map)
        .map((sku) => p.variants.find((v) => v.sku === sku))
        .filter((v): v is (typeof p.variants)[number] => !!v);
      let optIndex = p.productOptions.findIndex((o) => isSwatchOptionName(o.name));
      if (optIndex < 0) optIndex = p.productOptions.findIndex((_, i) => new Set(mapped.map((v) => col(v, i))).size > 1);
      if (optIndex < 0) optIndex = 0;
      for (const [sku, galleryIndex] of Object.entries(map)) {
        const v = p.variants.find((x) => x.sku === sku);
        const image = p.images[galleryIndex];
        const id = v ? valueId(optIndex, col(v, optIndex)) : null;
        if (image && id != null) await tag(image.id, id);
      }
    }

    const sw = swatchVariants[p.handle]?.images;
    const swatchIndex = p.productOptions.findIndex((o) => isCardSwatchOptionName(o.name));
    if (sw && swatchIndex >= 0) {
      for (const [colour, imagePosition] of Object.entries(sw)) {
        const image = p.images.find((im) => im.position === imagePosition);
        const id = valueId(swatchIndex, colour);
        if (image && id != null && tags.get(image.id) == null) await tag(image.id, id);
      }
    }
  }
  return `${tagged} photos tagged across ${products.length} products (${conflicts} conflicts kept)`;
}

/** 7. live-card-data.json imageRatios → Product.cardImageRatio. */
async function cardData(tx: Tx): Promise<string> {
  const ratios = readData<{ imageRatios?: Record<string, number> }>('live-card-data.json', {}).imageRatios ?? {};
  let set = 0;
  for (const [handle, value] of Object.entries(ratios)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    set += (await tx.product.updateMany({ where: { handle }, data: { cardImageRatio: value / 100 } })).count;
  }
  return `${set} card photo ratios`;
}

function localCollectionImage(handle: string): string | null {
  const dir = path.join(PUBLIC, 'images', 'collections');
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => n.replace(/\.[a-z0-9]+$/i, '') === handle);
  return f ? `/images/collections/${f}` : null;
}

const SYSTEM_HANDLES = new Set(['frontpage', 'all', 'all-1']);

/** 8. collections-index.json → CollectionIndexCard rows, plus local covers for collections without one. */
async function collectionIndex(tx: Tx, log: (s: string) => void): Promise<string> {
  const index = readData<{ handle: string; title: string; image?: string; placeholder?: number }[]>('collections-index.json', []);
  const collections = await tx.collection.findMany({ select: { id: true, handle: true, image: true } });
  const byHandle = new Map(collections.map((c) => [c.handle, c]));
  let cards = 0;
  let system = 0;
  let skipped = 0;
  let covers = 0;
  for (let i = 0; i < index.length; i++) {
    const entry = index[i];
    const placeholder = entry.placeholder ?? 1;
    const col = byHandle.get(entry.handle);
    if (col) {
      await tx.collectionIndexCard.upsert({
        where: { collectionId: col.id },
        update: { position: i, placeholder },
        create: { collectionId: col.id, position: i, placeholder },
      });
      cards++;
      if (col.image == null && entry.image) {
        const local = localCollectionImage(entry.handle);
        if (local) {
          await tx.collection.update({ where: { id: col.id }, data: { image: local } });
          covers++;
        }
      }
    } else if (SYSTEM_HANDLES.has(entry.handle)) {
      const systemImage = entry.image ? localCollectionImage(entry.handle) : null;
      await tx.collectionIndexCard.upsert({
        where: { systemHandle: entry.handle },
        update: { systemTitle: entry.title, systemImage, position: i, placeholder },
        create: { systemHandle: entry.handle, systemTitle: entry.title, systemImage, position: i, placeholder },
      });
      system++;
    } else {
      skipped++;
      log(`  collection-index: "${entry.handle}" is not a collection, skipped`);
    }
  }
  return `${cards} collection cards, ${system} built-in cards, ${skipped} skipped, ${covers} covers set`;
}

async function imageSize(src: string, fallback: { width: number; height: number }): Promise<{ width: number; height: number }> {
  if (src.startsWith('/') && !src.startsWith('//')) {
    const file = path.join(PUBLIC, decodeURIComponent(src.split(/[?#]/)[0]));
    if (file.startsWith(PUBLIC + path.sep) && existsSync(file)) {
      try {
        const meta = await sharp(file).metadata();
        if (meta.width && meta.height) return { width: meta.width, height: meta.height };
      } catch {
        // fall through
      }
    }
  }
  return fallback;
}

/** Drop the content's first element when it is an <img> with the featured image's src. */
function dropLeadingImage(html: string, src: string): string {
  const m = html.match(/^\s*(?:<p>\s*)?<img\b[^>]*>(?:\s*<\/p>)?/i);
  if (!m) return html;
  const imgSrc = m[0].match(/\ssrc=["']([^"']*)["']/i)?.[1];
  return imgSrc === src ? html.slice(m[0].length) : html;
}

/** 9. Page kinds; TEXT bodies → clean rich text; BLOG bodies → fields + clean rich text; DESIGNED documents → <main>. */
async function pages(tx: Tx, log: (s: string) => void): Promise<string> {
  const designed = new Set(DESIGNED_PAGE_HANDLES);
  const rows = await tx.page.findMany({
    select: { id: true, handle: true, bodyHtml: true, legacyIsBlogPost: true, createdAt: true },
  });
  const counts = { TEXT: 0, BLOG: 0, DESIGNED: 0, docs: 0 };
  for (const p of rows) {
    const kind = p.handle.startsWith(BLOG_HANDLE_PREFIX) || p.legacyIsBlogPost ? 'BLOG' : designed.has(p.handle) ? 'DESIGNED' : 'TEXT';
    counts[kind]++;
    if (kind === 'TEXT') {
      let body = p.bodyHtml;
      if (DOC_RE.test(body)) {
        const inner = extractRteFromDocument(body);
        if (inner != null) {
          body = inner;
          counts.docs++;
        } else log(`  pages: ${p.handle}: whole document without a content area, left as is`);
      }
      await tx.page.update({ where: { id: p.id }, data: { kind, bodyHtml: tidyInlineMarks(wrapLooseInline(sanitizeRichText(tableToLists(body)))) } });
    } else if (kind === 'BLOG') {
      const a = parseLegacyArticle(p.bodyHtml);
      const src = a.image?.src ?? null;
      const featuredImage = src && (src.startsWith('/') || src.startsWith('https://')) && !src.startsWith('//') ? src : null;
      const size = featuredImage
        ? await imageSize(featuredImage, { width: a.image?.width ?? 1920, height: a.image?.height ?? 800 })
        : null;
      let content = youtubeIframesToTiptap(a.contentHtml);
      content = tableToLists(content);
      content = sanitizeRichText(content);
      if (featuredImage) content = dropLeadingImage(content, featuredImage).trim();
      content = tidyInlineMarks(wrapLooseInline(content));
      await tx.page.update({
        where: { id: p.id },
        data: {
          kind,
          publishedAt: a.publishedAt ?? p.createdAt,
          author: a.author ?? '',
          tags: a.tags.map((t) => t.label.replace(/,/g, ' ').trim()).filter(Boolean).join(','),
          featuredImage,
          featuredImageWidth: size?.width ?? null,
          featuredImageHeight: size?.height ?? null,
          bodyHtml: content,
        },
      });
    } else {
      let body = p.bodyHtml;
      if (DOC_RE.test(body)) {
        const main = extractMainFromDocument(body);
        if (main != null) {
          body = main;
          counts.docs++;
        } else log(`  pages: ${p.handle}: whole document without <main>, left as is`);
      }
      await tx.page.update({ where: { id: p.id }, data: { kind, ...(body !== p.bodyHtml ? { bodyHtml: body } : {}) } });
    }
  }
  return `${rows.length} pages → TEXT ${counts.TEXT}, BLOG ${counts.BLOG}, DESIGNED ${counts.DESIGNED} (${counts.docs} whole documents unwrapped)`;
}

/**
 * 9b. TEXT/BLOG bodies converted before step 9 did this: text and bold runs left between blocks (legacy sub-title
 * divs) → one <p> per line, empty bold runs dropped and touching ones joined, so the stored body is what the editor
 * saves and the first editor save does not change the page's look.
 */
async function pageBlocks(tx: Tx): Promise<string> {
  const rows = await tx.page.findMany({ where: { kind: { in: ['TEXT', 'BLOG'] } }, select: { id: true, bodyHtml: true } });
  let changed = 0;
  for (const p of rows) {
    const body = tidyInlineMarks(wrapLooseInline(p.bodyHtml));
    if (body !== p.bodyHtml) {
      await tx.page.update({ where: { id: p.id }, data: { bodyHtml: body } });
      changed++;
    }
  }
  return `${changed} of ${rows.length} text/blog bodies: loose lines wrapped, bold runs tidied`;
}

/** 10. Product descriptions and collection descriptions → sanitised rich text. */
async function sanitizeRichTextStep(tx: Tx): Promise<string> {
  let products = 0;
  for (const p of await tx.product.findMany({ select: { id: true, bodyHtml: true } })) {
    const clean = sanitizeRichText(p.bodyHtml);
    if (clean !== p.bodyHtml) {
      await tx.product.update({ where: { id: p.id }, data: { bodyHtml: clean } });
      products++;
    }
  }
  let collections = 0;
  for (const c of await tx.collection.findMany({ select: { id: true, description: true } })) {
    const clean = sanitizeRichText(c.description);
    if (clean !== c.description) {
      await tx.collection.update({ where: { id: c.id }, data: { description: clean } });
      collections++;
    }
  }
  return `${products} product descriptions, ${collections} collection descriptions cleaned`;
}

/** 11. STACK badge → newColumn=false; "#" → ""; bare ?page=1 stripped; TOPBAR / FOOTER_3 removed. */
async function menus(tx: Tx): Promise<string> {
  const stacked = (await tx.menuItem.updateMany({ where: { legacyBadge: 'STACK' }, data: { newColumn: false } })).count;
  const hashes = (await tx.menuItem.updateMany({ where: { href: '#' }, data: { href: '' } })).count;
  let pages = 0;
  for (const m of await tx.menuItem.findMany({ where: { href: { contains: 'page=1' } }, select: { id: true, href: true } })) {
    const next = m.href.replace(/\?page=1(?=$|#)/, '');
    if (next !== m.href) {
      await tx.menuItem.update({ where: { id: m.id }, data: { href: next } });
      pages++;
    }
  }
  const removed = (await tx.menuItem.deleteMany({ where: { location: { in: ['TOPBAR', 'FOOTER_3'] } } })).count;
  return `${stacked} stacked headings, ${hashes} "#" links cleared, ${pages} "?page=1" stripped, ${removed} TOPBAR/FOOTER_3 items removed`;
}

/**
 * 12. Only home slideshow banners exist now. `Banner.location` is no longer in the schema, so read it with raw SQL,
 * and only while the old column still exists (a database migrated before the column was dropped has nothing to do).
 */
async function banners(tx: Tx, log: (s: string) => void): Promise<string> {
  const columns = await tx.$queryRawUnsafe<{ name: string }[]>(
    "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Banner'",
  );
  if (!columns.some((c) => c.name === 'location')) return 'no location column: nothing to check';
  const other = await tx.$queryRawUnsafe<{ id: number | bigint; location: string; title: string }[]>(
    "SELECT id, location, title FROM `Banner` WHERE location <> 'HOME_HERO'",
  );
  for (const b of other) log(`  banners: deleting banner ${b.id} (${b.location}) "${b.title}"`);
  if (other.length) await tx.banner.deleteMany({ where: { id: { in: other.map((b) => Number(b.id)) } } });
  return `${other.length} non-home banners deleted`;
}

/** Same rule as normalizeWhatsAppNumber in src/lib/whatsapp.ts (kept local: no src/components imports here). */
function normalizeWhatsApp(input: string): string | null {
  let d = (input ?? '').replace(/\D/g, '');
  if (d.startsWith('0092')) d = d.slice(2);
  if (/^03\d{9}$/.test(d)) d = `92${d.slice(1)}`;
  else if (/^3\d{9}$/.test(d)) d = `92${d}`;
  return /^923\d{9}$/.test(d) ? d : null;
}

export const DEFAULT_WHATSAPP_NUMBER = '923092050463';

/** 13. Settings: drop shipping keys, clear "#" socials, valid WhatsApp number, greeting/closing and announcement keys. */
async function settings(tx: Tx): Promise<string> {
  const dropped = (await tx.siteSetting.deleteMany({ where: { key: { in: ['shippingFee', 'freeShippingThreshold'] } } })).count;
  const socials = (await tx.siteSetting.updateMany({ where: { key: { in: ['facebook', 'instagram', 'youtube', 'linkedin'] }, value: '#' }, data: { value: '' } })).count;
  const current = (await tx.siteSetting.findUnique({ where: { key: 'whatsapp' } }))?.value ?? '';
  const number = normalizeWhatsApp(current) ?? DEFAULT_WHATSAPP_NUMBER;
  await tx.siteSetting.upsert({ where: { key: 'whatsapp' }, update: { value: number }, create: { key: 'whatsapp', value: number } });
  const defaults: Record<string, string> = {
    whatsappGreeting: "Hello Cozy Furnitures! I'd like to order this product:",
    whatsappAvailabilityGreeting: "Hello Cozy Furnitures! I'd like to ask about the availability of this product:",
    whatsappClosing: 'Please confirm availability and delivery to my city: ',
    announcementHref: '',
    announcementCta: '',
    announcementCtaHref: '',
  };
  let added = 0;
  for (const [key, value] of Object.entries(defaults)) {
    const exists = await tx.siteSetting.findUnique({ where: { key } });
    if (!exists) {
      await tx.siteSetting.create({ data: { key, value } });
      added++;
    }
  }
  return `${dropped} shipping keys removed, ${socials} "#" social links cleared, whatsapp=${number}${number !== current ? ` (was "${current}")` : ''}, ${added} keys added`;
}

/** 14. Admin display name: the old seed named the admin after the other business. */
async function adminName(tx: Tx): Promise<string> {
  const n = (await tx.adminUser.updateMany({ where: { name: 'Interwood Admin' }, data: { name: 'Cozy Furnitures Admin' } })).count;
  return `${n} admin name${n === 1 ? '' : 's'} changed to "Cozy Furnitures Admin"`;
}

/** 15. Page titles imported from the old site: entities decoded ("Support &amp; Inquiries"), lead-form named. */
const PAGE_TITLES: Record<string, string> = { 'lead-form': 'Information form' };

async function pageTitles(tx: Tx): Promise<string> {
  const rows = await tx.page.findMany({ select: { id: true, handle: true, title: true } });
  let changed = 0;
  for (const p of rows) {
    const named = PAGE_TITLES[p.handle];
    const title = named && p.title === p.handle ? named : decodeEntities(p.title).replace(/\s+/g, ' ').trim();
    if (title && title !== p.title) {
      await tx.page.update({ where: { id: p.id }, data: { title } });
      changed++;
    }
  }
  return `${changed} page title${changed === 1 ? '' : 's'} made readable`;
}

const STEPS: Step[] = [
  { id: 'options-to-rows', run: optionsToRows },
  { id: 'variant-status', run: variantStatus },
  { id: 'product-flags', run: productFlags },
  { id: 'product-layout-content', run: productLayoutContent },
  { id: 'product-layouts', run: productLayouts },
  { id: 'swatches', run: swatches },
  { id: 'photo-tags', run: photoTags },
  { id: 'card-data', run: cardData },
  { id: 'collection-index', run: collectionIndex },
  { id: 'pages', run: pages },
  { id: 'page-blocks', run: pageBlocks },
  { id: 'sanitize-rich-text', run: sanitizeRichTextStep },
  { id: 'menus', run: menus },
  { id: 'banners', run: banners },
  { id: 'settings', run: settings },
  { id: 'admin-name', run: adminName },
  { id: 'page-titles', run: pageTitles },
];

/* ------------------------------------------------------------------------------------------ runner */

export async function runAdminEasyModeMigration(prisma: PrismaClient, opts: Opts = {}): Promise<MigrationReport> {
  const log = opts.log ?? ((s: string) => console.log(s));
  if (opts.backup !== false && !opts.dryRun) log(`backup: ${backupDatabase('before-easy-mode-migration')}`);
  try {
    return await prisma.$transaction(
      async (tx) => {
        const report: MigrationReport = { steps: [] };
        for (const step of STEPS) {
          const id = `easy-mode:${step.id}`;
          const done = await tx.migrationStep.findUnique({ where: { id } });
          if (done) {
            report.steps.push({ id: step.id, status: 'skipped', summary: `skipped (applied ${done.appliedAt.toISOString().slice(0, 16).replace('T', ' ')})` });
            continue;
          }
          const summary = await step.run(tx, log);
          await tx.migrationStep.create({ data: { id, summary } });
          log(`${step.id}: ${summary}`);
          report.steps.push({ id: step.id, status: 'applied', summary });
        }
        if (opts.dryRun) throw new DryRunRollback(report);
        return report;
      },
      { timeout: 300_000, maxWait: 10_000 },
    );
  } catch (e) {
    if (e instanceof DryRunRollback) return e.report;
    throw e;
  }
}

export function printReport(report: MigrationReport, log: (s: string) => void = console.log) {
  const w = Math.max(...report.steps.map((s) => s.id.length));
  log('');
  log(`${'step'.padEnd(w)}  status   summary`);
  log(`${'-'.repeat(w)}  -------  ${'-'.repeat(40)}`);
  for (const s of report.steps) log(`${s.id.padEnd(w)}  ${s.status.padEnd(7)}  ${s.summary}`);
}

/** Writes every Order/OrderItem row (raw SQL, so it works after the models are removed) when any exist. */
export async function exportOrders(prisma: PrismaClient): Promise<string | null> {
  let orders: unknown[] = [];
  let items: unknown[] = [];
  try {
    orders = await prisma.$queryRawUnsafe<unknown[]>('SELECT * FROM `Order`');
    items = await prisma.$queryRawUnsafe<unknown[]>('SELECT * FROM `OrderItem`');
  } catch {
    return null; // tables already gone
  }
  if (!orders.length) return null;
  const dir = path.join(ROOT, 'prisma', 'backups');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `orders-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const json = JSON.stringify({ orders, items }, (_k, v) => (typeof v === 'bigint' ? Number(v) : v), 2);
  writeFileSync(file, json);
  return file;
}

if (require.main === module) {
  const args = new Set(process.argv.slice(2));
  const prisma = new PrismaClient();
  (async () => {
    if (args.has('--export-orders')) {
      const file = await exportOrders(prisma);
      console.log(file ? `orders exported: ${file}` : 'no orders to export');
      return;
    }
    const report = await runAdminEasyModeMigration(prisma, { dryRun: args.has('--dry-run'), backup: !args.has('--no-backup') });
    printReport(report);
    if (report.steps.every((s) => s.status === 'skipped')) console.log('\nnothing to do: every step was already applied');
    if (args.has('--dry-run')) console.log('\ndry run: every change was rolled back');
  })()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
