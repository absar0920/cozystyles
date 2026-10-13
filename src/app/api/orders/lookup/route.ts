import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { clientIpFromHeaders, rateLimit, resetRateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

const NOT_FOUND = 'No order found for these details. Please check your order number and phone number.';
const THROTTLED = 'Too many lookups for this order. Please wait a few minutes and try again.';

/** Max failed lookups per order number per IP before throttling kicks in. */
const LOOKUP_MAX_ATTEMPTS = 5;
const LOOKUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Digits-only phone normalization for matching: "0300 1234567", "+923001234567"
 * and "923001234567" all fold to the same canonical "03001234567"
 * (leading 92 country code → leading 0).
 */
function normalizePhoneKey(s: string): string {
  const d = (s ?? '').replace(/\D+/g, '');
  if (d.startsWith('92') && d.length === 12) return `0${d.slice(2)}`;
  return d;
}

/**
 * GET /api/orders/lookup?order=IW-100001&phone=03001234567
 * Requires BOTH the order number (case-insensitive) AND the customer's FULL
 * phone number (compared after normalization), so one customer can never
 * enumerate another customer's orders with a partial number.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderQuery = (searchParams.get('order') ?? '').trim().toUpperCase();
  const phoneQuery = normalizePhoneKey(searchParams.get('phone') ?? '');

  if (!orderQuery || orderQuery.length < 4 || phoneQuery.length < 6) {
    return NextResponse.json({ ok: false, error: NOT_FOUND }, { status: 400 });
  }

  // Throttle guesses: 5 failed attempts per order number per IP per 10 min.
  const throttleKey = `lookup:${orderQuery}:${clientIpFromHeaders(req.headers)}`;
  const rl = rateLimit(throttleKey, LOOKUP_MAX_ATTEMPTS, LOOKUP_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: THROTTLED }, { status: 429 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderQuery }, // stored numbers are always uppercase IW-100001
      include: { items: true },
    });

    // Full phone match only (normalized): stored "03001234567" must equal the
    // query's "+923001234567" / "923001234567" / "0300 1234567" — never a partial.
    const phoneMatch = order != null && normalizePhoneKey(order.phone) === phoneQuery;

    if (!order || !phoneMatch) {
      // Same response for "no such order" and "wrong phone" — never leak which one.
      return NextResponse.json({ ok: false, error: NOT_FOUND }, { status: 404 });
    }

    resetRateLimit(throttleKey); // success clears the failure window

    return NextResponse.json({
      ok: true,
      status: order.status,
      order: {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        city: order.city,
        status: order.status,
        subtotal: order.subtotal,
        total: order.total,
        createdAt: order.createdAt,
        items: order.items.map((it) => ({
          title: it.title,
          variantTitle: it.variantTitle,
          price: it.price,
          quantity: it.quantity,
          image: it.image,
        })),
      },
    });
  } catch (err) {
    console.error('[GET /api/orders/lookup] failed:', err);
    return NextResponse.json({ ok: false, error: 'Lookup failed. Please try again.' }, { status: 500 });
  }
}
