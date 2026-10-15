'use server';

import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { clientIpFromHeaders, rateLimit } from '@/lib/ratelimit';

export type ReviewFormState = { ok: boolean; message: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Write a review" submission (live: Judge.me form). Reviews are stored unapproved and only appear
 * after an admin approves them in /admin/reviews.
 */
export async function submitReview(_prev: ReviewFormState, form: FormData): Promise<ReviewFormState> {
  const productId = Number(form.get('productId'));
  const rating = Number(form.get('rating'));
  const title = String(form.get('title') ?? '').trim().slice(0, 100);
  const body = String(form.get('body') ?? '').trim().slice(0, 5000);
  const author = String(form.get('name') ?? '').trim().slice(0, 80);
  const email = String(form.get('email') ?? '').trim();

  if (!Number.isInteger(productId) || productId <= 0) return { ok: false, message: 'Product not found.' };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, message: 'Please select a rating.' };
  if (!body) return { ok: false, message: 'Please write your review.' };
  if (!author) return { ok: false, message: 'Please enter your name.' };
  if (!EMAIL.test(email)) return { ok: false, message: 'Please enter a valid email.' };

  const ip = clientIpFromHeaders(await headers());
  if (!rateLimit(`review:${ip}`, 5, 60 * 60 * 1000).ok) {
    return { ok: false, message: 'Too many reviews submitted. Please try again later.' };
  }

  const product = await prisma.product.findFirst({ where: { id: productId, status: 'ACTIVE' }, select: { id: true } });
  if (!product) return { ok: false, message: 'Product not found.' };

  await prisma.review.create({ data: { productId, rating, title, body, author, approved: false } });
  return { ok: true, message: 'Thank you for submitting a review!' };
}
