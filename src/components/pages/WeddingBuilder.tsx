'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const IMG = '/images/pages/wedding';

const STEPS = [
  ['Base', 'Package'],
  ['First', 'Add-on'],
  ['Second', 'Add-on'],
  ['Third', 'Add-on'],
  ['Fourth', 'Add-on'],
];

/** Base tiles: the artwork carries the copy (number, title, subtitle, "Unlock 12%"), as on live. */
const BASES = [
  { label: 'Bedroom', detail: 'Bed + 2 Bedside Tables', image: `${IMG}/bedroom.jpg`, href: '/collections/bed-set' },
  { label: 'Living Room', detail: 'Sofas', image: `${IMG}/living.jpg`, href: '/collections/sofas-all' },
  { label: 'Dining Room', detail: 'Dining Table + 4 Chairs', image: `${IMG}/dining.jpg`, href: '/collections/dining-table-sets' },
];

const TERMS = [
  'Offer is valid on selected eligible products only.',
  'Customers must select one base package to start the offer. Only one base package can be selected per order.',
  'Discount starts from 12% on one eligible base package.',
  'Customers can unlock an additional 2% discount with each qualifying add-on.',
  'Maximum discount under this campaign is 20%.',
  'The earned discount will apply only to eligible campaign products.',
  'This offer cannot be combined with any other discount, promotion, voucher, bank offer, or special approval.',
  'Free nationwide delivery is applicable for online customers.',
  'Free delivery in Karachi, Lahore and Islamabad is applicable for in-store customers.',
  'Easy installment plan is available for online customers.',
  'Delivery and installation will be handled as per Cozy Furnitures’ standard policy.',
  'Decorative items, props, bedding, cushions, flowers, rugs, and styling accessories shown in visuals are not included unless specifically mentioned.',
  'Cozy Furnitures reserves the right to amend, extend, or withdraw the campaign at any time.',
  'In case of any dispute, Cozy Furnitures’ decision shall be final.',
];

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-[15px] w-[15px] text-[#8a8a8a] md:h-5 md:w-5" fill="currentColor">
      <path d="M17 9h-1V7a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V7Z" />
    </svg>
  );
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-5"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative max-h-[90vh] w-full max-w-[1000px] overflow-auto bg-white px-7 pb-7 pt-11 text-accent">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-[14px] top-3 h-9 w-9 cursor-pointer border-0 bg-transparent text-[28px] leading-none text-accent"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

/**
 * Live /pages/wedding-package-builder: hero banner, 5-step discount scale, "Current Savings" box,
 * three base-package tiles and the cream "How to create…" / "Terms & Conditions" bar.
 * Base tiles lead to the matching collection to start the package.
 */
export function WeddingBuilder() {
  const [modal, setModal] = useState<'how' | 'terms' | null>(null);
  const close = () => setModal(null);

  return (
    <div className="sf-wedding">
      <picture>
        <source media="(max-width: 767px)" srcSet={`${IMG}/banner-mobile.jpg`} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${IMG}/banner-desktop.jpg`}
          alt="Create your own wedding package — bed sets, sofa sets, dining sets. Available on monthly installments."
          width={1920}
          height={739}
          className="block h-auto w-full"
        />
      </picture>

      <div className="px-[15px] pb-[70px] pt-[30px] md:px-[45px] md:pb-[90px] md:pt-0">
        <div className="mx-auto mb-6 mt-7 flex max-w-[1000px] items-center justify-center md:mb-8 md:mt-[90px]">
          <ol aria-label="Wedding package discount steps" className="m-0 mx-auto flex w-full max-w-[820px] list-none items-start p-0">
            {STEPS.map(([a, b], i) => {
              const next = i === 0;
              return (
                <li
                  key={a}
                  className={`relative flex flex-1 flex-col items-center text-center ${
                    i > 0
                      ? 'before:absolute before:right-1/2 before:top-[22px] before:z-0 before:h-2 before:w-full before:-translate-y-1/2 before:bg-[#b3b3b3] md:before:top-[26px] md:before:h-3'
                      : ''
                  }`}
                >
                  <span
                    aria-label={`${a} ${b}`}
                    className={`relative z-[1] flex h-11 w-11 items-center justify-center rounded-full md:h-[52px] md:w-[52px] ${
                      next ? 'bg-[#9a9a9a] shadow-[0_0_0_4px_#fff,0_0_0_6px_#9a9a9a]' : 'bg-[#d9d9d9]'
                    }`}
                  >
                    {!next && <LockIcon />}
                  </span>
                  <span
                    className={`mt-2 text-[12px] font-semibold leading-[1.3] before:mx-auto before:mb-[5px] before:block before:h-2 before:w-[2px] md:mt-3 md:text-[15px] md:before:mb-2 md:before:h-3 ${
                      next ? 'text-[#111] before:bg-[#111]' : 'text-[#8a8a8a] before:bg-[#8a8a8a]'
                    }`}
                  >
                    {a}
                    <br />
                    {b}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mx-auto mb-8 max-w-[420px] border-2 border-[#b3b3b3] bg-white px-[18px] pb-[22px] pt-5 text-center md:mb-[58px] md:px-7 md:pb-[30px] md:pt-[26px]">
          <span className="block text-[15px] font-medium text-[#111] md:text-[17px]">Current Savings</span>
          <strong className="mb-3 mt-[6px] block text-[40px] font-extrabold leading-none text-[#6d1f1f] md:mb-4 md:text-[52px]">
            0%
          </strong>
          <small className="block text-[15px] leading-[1.5] text-[#111] md:text-[17px]">Select your base package for 12% off.</small>
        </div>

        <div className="mx-auto grid max-w-[1350px] grid-cols-1 gap-5 md:grid-cols-3">
          {BASES.map((base) => (
            <Link
              key={base.label}
              href={base.href}
              className="block overflow-hidden rounded-lg border border-[#ddd] bg-white transition duration-200 hover:-translate-y-[3px] hover:border-[#111] hover:shadow-[0_12px_28px_rgba(0,0,0,.07)]"
            >
              <span className="block aspect-[4/3] overflow-hidden rounded-lg bg-[#f4f4f4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={base.image} alt={base.label} loading="lazy" width={1200} height={900} className="block h-full w-full object-cover" />
              </span>
              <span className="sr-only">
                {base.label} — {base.detail}. Unlock 12%
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="w-full bg-cream">
        <div className="mx-auto grid max-w-[1390px] grid-cols-1 text-accent md:grid-cols-3">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setModal('how')}
            className="flex min-h-[30px] cursor-pointer items-center justify-center bg-cream px-8 py-[33px] text-center leading-[17px] md:min-h-[120px] min-[1000px]:justify-end min-[1000px]:text-right"
          >
            {/* live trigger markup: empty title span (10px margin) above the prompt */}
            <span className="block">
              <span className="mb-[10px] block" />
              <span className="block">How to create a wedding package</span>
            </span>
          </button>
          <span className="hidden md:block" />
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setModal('terms')}
            className="flex min-h-[30px] cursor-pointer items-center justify-center bg-cream px-8 py-[33px] text-center leading-[17px] md:min-h-[120px]"
          >
            <span className="block">
              <span className="mb-[10px] block" />
              <span className="block leading-[1.7]">Terms &amp; Conditions</span>
            </span>
          </button>
        </div>
      </div>

      <Modal open={modal === 'how'} onClose={close}>
        <p className="mb-5 leading-[1.7]">
          <strong className="font-medium">How to create a wedding package</strong>
        </p>
        <p className="leading-[1.7]">
          {TERMS.slice(1, 5).map((t) => (
            <span key={t}>
              •&nbsp;&nbsp;{t}
              <br />
            </span>
          ))}
        </p>
      </Modal>
      <Modal open={modal === 'terms'} onClose={close}>
        <p className="mb-5 leading-[1.7]">
          <strong className="font-medium">Terms &amp; Conditions</strong>
        </p>
        <p className="leading-[1.7]">
          {TERMS.map((t) => (
            <span key={t}>
              •&nbsp;&nbsp;{t}
              <br />
            </span>
          ))}
        </p>
      </Modal>
    </div>
  );
}
