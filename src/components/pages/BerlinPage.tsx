'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * Live /pages/berlin ("Berlin Executive Series"): every section sits on #e1dfd6. Hero film, centred
 * intro, the product viewer (live: GLB 3D models; here the same box shows the product render), a
 * three-up video slider with rotating taglines, the "evolution" film and a fixed black "Shop Now".
 * Assets: scripts/fidelity/berlin.ts.
 */
const MODELS = [
  { title: 'Berlin Desk', image: '/images/berlin/1.png' },
  { title: 'Berlin Side Rack', image: '/images/berlin/2.webp' },
  { title: 'Berlin Credenza', image: '/images/berlin/3.webp' },
  { title: 'Berlin Side Table', image: '/images/berlin/4.webp' },
  { title: 'Berlin Center Table', image: '/images/berlin/5.webp' },
  { title: 'Berlin 1 Seat Sofa', image: '/images/berlin/6.webp' },
  { title: 'Berlin 3 Seater Sofa', image: '/images/berlin/7.webp' },
];

const SLIDES = [
  { src: '/videos/berlin/slide-1.mp4', tagline: 'Built-in Wireless Charging' },
  { src: '/videos/berlin/slide-2.mp4', tagline: 'Timeless Design' },
  { src: '/videos/berlin/slide-3.mp4', tagline: 'Concealed Cable Management System' },
];

/** `.rich-text h3` with the section override `font-weight: 100; color: #000` (renders at 400). */
function Heading({ children, spaced = false }: { children: React.ReactNode; spaced?: boolean }) {
  return (
    <div className={`px-[12.5px] text-center md:px-10 ${spaced ? 'pt-[50px] md:pt-[100px]' : ''}`}>
      <h3 className="mb-5 !text-[34px] !font-thin !leading-[42px] !text-black md:!text-[36px] md:!leading-[44px] lg:!text-[40px] lg:!leading-[48px]">
        {children}
      </h3>
    </div>
  );
}

function BackgroundVideo({ src, className }: { src: string; className: string }) {
  return (
    <div className={`mb-[25px] md:mb-10 ${className}`}>
      <video src={src} autoPlay loop muted playsInline preload="metadata" className="block h-full w-full object-cover" />
    </div>
  );
}

function ModelViewer() {
  const [active, setActive] = useState(0);
  return (
    <div className="flex flex-col gap-4 rounded-[12px] p-4 md:gap-5 md:p-5">
      <div className="relative flex h-[455px] items-center justify-center overflow-hidden rounded-[2px] md:h-[650px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MODELS[active].image} alt={MODELS[active].title} className="max-h-full max-w-full object-contain" />
      </div>
      <div className="no-scrollbar overflow-x-auto overflow-y-hidden">
        <div className="flex min-w-max justify-center gap-3 py-[10px]">
          {MODELS.map((m, i) => (
            <button
              key={m.title}
              type="button"
              aria-label={`View ${m.title}`}
              aria-pressed={i === active}
              onClick={() => setActive(i)}
              className={`flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border-2 transition-all duration-300 hover:scale-105 hover:border-[#939393] md:h-[120px] md:w-[120px] ${
                i === active ? 'border-[#939393] shadow-[0_0_0_1px_#939393]' : 'border-transparent'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.image} alt="" loading="lazy" className="h-full w-full border border-accent object-contain" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Center slide plays; when it ends the slider moves on. Side slides are tinted olive (#7f6e27 @ .7). */
function VideoSlider() {
  const [index, setIndex] = useState(0);
  const centerRef = useRef<HTMLVideoElement>(null);
  const n = SLIDES.length;
  useEffect(() => {
    const v = centerRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => undefined);
  }, [index]);
  const at = (o: number) => SLIDES[(index + o + n) % n];
  const side = (o: number) => (
    <div
      className={`relative z-[1] flex w-[70%] shrink-0 overflow-hidden rounded-[30px] md:w-1/2 ${o < 0 ? 'justify-end' : 'justify-start'}`}
      aria-hidden
    >
      <video
        key={at(o).src}
        src={at(o).src}
        muted
        playsInline
        preload="metadata"
        className="block aspect-[2/1] w-[95%] rounded-[30px] object-contain md:w-[80%]"
      />
      <span className="pointer-events-none absolute inset-0 z-[2] bg-[#7f6e27] opacity-70" />
    </div>
  );
  return (
    <div className="relative overflow-hidden">
      <div className="flex items-center justify-center">
        {side(-1)}
        <div className="relative z-[3] flex w-[85%] shrink-0 justify-center overflow-visible rounded-[20px] pb-10 md:w-[60%] md:rounded-[30px]">
          <video
            ref={centerRef}
            key={at(0).src}
            src={at(0).src}
            autoPlay
            muted
            playsInline
            preload="metadata"
            onEnded={() => setIndex((i) => (i + 1) % n)}
            className="block aspect-[2/1] w-[95%] rounded-[30px] object-contain md:w-[80%]"
          />
          <p className="absolute -bottom-[5px] z-10 mb-5 text-[20.4px] leading-[1.7] text-black">{at(0).tagline}</p>
        </div>
        {side(1)}
      </div>
    </div>
  );
}

export function BerlinPage() {
  return (
    <div className="bg-[#e1dfd6]">
      <BackgroundVideo src="/videos/berlin/hero.mp4" className="h-[350px] md:h-[650px]" />
      <div className="mx-auto max-w-[1360px] px-[12.5px] pb-[35px] text-center md:px-10">
        <p className="text-[17px] leading-[1.7] text-accent">
          A seamless blend of timeless form and modern function. Designed to elevate workspaces with rich textures, clean
          lines, and purposeful details—perfect for modern office spaces.
        </p>
      </div>
      <Heading>DISCOVER &amp; EXPLORE THE BERLIN RANGE</Heading>
      <ModelViewer />
      <Heading spaced>DESIGNED FOR MODERN OFFICES</Heading>
      <VideoSlider />
      <Heading spaced>EXPERIENCE THE EVOLUTION</Heading>
      <BackgroundVideo src="/videos/berlin/evolution.mp4" className="h-[500px] md:h-[750px]" />
      <div className="h-10" />
      <Link
        href="/collections/berlin"
        className="fixed bottom-[15vh] left-5 z-[9] bg-black px-[1em] py-[.5em] text-[15px] font-medium leading-[26.25px] text-white hover:text-white"
      >
        Shop Now
      </Link>
    </div>
  );
}
