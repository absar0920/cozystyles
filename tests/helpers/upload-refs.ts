/**
 * Run with `npx tsx --conditions=react-server tests/helpers/upload-refs.ts <referenced|sweep> <url…>` (the
 * react-server condition lets `src/lib/uploads.ts`, which imports 'server-only', load outside Next).
 * - referenced: prints {url: isUploadReferenced(url)}
 * - sweep: runs the app's 24-hour orphan sweep (forced), then prints {url: the Upload row still exists}
 * Used by tests/admin/product-layouts.spec.ts; prints one JSON line.
 */
import { prisma } from '@/lib/db';
import { isUploadReferenced, sweepOrphanUploads } from '@/lib/uploads';

async function main() {
  const [cmd, ...urls] = process.argv.slice(2);
  const out: Record<string, boolean> = {};
  if (cmd === 'referenced') {
    for (const u of urls) out[u] = await isUploadReferenced(u);
  } else if (cmd === 'sweep') {
    await sweepOrphanUploads({ force: true });
    for (const u of urls) out[u] = (await prisma.upload.count({ where: { url: u } })) > 0;
  } else throw new Error(`unknown command ${cmd}`);
  console.log(JSON.stringify(out));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
