import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { clientIpFromHeaders, rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

const LIMITS = { author: 80, title: 120, body: 2000 } as const;

/** Basic abuse guard: 3 reviews per 10 minutes per IP. */
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function bad(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

/**
 * POST /api/reviews — a shopper submits a product review. Reviews are stored
 * unapproved and only appear on the storefront once an admin approves them.
 */
export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  if (!rateLimit(`review:${ip}`, RATE_LIMIT, RATE_WINDOW_MS).ok) {
    return NextResponse.json(
      { ok: false, error: 'You are submitting reviews too quickly. Please try again later.' },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (typeof parsed !== 'object' || parsed === null) return bad('Invalid request body.');
    body = parsed as Record<string, unknown>;
  } catch {
    return bad('Invalid request body.');
  }

  const productId = Math.trunc(Number(body.productId));
  const rating = Math.trunc(Number(body.rating));
  const author = str(body.author);
  const title = str(body.title);
  const text = str(body.body);

  if (!Number.isFinite(productId) || productId <= 0) return bad('Unknown product.');
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return bad('Please choose a rating from 1 to 5 stars.');
  if (author.length < 2) return bad('Please enter your name.');
  if (author.length > LIMITS.author) return bad('Name is too long.');
  if (title.length > LIMITS.title) return bad('Title is too long.');
  if (text.length < 10) return bad('Please write at least a sentence about the product.');
  if (text.length > LIMITS.body) return bad(`Review is too long (maximum ${LIMITS.body} characters).`);

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { status: true } });
  if (!product || product.status !== 'ACTIVE') return bad('Unknown product.');

  await prisma.review.create({ data: { productId, rating, author, title, body: text, approved: false } });
  return NextResponse.json({ ok: true });
}
