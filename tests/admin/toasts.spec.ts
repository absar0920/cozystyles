import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { saveBar, uniqueName } from '../helpers/admin';

/** Toasts pop up on top of the inline notices: from client saves, from save errors and from server actions. */

const toasts = (page: Page) => page.getByTestId('toaster').getByTestId('toast');
const prisma = new PrismaClient();
// a "%" in the name once broke the redirect after a delete (the cookie was decoded twice)
const title = `${uniqueName('Toast page')} 100% cotton`;

// the test deletes its page through the admin; this only cleans up after a run that failed half-way
test.afterAll(async () => {
  await prisma.page.deleteMany({ where: { title } });
  await prisma.$disconnect();
});

test('saving, a save error and deleting each pop up a toast', async ({ page }) => {
  // a save error: the reason stays in the save bar, the toast points to it
  await page.goto('/admin/pages/new');
  await saveBar(page).getByRole('button', { name: 'Create page' }).click();
  await expect(saveBar(page).getByRole('status')).not.toBeEmpty();
  const notSaved = toasts(page).filter({ hasText: 'Not saved.' });
  await expect(notSaved).toHaveAttribute('data-tone', 'error');
  // the same error again pops up again (keyed on the save, not on the text)
  await notSaved.getByRole('button', { name: 'Close notification' }).click();
  await expect(notSaved).toHaveCount(0);
  await page.waitForTimeout(1600); // past the de-duplication window for identical toasts
  await saveBar(page).getByRole('button', { name: 'Create page' }).click();
  await expect(notSaved).toHaveCount(1);

  // a client save
  await page.getByLabel('Title', { exact: true }).fill(title);
  await saveBar(page).getByRole('button', { name: 'Create page' }).click();
  await expect(page).toHaveURL(/\/admin\/pages\/\d+\?created=1/);
  const added = toasts(page).filter({ hasText: 'Page added' });
  await expect(added).toHaveAttribute('data-tone', 'success');

  // the close button dismisses it; the toast never blocks clicks on the page behind it
  await added.getByRole('button', { name: 'Close notification' }).click();
  await expect(added).toHaveCount(0);

  // a server action that redirects (delete) leaves its toast in a cookie for the next page
  await page.goto(`/admin/pages?q=${encodeURIComponent(title)}`);
  const row = page.getByTestId('page-row').filter({ hasText: title });
  await row.getByTestId('confirm-delete').click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page).toHaveURL(/deleted=1/);
  await expect(toasts(page).filter({ hasText: 'removed' })).toContainText(title);
  // read once: a reload does not show it again
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600); // more than one cookie check (every 400 ms)
  await expect(toasts(page)).toHaveCount(0);
});
