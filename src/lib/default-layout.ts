import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { DEFAULT_LAYOUT_KEY, layoutNameKey } from '@/lib/product-layouts';

const DEFAULT_NAME = 'General furniture (standard)';

/**
 * Every product falls back to the protected "default" page layout, and saving a product checks that its layout
 * exists. A seeded database has it; a fresh one (a new deployment that starts with only the admin user) does not, so
 * the admin creates it on first use: just the automatic "You may also like" section, which the owner can extend in
 * Product page layouts. Safe to call on every request: one indexed lookup once the row exists.
 */
export async function ensureDefaultLayout(): Promise<void> {
  if (await prisma.productLayout.findUnique({ where: { key: DEFAULT_LAYOUT_KEY }, select: { id: true } })) return;
  try {
    await prisma.productLayout.create({
      data: {
        key: DEFAULT_LAYOUT_KEY,
        name: DEFAULT_NAME,
        nameKey: layoutNameKey(DEFAULT_NAME),
        description: 'The standard page for most furniture.',
        position: 0,
        sections: { create: [{ position: 0, kind: 'recommendations', data: '{}' }] },
      },
    });
  } catch (err) {
    // Two first requests at once: the other one created it.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
  }
}
