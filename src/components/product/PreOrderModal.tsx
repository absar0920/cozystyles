'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/** A UAN "+92-42-111-269-926" → "042 111 269 926" (live writes its UAN this way); other numbers as typed. */
export function localPhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '').replace(/^92/, '0');
  const uan = digits.match(/^(0\d{2})(111)(\d{3})(\d{3})$/);
  return uan ? uan.slice(1).join(' ') : trimmed;
}

/** The popup's last line: how to get help, from what the shop has set up (nothing → no line). */
export function preOrderHelpLine(phone: string | null | undefined, hasWhatsApp: boolean): string | null {
  const call = phone?.trim() ? `call ${localPhone(phone)}` : '';
  if (hasWhatsApp && call) return `For any help, message us on WhatsApp or ${call}.`;
  if (hasWhatsApp) return 'For any help, message us on WhatsApp.';
  if (call) return `For any help, ${call}.`;
  return null;
}

/**
 * Live "What is Pre-Order?" popup: centred white box, thick translucent border, 70% black page backdrop.
 * `phone` is the Phone from Admin → Settings → Contact details; `hasWhatsApp` = a WhatsApp number is set.
 */
export function PreOrderModal({
  onClose,
  phone = null,
  hasWhatsApp = true,
}: {
  onClose: () => void;
  phone?: string | null;
  hasWhatsApp?: boolean;
}) {
  const help = preOrderHelpLine(phone, hasWhatsApp);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(0,0,0,0.7)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preorder-title"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-[85%] overflow-y-auto border-[3px] border-[rgba(0,0,0,0.6)] bg-white p-5 text-center text-[17px] leading-[1.75] text-accent min-[800px]:w-1/2"
      >
        {/* live: one <p> whose lines are joined with <br>, the title is <b><u> followed by a blank line */}
        <p className="mb-5 leading-[1.7]">
          <b id="preorder-title" className="font-medium underline">
            What is Pre-Order
          </b>{' '}
          <br />
          <br />
          ‘Pre-Order’ means that a product is not currently available in our stock, but you can pre-order it and we will
          deliver it to you as soon as it is available.
          <br />
          Please note that delivery dates for pre-order items are subject to change so your product may arrive a little
          earlier or later than estimated.
          <br />
          {help && (
            <>
              {help}
              <br />
            </>
          )}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-0 top-0 cursor-pointer px-[10px] py-[5px] text-[1.5em] leading-none text-black"
        >
          X
        </button>
      </div>
    </div>,
    document.body,
  );
}
