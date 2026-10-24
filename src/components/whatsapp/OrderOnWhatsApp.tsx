'use client';

import { useEffect, useState } from 'react';
import { asksAvailability, VARIANT_STATUS_COPY, isVariantStatus } from '@/lib/variant-status';
import { buildProductMessage, waLink, type WhatsAppConfig } from '@/lib/whatsapp';
import { WhatsAppGlyph } from './WhatsAppGlyph';
import { currentPath, logWhatsAppClick } from './log-click';
import { toast } from '@/components/toast/toast';

/**
 * "ORDER ON WHATSAPP" / "ASK ABOUT AVAILABILITY" buy button (SPEC §5.7.2). The message is rebuilt on every
 * render from the selected variant, options and quantity; every click is logged as a WhatsApp inquiry.
 */
export type OrderOnWhatsAppProps = {
  /** null → render nothing */
  config: WhatsAppConfig | null;
  product: { id: number; title: string; handle: string };
  /** null → render nothing */
  variant: { id: number; price: number; compareAtPrice: number | null; status: string } | null;
  options: { name: string; value: string }[];
  quantity: number;
  className?: string;
};

export function OrderOnWhatsAppButton({ config, product, variant, options, quantity, className = '' }: OrderOnWhatsAppProps) {
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  if (!config || !variant) return null;

  const kind = asksAvailability(variant.status) ? 'AVAILABILITY' : 'ORDER';
  const base = origin ?? (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  const text = buildProductMessage(
    {
      kind,
      title: product.title,
      options,
      quantity,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      url: `${base}/products/${product.handle}?variant=${variant.id}`,
      ...(kind === 'AVAILABILITY' && isVariantStatus(variant.status) ? { statusLabel: VARIANT_STATUS_COPY[variant.status].label } : {}),
    },
    config,
  );

  return (
    <a
      href={waLink(config.number, text)}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="order-on-whatsapp"
      data-ready={origin ? 'true' : undefined}
      onClick={() => {
        toast.info(kind === 'ORDER' ? 'Opening WhatsApp with your order…' : 'Opening WhatsApp to ask about this item…');
        logWhatsAppClick({
          kind,
          productId: product.id,
          variantId: variant.id,
          quantity: Math.min(99, Math.max(1, Math.round(quantity) || 1)),
          path: currentPath(),
        });
      }}
      className={`btn h-[52px] min-w-0 flex-1 gap-[10px] max-[480px]:gap-2 max-[480px]:px-3 max-[480px]:tracking-[0.06em] ${className}`}
    >
      <WhatsAppGlyph className="h-[18px] w-[18px] shrink-0" />
      <span className="min-w-0 truncate leading-[1.25] max-[400px]:whitespace-normal max-[400px]:text-center">{kind === 'ORDER' ? 'Order on WhatsApp' : 'Ask about availability'}</span>
    </a>
  );
}
