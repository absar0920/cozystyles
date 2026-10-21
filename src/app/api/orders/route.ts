import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PAYMENT_METHODS } from '@/lib/constants';
import { getSettingsMap } from '@/lib/queries';
import { shippingFeeFor, shippingRuleFromSettings } from '@/lib/shipping';
import { PHONE_RE, MAX_QTY, normalizePhone, type CheckoutCustomer, type CheckoutLine } from '@/components/checkout/validation';

export const dynamic = 'force-dynamic';

const PAYMENT_VALUES = PAYMENT_METHODS.map((m) => m.value) as string[];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Request hardening limits. */
const MAX_ITEMS = 50;
const MAX_TOTAL = 100_000_000; // 10 crore PKR — anything above is surely a mistake/abuse.
const FIELD_LIMITS = { name: 120, phone: 20, email: 200, address: 500, city: 100, province: 100 } as const;
/** Duplicate-submission window: same phone + same items within this window returns the existing order. */
const DUPLICATE_WINDOW_MS = 60_000;

type RawBody = {
  customer?: Partial<CheckoutCustomer>;
  paymentMethod?: string;
  items?: { productId?: unknown; variantId?: unknown; qty?: unknown }[];
};

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** Order-independent fingerprint of the cart contents (variant + quantity per line). */
function itemsFingerprint(items: { variantId: number | null; quantity: number }[]): string {
  return items
    .map((it) => `${it.variantId ?? 'x'}x${it.quantity}`)
    .sort()
    .join(',');
}

/** Storage forms of the same mobile number: "03001234567" ⇔ "+923001234567" ⇔ "923001234567". */
function phoneStorageVariants(phone: string): string[] {
  const d = phone.replace(/\D+/g, '');
  const variants = new Set([phone]);
  if (d.startsWith('0') && d.length === 11) {
    variants.add(`+92${d.slice(1)}`);
    variants.add(`92${d.slice(1)}`);
  } else if (d.startsWith('92') && d.length === 12) {
    variants.add(`0${d.slice(2)}`);
    variants.add(`+92${d.slice(2)}`);
  }
  return [...variants];
}

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
  if (name.length > FIELD_LIMITS.name) return bad(`Name is too long (maximum ${FIELD_LIMITS.name} characters).`);
  if (!PHONE_RE.test(phone)) return bad('Please enter a valid Pakistani phone number (03XXXXXXXXX or +923XXXXXXXXX).');
  if (phone.length > FIELD_LIMITS.phone) return bad(`Phone number is too long (maximum ${FIELD_LIMITS.phone} characters).`);
  if (email && !EMAIL_RE.test(email)) return bad('Please enter a valid email address.');
  if (email.length > FIELD_LIMITS.email) return bad(`Email address is too long (maximum ${FIELD_LIMITS.email} characters).`);
  if (address.length < 8) return bad('Please enter your complete delivery address.');
  if (address.length > FIELD_LIMITS.address) return bad(`Address is too long (maximum ${FIELD_LIMITS.address} characters).`);
  if (!city) return bad('Please select your city.');
  if (city.length > FIELD_LIMITS.city) return bad(`City is too long (maximum ${FIELD_LIMITS.city} characters).`);
  if (province.length > FIELD_LIMITS.province) return bad(`Province is too long (maximum ${FIELD_LIMITS.province} characters).`);
  if (!PAYMENT_VALUES.includes(paymentMethod)) return bad('Please choose a valid payment method.');

  if (!Array.isArray(body.items) || body.items.length === 0) return bad('Your cart is empty.');
  if (body.items.length > MAX_ITEMS) return bad(`Too many items — please keep your order to ${MAX_ITEMS} items or fewer.`);

  const lines: CheckoutLine[] = [];
  for (const raw of body.items) {
    const productId = Math.trunc(Number(raw?.productId));
    const variantId = Math.trunc(Number(raw?.variantId));
    const qty = Math.trunc(Number(raw?.qty));
    if (!Number.isFinite(productId) || productId <= 0) continue;
    if (!Number.isFinite(qty) || qty <= 0) return bad('Please enter a valid quantity for every item in your cart.');
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
      let variant = cheapest;
      if (line.variantId > 0) {
        const requested = product.variants.find((v) => v.id === line.variantId);
        if (!requested) {
          return bad(`"${product.title}" is no longer available in the selected option — please remove it from your cart and add it again.`);
        }
        variant = requested;
      }
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

    // --- duplicate-submission guard (double-click / retried checkout) ---
    // Same customer phone + same items fingerprint within 60s → return the
    // existing order instead of creating a second one.
    const recentOrders = await prisma.order.findMany({
      where: {
        phone: { in: phoneStorageVariants(phone) },
        createdAt: { gt: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      include: { items: true },
      orderBy: { id: 'desc' },
      take: 10,
    });
    const fingerprint = itemsFingerprint(orderItems);
    const duplicate = recentOrders.find((o) => o.subtotal === subtotal && itemsFingerprint(o.items) === fingerprint);
    if (duplicate) {
      return NextResponse.json({ ok: true, orderNumber: duplicate.orderNumber, orderId: duplicate.id, duplicate: true });
    }

    // --- shipping from SiteSetting (admin-controlled) ---
    const shippingFee = shippingFeeFor(subtotal, shippingRuleFromSettings(await getSettingsMap()));
    const discount = 0;
    const total = subtotal - discount + shippingFee;
    if (total > MAX_TOTAL) return bad('Order total exceeds maximum. Please contact us directly for bulk orders.');

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
        discount,
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
