import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Records a manual-test guide while Playwright drives a real browser: every action becomes a numbered step,
 * every form a "type exactly this" table, screenshots are captured in order, and problems found become
 * Findings. Each section is saved on its own (out/sections/<id>.json) so a run can resume from any section;
 * `assemble()` stitches them into out/README.md and out/guide.html (printed to PDF by build-pdf.mjs).
 */

export type FieldKind = 'fill' | 'type' | 'select' | 'check' | 'uncheck' | 'click' | 'upload' | 'none';

export type FieldRow = {
  /** Field name as the reader sees it on screen. */
  label: string;
  /** What to type/choose. For uploads: path(s) of the photo(s) relative to the project folder. */
  value: string | string[];
  locator?: Locator;
  kind?: FieldKind;
  /** Upload only: the button the reader clicks (shown in the table). */
  button?: string;
  /** Custom action instead of the built-in one (kind is then only used for the table wording). */
  act?: () => Promise<void>;
};

type Entry =
  | { t: 'h2'; text: string; anchor: string }
  | { t: 'h3'; text: string; anchor: string }
  | { t: 'p'; md: string }
  | { t: 'step'; n: number; md: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'expect'; md: string }
  | { t: 'note'; md: string }
  | { t: 'shot'; file: string; caption: string; n: string }
  | { t: 'finding'; id: string; severity: Severity; title: string; md: string };

export type Severity = 'bug' | 'issue' | 'note';
type Finding = { id: string; severity: Severity; title: string; md: string; section: string };
type SectionFile = { id: string; title: string; entries: Entry[]; findings: Finding[]; data: [string, string][] };

const anchorOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s/g, '-');

const projectRoot = path.resolve(__dirname, '..');

export class Guide {
  readonly out: string;
  readonly shotsDir: string;
  private cur: SectionFile | null = null;
  private stepNo = 0;
  private shotNo = 0;

  constructor(outDir: string) {
    this.out = path.resolve(outDir);
    this.shotsDir = path.join(this.out, 'screenshots');
    mkdirSync(this.shotsDir, { recursive: true });
    mkdirSync(path.join(this.out, 'sections'), { recursive: true });
  }

  /** Start a section (e.g. id "03", title "3. Products"). Saved by endSection(). */
  section(id: string, title: string, intro?: string) {
    this.cur = { id, title, entries: [], findings: [], data: [] };
    this.stepNo = 0;
    this.shotNo = 0;
    this.e({ t: 'h2', text: title, anchor: anchorOf(title) });
    if (intro) this.text(intro);
  }

  endSection() {
    if (!this.cur) return;
    writeFileSync(path.join(this.out, 'sections', `${this.cur.id}.json`), JSON.stringify(this.cur, null, 1));
    this.cur = null;
  }

  part(title: string, intro?: string) {
    this.e({ t: 'h3', text: title, anchor: anchorOf(title) });
    this.stepNo = 0;
    if (intro) this.text(intro);
  }

  text(md: string) {
    this.e({ t: 'p', md });
  }

  step(md: string) {
    this.stepNo += 1;
    this.e({ t: 'step', n: this.stepNo, md });
  }

  expect(md: string) {
    this.e({ t: 'expect', md });
  }

  note(md: string) {
    this.e({ t: 'note', md });
  }

  /** Record a value used during the test (shown in the "Test data and credentials" appendix). */
  data(label: string, value: string) {
    this.sec().data.push([label, value]);
  }

  /** A problem found while testing. Shown inline and in the Findings appendix. */
  finding(severity: Severity, title: string, md: string) {
    const s = this.sec();
    const id = `F${s.id}-${s.findings.length + 1}`;
    s.findings.push({ id, severity, title, md, section: s.title });
    this.e({ t: 'finding', id, severity, title, md });
  }

  async goto(page: Page, url: string, how?: string) {
    this.step(how ?? `Open **${url}**.`);
    await gotoPage(page, url);
  }

  async click(locator: Locator, md: string) {
    this.step(md);
    await locator.click();
  }

  /** A simple table (e.g. a list of items to create) without performing anything. */
  table(head: string[], rows: string[][]) {
    this.e({ t: 'table', head, rows });
  }

  /** Perform a form fill and document it as a Field / Value table. */
  async form(rows: FieldRow[], intro = 'Fill in the form exactly as follows:') {
    this.step(intro);
    const tableRows: string[][] = [];
    for (const r of rows) {
      const kind = r.kind ?? 'fill';
      const values = Array.isArray(r.value) ? r.value : [r.value];
      let cell: string;
      if (kind === 'upload') cell = `click **${r.button ?? 'Upload'}** and choose ${values.map((v) => '`' + v + '`').join(', ')}`;
      else if (kind === 'check') cell = '☑ ticked / on';
      else if (kind === 'uncheck') cell = '☐ not ticked / off';
      else if (kind === 'click') cell = values[0] ? values[0] : 'click it';
      else if (kind === 'none') cell = values[0] ? `${values[0]} _(leave as is)_` : '_(leave as is)_';
      else cell = values[0] === '' ? '_(leave empty)_' : '`' + values.join('\n') + '`';
      tableRows.push([r.label, cell]);
      if (r.act) await r.act();
      else if (r.locator) {
        if (kind === 'fill') await r.locator.fill(values[0]);
        else if (kind === 'type') {
          await r.locator.click();
          await r.locator.pressSequentially(values[0]);
        } else if (kind === 'select') await r.locator.selectOption({ label: values[0] });
        else if (kind === 'check') await r.locator.check();
        else if (kind === 'uncheck') await r.locator.uncheck();
        else if (kind === 'click') await r.locator.click();
        else if (kind === 'upload') await chooseFiles(r.locator, values);
      }
    }
    this.e({ t: 'table', head: ['Field', 'Value'], rows: tableRows });
  }

  /** Screenshot (viewport by default) with an optional red outline around the element of interest. */
  async shot(page: Page, caption: string, opts: { highlight?: Locator; fullPage?: boolean; clip?: Locator } = {}) {
    const s = this.sec();
    this.shotNo += 1;
    const n = `${s.id}.${this.shotNo}`;
    const file = `${s.id}-${String(this.shotNo).padStart(2, '0')}-${anchorOf(caption).slice(0, 48)}.jpg`;
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    if (opts.fullPage) await loadAllImages(page);
    await page.waitForTimeout(600); // let entrance animations settle
    if (opts.highlight) {
      await opts.highlight.scrollIntoViewIfNeeded().catch(() => {});
      await opts.highlight
        .evaluate((el: HTMLElement) => {
          el.dataset.prevOutline = el.style.outline;
          el.style.outline = '3px solid #e11d48';
          el.style.outlineOffset = '3px';
        })
        .catch(() => {});
    }
    const target = path.join(this.shotsDir, file);
    if (opts.clip) await opts.clip.screenshot({ path: target, type: 'jpeg', quality: 70 });
    else await page.screenshot({ path: target, type: 'jpeg', quality: 70, fullPage: opts.fullPage ?? false });
    if (opts.highlight) {
      await opts.highlight.evaluate((el: HTMLElement) => (el.style.outline = el.dataset.prevOutline ?? '')).catch(() => {});
    }
    this.e({ t: 'shot', file, caption, n });
  }

  private flags = new Set<string>();
  /** Returns true if `name` was already flagged in this section (and flags it). */
  flag(name: string): boolean {
    const key = `${this.cur?.id}:${name}`;
    if (this.flags.has(key)) return true;
    this.flags.add(key);
    return false;
  }

  private sec(): SectionFile {
    if (!this.cur) throw new Error('Guide: call section() first');
    return this.cur;
  }

  private e(entry: Entry) {
    this.sec().entries.push(entry);
  }

  /** Stitch every saved section (in id order) into README.md and guide.html. */
  assemble(opts: { title: string; preambleMd: string; preambleHtml: string; meta: [string, string][] }) {
    const dir = path.join(this.out, 'sections');
    const sections: SectionFile[] = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
    const findings = sections.flatMap((s) => s.findings);
    const data = sections.flatMap((s) => s.data.map(([k, v]) => [s.title, k, v]));
    writeFileSync(path.join(this.out, 'README.md'), renderMarkdown(opts, sections, findings, data));
    writeFileSync(path.join(this.out, 'guide.html'), renderHtml(opts, sections, findings, data));
    return { sections: sections.length, findings: findings.length, shots: sections.flatMap((s) => s.entries).filter((e) => e.t === 'shot').length };
  }
}

/* ------------------------------------------------------------------ browser helpers */

/** Navigate and wait for the page; also waits out Hostinger CDN's "Checking your browser" interstitial. */
export async function gotoPage(page: Page, url: string) {
  // The first request after a deploy can hit a cold server: give it one more try before failing.
  try {
    await page.goto(url);
  } catch (err) {
    if (!(err instanceof Error) || !/Timeout/i.test(err.message)) throw err;
    await page.goto(url);
  }
  for (let i = 0; i < 20; i++) {
    const checking = await page
      .locator('body')
      .innerText({ timeout: 2000 })
      .then((t) => /checking your browser/i.test(t))
      .catch(() => false);
    if (!checking) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Click an upload control and pick files in the OS file dialog, like a person would. Paths are relative to the project. */
export async function chooseFiles(trigger: Locator, files: string[]) {
  const abs = files.map((f) => (path.isAbsolute(f) ? f : path.join(projectRoot, f)));
  for (const f of abs) if (!existsSync(f)) throw new Error(`Sample photo missing: ${f}`);
  const [chooser] = await Promise.all([trigger.page().waitForEvent('filechooser'), trigger.click()]);
  await chooser.setFiles(abs);
}

/** Scroll through the page so lazy images load, wait until they have decoded, return to top. */
export async function loadAllImages(page: Page) {
  await page
    .evaluate(async () => {
      const step = Math.max(400, window.innerHeight - 100);
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 5000); }),
        ),
      );
      window.scrollTo(0, 0);
    })
    .catch(() => {});
  await page.waitForTimeout(300);
}

const ERROR_PAGE = 'This page could not finish loading';

/**
 * Waits for `success` after a save. If the admin shows its "Something went wrong — This page could not finish loading"
 * screen instead (seen on the Hostinger staging server right after a successful save), it documents that as a finding
 * (once per section), screenshots it and clicks **Reload the page** like a person would. Returns true when the error
 * screen appeared, so the caller can check the item was saved anyway.
 */
export async function afterSave(g: Guide, page: Page, success: () => Promise<unknown>, what: string): Promise<boolean> {
  const outcome = await Promise.race([
    success().then(() => 'ok' as const),
    page.getByText(ERROR_PAGE).waitFor({ timeout: 45_000 }).then(() => 'error' as const),
  ]);
  if (outcome === 'ok') return false;
  if (!g.flag('save-error-page')) {
    await g.shot(page, `Error screen after saving ${what}`);
    g.finding(
      'bug',
      'Sometimes an error screen appears right after saving',
      `After saving ${what}, the admin showed “Something went wrong — ${ERROR_PAGE}…” instead of the saved page, although the save itself had worked (the item exists after reloading). It happened once in this run on the staging server and not in the local test, so it looks intermittent (server or hosting). The owner can click **Reload the page** and continue.`,
    );
  }
  g.step('If the **Something went wrong** screen appears, click **Reload the page**.');
  await page.getByRole('button', { name: 'Reload the page' }).click();
  await page.waitForLoadState('networkidle').catch(() => {});
  return true;
}

/** Every <img> matching `selector` has loaded (non-zero natural width). */
export async function expectImagesLoaded(page: Page, selector: string) {
  const widths = await page.locator(selector).evaluateAll((imgs) =>
    Promise.all((imgs as HTMLImageElement[]).map(async (img) => { img.loading = 'eager'; await img.decode().catch(() => {}); return img.naturalWidth; })),
  );
  expect(widths.length, `images matching ${selector}`).toBeGreaterThan(0);
  for (const w of widths) expect(w).toBeGreaterThan(0);
}

/* ------------------------------------------------------------------ rendering */

type AssembleOpts = { title: string; preambleMd: string; preambleHtml: string; meta: [string, string][] };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Tiny inline markdown: **bold**, `code`, [text](url), line breaks. */
function inline(md: string): string {
  return esc(md)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, '<br>');
}
const mdCell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
const SEV: Record<Severity, string> = { bug: '🐞 Bug', issue: '⚠️ Issue', note: 'ℹ️ Note' };

function renderMarkdown(o: AssembleOpts, sections: SectionFile[], findings: Finding[], data: string[][]): string {
  const out: string[] = [`# ${o.title}`, '', o.preambleMd.trim(), '', '| | |', '|---|---|', ...o.meta.map(([k, v]) => `| ${k} | ${mdCell(v)} |`), ''];
  out.push('## Contents', '');
  for (const s of sections) {
    for (const e of s.entries) {
      if (e.t === 'h2') out.push(`- [${e.text}](#${e.anchor})`);
      if (e.t === 'h3') out.push(`  - [${e.text}](#${e.anchor})`);
    }
  }
  out.push('- [Findings](#findings)', '- [Test data and credentials](#test-data-and-credentials)', '');
  for (const s of sections) {
    for (const e of s.entries) {
      switch (e.t) {
        case 'h2': out.push('', `## ${e.text}`, ''); break;
        case 'h3': out.push('', `### ${e.text}`, ''); break;
        case 'p': out.push(e.md, ''); break;
        case 'step': out.push(`${e.n}. ${e.md}`); break;
        case 'table':
          out.push('', `   | ${e.head.join(' | ')} |`, `   |${e.head.map(() => '---').join('|')}|`, ...e.rows.map((r) => `   | ${r.map(mdCell).join(' | ')} |`), '');
          break;
        case 'expect': out.push('', `> ✅ **Expected:** ${e.md}`, ''); break;
        case 'note': out.push('', `> ℹ️ ${e.md}`, ''); break;
        case 'shot': out.push('', `   ![${e.caption}](screenshots/${e.file})`, `   <sub>Screenshot ${e.n}: ${e.caption}</sub>`, ''); break;
        case 'finding': out.push('', `> **${SEV[e.severity]} ${e.id}: ${e.title}** — ${e.md}`, ''); break;
      }
    }
  }
  out.push('', '## Findings', '');
  if (!findings.length) out.push('No problems were found.');
  else {
    out.push('| ID | Type | Section | Finding |', '|---|---|---|---|');
    for (const f of findings) out.push(`| ${f.id} | ${SEV[f.severity]} | ${mdCell(f.section)} | **${mdCell(f.title)}** — ${mdCell(f.md)} |`);
  }
  out.push('', '## Test data and credentials', '', '| Section | Item | Value |', '|---|---|---|', ...data.map((r) => `| ${r.map(mdCell).join(' | ')} |`), '');
  return out.join('\n');
}

const CSS = `
@page { size: A4; margin: 14mm 12mm 16mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2933; margin: 0; }
h1 { font-size: 24pt; color: #103a3a; margin: 0 0 6mm; }
h2 { font-size: 16pt; color: #103a3a; border-bottom: 2px solid #108474; padding-bottom: 2mm; margin: 9mm 0 4mm; page-break-before: always; }
h2.first { page-break-before: avoid; }
h3 { font-size: 12.5pt; color: #108474; margin: 6mm 0 2mm; page-break-after: avoid; }
p { margin: 0 0 3mm; }
code { font: 9pt/1.3 Menlo, Consolas, monospace; background: #eef2f1; padding: 0 3px; border-radius: 3px; word-break: break-word; }
table { border-collapse: collapse; width: 100%; margin: 2mm 0 4mm; font-size: 9.5pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #cfd8d6; padding: 3px 6px; text-align: left; vertical-align: top; }
th { background: #e8f3f1; }
ol.steps { padding-left: 6mm; margin: 0 0 2mm; }
ol.steps li { margin: 1mm 0; }
.expect { border-left: 4px solid #16a34a; background: #f0fdf4; padding: 2mm 3mm; margin: 2mm 0 3mm; }
.note { border-left: 4px solid #2563eb; background: #eff6ff; padding: 2mm 3mm; margin: 2mm 0 3mm; }
.finding { border-left: 4px solid #dc2626; background: #fef2f2; padding: 2mm 3mm; margin: 2mm 0 3mm; }
.finding.note { border-color: #2563eb; background: #eff6ff; }
.finding.issue { border-color: #d97706; background: #fffbeb; }
figure { margin: 2mm 0 4mm; page-break-inside: avoid; }
figure img { max-width: 100%; max-height: 205mm; border: 1px solid #d0d7de; border-radius: 4px; }
figcaption { font-size: 8.5pt; color: #57606a; margin-top: 1mm; }
.meta td:first-child { width: 42mm; font-weight: 600; }
.toc { columns: 2; font-size: 9.5pt; }
.toc ul { margin: 0; padding-left: 4mm; }
.cover { page-break-after: always; }
`;

function renderHtml(o: AssembleOpts, sections: SectionFile[], findings: Finding[], data: string[][]): string {
  const h: string[] = [];
  h.push(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.title)}</title><style>${CSS}</style></head><body>`);
  h.push('<div class="cover">', `<h1>${esc(o.title)}</h1>`, o.preambleHtml, '<table class="meta">', ...o.meta.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${inline(v)}</td></tr>`), '</table>');
  h.push('<h3>Contents</h3><div class="toc"><ul>');
  for (const s of sections) for (const e of s.entries) if (e.t === 'h2') h.push(`<li><a href="#${e.anchor}">${esc(e.text)}</a></li>`);
  h.push('<li><a href="#findings">Findings</a></li><li><a href="#test-data-and-credentials">Test data and credentials</a></li></ul></div></div>');
  let first = true;
  for (const s of sections) {
    let inSteps = false;
    const close = () => { if (inSteps) { h.push('</ol>'); inSteps = false; } };
    for (const e of s.entries) {
      if (e.t !== 'step' && e.t !== 'table' && e.t !== 'shot' && e.t !== 'expect' && e.t !== 'note') close();
      switch (e.t) {
        case 'h2': h.push(`<h2 id="${e.anchor}"${first ? ' class="first"' : ''}>${esc(e.text)}</h2>`); first = false; break;
        case 'h3': h.push(`<h3 id="${e.anchor}">${esc(e.text)}</h3>`); break;
        case 'p': h.push(`<p>${inline(e.md)}</p>`); break;
        case 'step':
          if (!inSteps) { h.push(`<ol class="steps" start="${e.n}">`); inSteps = true; }
          h.push(`<li>${inline(e.md)}</li>`);
          break;
        case 'table':
          h.push('<table><tr>' + e.head.map((x) => `<th>${esc(x)}</th>`).join('') + '</tr>' + e.rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</table>');
          break;
        case 'expect': h.push(`<div class="expect">✅ <strong>Expected:</strong> ${inline(e.md)}</div>`); break;
        case 'note': h.push(`<div class="note">ℹ️ ${inline(e.md)}</div>`); break;
        case 'shot': h.push(`<figure><img src="screenshots/${e.file}" alt="${esc(e.caption)}"><figcaption>Screenshot ${e.n}: ${esc(e.caption)}</figcaption></figure>`); break;
        case 'finding': h.push(`<div class="finding ${e.severity}"><strong>${SEV[e.severity]} ${e.id}: ${esc(e.title)}</strong><br>${inline(e.md)}</div>`); break;
      }
    }
    close();
  }
  h.push('<h2 id="findings">Findings</h2>');
  if (!findings.length) h.push('<p>No problems were found.</p>');
  else h.push('<table><tr><th>ID</th><th>Type</th><th>Section</th><th>Finding</th></tr>' + findings.map((f) => `<tr><td>${f.id}</td><td>${SEV[f.severity]}</td><td>${esc(f.section)}</td><td><strong>${esc(f.title)}</strong><br>${inline(f.md)}</td></tr>`).join('') + '</table>');
  h.push('<h2 id="test-data-and-credentials">Test data and credentials</h2><table><tr><th>Section</th><th>Item</th><th>Value</th></tr>' + data.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</table>');
  h.push('</body></html>');
  return h.join('\n');
}
