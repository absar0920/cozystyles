import { expect, test, type Page } from '@playwright/test';

/** SPEC decision 29 — unsaved changes are not lost silently: links, and the browser Back button after in-app navigation. */

async function openSettingsInApp(page: Page) {
  await page.goto('/admin');
  // client-side navigation, so Back is handled by the app router (no page unload)
  await page.locator('a[href="/admin/settings"]').first().click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(page.getByLabel('Phone', { exact: true })).toBeVisible();
}

test('Back after an in-app navigation asks before losing edits; cancelling keeps them', async ({ page }) => {
  await openSettingsInApp(page);
  const phone = page.getByLabel('Phone', { exact: true });
  const original = await phone.inputValue();
  await phone.fill(`${original} x`);

  const dialogs: string[] = [];
  page.once('dialog', (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await page.goBack({ waitUntil: 'commit' }).catch(() => {});
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toContain('unsaved changes');
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(phone).toHaveValue(`${original} x`);

  // second Back: accept → leaves to the dashboard
  page.once('dialog', (d) => {
    dialogs.push(d.message());
    void d.accept();
  });
  await page.goBack({ waitUntil: 'commit' }).catch(() => {});
  await expect.poll(() => dialogs.length).toBe(2);
  await expect(page).toHaveURL(/\/admin$/);
});

test('a clean form leaves on the first Back with no prompt', async ({ page }) => {
  await openSettingsInApp(page);
  const phone = page.getByLabel('Phone', { exact: true });
  const original = await phone.inputValue();
  // dirty, then reverted → clean: the extra history entry is dropped again
  await phone.fill(`${original} x`);
  await phone.fill(original);
  await page.waitForTimeout(300);
  let prompted = false;
  page.on('dialog', (d) => {
    prompted = true;
    void d.dismiss();
  });
  await page.goBack();
  await expect(page).toHaveURL(/\/admin$/);
  expect(prompted).toBe(false);
});

test('after saving, Back leaves with no prompt', async ({ page }) => {
  await openSettingsInApp(page);
  const phone = page.getByLabel('Phone', { exact: true });
  const original = await phone.inputValue();
  const save = page.getByTestId('save-bar').getByRole('button', { name: /^Save/ });
  let prompted = false;
  page.on('dialog', (d) => {
    prompted = true;
    void d.dismiss();
  });
  const saved = page.getByText('Saved. The store is updated.');
  try {
    await phone.fill(`${original} 1`);
    await save.click();
    // the button is also disabled while the save runs: wait until it has landed
    await expect(saved).toBeVisible();
    await expect(save).toBeDisabled();
  } finally {
    // put the real value back the same way, after the first save has finished
    await phone.fill(original);
    if (await save.isEnabled()) {
      await save.click();
      await expect(saved).toBeVisible();
    }
    await expect(phone).toHaveValue(original);
    await expect(save).toBeDisabled();
  }
  await page.waitForTimeout(300);
  await page.goBack();
  await expect(page).toHaveURL(/\/admin$/);
  expect(prompted).toBe(false);
  // the stored value really is the original again
  await page.goto('/admin/settings');
  await expect(page.getByLabel('Phone', { exact: true })).toHaveValue(original);
});
