'use client';

import { useEffect, useState } from 'react';
import { ThemeArrowUp } from '@/components/icons';
import { GENERAL_QUESTION_TEXT, waLink, type WhatsAppConfig } from '@/lib/whatsapp';
import { currentPath, logWhatsAppClick } from '@/components/whatsapp/log-click';

/** Live `#whatsapp-chat`: 60×60 WhatsApp image, fixed bottom 10 / right 15. Sends a general question; hidden when WhatsApp is off. */
export function WhatsappButton({ config }: { config: WhatsAppConfig | null }) {
  if (!config) return null;
  return (
    <div className="fixed bottom-2.5 right-[15px] z-[9999] [[data-mobile-menu=open]_&]:hidden">
      <a
        href={waLink(config.number, GENERAL_QUESTION_TEXT)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        data-testid="whatsapp-bubble"
        onClick={() => logWhatsAppClick({ kind: 'GENERAL', path: currentPath() })}
        className="block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/theme/whatsapp.svg" width={60} height={60} alt="Chat with us on WhatsApp" />
      </a>
    </div>
  );
}

/** Live `back-to-top`: 36px white circle, slides in after scrolling; bottom 10 / right 15, mostly under the WhatsApp button. */
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight / 2);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`group fixed bottom-2.5 right-[15px] z-[9998] flex [[data-mobile-menu=open]_&]:hidden h-9 w-9 items-center justify-center rounded-full bg-white text-accent shadow-totop transition-[transform,opacity] duration-[250ms] ease-theme ${
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[70px] opacity-0'
      }`}
    >
      <ThemeArrowUp className="translate-y-1" />
    </button>
  );
}
