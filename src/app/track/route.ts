import { prisma } from '@/lib/db';
import { allowInquiryLog } from '@/lib/inquiry-limit';
import { TRACK_ORDER_TEXT, waLink } from '@/lib/whatsapp';
import { getWhatsAppConfig } from '@/lib/whatsapp-server';

/**
 * /track: order tracking happens on WhatsApp (SPEC §5.7.5). Logs a TRACK inquiry (not for prefetches or bots)
 * and redirects to the store's chat with a "check my order" message, or home when WhatsApp is off.
 */
export const dynamic = 'force-dynamic';

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|curl|wget|headless/i;

function isPrefetchOrBot(h: Headers): boolean {
  if (h.has('next-router-prefetch') || h.has('rsc')) return true;
  const purpose = `${h.get('purpose') ?? ''} ${h.get('sec-purpose') ?? ''}`.toLowerCase();
  if (purpose.includes('prefetch')) return true;
  return BOT_UA.test(h.get('user-agent') ?? '');
}

export async function GET(req: Request) {
  const config = await getWhatsAppConfig();

  // same limits as /api/whatsapp-click
  const allowed = !isPrefetchOrBot(req.headers) && (await allowInquiryLog(req.headers));
  if (allowed) {
    try {
      await prisma.whatsAppInquiry.create({ data: { kind: 'TRACK', pagePath: '/track' } });
    } catch {
      // logging must never block the redirect
    }
  }

  const location = config ? waLink(config.number, TRACK_ORDER_TEXT) : '/';
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
}
