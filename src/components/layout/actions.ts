'use server';

import { prisma } from '@/lib/db';
import { getRelatedProducts, listProducts } from '@/lib/queries';

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
      where: { isBlogPost: true, published: true, title: { contains: q } },
      select: { handle: true, title: true },
      take: 4,
    }),
    prisma.collection.findMany({
      where: { title: { contains: q } },
      select: { handle: true, title: true },
      orderBy: { position: 'asc' },
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
    articles: articles.map((a) => ({ href: `/blogs/news/${a.handle.replace(/^news-/, '')}`, title: a.title })),
    suggestions: collections.map((c) => ({ href: `/collections/${c.handle}`, label: c.title })),
  };
}

/** Cart drawer "YOU MAY ALSO LIKE": products related to the cart lines, excluding them. */
export async function cartRecommendations(productIds: number[]): Promise<PredictiveProduct[]> {
  const ids = (Array.isArray(productIds) ? productIds : []).filter((n) => Number.isInteger(n) && n > 0).slice(0, 10);
  if (!ids.length) return [];
  const first = await prisma.product.findUnique({
    where: { id: ids[0] },
    select: { collections: { select: { handle: true }, take: 3 } },
  });
  const related = await getRelatedProducts(ids[0], first?.collections.map((c) => c.handle) ?? [], 10);
  return related
    .filter((p) => !ids.includes(p.id) && !p.priceOnRequest)
    .slice(0, 6)
    .map((p) => ({
      handle: p.handle,
      title: p.title,
      image: p.image,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      priceOnRequest: p.priceOnRequest,
    }));
}
