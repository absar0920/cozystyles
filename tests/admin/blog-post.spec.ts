import { expect, test, type Page } from '@playwright/test';
import { saveBar, uniqueName, uploadInto } from '../helpers/admin';
import { fixture } from '../helpers/fixtures';
import { releaseTestUploads } from '../helpers/uploads';

/** Pages and blog posts (SPEC §5.3, §8.2 spec 6). */

const editor = (page: Page) => page.getByTestId('rich-text-editor').getByRole('textbox');

/** Deletes every row of a list page whose title contains `needle` (cleanup after a failed run). */
async function deleteRows(page: Page, list: '/admin/blog' | '/admin/pages', needle: string) {
  for (let i = 0; i < 10; i++) {
    await page.goto(`${list}?q=${encodeURIComponent(needle)}`);
    const row = page.locator('[data-testid=blog-row], [data-testid=page-row]').filter({ hasText: needle }).first();
    if (!(await row.count())) return;
    await row.getByTestId('confirm-delete').click();
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/deleted=1/);
  }
}

test.describe('blog posts and pages', () => {
  const postTitle = uniqueName('Blog');
  const pageTitle = uniqueName('Page');
  const since = new Date(Date.now() - 1000);

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await deleteRows(page, '/admin/blog', postTitle);
    await deleteRows(page, '/admin/pages', pageTitle);
    await page.close();
    await releaseTestUploads({ since, originalNames: ['blog-cover.jpg', 'sofa-grey.jpg'] });
  });

  test('create a post with photo, subheading and tags, then delete it', async ({ page, request }) => {
    const photo = fixture('blog-cover.jpg');

    await page.goto('/admin/blog/new');
    await expect(editor(page)).toBeVisible(); // hydrated
    await page.getByLabel('Title', { exact: true }).fill(postTitle);
    await page.getByLabel('Date').fill('2026-01-15');
    await page.getByLabel('Author').fill('E2E Author');
    const upload = page.getByTestId('image-upload');
    await uploadInto(upload, photo);
    await expect(upload.locator('img')).toHaveAttribute('src', /^\/uploads\//);

    await editor(page).click();
    await page.keyboard.type('An introduction paragraph.');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Subheading' }).click();
    await page.keyboard.type('E2E subheading');
    await page.keyboard.press('Enter');
    await page.keyboard.type('The body text under the subheading.');

    const tags = page.getByRole('textbox', { name: 'Tags' });
    await tags.fill('Design Ideas');
    await tags.press('Enter');
    await tags.fill('E2E Tag');
    await tags.press('Enter');

    await saveBar(page).getByRole('button', { name: 'Create post' }).click();
    await expect(page).toHaveURL(/\/admin\/blog\/\d+\?created=1/);
    await expect(page.getByText('Blog post created.')).toBeVisible();

    // blog index card: image + date
    await page.goto('/blogs/news');
    const card = page.locator('.blog-post').filter({ hasText: postTitle });
    await expect(card).toBeVisible();
    await expect(card.locator('img')).toHaveAttribute('src', /^\/uploads\//);
    await expect(card.locator('aside')).toHaveText(/January 15 2026/i);
    // the subheading ends with a full stop in the preview instead of running into the next sentence
    await expect(card.locator('.post-excerpt')).toHaveText('An introduction paragraph. E2E subheading. The body text under the subheading.');

    // post page: date, author, image, tags, content
    await card.getByRole('link', { name: postTitle }).first().click();
    await expect(page.locator('h1')).toHaveText(postTitle);
    const article = page.locator('#blog-post-detail');
    await expect(article.locator('time')).toHaveText('Jan 15, 2026');
    await expect(article.getByText('E2E Author', { exact: true })).toBeVisible();
    await expect(article.locator('img').first()).toHaveAttribute('src', /^\/uploads\//);
    await expect(article.locator('.post-content h3')).toHaveText('E2E subheading');
    await expect(article.locator('footer a', { hasText: 'E2E Tag' })).toHaveAttribute('href', '/blogs/news/tagged/e2e-tag');
    await expect(article.locator('footer a', { hasText: 'Design Ideas' })).toBeVisible();

    // tag page lists it
    await page.goto('/blogs/news/tagged/e2e-tag');
    await expect(page.locator('.blog-post').filter({ hasText: postTitle })).toBeVisible();

    // delete → the tag page is gone
    await page.goto('/admin/blog?q=' + encodeURIComponent(postTitle));
    await page.getByTestId('blog-row').filter({ hasText: postTitle }).getByRole('link', { name: `Edit ${postTitle}` }).click();
    // the list rows have delete buttons too: wait until the post's editor has really opened
    await expect(page).toHaveURL(/\/admin\/blog\/\d+/);
    await expect(page.getByTestId('blog-row')).toHaveCount(0);
    await page.getByTestId('confirm-delete').click();
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toContainText('The post, its text and its featured photo');
    await dialog.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/\/admin\/blog\?deleted=1/);
    expect((await request.get('/blogs/news/tagged/e2e-tag')).status()).toBe(404);
  });

  test('editor: typing after a new photo keeps it, links use page names, save waits for uploads', async ({ page }) => {
    await page.goto('/admin/pages/new');
    await expect(editor(page)).toBeVisible(); // hydrated
    const hidden = page.locator('input[type=hidden][name=content]');
    await editor(page).click();
    await page.keyboard.type('Before photo');
    await page.keyboard.press('Enter');

    // hold the upload so the save bar can be checked while it runs
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/api/admin/uploads', async (route) => {
      await held;
      await route.continue();
    });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Add photo' }).click();
    await (await chooser).setFiles(fixture('sofa-grey.jpg'));
    await expect(saveBar(page)).toContainText('Waiting for the photo to finish uploading');
    await expect(saveBar(page).getByRole('button', { name: 'Create page' })).toBeDisabled();
    release();
    await expect(page.locator('.admin-rte img')).toHaveCount(1);
    await expect(saveBar(page).getByRole('button', { name: 'Create page' })).toBeEnabled();

    // the cursor is after the photo: typing must not replace it
    await page.keyboard.type('After photo');
    await expect(hidden).toHaveValue(/<img src="\/uploads\/[^"]+"[^>]*><p>After photo<\/p>/);
    await page.getByPlaceholder('e.g. Walnut dining table with six chairs').fill('Grey sofa');
    await expect(hidden).toHaveValue(/alt="Grey sofa"/);

    // a link added with nothing selected shows the page name, never its address
    await page.getByText('After photo').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' see ');
    await page.getByRole('button', { name: 'Link', exact: true }).click();
    const popover = page.getByTestId('editor-link-popover');
    await popover.getByRole('button', { name: 'Choose link' }).click();
    await page.getByLabel('Search collections, products, pages').fill('privacy');
    await page.getByRole('dialog').getByRole('button', { name: /Privacy Policy/ }).first().click();
    await expect(hidden).toHaveValue(/<a href="\/pages\/privacy-policy">Privacy Policy<\/a>/);
  });

  test('a custom-design page shows the notice and no editor', async ({ page }) => {
    await page.goto('/admin/pages?q=About%20Us');
    await page.getByTestId('page-row').filter({ hasText: /^About Us/ }).getByRole('link', { name: 'Edit About Us' }).click();
    await expect(page.getByText('This page has a custom design')).toBeVisible();
    await expect(page.getByTestId('rich-text-editor')).toHaveCount(0);
    await expect(page.getByLabel('SEO title')).toBeVisible();
  });

  test('the privacy policy opens as clean rich text', async ({ page }) => {
    await page.goto('/admin/pages?q=Privacy');
    await page.getByTestId('page-row').filter({ hasText: 'Privacy Policy' }).getByRole('link', { name: 'Edit Privacy Policy' }).click();
    await expect(editor(page)).toBeVisible();
    const html = await page.locator('input[type=hidden][name=content]').inputValue();
    expect(html.length).toBeGreaterThan(100);
    expect(html.toLowerCase()).not.toContain('<!doctype');
    expect(html).not.toContain('class=');
    const editorHtml = await editor(page).innerHTML();
    expect(editorHtml.toLowerCase()).not.toContain('<!doctype');
  });

  test('create, edit and delete a text page', async ({ page, request }) => {
    await page.goto('/admin/pages/new');
    await expect(editor(page)).toBeVisible(); // hydrated
    await page.getByLabel('Title', { exact: true }).fill(pageTitle);
    await editor(page).click();
    await page.keyboard.type('Our return rules.');
    await saveBar(page).getByRole('button', { name: 'Create page' }).click();
    await expect(page).toHaveURL(/\/admin\/pages\/\d+\?created=1/);
    await expect(page.getByText('To let customers find this page, add it to a menu.')).toBeVisible();

    const slug = pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const res = await request.get(`/pages/${slug}`);
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('Our return rules.');
    // the store shows the title as the page heading, above the text
    const store = await page.context().newPage();
    await store.goto(`/pages/${slug}`);
    await expect(store.locator('main h1')).toHaveText(pageTitle);
    await expect(store.locator('main .sf-text-body')).toHaveText('Our return rules.');
    await store.close();

    // edit: the save bar reports unsaved changes, then "Saved"
    await page.getByLabel('SEO title').fill('E2E SEO title');
    await expect(saveBar(page)).toContainText('Unsaved changes');
    await saveBar(page).getByRole('button', { name: 'Save' }).click();
    await expect(saveBar(page)).toContainText('Saved');
    await page.reload();
    await expect(page.getByLabel('SEO title')).toHaveValue('E2E SEO title');
    expect(await (await request.get(`/pages/${slug}`)).text()).toContain('<title>E2E SEO title');

    // hide it → 404 on the store
    await page.getByRole('switch', { name: 'Visible on the store' }).click();
    await saveBar(page).getByRole('button', { name: 'Save' }).click();
    await expect(saveBar(page)).toContainText('Saved');
    expect((await request.get(`/pages/${slug}`)).status()).toBe(404);

    // a web address another page has is refused (the demo's custom-design About Us page here; a shop without one
    // can give /pages/about-us to a text page), and so is the built-in Contact us page's
    await page.getByText('Advanced').click();
    await page.getByLabel('Web address').fill('about-us');
    await saveBar(page).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('The page “About Us” already uses this web address. Please choose another.').first()).toBeVisible();
    await page.getByLabel('Web address').fill('contact');
    await saveBar(page).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('That web address is used by a built-in page. Please choose another.').first()).toBeVisible();

    await page.getByTestId('confirm-delete').click();
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/\/admin\/pages\?deleted=1/);
  });

  test('a new page whose automatic web address is taken is refused, not saved under another address', async ({ page }) => {
    await page.goto('/admin/pages/new');
    await expect(editor(page)).toBeVisible(); // hydrated
    await page.getByLabel('Title', { exact: true }).fill('Privacy Policy');
    await editor(page).click();
    await page.keyboard.type('Copy.');
    await saveBar(page).getByRole('button', { name: 'Create page' }).click();
    try {
      await expect(page.getByText('The page “Privacy Policy” already uses this web address. Please choose another.').first()).toBeVisible();
      // the Advanced section opens on the address that was refused
      await expect(page.getByLabel('Web address')).toBeVisible();
      await expect(page.getByLabel('Web address')).toHaveValue('privacy-policy');
      await expect(page).toHaveURL(/\/admin\/pages\/new$/);
    } finally {
      // a regression would have created a second "Privacy Policy" page: remove it
      if (/\/admin\/pages\/\d+/.test(page.url())) {
        await page.getByTestId('confirm-delete').click();
        await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete permanently' }).click();
        await expect(page).toHaveURL(/\/admin\/pages\?deleted=1/);
      }
    }
  });
});
