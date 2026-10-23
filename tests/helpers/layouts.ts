import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { parseSectionData, type SectionKind } from '../../src/lib/product-layout-sections';
import { valuesFromData, type DraftSection, type LayoutDraft } from '../../src/lib/product-layout-draft';
import { releaseTestUploads } from './uploads';

/**
 * Helpers for the product page layout specs (docs/product-layouts/SPEC.md §13). Test data is tracked in a
 * `LayoutTestData` and removed by `cleanup()` (call it from afterAll), so a failing test never leaves a layout,
 * product, collection, preview or photo behind.
 */

const ROOT = path.resolve(__dirname, '../..');
const BASE = () => process.env.E2E_BASE_URL ?? 'http://localhost:3100';

/* ------------------------------------------------------------------------------------- server actions */

/**
 * The id of a server action, read from the dev server's manifest (`.next/server/server-reference-manifest.json`).
 * The action must have been compiled, i.e. a page that uses it has been opened once.
 */
export function actionId(exportedName: string, filename = 'app/admin/actions/product-layouts.ts'): string {
  const id = findActionId(exportedName, filename);
  if (id) return id;
  throw new Error(`Server action ${filename}#${exportedName} not compiled yet: open a page that uses it first`);
}

/**
 * Turbopack (`next dev --turbopack`) only registers the actions a page imports, so an exported action no page
 * uses cannot be called at all. True when the manifest comes from Turbopack and does not list the action.
 */
export function actionNotExposed(exportedName: string, filename = 'app/admin/actions/product-layouts.ts'): boolean {
  if (findActionId(exportedName, filename)) return false;
  const manifest = JSON.parse(readFileSync(path.join(ROOT, '.next/server/server-reference-manifest.json'), 'utf8')) as {
    node: Record<string, { filename?: string }>;
  };
  return Object.values(manifest.node).some((e) => e.filename?.startsWith('src/'));
}

function findActionId(exportedName: string, filename: string): string | null {
  const file = path.join(ROOT, '.next/server/server-reference-manifest.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as { node: Record<string, { filename?: string; exportedName?: string }> };
  // webpack names the file "app/…", Turbopack (`next dev --turbopack`) "src/app/…"
  const names = new Set([filename, `src/${filename}`]);
  for (const [id, entry] of Object.entries(manifest.node)) {
    if (entry.exportedName === exportedName && entry.filename && names.has(entry.filename)) return id;
  }
  return null;
}

export type ActionResponse<T = unknown> = { status: number; redirect: string | null; result: T | undefined };

/**
 * Calls a server action directly, the way the browser does (`Next-Action` header, JSON arguments), bypassing
 * every client-side check. `result` is the action's return value (undefined when it redirected).
 */
export async function callAction<T = unknown>(request: APIRequestContext, exportedName: string, args: unknown[], opts: { path?: string; filename?: string } = {}): Promise<ActionResponse<T>> {
  const res = await request.post(opts.path ?? '/admin/product-layouts', {
    headers: {
      'Next-Action': actionId(exportedName, opts.filename),
      'Content-Type': 'text/plain;charset=UTF-8',
      Accept: 'text/x-component',
      Origin: BASE(),
    },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  const text = await res.text();
  const line = text.split('\n').find((l) => l.startsWith('1:'));
  let result: T | undefined;
  if (line) {
    try {
      result = JSON.parse(line.slice(2)) as T;
    } catch {
      result = undefined;
    }
  }
  return { status: res.status(), redirect: res.headers()['x-action-redirect'] ?? null, result };
}

/** React's own encoder for server action arguments (the one the browser bundle uses). */
const { encodeReply } = createRequire(__filename)('next/dist/compiled/react-server-dom-webpack/client.node') as {
  encodeReply: (value: unknown) => Promise<string | FormData>;
};

/**
 * Calls a `(formData) => …` server action the way a `<form action={…}>` posts it from the browser (`Next-Action`
 * header, the FormData argument encoded by React), bypassing every client-side check. Returns the redirect target.
 * (The no-JavaScript `$ACTION_ID_…` post is not used: the Turbopack dev server answers it with a 500.)
 */
export async function callFormAction(request: APIRequestContext, exportedName: string, fields: Record<string, string>, opts: { path?: string; filename?: string } = {}): Promise<{ status: number; location: string | null }> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const body = await encodeReply([fd]);
  // a FormData keeps React's part order (the root part "0" last); a plain object would send "0" first, and the
  // server would decode the root before the fields it refers to had arrived
  let multipart: FormData;
  if (typeof body === 'string') {
    multipart = new FormData();
    multipart.append('0', body);
  } else multipart = body;
  const res = await request.post(opts.path ?? '/admin/product-layouts', {
    headers: { Origin: BASE(), 'Next-Action': actionId(exportedName, opts.filename), Accept: 'text/x-component' },
    multipart,
    maxRedirects: 0,
  });
  return { status: res.status(), location: res.headers()['location'] ?? res.headers()['x-action-redirect'] ?? null };
}

/* ------------------------------------------------------------------------------------------ database */

export type SectionRow = { position: number; kind: string; hidden: boolean; bodyHtml: string; data: string; refs: string; collectionId: number | null };

/** The stored section rows of a layout, in order, without ids (for byte-for-byte comparisons). */
export async function rowsOf(prisma: PrismaClient, layoutId: number): Promise<SectionRow[]> {
  return prisma.productLayoutSection.findMany({
    where: { layoutId },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { position: true, kind: true, hidden: true, bodyHtml: true, data: true, refs: true, collectionId: true },
  });
}

/** The draft the editor would start from (same keys and bases as `loadLayoutEditorData`), for direct action calls. */
export async function draftFromDb(prisma: PrismaClient, layoutId: number): Promise<{ updatedAt: string; draft: LayoutDraft }> {
  const l = await prisma.productLayout.findUniqueOrThrow({
    where: { id: layoutId },
    select: {
      name: true,
      description: true,
      updatedAt: true,
      sections: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, kind: true, hidden: true, bodyHtml: true, data: true, collectionId: true } },
    },
  });
  const sections = l.sections.map((r) => {
    const kind = r.kind as SectionKind;
    return {
      key: `s-${r.id}`,
      kind,
      base: { from: 'stored', id: r.id },
      hidden: r.hidden,
      bodyHtml: r.bodyHtml,
      values: valuesFromData(kind, parseSectionData(kind, r.data).data, r.collectionId),
    } as DraftSection;
  });
  return { updatedAt: l.updatedAt.toISOString(), draft: { name: l.name, description: l.description, sections } };
}

/** Runs `tests/helpers/upload-refs.ts` (the app's own `isUploadReferenced` / orphan sweep) against the dev database. */
export function uploadRefs(cmd: 'referenced' | 'sweep', urls: string[]): Record<string, boolean> {
  const out = execFileSync('npx', ['tsx', '--conditions=react-server', 'tests/helpers/upload-refs.ts', cmd, ...urls], { cwd: ROOT, encoding: 'utf8' });
  const line = out.trim().split('\n').pop() ?? '{}';
  return JSON.parse(line) as Record<string, boolean>;
}

/** Tracks everything a spec creates and removes it afterwards. */
export class LayoutTestData {
  readonly since = new Date(Date.now() - 1000);
  readonly stamp = Date.now();
  readonly layoutIds = new Set<number>();
  readonly productIds = new Set<number>();
  readonly collectionIds = new Set<number>();
  readonly uploadNames = new Set<string>();
  constructor(readonly prisma: PrismaClient) {}

  /** An ACTIVE (or DRAFT) product with one variant and a bundled photo, on `layoutKey`, in no collection. */
  async product(suffix: string, layoutKey: string, status: 'ACTIVE' | 'DRAFT' = 'ACTIVE') {
    const photo = await this.prisma.productImage.findFirstOrThrow({ where: { src: { startsWith: '/images/' } }, orderBy: { id: 'asc' }, select: { src: true, width: true, height: true } });
    const p = await this.prisma.product.create({
      data: {
        handle: `e2e-layout-${this.stamp}-${suffix}`,
        title: `E2E Layout product ${suffix} ${this.stamp}`,
        bodyHtml: '<p>Test product for the layout specs.</p>',
        status,
        layout: layoutKey,
        variants: { create: [{ title: 'Default Title', price: 1000, status: 'READY_TO_SHIP', position: 0 }] },
        images: { create: [{ src: photo.src, alt: '', position: 0, width: photo.width, height: photo.height }] },
      },
      select: { id: true, handle: true, title: true },
    });
    this.productIds.add(p.id);
    return p;
  }

  async collection(suffix: string, productIds: number[] = []) {
    const c = await this.prisma.collection.create({
      data: { handle: `e2e-layout-${this.stamp}-${suffix}`, title: `E2E Layout collection ${suffix} ${this.stamp}`, products: { connect: productIds.map((id) => ({ id })) } },
      select: { id: true, handle: true, title: true },
    });
    this.collectionIds.add(c.id);
    return c;
  }

  layoutFromUrl(url: string): number {
    const m = url.match(/\/admin\/product-layouts\/(\d+)/);
    if (!m) throw new Error(`not a layout editor URL: ${url}`);
    const id = Number(m[1]);
    this.layoutIds.add(id);
    return id;
  }

  async layoutKey(id: number): Promise<string> {
    return (await this.prisma.productLayout.findUniqueOrThrow({ where: { id }, select: { key: true } })).key;
  }

  async cleanup() {
    const prisma = this.prisma;
    // anything a failed step created before its id was recorded: made during this run, with a test-looking name
    const stray = await prisma.productLayout.findMany({
      where: { createdAt: { gte: this.since }, OR: [{ name: { contains: 'E2E' } }, { name: { startsWith: 'Copy of ' } }] },
      select: { id: true },
    });
    for (const l of stray) this.layoutIds.add(l.id);
    const products = await prisma.product.findMany({ where: { OR: [{ id: { in: [...this.productIds] } }, { handle: { startsWith: `e2e-layout-${this.stamp}-` } }] }, select: { id: true } });
    await prisma.product.deleteMany({ where: { id: { in: products.map((p) => p.id) } } });
    const layouts = await prisma.productLayout.findMany({ where: { id: { in: [...this.layoutIds] } }, select: { id: true, key: true } });
    const keys = layouts.map((l) => l.key).filter((k) => k !== 'default');
    const stuck = await prisma.product.count({ where: { layout: { in: keys } } });
    if (stuck) throw new Error(`${stuck} real products still use a test layout (${keys.join(', ')}): not deleting them`);
    await prisma.productLayout.deleteMany({ where: { id: { in: layouts.map((l) => l.id) }, key: { not: 'default' } } });
    await prisma.collection.deleteMany({ where: { OR: [{ id: { in: [...this.collectionIds] } }, { handle: { startsWith: `e2e-layout-${this.stamp}-` } }] } });
    if (this.uploadNames.size) await releaseTestUploads({ since: this.since, originalNames: [...this.uploadNames] });
  }
}

/* ------------------------------------------------------------------------------------------- editor UI */

export const editorSections = (page: Page) => page.getByTestId('layout-section');

/** The n-th section of a kind in the layout editor. */
export function section(page: Page, kind: SectionKind, n = 0): Locator {
  return page.locator(`[data-testid=layout-section][data-kind=${kind}]`).nth(n);
}

export async function kindsInEditor(page: Page): Promise<string[]> {
  return editorSections(page).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.kind ?? ''));
}

export async function openLayout(page: Page, id: number) {
  await page.goto(`/admin/product-layouts/${id}`);
  await expect(page.getByTestId('layout-editor')).toBeVisible();
}

/** Opens a section's editor (no-op when it is already open). */
export async function editSection(s: Locator) {
  const btn = s.getByRole('button', { name: /^(Edit|Close)\b/ }).first();
  if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
  await expect(s.getByTestId('section-editor')).toBeVisible();
}

export async function sectionMenu(page: Page, s: Locator, item: string) {
  await s.getByRole('button', { name: /^More actions for/ }).click();
  await page.getByRole('button', { name: item, exact: true }).click();
}

/** Save layout; with `usedBy` ≥ 2 the shared-change warning is confirmed. Waits for "Saved." */
export async function saveLayout(page: Page, usedBy = 0) {
  await page.getByTestId('save-bar').getByRole('button', { name: 'Save layout' }).click();
  if (usedBy >= 2) {
    const warn = page.getByTestId('save-warning');
    await expect(warn).toBeVisible();
    await warn.getByRole('button', { name: `Save for all ${usedBy} products` }).click();
  }
  await expect(page.getByText(/^Saved\./).first()).toBeVisible({ timeout: 30_000 });
}

/** "Make a copy" on a list card; returns the copy's id (tracked). */
export async function copyFromList(page: Page, data: LayoutTestData, layoutName: string): Promise<number> {
  await page.goto('/admin/product-layouts');
  const card = page.getByTestId('layout-card').filter({ has: page.getByRole('link', { name: layoutName, exact: true }) });
  await card.getByRole('button', { name: 'Make a copy' }).click();
  await page.waitForURL(/\/admin\/product-layouts\/\d+\?copied=\d+/);
  const id = data.layoutFromUrl(page.url());
  await expect(page.getByTestId('layout-editor')).toBeVisible();
  return id;
}

/** Renames the open layout (saved with the next save). */
export async function rename(page: Page, name: string) {
  if (!(await page.getByTestId('rename-fields').isVisible())) await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.locator('#layout-name').fill(name);
}
