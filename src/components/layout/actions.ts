'use server';

import { prisma } from '@/lib/db';
import { listProducts } from '@/lib/queries';
import { pagePublicPath } from '@/lib/page-kinds';

export type PredictiveProduct = {
  handle: string;
  title: string;
  image: string | null;
  price: number;
  compareAtPrice: number | null;
  priceOnRequest: boolean;
};

export type PredictiveResults = {
  products: PredictiveProduct[];
  articles: { href: string; title: string }[];
  suggestions: { href: string; label: string }[];
};

/** Header predictive search (live: Products / Articles / Suggestions tabs). */
export async function predictiveSearch(raw: string): Promise<PredictiveResults> {
  const q = String(raw ?? '').trim().slice(0, 80);
  if (q.length < 2) return { products: [], articles: [], suggestions: [] };

  const [products, articles, collections] = await Promise.all([
    listProducts({ q, perPage: 4 }),
    prisma.page.findMany({
      where: { kind: 'BLOG', published: true, title: { contains: q } },
      select: { handle: true, title: true, kind: true },
      take: 4,
    }),
    prisma.collection.findMany({
      where: { title: { contains: q } },
      select: { handle: true, title: true },
      orderBy: { title: 'asc' },
      take: 6,
    }),
  ]);

  return {
    products: products.items.map((p) => ({
      handle: p.handle,
      title: p.title,
      image: p.image,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      priceOnRequest: p.priceOnRequest,
    })),
    articles: articles.map((a) => ({ href: pagePublicPath(a), title: a.title })),
    suggestions: collections.map((c) => ({ href: `/collections/${c.handle}`, label: c.title })),
  };
}
