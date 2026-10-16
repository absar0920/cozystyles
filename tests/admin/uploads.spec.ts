import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { apiUpload, deleteBannersByTitle, saveBar, uniqueName, uploadInto } from '../helpers/admin';
import { makeImage, makeTextFileNamedJpg } from '../helpers/fixtures';
import { releaseTestUploads } from '../helpers/uploads';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100';
const URL_RE = /^\/uploads\/\d{4}\/\d{2}\/[a-z0-9-]+-[0-9a-f]{8}\.webp$/;

test.describe('photo uploads', () => {
  const since = new Date(Date.now() - 1000);
  // the API-level uploads below are never saved anywhere: remove their rows and files (dev.db is committed)
  test.afterAll(async () => {
    await releaseTestUploads({ since, originalNames: ['wide.png', 'gps.jpg', 'anon.jpg', 'csrf.jpg', 'orphan-a.jpg', 'orphan-b.jpg'] });
  });

  test('rejects requests without a session', async ({ playwright }) => {
    const anon = await playwright.request.newContext({ baseURL: BASE, storageState: { cookies: [], origins: [] } });
    const file = await makeImage('anon', { width: 50, height: 50 });
    const res = await apiUpload(anon, file);
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toMatch(/session has ended/i);
    await anon.dispose();
  });

  test('blocks cross-site and origin-less posts', async ({ request }) => {
    const file = await makeImage('csrf', { width: 50, height: 50 });
    const multipart = { file: { name: 'csrf.jpg', mimeType: 'image/jpeg', buffer: await sharp(file).toBuffer() }, purpose: 'product' };
    const none = await request.post('/api/admin/uploads', { multipart });
    expect(none.status()).toBe(403);
    const evil = await request.post('/api/admin/uploads', { multipart, headers: { Origin: 'https://evil.example' } });
    expect(evil.status()).toBe(403);
    expect((await evil.json()).error).toMatch(/blocked for security reasons/i);
  });

  test('rejects a text file named .jpg with a friendly message', async ({ request }) => {
    const res = await apiUpload(request, makeTextFileNamedJpg());
    expect(res.status()).toBe(415);
    expect((await res.json()).error).toBe('Only JPG, PNG, WebP or iPhone (HEIC) photos can be uploaded.');
  });

  test('stores a big PNG as a 2000px WebP and serves it', async ({ request }) => {
    const file = await makeImage('wide', { width: 3000, height: 1500, format: 'png', color: '#c25b41' });
    const res = await apiUpload(request, file);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.upload.url).toMatch(URL_RE);
    expect(body.upload).toMatchObject({ width: 2000, height: 1000 });

    const get = await request.get(body.upload.url);
    expect(get.status()).toBe(200);
    expect(get.headers()['content-type']).toBe('image/webp');
    expect(get.headers()['cache-control']).toContain('immutable');
    const meta = await sharp(await get.body()).metadata();
    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([2000, 1000]);
  });

  test('strips EXIF / GPS from photos', async ({ request }) => {
    const file = await makeImage('gps', { width: 800, height: 600, exif: true });
    expect((await sharp(file).metadata()).exif).toBeTruthy();
    const res = await apiUpload(request, file);
    expect(res.status()).toBe(200);
    const get = await request.get((await res.json()).upload.url);
    const meta = await sharp(await get.body()).metadata();
    expect(meta.exif).toBeUndefined();
  });

  test('never serves anything outside the upload folder', async ({ request }) => {
    expect((await request.get('/uploads/../../.env')).status()).toBe(404);
    // encoded traversal is refused before it reaches the route (400 from the server, or 404)
    expect([400, 404]).toContain((await request.get('/uploads/..%2F..%2F.env')).status());
    expect((await request.get('/uploads/2026/10/x.webp')).status()).toBe(404);
    expect((await request.get('/uploads/2026/10/missing-photo-0badc0de.webp')).status()).toBe(404);
  });

  test('a replaced or deleted banner photo is removed from the server', async ({ page, request }) => {
    const title = uniqueName('Banner');
    let bannerId = '';
    const card = () => page.locator(`[data-testid=banner-card][data-banner-id="${bannerId}"]`);
    const deleteCard = async () => {
      await card().getByTestId('confirm-delete').click();
      await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete permanently' }).click();
      await expect(card()).toHaveCount(0);
    };

    try {
      // create a hidden test banner with photo A
      await page.goto('/admin/banners');
      await page.getByRole('button', { name: '+ Add banner' }).click();
      let form = page.getByTestId('banner-form');
      await uploadInto(form.getByTestId('image-upload').nth(0), await makeImage('orphan-a', { width: 1200, height: 462, color: '#103a3a' }));
      const photo = form.getByTestId('image-upload').nth(0).locator('img');
      await expect(photo).toHaveAttribute('src', URL_RE);
      const a = (await photo.getAttribute('src')) ?? '';
      expect((await request.get(a)).status()).toBe(200);
      await form.getByLabel(/Name \(only for you/).fill(title);
      await form.getByRole('switch', { name: 'Show on the store' }).click();
      await saveBar(page).getByRole('button', { name: 'Add banner' }).click();
      await expect(page.getByText('Saved. The home page is updated.')).toBeVisible();
      const created = page.getByTestId('banner-card').filter({ hasText: title });
      await expect(created).toHaveCount(1);
      bannerId = (await created.getAttribute('data-banner-id')) ?? '';
      expect(bannerId).toMatch(/^\d+$/);

      // replace A with B → A is deleted
      await card().getByRole('button', { name: 'Edit' }).click();
      form = page.getByTestId('banner-form');
      await uploadInto(form.getByTestId('image-upload').nth(0), await makeImage('orphan-b', { width: 1200, height: 462, color: '#a19a7e' }));
      await expect(form.getByTestId('image-upload').nth(0).locator('img')).not.toHaveAttribute('src', a);
      const b = (await form.getByTestId('image-upload').nth(0).locator('img').getAttribute('src')) ?? '';
      expect(b).toMatch(URL_RE);
      await saveBar(page).getByRole('button', { name: 'Save banner' }).click();
      await expect(page.getByText('Saved. The home page is updated.')).toBeVisible();
      await expect.poll(async () => (await request.get(a)).status()).toBe(404);
      expect((await request.get(b)).status()).toBe(200);

      // delete the banner → B goes too
      await deleteCard();
      bannerId = '';
      await expect.poll(async () => (await request.get(b)).status()).toBe(404);
    } finally {
      // by name, so a banner whose id was never read from the list is removed too
      await deleteBannersByTitle(page, title);
    }
  });
});
