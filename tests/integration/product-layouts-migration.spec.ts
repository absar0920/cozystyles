import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { parseSectionData, parseSnapshot, serializeSectionData, type SectionKind } from '../../src/lib/product-layout-sections';
import { legacyIconAt } from '../../src/lib/product-layout-icons';
import { sanitizeRichText } from '../../src/lib/rich-text/sanitize';

/**
 * The product-layout-content migration step (docs/product-layouts/SPEC.md §7, §13.5). Node only (no browser).
 * Runs against a scratch MySQL database (`<dev db>_scratch_<random>` on the same server, schema copied with its URL,
 * every PrismaClient pointed at it by a preload) — never the dev database, whose row counts are compared before and
 * after. The scratch database is dropped afterwards.
 */

const ROOT = path.resolve(__dirname, '../..');
const DEV_URL =
  process.env.DATABASE_URL ?? readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)?.[1] ?? '';
type Frozen = { key: string; name: string; description: string; sections: Record<string, unknown>[] };
const frozen = (JSON.parse(readFileSync(path.join(ROOT, 'prisma/easy-mode-data/product-layouts.json'), 'utf8')) as { layouts: Frozen[] }).layouts;

test.describe.configure({ mode: 'serial' });

let dir = '';
let url = '';
let db: PrismaClient;
let devSum = '';
let scratchName = '';

/** Row counts of the dev database: a fingerprint that would change if anything wrote to it. */
async function devFingerprint(): Promise<string> {
  const dev = new PrismaClient({ datasourceUrl: DEV_URL });
  try {
    const counts = await Promise.all([dev.product.count(), dev.productLayout.count(), dev.productLayoutSection.count(), dev.collection.count(), dev.page.count()]);
    return counts.join('/');
  } finally {
    await dev.$disconnect();
  }
}
/** Runs a tsx script with every PrismaClient redirected to the scratch database. */
const run = (args: string[]) =>
  execFileSync('npx', ['tsx', '-r', path.join(dir, 'preload.cjs'), ...args], { cwd: ROOT, env: { ...process.env, SEED_DB: url }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  expect(DEV_URL.startsWith('mysql://'), 'DATABASE_URL must be a MySQL URL').toBe(true);
  devSum = await devFingerprint();
  dir = mkdtempSync(path.join(os.tmpdir(), 'pl-migration-'));
  const dev = new URL(DEV_URL);
  scratchName = `${dev.pathname.slice(1)}_scratch_${randomBytes(4).toString('hex')}`;
  const scratch = new URL(DEV_URL);
  scratch.pathname = `/${scratchName}`;
  url = scratch.toString();
  const schema = readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8').replace(/url\s*=\s*env\("DATABASE_URL"\)/, `url = "${url}"`);
  expect(schema).toContain(url);
  writeFileSync(path.join(dir, 'schema.prisma'), schema);
  writeFileSync(
    path.join(dir, 'preload.cjs'),
    `const url = process.env.SEED_DB;
if (!url || !url.startsWith('mysql:') || !url.includes('_scratch_')) throw new Error('SEED_DB must point at a scratch database');
const m = require(require.resolve('@prisma/client', { paths: [${JSON.stringify(ROOT)}] }));
const Orig = m.PrismaClient;
class P extends Orig { constructor(o = {}) { super({ ...o, datasourceUrl: url }); } }
m.PrismaClient = P;
`,
  );
  // db push creates the scratch database itself
  execFileSync('npx', ['prisma', 'db', 'push', '--schema', path.join(dir, 'schema.prisma'), '--skip-generate'], { cwd: ROOT, stdio: 'pipe' });
  const log = run(['prisma/seed.ts']);
  expect(log).toContain('SEED COMPLETE');
  db = new PrismaClient({ datasourceUrl: url });
});

test.afterAll(async () => {
  if (db && scratchName) await db.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${scratchName}\``);
  await db?.$disconnect();
  if (dir) rmSync(dir, { recursive: true, force: true });
  if (devSum) expect(await devFingerprint()).toBe(devSum);
});

test('every migrated layout equals the frozen input', async () => {
  const layouts = await db.productLayout.findMany({
    orderBy: { position: 'asc' },
    include: { sections: { orderBy: { position: 'asc' }, include: { collection: { select: { handle: true } } } } },
  });
  expect(layouts.map((l) => l.key)).toEqual(frozen.map((l) => l.key));
  let rows = 0;
  for (const l of layouts) {
    const src = frozen.find((f) => f.key === l.key)!;
    expect(l.name).toBe(src.name);
    expect(l.description).toBe(src.description ?? '');
    expect(l.previousVersion).toBeNull();
    const original = parseSnapshot(l.originalVersion);
    expect(original, l.key).not.toBeNull();
    expect(original!.sections.map((s) => s.data)).toEqual(l.sections.map((s) => s.data));
    expect(l.sections.map((s) => s.kind)).toEqual(src.sections.map((s) => s.kind));

    for (const [i, r] of l.sections.entries()) {
      rows++;
      const where = `${l.key} #${i} ${r.kind}`;
      const kind = r.kind as SectionKind;
      const raw = src.sections[i] as Record<string, any>;
      const { data, complete } = parseSectionData(kind, r.data);
      expect(complete, where).toBe(true);
      expect(serializeSectionData(kind, data), where).toBe(r.data);
      expect(r.hidden).toBe(false);
      const d = data as Record<string, any>;
      switch (kind) {
        case 'overlay':
          expect({ image: d.image, subheading: d.subheading, heading: d.heading, headingClass: d.headingClass }, where).toEqual({
            image: raw.image,
            subheading: raw.subheading ?? null,
            heading: raw.heading,
            headingClass: raw.headingClass,
          });
          expect(r.bodyHtml, where).toBe(sanitizeRichText(raw.html));
          expect(domish(r.bodyHtml), where).toBe(domish(raw.html));
          break;
        case 'imageText':
          for (const f of ['image', 'ratio', 'size', 'imageFirst', 'center', 'disableBottom', 'headingClass', 'heading', 'headingThin', 'condensed']) {
            expect(d[f], `${where} ${f}`).toEqual(raw[f] ?? null);
          }
          expect(d.button, where).toEqual(raw.button ? { label: raw.button.label, href: raw.button.href === '#' ? '' : raw.button.href } : null);
          expect(r.bodyHtml, where).toBe(sanitizeRichText(raw.html));
          expect(domish(r.bodyHtml), where).toBe(domish(raw.html));
          break;
        case 'icons':
          expect(d.blocks, where).toEqual((raw.blocks as { title: string; text: string }[]).map((b, j) => ({ icon: legacyIconAt(j), title: b.title, text: b.text })));
          break;
        case 'testimonials':
          expect({ subheading: d.subheading, heading: d.heading, size: d.size, items: d.items }, where).toEqual({
            subheading: raw.subheading ?? null,
            heading: raw.heading,
            size: raw.size,
            items: raw.items,
          });
          break;
        case 'slideshow':
          expect(d.slides.length, where).toBe(1);
          expect(d.slides[0], where).toMatchObject({ desktop: raw.desktop, mobile: raw.mobile ?? null, desktopRatio: raw.desktopRatio, mobileRatio: raw.mobileRatio ?? null });
          break;
        case 'featuredCollection':
          expect({ heading: d.heading, collection: d.collection, handles: d.handles }, where).toEqual({ heading: raw.heading, collection: raw.collection, handles: raw.handles ?? [] });
          expect(r.collection?.handle, where).toBe(raw.collection);
          break;
        default:
          expect(r.data, where).toBe('{}');
      }
    }
  }
  expect(rows).toBe(frozen.reduce((n, l) => n + l.sections.length, 0));
  // every product points at a layout that exists
  const keys = layouts.map((l) => l.key);
  expect(await db.product.count({ where: { layout: { notIn: keys } } })).toBe(0);
});

test('a second run skips the step', async () => {
  const before = await snapshot();
  const out = run(['scripts/migrate-admin-easy-mode.ts', '--no-backup']);
  expect(out).toMatch(/product-layout-content\s+skipped/);
  expect(out).toContain('nothing to do');
  expect(await snapshot()).toEqual(before);
});

test('--dry-run leaves no rows; a hand-made layout first does not stop the 18 from being imported', async () => {
  await db.productLayout.deleteMany({});
  await db.migrationStep.delete({ where: { id: 'easy-mode:product-layout-content' } });
  const dry = run(['scripts/migrate-admin-easy-mode.ts', '--dry-run', '--no-backup']);
  expect(dry).toContain('dry run: every change was rolled back');
  expect(await db.productLayout.count()).toBe(0);
  expect(await db.productLayoutSection.count()).toBe(0);
  expect(await db.migrationStep.count({ where: { id: 'easy-mode:product-layout-content' } })).toBe(0);

  await db.productLayout.create({ data: { key: 'hand-made', name: 'Sofas', nameKey: 'sofas', position: 0, sections: { create: [{ kind: 'recommendations' }] } } });
  const out = run(['scripts/migrate-admin-easy-mode.ts', '--no-backup']);
  expect(out).toMatch(/product-layout-content: 18 layouts \(0 skipped\)/);
  const keys = (await db.productLayout.findMany({ select: { key: true } })).map((l) => l.key).sort();
  expect(keys).toEqual(['hand-made', ...frozen.map((l) => l.key)].sort());
  expect((await db.productLayout.findUniqueOrThrow({ where: { key: 'sofas' } })).name).toBe('Sofas (original)');
  expect(await db.productLayoutSection.count()).toBe(frozen.reduce((n, l) => n + l.sections.length, 0) + 1);
});

/** Markup compared loosely (DOM-equivalent): void-tag style, entity spelling and whitespace between tags don't count. */
function domish(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '<br>')
    .replace(/&nbsp;/g, String.fromCharCode(0xa0))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/>\s+</g, '><')
    .trim();
}

async function snapshot() {
  const [layouts, sections] = await Promise.all([
    db.productLayout.findMany({ orderBy: { id: 'asc' }, select: { key: true, name: true, position: true, originalVersion: true, previousVersion: true, updatedAt: true } }),
    db.productLayoutSection.findMany({ orderBy: { id: 'asc' }, select: { layoutId: true, position: true, kind: true, hidden: true, bodyHtml: true, data: true, refs: true, collectionId: true } }),
  ]);
  return { layouts, sections };
}
