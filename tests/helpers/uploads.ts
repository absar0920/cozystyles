import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Test-data hygiene for photo uploads (prisma/dev.db is committed). Deletes the Upload rows — and their files —
 * that a spec created (matched by original file name, created at/after `since`) when nothing references them.
 * Mirrors isUploadReferenced() in src/lib/uploads.ts, which is server-only and cannot be imported here.
 */
export async function releaseTestUploads({ since, originalNames }: { since: Date; originalNames: string[] }): Promise<number> {
  const prisma = new PrismaClient();
  const root = path.resolve(process.env.UPLOADS_DIR ?? path.join(__dirname, '../../storage/uploads'));
  let removed = 0;
  try {
    const rows = await prisma.upload.findMany({
      where: { createdAt: { gte: since }, originalName: { in: originalNames.map((n) => path.basename(n)) } },
      select: { id: true, key: true, url: true },
    });
    for (const u of rows) {
      const url = u.url;
      const refs = await Promise.all([
        prisma.productImage.count({ where: { src: url } }),
        prisma.productOptionValue.count({ where: { swatchImage: url } }),
        prisma.collection.count({ where: { OR: [{ image: url }, { description: { contains: url } }] } }),
        prisma.collectionIndexCard.count({ where: { systemImage: url } }),
        prisma.banner.count({ where: { OR: [{ image: url }, { mobileImage: url }] } }),
        prisma.page.count({ where: { OR: [{ featuredImage: url }, { bodyHtml: { contains: url } }] } }),
        prisma.product.count({ where: { bodyHtml: { contains: url } } }),
        prisma.siteSetting.count({ where: { value: { contains: url } } }),
      ]);
      if (refs.some((n) => n > 0)) continue;
      const file = path.resolve(root, u.key);
      if (file.startsWith(root + path.sep)) await unlink(file).catch(() => undefined);
      await prisma.upload.deleteMany({ where: { id: u.id } });
      removed++;
    }
  } finally {
    await prisma.$disconnect();
  }
  return removed;
}
