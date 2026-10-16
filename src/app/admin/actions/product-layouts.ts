'use server';

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { extractUploadUrls, releaseUploads } from '@/lib/uploads';
import { DEFAULT_LAYOUT_KEY, MAX_LAYOUT_NAME, PROTECTED_LAYOUT_KEYS, copyName, layoutKeyFromName, layoutNameKey } from '@/lib/product-layouts';
import {
  isSectionKind,
  parseSectionData,
  parseSnapshot,
  sectionRefs,
  serializeSnapshot,
  type LayoutSnapshot,
  type SnapshotSection,
} from '@/lib/product-layout-sections';
import {
  LayoutInputError,
  cleanLabel,
  cleanLayoutName,
  draftCollectionIds,
  draftImageUrls,
  mergeLayoutDraft,
  mergedToSnapshot,
  parseLayoutDraft,
  type MergeContext,
  type MergedSection,
  type StoredRow,
} from '@/lib/product-layout-merge';
import { MAX_DESCRIPTION, type LayoutActionError, type LayoutDraft } from '@/lib/product-layout-draft';
import { lockLayout } from '@/lib/layout-lock';
import { loadLayoutEditorData, layoutUsage, type LayoutEditorData } from '@/app/admin/(panel)/product-layouts/_lib/load';

/**
 * Admin actions for product page layouts (docs/product-layouts/SPEC.md §5, §9.6, §10). Every action starts with
 * `requireAdmin()`. Section content is validated and merged by `@/lib/product-layout-merge` (the base/merge rule).
 */

const PREVIEW_TTL_MS = 2 * 60 * 60 * 1000;
const GENERIC = 'Something went wrong. Please reload the page and try again.';

/** A database id from a request: a positive whole number, or null (no coercion of strings or fractions). */
function asId(v: unknown): number | null {
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null;
}

/** A paging number from a request: a whole number clamped to [0, max]; anything else becomes `fallback`. */
function asCount(v: unknown, fallback: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(Math.floor(v), 0), max) : fallback;
}

type Fail = LayoutActionError;

function revalidateLayouts() {
  revalidatePath('/admin/product-layouts', 'layout');
  revalidatePath('/admin/products', 'layout');
  revalidatePath('/products/[handle]', 'page');
}

function inputError(e: unknown): Fail {
  if (e instanceof LayoutInputError) {
    if (e.stale) return { ok: false, code: 'STALE', error: 'This layout changed somewhere else. Please reload.' };
    return { ok: false, code: 'INVALID', error: e.message, ...(e.field ? { field: e.field } : {}) };
  }
  throw e;
}

const isP2002 = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const p2002Target = (e: unknown): string => {
  const t = (e as Prisma.PrismaClientKnownRequestError).meta?.target;
  return Array.isArray(t) ? t.join(',') : String(t ?? '');
};
const nameTaken = (name: string): Fail => ({ ok: false, code: 'INVALID', error: `Another layout is already called “${name}”.`, field: 'name' });

type LayoutRow = {
  id: number;
  key: string;
  name: string;
  description: string;
  updatedAt: Date;
  previousVersion: string | null;
  originalVersion: string | null;
  sections: (StoredRow & { position: number; refs: string })[];
};

async function loadLayout(id: number): Promise<LayoutRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.productLayout.findUnique({
    where: { id },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      updatedAt: true,
      previousVersion: true,
      originalVersion: true,
      sections: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: { id: true, position: true, kind: true, hidden: true, bodyHtml: true, data: true, refs: true, collectionId: true },
      },
    },
  });
}

/** Database lookups the merge needs (uploads and collections the draft mentions, the layout's rows and snapshots). */
async function mergeContext(layout: LayoutRow, draft: LayoutDraft, storedAllowed: boolean): Promise<MergeContext> {
  const urls = draftImageUrls(draft);
  const ids = draftCollectionIds(draft);
  const [uploads, collections] = await Promise.all([
    urls.length ? prisma.upload.findMany({ where: { url: { in: urls } }, select: { url: true, width: true, height: true } }) : [],
    ids.length ? prisma.collection.findMany({ where: { id: { in: ids } }, select: { id: true, handle: true } }) : [],
  ]);
  return {
    rows: new Map(layout.sections.map((r) => [r.id, r])),
    storedAllowed,
    previous: parseSnapshot(layout.previousVersion),
    original: parseSnapshot(layout.originalVersion),
    uploads: new Map(uploads.map((u) => [u.url, { width: u.width, height: u.height }])),
    collections: new Map(collections.map((c) => [c.id, { handle: c.handle }])),
  };
}

/** Parse + name checks + merge; throws LayoutInputError, returns section errors as a Fail. */
async function prepare(raw: unknown, layout: LayoutRow, storedAllowed: boolean, nameOverride?: string) {
  const draft = parseLayoutDraft(raw);
  const { name, description } = cleanLayoutName(nameOverride ?? draft.name, draft.description);
  const ctx = await mergeContext(layout, draft, storedAllowed);
  const { sections, errors } = mergeLayoutDraft(draft, ctx);
  if (Object.keys(errors).length) {
    return { fail: { ok: false, code: 'INVALID', error: 'Please fix the highlighted sections.', sectionErrors: errors } as Fail };
  }
  return { name, description, sections };
}

function snapshotOf(layout: { name: string; description: string; sections: SnapshotSection[] }): string {
  return serializeSnapshot(layout);
}

function rowsToSnapshot(rows: LayoutRow['sections']): SnapshotSection[] {
  return rows.filter((r) => isSectionKind(r.kind)).map((r) => ({ kind: r.kind as SnapshotSection['kind'], hidden: r.hidden, bodyHtml: r.bodyHtml, data: r.data, collectionId: r.collectionId }));
}

/** Every upload URL rows or a snapshot refer to (release candidates; `releaseUploads` keeps referenced ones). */
function rowUrls(rows: { kind: string; bodyHtml: string; refs?: string; data?: string }[]): string[] {
  return rows.flatMap((r) => [...(r.refs ?? '').split('\n'), ...extractUploadUrls(r.bodyHtml)]).filter((u) => u.startsWith('/uploads/'));
}
function snapshotUrls(json: string | null): string[] {
  const snap = parseSnapshot(json);
  if (!snap) return [];
  return snap.sections.flatMap((s) => [...sectionRefs(s.kind, parseSectionData(s.kind, s.data).data, s.bodyHtml).split('\n'), ...extractUploadUrls(s.bodyHtml)]).filter((u) => u.startsWith('/uploads/'));
}

async function takenKeys(): Promise<{ keys: Set<string>; nameKeys: Set<string>; maxPosition: number }> {
  const all = await prisma.productLayout.findMany({ select: { key: true, nameKey: true, position: true } });
  return { keys: new Set(all.map((l) => l.key)), nameKeys: new Set(all.map((l) => l.nameKey)), maxPosition: all.reduce((m, l) => Math.max(m, l.position), -1) };
}

/** Creates a layout with the given sections; retries on a key clash (two creates at once). */
async function createLayoutWithSections(opts: {
  name: string;
  description: string;
  originalVersion: string | null;
  sections: { kind: string; hidden: boolean; bodyHtml: string; data: string; refs: string; collectionId: number | null }[];
  assignProductId?: number;
  uniqueName?: (taken: Set<string>) => string;
}): Promise<{ ok: true; id: number; name: string } | Fail> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const taken = await takenKeys();
    const name = opts.uniqueName ? opts.uniqueName(taken.nameKeys) : opts.name;
    if (!opts.uniqueName && taken.nameKeys.has(layoutNameKey(name))) return nameTaken(name);
    const key = layoutKeyFromName(name, taken.keys);
    try {
      const id = await prisma.$transaction(async (tx) => {
        const l = await tx.productLayout.create({
          data: { key, name, nameKey: layoutNameKey(name), description: opts.description, position: taken.maxPosition + 1, originalVersion: opts.originalVersion },
        });
        for (const [position, s] of opts.sections.entries()) {
          await tx.productLayoutSection.create({
            data: { layoutId: l.id, position, kind: s.kind, hidden: s.hidden, bodyHtml: s.bodyHtml, data: s.data, refs: s.refs, collectionId: s.collectionId },
          });
        }
        if (opts.assignProductId != null) await tx.product.update({ where: { id: opts.assignProductId }, data: { layout: key } });
        return l.id;
      });
      revalidateLayouts();
      return { ok: true, id, name };
    } catch (e) {
      if (isP2002(e)) {
        if (!opts.uniqueName && p2002Target(e).includes('nameKey')) return nameTaken(name);
        continue; // the key or name was taken a moment ago: try the next one
      }
      throw e;
    }
  }
  return { ok: false, code: 'INVALID', error: 'The layout could not be created. Please try again.' };
}

/* ------------------------------------------------------------------------------------------------ save */

export type SaveLayoutResult = { ok: true; updatedAt: string; ids: Record<string, number>; data: LayoutEditorData } | Fail;

export async function saveProductLayoutAction(input: { layoutId: number; updatedAt: string; draft: unknown }): Promise<SaveLayoutResult> {
  await requireAdmin();
  if (!input || typeof input !== 'object') return { ok: false, code: 'INVALID', error: GENERIC };
  const layout = await loadLayout(Number(input.layoutId));
  if (!layout) return { ok: false, code: 'INVALID', error: 'This layout no longer exists. It may have been deleted in another tab.' };
  if (layout.updatedAt.toISOString() !== input.updatedAt) return { ok: false, code: 'STALE', error: 'Someone else saved this layout a moment ago.' };

  let prepared: Awaited<ReturnType<typeof prepare>>;
  try {
    prepared = await prepare(input.draft, layout, true);
  } catch (e) {
    return inputError(e);
  }
  if ('fail' in prepared) return prepared.fail!;
  const { name, description, sections } = prepared;

  const clash = await prisma.productLayout.findFirst({ where: { nameKey: layoutNameKey(name), id: { not: layout.id } }, select: { id: true } });
  if (clash) return nameTaken(name);

  const ids: Record<string, number> = {};
  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const bumped = await tx.productLayout.updateMany({
        where: { id: layout.id, updatedAt: layout.updatedAt },
        data: {
          updatedAt: now,
          name,
          nameKey: layoutNameKey(name),
          description,
          previousVersion: snapshotOf({ name: layout.name, description: layout.description, sections: rowsToSnapshot(layout.sections) }),
        },
      });
      if (bumped.count === 0) throw new LayoutInputError('stale', undefined, true);
      const own = new Map(layout.sections.map((r) => [r.id, r]));
      const kept = new Set<number>();
      for (const [position, s] of sections.entries()) {
        const row = s.storedId != null ? own.get(s.storedId) : undefined;
        if (row) {
          kept.add(row.id);
          ids[s.key] = row.id;
          const same =
            row.position === position && row.hidden === s.hidden && row.bodyHtml === s.bodyHtml && row.data === s.data && row.collectionId === s.collectionId && row.refs === s.refs;
          if (!same) {
            await tx.productLayoutSection.updateMany({
              where: { id: row.id, layoutId: layout.id },
              data: { position, hidden: s.hidden, bodyHtml: s.bodyHtml, data: s.data, refs: s.refs, collectionId: s.collectionId },
            });
          }
        } else {
          const created = await tx.productLayoutSection.create({
            data: { layoutId: layout.id, position, kind: s.kind, hidden: s.hidden, bodyHtml: s.bodyHtml, data: s.data, refs: s.refs, collectionId: s.collectionId },
          });
          ids[s.key] = created.id;
        }
      }
      const removed = layout.sections.filter((r) => !kept.has(r.id)).map((r) => r.id);
      if (removed.length) await tx.productLayoutSection.deleteMany({ where: { layoutId: layout.id, id: { in: removed } } });
    });
  } catch (e) {
    if (e instanceof LayoutInputError && e.stale) return { ok: false, code: 'STALE', error: 'Someone else saved this layout a moment ago.' };
    if (isP2002(e)) return nameTaken(name);
    console.error('[saveProductLayoutAction]', e);
    return { ok: false, code: 'INVALID', error: 'The layout could not be saved. Please try again.' };
  }

  // photos only the outgoing undo snapshot (or a removed section) used are no longer needed
  await releaseUploads([...snapshotUrls(layout.previousVersion), ...rowUrls(layout.sections)]);
  revalidateLayouts();
  const data = await loadLayoutEditorData(layout.id);
  if (!data) return { ok: false, code: 'INVALID', error: 'The layout was saved but could not be reloaded. Please refresh the page.' };
  return { ok: true, updatedAt: data.layout.updatedAt, ids, data };
}

/* ------------------------------------------------------------------------------------ save as a new layout */

export async function saveAsNewLayoutAction(input: { sourceLayoutId: number; name: string; draft: unknown }): Promise<{ ok: true; id: number } | Fail> {
  await requireAdmin();
  if (!input || typeof input !== 'object') return { ok: false, code: 'INVALID', error: GENERIC };
  const source = await loadLayout(Number(input.sourceLayoutId));
  if (!source) return { ok: false, code: 'INVALID', error: 'The layout you started from no longer exists.' };
  let prepared: Awaited<ReturnType<typeof prepare>>;
  try {
    prepared = await prepare(input.draft, source, false, typeof input.name === 'string' ? input.name : '');
  } catch (e) {
    return inputError(e);
  }
  if ('fail' in prepared) return prepared.fail!;
  const res = await createLayoutWithSections({
    name: prepared.name,
    description: prepared.description,
    originalVersion: source.originalVersion,
    sections: prepared.sections,
  });
  return res.ok ? { ok: true, id: res.id } : res;
}

/* --------------------------------------------------------------------------------------------- preview */

export async function createLayoutPreviewAction(input: { layoutId: number; draft: unknown; productId: number }): Promise<{ ok: true; url: string } | Fail> {
  await requireAdmin();
  if (!input || typeof input !== 'object') return { ok: false, code: 'INVALID', error: GENERIC };
  const layout = await loadLayout(Number(input.layoutId));
  if (!layout) return { ok: false, code: 'INVALID', error: 'This layout no longer exists.' };
  const productId = Number(input.productId);
  const product = Number.isInteger(productId) && productId > 0 ? await prisma.product.findUnique({ where: { id: productId }, select: { handle: true } }) : null;
  if (!product) return { ok: false, code: 'INVALID', error: 'Please pick a product to preview on.' };
  let prepared: Awaited<ReturnType<typeof prepare>>;
  try {
    prepared = await prepare(input.draft, layout, true);
  } catch (e) {
    return inputError(e);
  }
  if ('fail' in prepared) return prepared.fail!;
  const token = randomBytes(16).toString('hex');
  await prisma.productLayoutPreview.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await prisma.productLayoutPreview.create({
    data: {
      token,
      layoutId: layout.id,
      sections: serializeSnapshot({ name: prepared.name, description: prepared.description, sections: mergedToSnapshot(prepared.sections as MergedSection[]) }),
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
    },
  });
  return { ok: true, url: `/products/${encodeURIComponent(product.handle)}?layoutPreview=${token}` };
}

/* ---------------------------------------------------------------------------------- create / duplicate */

function copyRows(rows: LayoutRow['sections']) {
  return rows.map((r) => ({ kind: r.kind, hidden: r.hidden, bodyHtml: r.bodyHtml, data: r.data, refs: r.refs, collectionId: r.collectionId }));
}

export async function createProductLayoutAction(input: { name: string; fromLayoutId: number | null }): Promise<{ ok: true; id: number } | Fail> {
  await requireAdmin();
  let name: string;
  try {
    ({ name } = cleanLayoutName(typeof input?.name === 'string' ? input.name : '', ''));
  } catch (e) {
    return inputError(e);
  }
  let source: LayoutRow | null = null;
  if (input.fromLayoutId != null) {
    source = await loadLayout(Number(input.fromLayoutId));
    if (!source) return { ok: false, code: 'INVALID', error: 'The layout you picked to start from no longer exists.' };
  }
  const res = await createLayoutWithSections({
    name,
    // "What it's for" describes the layout it was copied from, not this one: left for the owner to fill in
    description: '',
    originalVersion: source?.originalVersion ?? null,
    sections: source ? copyRows(source.sections) : [{ kind: 'recommendations', hidden: false, bodyHtml: '', data: '{}', refs: '', collectionId: null }],
  });
  return res.ok ? { ok: true, id: res.id } : res;
}

export async function duplicateProductLayoutAction(id: number): Promise<{ ok: true; id: number } | Fail> {
  await requireAdmin();
  const source = await loadLayout(Number(id));
  if (!source) return { ok: false, code: 'INVALID', error: 'That layout no longer exists.' };
  const res = await createLayoutWithSections({
    name: source.name,
    description: '', // the source's "What it's for" line describes the source; the editor asks for a new one
    originalVersion: source.originalVersion,
    sections: copyRows(source.sections),
    uniqueName: (taken) => copyName(source.name, taken),
  });
  return res.ok ? { ok: true, id: res.id } : res;
}

/** "What it's for" on a product's own layout: `Only for “<product>”.`, shortened to fit. */
function onlyForDescription(title: string): string {
  const t = cleanLabel(title);
  const room = MAX_DESCRIPTION - 'Only for “”.'.length;
  return `Only for “${t.length > room ? `${t.slice(0, room - 1).trimEnd()}…` : t}”.`;
}

/** "Give this product its own layout": a copy of its layout named "<layout> – <product>", used by that product only. */
export async function makeLayoutForProductAction(input: { productId: number }): Promise<{ ok: true; id: number } | Fail> {
  await requireAdmin();
  const productId = Number(input?.productId);
  const product = Number.isInteger(productId) && productId > 0 ? await prisma.product.findUnique({ where: { id: productId }, select: { id: true, title: true, layout: true } }) : null;
  if (!product) return { ok: false, code: 'INVALID', error: 'This product no longer exists.' };
  const layoutRow =
    (await prisma.productLayout.findUnique({ where: { key: product.layout }, select: { id: true } })) ??
    (await prisma.productLayout.findUnique({ where: { key: DEFAULT_LAYOUT_KEY }, select: { id: true } }));
  const source = layoutRow ? await loadLayout(layoutRow.id) : null;
  if (!source) return { ok: false, code: 'INVALID', error: "This product's layout no longer exists." };
  const base = `${source.name} – ${cleanLabel(product.title)}`;
  const res = await createLayoutWithSections({
    name: base,
    description: onlyForDescription(product.title),
    originalVersion: source.originalVersion,
    sections: copyRows(source.sections),
    assignProductId: product.id,
    uniqueName: (taken) => {
      for (let n = 1; ; n++) {
        const suffix = n === 1 ? '' : ` ${n}`;
        const room = MAX_LAYOUT_NAME - suffix.length;
        const name = `${base.length > room ? `${base.slice(0, room - 1).trimEnd()}…` : base}${suffix}`;
        if (!taken.has(layoutNameKey(name))) return name;
      }
    },
  });
  if (res.ok) revalidatePath(`/admin/products/${product.id}`);
  return res.ok ? { ok: true, id: res.id } : res;
}

/* ------------------------------------------------------------------------------------------- delete */

export async function deleteProductLayoutAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  const layout = await loadLayout(id);
  if (!layout) redirect('/admin/product-layouts?deleted=1');
  if (PROTECTED_LAYOUT_KEYS.includes(layout.key)) redirect(`/admin/product-layouts/${layout.id}?error=protected`);
  let deleted = false;
  let gone = false;
  await prisma.$transaction(async (tx) => {
    // lock first: a move onto this layout running at the same moment waits, then sees it gone (see lockLayout)
    if (!(await lockLayout(tx, { id: layout.id }))) {
      gone = true; // deleted in another tab a moment ago
      return;
    }
    const used = await tx.product.count({ where: { layout: layout.key } });
    if (used > 0) return;
    await tx.productLayout.delete({ where: { id: layout.id } });
    deleted = true;
  });
  if (gone) redirect('/admin/product-layouts?deleted=1');
  if (!deleted) redirect(`/admin/product-layouts/${layout.id}?error=in-use`);
  await releaseUploads([...rowUrls(layout.sections), ...snapshotUrls(layout.previousVersion), ...snapshotUrls(layout.originalVersion)]);
  revalidateLayouts();
  redirect('/admin/product-layouts?deleted=1');
}

/* ------------------------------------------------------------------------------------------- usage */

export async function layoutUsageAction(id: number): Promise<{ total: number; drafts: number } | null> {
  await requireAdmin();
  const layout = Number.isInteger(id) && id > 0 ? await prisma.productLayout.findUnique({ where: { id }, select: { key: true } }) : null;
  if (!layout) return null;
  return (await layoutUsage()).get(layout.key) ?? { total: 0, drafts: 0 };
}

/* -------------------------------------------------------------------------------------- move products */

export type MoveCandidate = { id: number; title: string; image: string | null; status: string; layoutName: string };

/** Products for the Move dialog's checklist and the preview picker (20 per page). */
export async function searchProductsForMoveAction(input: { q?: string; layoutId?: number | null; collectionId?: number | null; skip?: number; take?: number }): Promise<{
  items: MoveCandidate[];
  total: number;
}> {
  await requireAdmin();
  const q = typeof input?.q === 'string' ? input.q.trim().slice(0, 100) : '';
  // null/undefined = any layout; anything else must be a real layout id (a malformed one matches nothing)
  const wantsLayout = input?.layoutId != null;
  const layoutId = asId(input?.layoutId);
  const layout = layoutId ? await prisma.productLayout.findUnique({ where: { id: layoutId }, select: { key: true } }) : null;
  if (wantsLayout && !layout) return { items: [], total: 0 };
  if (input?.collectionId != null && !asId(input.collectionId)) return { items: [], total: 0 };
  const collectionId = asId(input?.collectionId);
  const where: Prisma.ProductWhereInput = {
    ...(layout ? { layout: layout.key } : {}),
    ...(collectionId ? { collections: { some: { id: collectionId } } } : {}),
    ...(q ? { title: { contains: q } } : {}),
  };
  const take = asCount(input?.take, 20, 50);
  const skip = asCount(input?.skip, 0, 1_000_000);
  const [total, rows, names] = await Promise.all([
    prisma.product.count({ where }),
    take
      ? prisma.product.findMany({
          where,
          orderBy: [{ status: 'asc' }, { title: 'asc' }, { id: 'asc' }],
          skip,
          take,
          select: { id: true, title: true, status: true, layout: true, images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], take: 1, select: { src: true } } },
        })
      : Promise.resolve([]),
    prisma.productLayout.findMany({ select: { key: true, name: true } }),
  ]);
  const nameBy = new Map(names.map((n) => [n.key, n.name]));
  return {
    total,
    items: rows.map((r) => ({ id: r.id, title: r.title, image: r.images[0]?.src ?? null, status: r.status, layoutName: nameBy.get(r.layout) ?? nameBy.get(DEFAULT_LAYOUT_KEY) ?? '' })),
  };
}

export type MoveResult = { ok: true; count: number; movedIds: number[]; fromKey: string; toKey: string; toName: string } | { ok: false; error: string };

export async function moveProductsAction(input: {
  fromId: number;
  toId: number;
  scope: 'all' | 'collection' | 'chosen';
  collectionId?: number | null;
  productIds?: number[];
}): Promise<MoveResult> {
  await requireAdmin();
  if (input?.fromId == null || input?.toId == null) return { ok: false, error: 'Please choose the layout to move them to.' };
  const fromId = asId(input.fromId);
  const toId = asId(input.toId);
  if (!fromId || !toId) return { ok: false, error: GENERIC };
  if (fromId === toId) return { ok: false, error: 'Choose a different layout to move them to.' };
  const [from, to] = await Promise.all([
    prisma.productLayout.findUnique({ where: { id: fromId }, select: { key: true } }),
    prisma.productLayout.findUnique({ where: { id: toId }, select: { key: true, name: true } }),
  ]);
  if (!from) return { ok: false, error: 'The layout to move from no longer exists.' };
  if (!to) return { ok: false, error: 'The layout to move to no longer exists. Pick another one.' };
  const scope = input.scope;
  const where: Prisma.ProductWhereInput = { layout: from.key };
  if (scope === 'collection') {
    const collectionId = asId(input.collectionId);
    if (!collectionId) return { ok: false, error: 'Please choose a collection.' };
    where.collections = { some: { id: collectionId } };
  } else if (scope === 'chosen') {
    const ids = Array.isArray(input.productIds) ? input.productIds.filter((n) => asId(n) !== null).slice(0, 5000) : [];
    if (!ids.length) return { ok: false, error: 'Tick the products to move.' };
    where.id = { in: ids };
  } else if (scope !== 'all') return { ok: false, error: GENERIC };

  const movedIds = await prisma.$transaction(async (tx) => {
    // lock first and re-check: the target may have been deleted since the lookup above (see lockLayout)
    if (!(await lockLayout(tx, { id: toId }))) return null;
    const ids = (await tx.product.findMany({ where, select: { id: true } })).map((p) => p.id);
    if (ids.length) await tx.product.updateMany({ where: { id: { in: ids } }, data: { layout: to.key } });
    return ids;
  });
  if (!movedIds) return { ok: false, error: 'The layout to move to no longer exists. Pick another one.' };
  revalidateLayouts();
  for (const id of movedIds.slice(0, 50)) revalidatePath(`/admin/products/${id}`);
  return { ok: true, count: movedIds.length, movedIds, fromKey: from.key, toKey: to.key, toName: to.name };
}

export async function undoMoveProductsAction(input: { movedIds: number[]; fromKey: string; toKey: string }): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requireAdmin();
  const ids = Array.isArray(input?.movedIds) ? input.movedIds.filter((n) => asId(n) !== null).slice(0, 5000) : [];
  if (typeof input?.fromKey !== 'string' || typeof input?.toKey !== 'string') return { ok: false, error: GENERIC };
  const { fromKey, toKey } = input;
  const count = await prisma.$transaction(async (tx) => {
    if (!(await lockLayout(tx, { key: fromKey }))) return null;
    return (await tx.product.updateMany({ where: { id: { in: ids }, layout: toKey }, data: { layout: fromKey } })).count;
  });
  if (count == null) return { ok: false, error: 'The layout they came from no longer exists.' };
  revalidateLayouts();
  return { ok: true, count };
}

/* ----------------------------------------------------------------------------------------- snapshot */

/** For scripts/tests: the snapshot type re-exported so callers don't import two modules. */
export type { LayoutSnapshot };
