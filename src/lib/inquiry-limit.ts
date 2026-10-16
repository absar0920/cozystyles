import { clientIp, rateLimit } from '@/lib/ratelimit';
import { visitorIdFromHeaders } from '@/lib/visitor';

/**
 * Decides whether one WhatsApp click may be stored as a `WhatsAppInquiry` (used by /api/whatsapp-click and /track).
 *
 * Real browsers carry the signed visitor cookie the middleware sets on their first page view, so they are limited
 * per visitor and share only a very high store-wide safety cap. Requests without a valid cookie (scripts, forged
 * posts, browsers with cookies off) share one small anonymous budget, which a flood can use up without touching
 * real customers' clicks. Behind a trusted proxy the client IP is limited as well.
 */
const WINDOW_MS = 60_000;
const PER_IP = 30;
const PER_VISITOR = 20;
const ALL_VISITORS = 3_000; // only a safety net for the database: far above any real store's traffic
const ANONYMOUS = 60;

export async function allowInquiryLog(headers: Headers): Promise<boolean> {
  const ip = clientIp(headers);
  if (ip && !rateLimit(`wa:ip:${ip}`, PER_IP, WINDOW_MS).ok) return false;

  const visitor = await visitorIdFromHeaders(headers);
  if (visitor) {
    return rateLimit(`wa:v:${visitor}`, PER_VISITOR, WINDOW_MS).ok && rateLimit('wa:visitors', ALL_VISITORS, WINDOW_MS).ok;
  }
  return rateLimit('wa:anon', ANONYMOUS, WINDOW_MS).ok;
}
