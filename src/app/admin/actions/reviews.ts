'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';

/** Admin review moderation actions. */

/** Re-rate a product's denormalized rating/reviewCount from its approved reviews. */
async function syncProductReviewStats(productId: number) {
  const agg = await prisma.review.aggregate({
    where: { productId, approved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const count = agg._count._all;
  await prisma.product.update({
    where: { id: productId },
    data: count > 0 ? { reviewCount: count, rating: Math.round((agg._avg.rating ?? 5) * 10) / 10 } : { reviewCount: 0 },
  });
}

/* -------------------------------- Reviews -------------------------------- */

export async function toggleReviewApprovedAction(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;
  const review = await prisma.review.findUnique({ where: { id }, select: { approved: true, productId: true } });
  if (!review) return;

  await prisma.review.update({ where: { id }, data: { approved: !review.approved } });
  await syncProductReviewStats(review.productId);

  const product = await prisma.product.findUnique({ where: { id: review.productId }, select: { handle: true } });
  revalidatePath('/admin/reviews');
  revalidatePath('/');
  if (product) revalidatePath(`/products/${product.handle}`);
}

export async function deleteReviewAction(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;
  const review = await prisma.review.findUnique({ where: { id }, select: { productId: true } });
  if (!review) return;

  await prisma.review.delete({ where: { id } });
  await syncProductReviewStats(review.productId);

  const product = await prisma.product.findUnique({ where: { id: review.productId }, select: { handle: true } });
  revalidatePath('/admin/reviews');
  revalidatePath('/');
  if (product) revalidatePath(`/products/${product.handle}`);
}
