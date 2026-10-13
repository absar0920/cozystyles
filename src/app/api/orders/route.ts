import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PAYMENT_METHODS } from '@/lib/constants';
import { PHONE_RE, MAX_QTY, normalizePhone, type CheckoutCustomer, type CheckoutLine } from '@/components/checkout/validation';

export const dynamic = 'force-dynamic';

const PAYMENT_VALUES = PAYMENT_METHODS.map((m) => m.value) as string[];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type RawBody = {
  customer?: Partial<CheckoutCustomer>;
  paymentMethod?: string;
  items?: { productId?: unknown; variantId?: unknown; qty?: unknown }[];
};

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** POST /api/orders — place an order (server-side pricing, COD-safe). */
export async function POST(req: Request) {
  let body: RawBody;
  try {
    body = (await req.json()) as RawBody;
  } catch {
    return bad('Invalid request body.');
  }

  const c = body.customer ?? {};
  const name = String(c.name ?? '').trim();
  const phone = normalizePhone(String(c.phone ?? '').trim());
  const email = String(c.email ?? '').trim();
  const address = String(c.address ?? '').trim();
  const city = String(c.city ?? '').trim();
  const province = String(c.province ?? '').trim() || 'Punjab';
  const notes = String(c.notes ?? '').trim().slice(0, 1000);
  const paymentMethod = String(body.paymentMethod ?? 'COD');

  // --- validation (mirrors client-side checks) ---
  if (name.length < 2) return bad('Please enter your full name.');
  if (!PHONE_RE.test(phone)) return bad('Please enter a valid Pakistani phone number (03XXXXXXXXX or +923XXXXXXXXX).');
  if (email && !EMAIL_RE.test(email)) return bad('Please enter a valid email address.');
  if (address.length < 8) return bad('Please enter your complete delivery address.');
  if (!city) return bad('Please select your city.');
  if (!PAYMENT_VALUES.includes(paymentMethod)) return bad('Please choose a valid payment method.');

  if (!Array.isArray(body.items) || body.items.length === 0) return bad('Your cart is empty.');

  const lines: CheckoutLine[] = [];
  for (const raw of body.items) {
    const productId = Math.trunc(Number(raw?.productId));
    const variantId = Math.trunc(Number(raw?.variantId));
    const qty = Math.trunc(Number(raw?.qty));
    if (!Number.isFinite(productId) || productId <= 0) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(variantId) || variantId < 0) continue;
    lines.push({ productId, variantId, qty: Math.min(MAX_QTY, qty) });
  }
  if (lines.length === 0) return bad('Your cart is empty.');

  try {
    // --- server-side pricing from the DB (never trust client prices) ---
    const productIds = [...new Set(lines.map((l) => l.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        variants: true,
        images: { orderBy: { position: 'asc' }, take: 1 },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const orderItems: {
      productId: number;
      variantId: number;
      title: string;
      variantTitle: string;
      price: number;
      quantity: number;
      image: string;
    }[] = [];

    for (const line of lines) {
      const product = byId.get(line.productId);
      if (!product || product.variants.length === 0) continue; // skip missing products
      const cheapest = [...product.variants].sort((a, b) => a.price - b.price)[0];
      const variant = line.variantId > 0 ? product.variants.find((v) => v.id === line.variantId) ?? cheapest : cheapest;
      orderItems.push({
        productId: product.id,
        variantId: variant.id,
        title: product.title,
        variantTitle: variant.title,
        price: variant.price,
        quantity: line.qty,
        image: product.images[0]?.src ?? '',
      });
    }

    if (orderItems.length === 0) return bad('The products in your cart are no longer available.');

    const subtotal = orderItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const shippingFee = 0; // free delivery & installation nationwide
    const total = subtotal;

    // orderNumber = 'IW-' + (100000 + id) — create with a unique placeholder, then set.
    const created = await prisma.order.create({
      data: {
        orderNumber: `TMP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        customerName: name,
        phone,
        email: email || null,
        address,
        city,
        province,
        notes,
        paymentMethod,
        status: 'PENDING',
        subtotal,
        discount: 0,
        shippingFee,
        total,
        items: { create: orderItems },
      },
    });

    const orderNumber = `IW-${100000 + created.id}`;
    const final = await prisma.order.update({
      where: { id: created.id },
      data: { orderNumber },
    });

    return NextResponse.json({ ok: true, orderNumber: final.orderNumber, orderId: final.id }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/orders] failed:', err);
    return bad('We could not place your order. Please try again.', 500);
  }
}
