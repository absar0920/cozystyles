import { expect, type Page } from '@playwright/test';
import type { PrismaClient } from '@prisma/client';

/** Every admin screen the sweep specs (no-typed-fields, mobile) visit. Ids come from seeded rows. */
export type AdminRoute = { name: string; path: string; prepare?: (page: Page) => Promise<void> };

export async function adminRoutes(prisma: PrismaClient): Promise<AdminRoute[]> {
  const [product, collection, textPage, designedPage, post, layout] = await Promise.all([
    prisma.product.findUniqueOrThrow({ where: { handle: 'alexa-sofa-chair' }, select: { id: true } }),
    prisma.collection.findUniqueOrThrow({ where: { handle: 'sofas-all' }, select: { id: true } }),
    prisma.page.findUniqueOrThrow({ where: { handle: 'privacy-policy' }, select: { id: true } }),
    prisma.page.findUniqueOrThrow({ where: { handle: 'about-us' }, select: { id: true } }),
    prisma.page.findFirstOrThrow({ where: { kind: 'BLOG' }, orderBy: { id: 'asc' }, select: { id: true } }),
    prisma.productLayout.findUniqueOrThrow({ where: { key: 'default' }, select: { id: true } }),
  ]);
  return [
    { name: 'dashboard', path: '/admin' },
    { name: 'inquiries', path: '/admin/inquiries' },
    { name: 'products list', path: '/admin/products' },
    {
      name: 'product edit (Advanced open)',
      path: `/admin/products/${product.id}`,
      prepare: async (page) => {
        const advanced = page.getByText('Advanced', { exact: true }).first();
        if (await advanced.isVisible()) await advanced.click();
      },
    },
    { name: 'new product', path: '/admin/products/new' },
    { name: 'product layouts list', path: '/admin/product-layouts' },
    {
      name: 'product layout edit (sections open)',
      path: `/admin/product-layouts/${layout.id}`,
      prepare: async (page) => {
        // at desktop width several sections stay open; on phones only the last one opened
        const buttons = page.getByTestId('layout-section').getByRole('button', { name: /^Edit\b/ });
        const n = await buttons.count();
        for (let i = 0; i < n; i++) if (await buttons.count()) await buttons.first().click();
        await expect(page.getByTestId('section-editor').first()).toBeVisible();
      },
    },
    { name: 'collections list', path: '/admin/collections' },
    { name: 'collection edit', path: `/admin/collections/${collection.id}` },
    { name: 'arrange collections', path: '/admin/collections/arrange' },
    {
      name: 'banners (form open)',
      path: '/admin/banners',
      prepare: async (page) => {
        await page.getByRole('button', { name: '+ Add banner' }).click();
        await expect(page.getByTestId('banner-form')).toBeVisible();
      },
    },
    { name: 'menu: main', path: '/admin/menus?tab=main' },
    { name: 'menu: about', path: '/admin/menus?tab=about' },
    { name: 'menu: support', path: '/admin/menus?tab=support' },
    { name: 'menu: popular', path: '/admin/menus?tab=popular' },
    { name: 'pages list', path: '/admin/pages' },
    { name: 'text page', path: `/admin/pages/${textPage.id}` },
    { name: 'designed page', path: `/admin/pages/${designedPage.id}` },
    { name: 'blog list', path: '/admin/blog' },
    { name: 'blog edit', path: `/admin/blog/${post.id}` },
    { name: 'settings', path: '/admin/settings' },
    { name: 'password', path: '/admin/account/password' },
  ];
}
