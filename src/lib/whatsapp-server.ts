import 'server-only';
import { prisma } from '@/lib/db';
import { WHATSAPP_DEFAULTS, normalizeWhatsAppNumber, type WhatsAppConfig } from '@/lib/whatsapp';

/** The store's WhatsApp config from settings; null when the number is empty or invalid (buttons hidden). */
export async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ['whatsapp', 'whatsappGreeting', 'whatsappAvailabilityGreeting', 'whatsappClosing'] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const number = normalizeWhatsAppNumber(map.whatsapp ?? '');
  if (!number) return null;
  return {
    number,
    greeting: map.whatsappGreeting?.trim() ? map.whatsappGreeting : WHATSAPP_DEFAULTS.greeting,
    availabilityGreeting: map.whatsappAvailabilityGreeting?.trim()
      ? map.whatsappAvailabilityGreeting
      : WHATSAPP_DEFAULTS.availabilityGreeting,
    closing: map.whatsappClosing?.trim() ? map.whatsappClosing : WHATSAPP_DEFAULTS.closing,
  };
}
