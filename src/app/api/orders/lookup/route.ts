import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { digits } from '@/components/checkout/validation';

export const dynamic = 'force-dynamic';

const NOT_FOUND = 'No order found for these details. Please check your order number and phone number.';

/**
 * GET /api/orders/lookup?order=IW-100001&phone=03001234567
 * Requires BOTH the order number (case-insensitive) AND a phone number whose
 * full value or last 6 digits match the order's phone — so one customer can
 * never enumerate another customer's orders.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderQuery = (searchParams.get('order') ?? '').trim().toUpperCase();
  const phoneQuery = digits(searchParams.get('phone') ?? '');

  if (!orderQuery || orderQuery.length < 4 || phoneQuery.length < 6) {
    return NextResponse.json({ ok: false, error: NOT_FOUND }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderQuery }, // stored numbers are always uppercase IW-100001
      include: { items: true },
    });

    const phoneMatch =
      order != null &&
      (digits(order.phone) === phoneQuery || digits(order.phone).endsWith(phoneQuery.slice(-6)));

    if (!order || !phoneMatch) {
      // Same response for "no such order" and "wrong phone" — never leak which one.
      return NextResponse.json({ ok: false, error: NOT_FOUND }, { status: 404 });
    }

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
