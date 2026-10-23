import path from 'node:path';
import { test, type BrowserContext, type Page } from '@playwright/test';
import { ensureSignedIn, readEnvFile, type Ctx, type Section } from './context';
import { Guide } from './guide';
import { SECTIONS } from './sections';

/**
 * Browser-only walkthrough of the whole store, recorded as a document with screenshots.
 *
 *   WALK_BASE_URL   site to test (default http://localhost:3200)
 *   WALK_TARGET     label for the output folder: local | staging (default local)
 *   WALK_ENV_FILE   file with ADMIN_EMAIL / ADMIN_PASSWORD (default ./.env)
 *   WALK_FROM=05    resume from section 05 (earlier sections' saved output is kept)
 *   WALK_ONLY=05    run one section
 */

const baseURL = process.env.WALK_BASE_URL ?? 'http://localhost:3200';
const target = process.env.WALK_TARGET ?? 'local';
const env = readEnvFile(process.env.WALK_ENV_FILE ?? path.resolve(__dirname, '../.env'));
const creds = { email: env.ADMIN_EMAIL ?? '', password: env.ADMIN_PASSWORD ?? '' };
const outDir = path.resolve(__dirname, '../walkthrough-output', target);
const from = process.env.WALK_FROM;
const only = process.env.WALK_ONLY;

test.describe.configure({ mode: 'serial' });

const guide = new Guide(outDir);
let ctx: Ctx;

/** WALK_SLOW=1: emulate a slower server/network (latency, bandwidth, CPU) to flush out timing races locally. */
async function slowDown(context: BrowserContext) {
  if (!process.env.WALK_SLOW) return;
  const apply = async (p: Page) => {
    const cdp = await context.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 250, downloadThroughput: 1_500_000, uploadThroughput: 750_000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
  };
  context.on('page', (p) => void apply(p).catch(() => {}));
}

test.beforeAll(async ({ browser }) => {
  const newContext: Ctx['newContext'] = async (opts = {}) => {
    const c = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...opts });
    await slowDown(c);
    return c;
  };
  const admin: Page = await (await newContext()).newPage();
  const shopper: Page = await (await newContext()).newPage();
  ctx = { guide, browser, baseURL, target, admin, shopper, creds, newContext };
  if (!creds.email || !creds.password) throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD missing (WALK_ENV_FILE)');
});

const wanted = (s: Section) => (only ? s.id === only : from ? s.id >= from : true);

for (const s of SECTIONS) {
  test(`${s.id} ${s.title}`, async () => {
    test.skip(!wanted(s), 'not selected');
    test.setTimeout(30 * 60_000);
    // A resumed run starts signed out; section 01 signs in by itself (first sign-in creates the admin).
    if (s.id !== '01') await ensureSignedIn(ctx.admin, ctx.creds);
    guide.section(s.id, s.title, s.intro);
    try {
      await s.run(ctx);
    } finally {
      guide.endSection();
    }
  });
}
