import { prisma } from '@/lib/db';
import { allowInquiryLog } from '@/lib/inquiry-limit';

/**
 * Logs one tap on a WhatsApp button as a `WhatsAppInquiry` (SPEC §5.7.3). Sent with `navigator.sendBeacon`
 * as a text/plain JSON body. Always answers without a body; a rate-limited caller gets 204 and nothing is stored.
 *
 * Limits: per visitor cookie (and per client IP behind a trusted proxy), with forged cookieless posts sharing their own
 * small budget so they can't crowd out real customers' clicks — see `allowInquiryLog`. ORDER and AVAILABILITY clicks
 * must name a product that exists; otherwise nothing is stored.
 */
export const dynamic = 'force-dynamic';

const KINDS = ['ORDER', 'AVAILABILITY', 'GENERAL', 'TRACK'] as const;
type Kind = (typeof KINDS)[number];

const MAX_BODY_BYTES = 4 * 1024;

const NO_STORE = { 'Cache-Control': 'no-store' };

function status(code: number): Response {
  return new Response(null, { status: code, headers: NO_STORE });
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

type Click = { kind: Kind; productId?: number; variantId?: number; quantity: number; path: string };

/** Validated click, or null when the body is malformed. */
function parseClick(raw: unknown): Click | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.kind !== 'string' || !(KINDS as readonly string[]).includes(b.kind)) return null;
  if (b.productId !== undefined && !isPositiveInt(b.productId)) return null;
  // product clicks must say which product they are about
  if ((b.kind === 'ORDER' || b.kind === 'AVAILABILITY') && b.productId === undefined) return null;
  if (b.variantId !== undefined && !isPositiveInt(b.variantId)) return null;
  let quantity = 1;
  if (b.quantity !== undefined) {
    if (typeof b.quantity !== 'number' || !Number.isInteger(b.quantity) || b.quantity < 1 || b.quantity > 99) return null;
    quantity = b.quantity;
  }
  if (typeof b.path !== 'string' || !b.path.startsWith('/') || b.path.length > 300) return null;
  return {
    kind: b.kind as Kind,
    productId: b.productId as number | undefined,
    variantId: b.variantId as number | undefined,
    quantity,
    path: b.path,
  };
}

export async function POST(req: Request) {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return status(413);
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return status(413);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return status(400);
  }
  const click = parseClick(raw);
  if (!click) return status(400);

  if (!(await allowInquiryLog(req.headers))) return status(204);

  let productId: number | null = null;
  let productTitle = '';
  let variantId: number | null = null;
  let variantSummary = '';
  let unitPrice: number | null = null;

  if (click.productId) {
    const product = await prisma.product.findUnique({
      where: { id: click.productId },
      select: {
        id: true,
        title: true,
        productOptions: { orderBy: { position: 'asc' }, select: { name: true } },
      },
    });
    if (product) {
      productId = product.id;
      productTitle = product.title;
      if (click.variantId) {
        const variant = await prisma.variant.findFirst({
          where: { id: click.variantId, productId: product.id },
          select: { id: true, price: true, option1: true, option2: true, option3: true },
        });
        if (variant) {
          variantId = variant.id;
          unitPrice = variant.price;
          const values = [variant.option1, variant.option2, variant.option3];
          variantSummary = product.productOptions
            .slice(0, 3)
            .map((o, i) => (values[i] ? `${o.name}: ${values[i]}` : ''))
            .filter(Boolean)
            .join(' · ');
        }
      }
    }
  }
  // an ORDER/AVAILABILITY click for a product that doesn't exist (any more) is not a real inquiry
  if (click.kind !== 'GENERAL' && click.kind !== 'TRACK' && productId === null) return status(204);

  await prisma.whatsAppInquiry.create({
    data: {
      kind: click.kind,
      productId,
      productTitle,
      variantId,
      variantSummary,
      quantity: click.quantity,
      unitPrice,
      pagePath: click.path,
    },
  });

  return status(204);
}
