/** WhatsApp ordering: number normalisation, links and the exact product message (client-safe). SPEC §5.7.1. */
import { formatRs } from '@/components/ui/Price';

export type WhatsAppConfig = { number: string; greeting: string; availabilityGreeting: string; closing: string };

export const WHATSAPP_DEFAULTS: Omit<WhatsAppConfig, 'number'> = {
  greeting: "Hello Cozy Furnitures! I'd like to order this product:",
  availabilityGreeting: "Hello Cozy Furnitures! I'd like to ask about the availability of this product:",
  closing: 'Please confirm availability and delivery to my city: ',
};

export const GENERAL_QUESTION_TEXT = 'Hello Cozy Furnitures! I have a question.';
export const TRACK_ORDER_TEXT = "Hello Cozy Furnitures! I'd like to check the status of my order.";

/**
 * Pakistani mobile → "923XXXXXXXXX", else null.
 * Digits only; "03" + 9 digits → "92" + rest; "3" + 9 digits → "92" + it.
 */
export function normalizeWhatsAppNumber(input: string): string | null {
  let d = (input ?? '').replace(/\D/g, '');
  if (d.startsWith('0092')) d = d.slice(2);
  if (/^03\d{9}$/.test(d)) d = `92${d.slice(1)}`;
  else if (/^3\d{9}$/.test(d)) d = `92${d}`;
  return /^923\d{9}$/.test(d) ? d : null;
}

/**
 * Normalise a number typed in Settings. Stricter than `normalizeWhatsAppNumber`: anything other than digits,
 * spaces, dashes, `+` and brackets (e.g. a stray letter) is reported as invalid instead of being dropped.
 */
export function parseWhatsAppNumberInput(input: string): string | null {
  const s = (input ?? '').trim();
  return /^[\d\s\-+()]+$/.test(s) ? normalizeWhatsAppNumber(s) : null;
}

export function waLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export type ProductMessageInput = {
  kind: 'ORDER' | 'AVAILABILITY';
  title: string;
  options: { name: string; value: string }[];
  quantity: number;
  /** unit price; 0 = price on request */
  price: number;
  compareAtPrice: number | null;
  /** absolute: `${origin}/products/${handle}?variant=${variantId}` */
  url: string;
  /** AVAILABILITY only: 'Pre-order' | 'Sold out' */
  statusLabel?: string;
};

export function buildProductMessage(input: ProductMessageInput, config: WhatsAppConfig): string {
  const lines: string[] = [];
  lines.push(input.kind === 'ORDER' ? config.greeting : config.availabilityGreeting);
  lines.push(`*${input.title}*`);
  for (const o of input.options) lines.push(`${o.name}: ${o.value}`);
  lines.push(`Quantity: ${input.quantity}`);
  if (input.price > 0) {
    let price = `Price: ${formatRs(input.price)}`;
    if (input.quantity > 1) price += ' each';
    if (input.compareAtPrice != null && input.compareAtPrice > input.price) price += ` (was ${formatRs(input.compareAtPrice)})`;
    lines.push(price);
  } else {
    lines.push('Price: on request');
  }
  if (input.kind === 'AVAILABILITY' && input.statusLabel) lines.push(`Status: ${input.statusLabel}`);
  lines.push(input.url);
  lines.push(config.closing);
  return lines.join('\n');
}
