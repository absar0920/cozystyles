import { execFileSync } from 'node:child_process';
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
 * Runs against a scratch database built from scratch in a temp folder (schema copied with an absolute URL, every
 * PrismaClient pointed at it by a preload) — never prisma/dev.db, whose checksum is compared before and after.
 */

const ROOT = path.resolve(__dirname, '../..');
const DEV_DB = path.join(ROOT, 'prisma/dev.db');
type Frozen = { key: string; name: string; description: string; sections: Record<string, unknown>[] };
const frozen = (JSON.parse(readFileSync(path.join(ROOT, 'prisma/easy-mode-data/product-layouts.json'), 'utf8')) as { layouts: Frozen[] }).layouts;

test.describe.configure({ mode: 'serial' });

let dir = '';
let url = '';
let db: PrismaClient;
let devSum = '';

const sum = (file: string) => execFileSync('shasum', [file], { encoding: 'utf8' }).split(' ')[0];
/** Runs a tsx script with every PrismaClient redirected to the scratch database. */
const run = (args: string[]) =>
  execFileSync('npx', ['tsx', '-r', path.join(dir, 'preload.cjs'), ...args], { cwd: ROOT, env: { ...process.env, SEED_DB: url }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  devSum = sum(DEV_DB);
  dir = mkdtempSync(path.join(os.tmpdir(), 'pl-migration-'));
  url = `file:${path.join(dir, 'fresh.db')}`;
  const schema = readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8').replace(/url\s*=\s*"file:\.\/dev\.db"/, `url = "${url}"`);
  expect(schema).toContain(url);
  writeFileSync(path.join(dir, 'schema.prisma'), schema);
  writeFileSync(
    path.join(dir, 'preload.cjs'),
    `const url = process.env.SEED_DB;
if (!url || !url.startsWith('file:') || url.includes(${JSON.stringify(path.join(ROOT, 'prisma'))})) throw new Error('SEED_DB must point at a scratch database');
const m = require(require.resolve('@prisma/client', { paths: [${JSON.stringify(ROOT)}] }));
const Orig = m.PrismaClient;
class P extends Orig { constructor(o = {}) { super({ ...o, datasourceUrl: url }); } }
m.PrismaClient = P;
`,
  );
  execFileSync('npx', ['prisma', 'db', 'push', '--schema', path.join(dir, 'schema.prisma'), '--skip-generate'], { cwd: ROOT, stdio: 'pipe' });
  const log = run(['prisma/seed.ts']);
  expect(log).toContain('SEED COMPLETE');
  db = new PrismaClient({ datasourceUrl: url });
});

test.afterAll(async () => {
  await db?.$disconnect();
  if (dir) rmSync(dir, { recursive: true, force: true });
  if (devSum) expect(sum(DEV_DB)).toBe(devSum);
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
