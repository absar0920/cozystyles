import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

/**
 * The footer "Join our mailing list" box has no mailing service behind it: sign-ups are filed in Admin → Messages
 * under the subject "Newsletter" (once per email address), the admin says so plainly, and the owner can download
 * them. The sign-up this test makes is deleted again.
 */

const prisma = new PrismaClient();
test.afterAll(async () => {
  await prisma.$disconnect();
});

test('newsletter sign-ups are filed once under Newsletter, with a plain note and a CSV download', async ({ page }) => {
  const email = `e2e-newsletter-${Date.now()}@example.com`;
  try {
    // the footer form, twice with the same address
    await page.goto('/');
    const footer = page.locator('footer.footer');
    for (let i = 0; i < 2; i++) {
      await page.goto('/');
      await footer.getByPlaceholder('Enter your mail address').fill(email);
      await footer.getByRole('button', { name: 'Enter your mail address' }).click();
      await expect(footer.getByRole('status')).toHaveText('Thanks for subscribing!');
    }
    const rows = await prisma.contactSubmission.findMany({ where: { email } });
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe('Newsletter');

    await page.goto('/admin/messages');
    await page.getByRole('tab', { name: /Newsletter sign-ups/ }).click();
    await expect(page).toHaveURL(/type=newsletter/);
    await expect(page.getByText('There is no mailing list')).toBeVisible();
    await expect(page.getByText(/nothing is ever sent to them/)).toBeVisible();
    await expect(page.locator('table').getByText(email)).toBeVisible();
    // ordinary messages are not in this list, and sign-ups are not under Messages
    const subjects = await page.locator('tbody tr td:nth-child(2)').allInnerTexts();
    expect(subjects.length).toBeGreaterThan(0);
    for (const subject of subjects) expect(subject.trim()).toBe('Newsletter');
    await page.getByRole('tab', { name: 'Messages', exact: true }).click();
    await expect(page).toHaveURL(/type=messages/);
    await expect(page.locator('table').getByText(email)).toHaveCount(0);

    await page.goto('/admin/messages?type=newsletter');
    const download = page.getByRole('link', { name: 'Download sign-ups (CSV)' });
    await expect(download).toHaveAttribute('href', '/admin/messages/newsletter-signups');
    const csv = await page.request.get('/admin/messages/newsletter-signups');
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toContain('text/csv');
    const lines = (await csv.text()).split(/\r?\n/);
    expect(lines[0]).toBe('Email,Signed up');
    expect(lines.filter((l) => l.startsWith(`${email},`))).toHaveLength(1);
  } finally {
    await prisma.contactSubmission.deleteMany({ where: { email } });
  }
});

test('the sign-ups download needs the admin to be signed in', async ({ playwright }) => {
  const baseURL = test.info().project.use.baseURL!;
  // (request contexts otherwise get the project's signed-in storage state)
  const context = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const res = await context.get('/admin/messages/newsletter-signups', { maxRedirects: 0 });
  expect([302, 303, 307, 401]).toContain(res.status());
  expect(await res.text()).not.toContain('Email,Signed up');
  // a forged session cookie gets past the middleware's presence check, not past the route's own check
  const { hostname } = new URL(baseURL);
  const forged = await playwright.request.newContext({
    baseURL,
    storageState: {
      cookies: [{ name: 'iw_admin_session', value: 'forged', domain: hostname, path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' }],
      origins: [],
    },
  });
  const res2 = await forged.get('/admin/messages/newsletter-signups', { maxRedirects: 0 });
  expect(res2.status()).toBe(401);
  await context.dispose();
  await forged.dispose();
});
