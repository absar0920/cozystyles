'use client';

/** Fire-and-forget WhatsApp click logging (SPEC §5.7.3). Never throws and never delays the navigation. */
export type WhatsAppClick = {
  kind: 'ORDER' | 'AVAILABILITY' | 'GENERAL' | 'TRACK';
  productId?: number;
  variantId?: number;
  quantity?: number;
  path: string;
};

const ENDPOINT = '/api/whatsapp-click';
// text/plain is a CORS-safelisted type: no browser rejects or preflights the beacon.
const CONTENT_TYPE = 'text/plain;charset=UTF-8';

export function logWhatsAppClick(c: WhatsAppClick): void {
  try {
    const body = JSON.stringify(c);
    let sent = false;
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: CONTENT_TYPE }));
      } catch {
        sent = false;
      }
    }
    if (!sent) {
      void fetch(ENDPOINT, { method: 'POST', keepalive: true, body, headers: { 'Content-Type': CONTENT_TYPE } }).catch(
        () => undefined,
      );
    }
  } catch {
    // logging must never break the WhatsApp link
  }
}

/** The current page's path + query, for the `path` field. */
export function currentPath(): string {
  if (typeof window === 'undefined') return '/';
  return (window.location.pathname + window.location.search).slice(0, 300);
}
