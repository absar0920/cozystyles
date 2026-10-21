import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';

export const DOC_DIR = 'docs/walkthrough';
const SHOT_DIR = path.join(DOC_DIR, 'screenshots');

export type FieldRow = {
  /** Field name as shown on screen. */
  label: string;
  /** Value typed/selected; for checkboxes use "✓ checked" / "☐ unchecked". */
  value: string;
  locator: Locator;
  /** 'none' documents a field the reader should leave unchanged. */
  kind?: 'fill' | 'select' | 'check' | 'uncheck' | 'click' | 'none';
};

/**
 * Records a manual-test guide while Playwright drives the browser: every action becomes a
 * numbered step, every form becomes a "type exactly this" table, and screenshots are
 * captured in order. `write()` renders docs/walkthrough/README.md.
 */
export class Guide {
  private out: string[] = [];
  private shotNo = 0;
  private stepNo = 0;
  private toc: { level: number; title: string; anchor: string }[] = [];

  constructor() {
    mkdirSync(SHOT_DIR, { recursive: true });
  }

  private anchor(title: string) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s/g, '-');
  }

  section(title: string, intro?: string) {
    this.toc.push({ level: 2, title, anchor: this.anchor(title) });
    this.out.push(`\n## ${title}\n`);
    if (intro) this.out.push(`${intro}\n`);
    this.stepNo = 0;
  }

  part(title: string, intro?: string) {
    this.toc.push({ level: 3, title, anchor: this.anchor(title) });
    this.out.push(`\n### ${title}\n`);
    if (intro) this.out.push(`${intro}\n`);
    this.stepNo = 0;
  }

  /** Raw line(s) — no blank line added, so consecutive calls can build a table. */
  text(md: string) {
    this.out.push(md);
  }

  step(md: string) {
    this.stepNo += 1;
    this.out.push(`${this.stepNo}. ${md}`);
  }

  expect(md: string) {
    this.out.push(`\n> ✅ **Expected:** ${md}\n`);
  }

  note(md: string) {
    this.out.push(`\n> ℹ️ ${md}\n`);
  }

  async goto(page: Page, url: string, how?: string) {
    this.step(how ?? `Open **${url}** (\`http://localhost:3000${url}\`).`);
    await page.goto(url);
    await page.waitForLoadState('networkidle');
  }

  async click(locator: Locator, md: string) {
    this.step(md);
    await locator.click();
  }

  /** Perform a form fill and document it as a field/value table. */
  async form(rows: FieldRow[], intro = 'Fill in the form exactly as follows:') {
    this.step(intro);
    this.out.push('\n   | Field | Value |\n   |---|---|');
    for (const r of rows) {
      const shown = r.value.includes('\n') ? r.value.replace(/\n/g, '<br>') : r.value;
      this.out.push(`   | ${r.label} | ${shown === '' ? '_(leave empty)_' : '`' + shown.replace(/\|/g, '\\|') + '`'} |`);
      const kind = r.kind ?? 'fill';
      if (kind === 'fill') await r.locator.fill(r.value);
      else if (kind === 'select') await r.locator.selectOption({ label: r.value });
      else if (kind === 'check') await r.locator.check();
      else if (kind === 'uncheck') await r.locator.uncheck();
      else if (kind === 'click') await r.locator.click();
    }
    this.out.push('');
  }

  /** Screenshot (viewport by default) with an optional red outline around the element of interest. */
  async shot(page: Page, caption: string, opts: { highlight?: Locator; fullPage?: boolean; clip?: Locator } = {}) {
    this.shotNo += 1;
    const file = `${String(this.shotNo).padStart(3, '0')}-${this.anchor(caption).slice(0, 50)}.jpg`;
    await page.evaluate(() => document.fonts?.ready);
    if (opts.fullPage) await loadAllImages(page);
    // Let entrance animations finish so the screenshot isn't caught mid-fade.
    await page.waitForTimeout(700);
    if (opts.highlight) {
      await opts.highlight.scrollIntoViewIfNeeded().catch(() => {});
      await opts.highlight.evaluate((el: HTMLElement) => {
        el.dataset.prevOutline = el.style.outline;
        el.style.outline = '3px solid #e11d48';
        el.style.outlineOffset = '3px';
      });
    }
    if (opts.clip) {
      await opts.clip.screenshot({ path: path.join(SHOT_DIR, file), type: 'jpeg', quality: 72 });
    } else {
      await page.screenshot({ path: path.join(SHOT_DIR, file), type: 'jpeg', quality: 72, fullPage: opts.fullPage ?? false });
    }
    if (opts.highlight) {
      await opts.highlight.evaluate((el: HTMLElement) => {
        el.style.outline = el.dataset.prevOutline ?? '';
      });
    }
    this.out.push(`\n   ![${caption}](screenshots/${file})\n   <sub>Screenshot ${this.shotNo}: ${caption}</sub>\n`);
  }

  write(preamble: string, appendix: string) {
    const toc = this.toc
      .map((t) => `${t.level === 2 ? '- ' : '  - '}[${t.title}](#${t.anchor})`)
      .join('\n');
    const body = this.out.join('\n');
    writeFileSync(
      path.join(DOC_DIR, 'README.md'),
      `${preamble.trim()}\n\n## Contents\n\n${toc}\n${body}\n${appendix.trim()}\n`,
    );
  }
}

/** Scroll through the page so lazy images load, wait until every <img> has decoded, return to top. */
async function loadAllImages(page: Page) {
  await page.evaluate(async () => {
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
  });
  await page.waitForTimeout(400);
}

export function readPart(name: string) {
  return readFileSync(path.join(__dirname, name), 'utf8');
}
