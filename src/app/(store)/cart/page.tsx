import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { CartView, type OptionNames } from './CartView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Your Shopping Cart' };

/** Option names per product handle, so cart lines read "Size: 1 Seater" like live. */
async function loadOptionNames(): Promise<OptionNames> {
  const products = await prisma.product.findMany({
    where: { options: { not: '[]' } },
    select: { handle: true, options: true },
  });
  const map: OptionNames = {};
  for (const p of products) {
    try {
      const opts = JSON.parse(p.options) as { name?: string; position?: number }[];
      const names = opts
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((o) => o.name ?? '')
        .filter(Boolean);
      if (names.length) map[p.handle] = names;
    } catch {
      // malformed options JSON: fall back to the bare variant title
    }
  }
  return map;
}

export default async function CartPage() {
  return (
    <CartView optionNames={await loadOptionNames()} />
  );
}
