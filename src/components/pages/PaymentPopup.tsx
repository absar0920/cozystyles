'use client';

import { useEffect, useState } from 'react';

/**
 * Live /pages/payment: clicking "Online Bank Transfer (view details)" opens a centred white box with the bank
 * details and a red "X" close button (page inline style: 50% wide, 100% under 800px, 100vw shadow as the backdrop).
 *
 * The page text is owner-edited rich text, which carries no ids, so the trigger is found by its words: the list
 * item starting "Online Bank Transfer" (its underlined "(view details)" is the visible cue). A link to
 * `#bank-details` and the legacy `#openPopup` element also open it.
 */
const TRIGGER_TEXT = /^\s*online bank transfer/i;

function findTriggers(): HTMLElement[] {
  const out: HTMLElement[] = [];
  const legacy = document.getElementById('openPopup');
  if (legacy) out.push(legacy);
  document.querySelectorAll<HTMLElement>('.page-content-width li, .rte li').forEach((li) => {
    // the item's own text, without nested lists
    const own = Array.from(li.childNodes)
      .filter((n) => !(n instanceof HTMLElement && (n.tagName === 'UL' || n.tagName === 'OL')))
      .map((n) => n.textContent ?? '')
      .join('');
    if (TRIGGER_TEXT.test(own)) out.push(li);
  });
  return out;
}

export function PaymentPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const triggers = findTriggers();
    const cues: HTMLElement[] = [];
    triggers.forEach((t) => {
      // make the "(view details)" cue (or the whole line) look and act like a button
      const cue = t.querySelector<HTMLElement>('u') ?? t;
      cue.style.cursor = 'pointer';
      cue.setAttribute('role', 'button');
      cue.setAttribute('tabindex', '0');
      cues.push(cue);
    });
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el) return;
      const link = el.closest('a[href="#bank-details"]');
      if (link || triggers.some((t) => t.contains(el) && !el.closest('a[href]:not([href="#bank-details"])'))) {
        if (link) e.preventDefault();
        setOpen(true);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && cues.includes(e.target as HTMLElement)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
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
