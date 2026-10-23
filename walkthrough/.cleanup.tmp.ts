import { chromium, expect } from '@playwright/test';
import { readEnvFile } from './context';
import { gotoPage } from './guide';
const env = readEnvFile(process.env.HOME + '/.config/cozystyles/staging.env');
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await (await b.newContext({ baseURL: 'https://staging.cozystyle.pk', viewport: { width: 1440, height: 900 } })).newPage();
  await gotoPage(p, '/admin/login');
  await p.getByLabel(/email/i).fill(env.ADMIN_EMAIL); await p.getByLabel(/password/i).fill(env.ADMIN_PASSWORD);
  await p.getByRole('button', { name: /sign in/i }).click(); await p.waitForURL(/\/admin\/?$/);
  for (const t of ['Sofas', 'Coffee Tables', 'Beds', 'Bedside Tables', 'Dining', 'Office Chairs', 'Living Room', 'Bedroom']) {
    await gotoPage(p, '/admin/collections');
    const link = p.locator('main').getByRole('link', { name: t, exact: true }).first();
    if (!(await link.count())) continue;
    await link.click(); await expect(p.getByRole('heading', { level: 1, name: t, exact: true })).toBeVisible();
    await p.getByRole('button', { name: 'Delete', exact: true }).click();
    await p.getByRole('button', { name: 'Delete permanently' }).click();
    await p.waitForURL(/\/admin\/collections(\?|$)/, { timeout: 30000 });
    console.log('deleted', t);
  }
  await gotoPage(p, '/admin/collections');
  console.log((await p.locator('main').innerText()).slice(0, 60).replace(/\n/g, ' | '));
  await b.close();
})();
