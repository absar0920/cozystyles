/**
 * Stitch the recorded sections into README.md + guide.html and print the PDF.
 *
 *   WALK_TARGET=staging WALK_BASE_URL=https://staging.cozystyle.pk WALK_ENV_FILE=~/.config/cozystyles/staging.env \
 *     npx tsx walkthrough/build-doc.ts
 *
 * The PDF contains the admin password on purpose (requested); walkthrough-output/ is gitignored — never commit it.
 */
import path from 'node:path';
import { chromium } from '@playwright/test';
import { readEnvFile } from './context';
import { BANNERS, COLLECTIONS, PAGES, PRODUCTS, STORE, TEMP_ADMIN_PASSWORD } from './data';
import { Guide } from './guide';

const target = process.env.WALK_TARGET ?? 'local';
const baseURL = process.env.WALK_BASE_URL ?? 'http://localhost:3200';
const env = readEnvFile(process.env.WALK_ENV_FILE ?? path.resolve(__dirname, '../.env'));
const outDir = path.resolve(__dirname, '../walkthrough-output', target);
const date = process.env.WALK_DATE ?? new Date().toISOString().slice(0, 10);

const preambleText = `This document is the result of a complete test of the **${target}** shop, done **only through a web browser** (Google Chrome driven by Playwright): the shop started empty (only its database tables and the admin login), nothing was seeded, nothing was changed directly in the database and no API was called by hand. Every product, collection, page layout, banner, menu, page and blog post below was created by clicking and typing in the admin panel, and every check on the store was made as a shopper would. Each numbered step says exactly what was clicked and typed; the screenshots were taken at that moment.`;

const meta: [string, string][] = [
  ['Shop tested', baseURL],
  ['Admin panel', `${baseURL}/admin`],
  ['Admin email', env.ADMIN_EMAIL ?? '(see WALK_ENV_FILE)'],
  ['Admin password', env.ADMIN_PASSWORD ?? '(see WALK_ENV_FILE)'],
  ['Temporary password used in the "Change password" test', `${TEMP_ADMIN_PASSWORD} (changed back to the password above at the end)`],
  ['WhatsApp number set in Settings', `${STORE.whatsapp} — a placeholder test number; replace it with the shop's real number`],
  ['Created', `${COLLECTIONS.length} collections, ${PRODUCTS.length} products (1 draft), 1 page layout, ${BANNERS.length} home banners, 4 menus, ${PAGES.length} pages, 2 blog posts`],
  ['Date of test', date],
  ['Browser', 'Google Chrome, desktop 1440×900 and phone (Pixel 7) sizes'],
];

const guide = new Guide(outDir);
const counts = guide.assemble({
  title: `Cozy Furnitures — ${target === 'staging' ? 'Staging' : 'Local'} test walkthrough`,
  preambleMd: preambleText,
  preambleHtml: `<p>${preambleText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>`,
  meta,
});

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto('file://' + path.join(outDir, 'guide.html'), { waitUntil: 'load' });
  await page.evaluate(() => Promise.all(Array.from(document.images).map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))));
  const pdf = path.join(outDir, `cozystyles-${target}-walkthrough.pdf`);
  await page.pdf({
    path: pdf,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#777">Cozy Furnitures ${target} walkthrough · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
    margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
  });
  await browser.close();
  console.log(JSON.stringify({ ...counts, pdf }));
})();
