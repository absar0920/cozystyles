'use client';

import { useEffect, useState } from 'react';

/**
 * Live /pages/payment: clicking "Online Bank Transfer (view details)" (`#openPopup` inside the
 * rich text) opens a centred white box with the bank details and a red "X" close button
 * (page inline style: 50% wide, 100% under 800px, 100vw shadow as the backdrop).
 */
export function PaymentPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const trigger = document.getElementById('openPopup');
    if (!trigger) return;
    const show = () => setOpen(true);
    trigger.addEventListener('click', show);
    return () => trigger.removeEventListener('click', show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bank transfer details"
      className="fixed left-1/2 top-1/2 z-[1000] w-full -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-black/50 bg-white p-5 text-center shadow-[0_0_0_100vw_rgba(0,0,0,0.3)] min-[801px]:w-1/2"
    >
      {/* theme `p { margin-bottom: 20px }` gives live's spacer under the IBAN line */}
      <p className="mb-5 leading-[1.7]">
        <b className="font-medium">Kindly make all transfers to:</b> <br />
        Bank: Allied Bank - ABL
        <br />
        Branch: CORP Main Boulevard
        <br />
        Account Title: Cozy Furnitures Pvt Ltd
        <br />
        Account Number: 001-00000234100-30
        <br />
        IBAN: PK94 ABPA 0010 0000 2341 0030
        <br />
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="absolute right-0 top-0 cursor-pointer border-0 bg-[red] px-[10px] py-[5px] text-white"
        aria-label="Close"
      >
        X
      </button>
    </div>
  );
}
