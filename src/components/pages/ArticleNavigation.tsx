'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type NavLink = { href: string; title: string };

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  const [line, head] =
    dir === 'left' ? ['M14.2 5.5H2.2', 'M5.5 1L1 5.5L5.5 10'] : ['M0.8 5.5H12.8', 'M9.5 1L14 5.5L9.5 10'];
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden>
      <path d={line} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={head} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Live `article-navigation`: hidden until the title scrolls out, then pinned under the sticky
 * header (z-below it) with prev/next links, "Now Reading:" + title and an accent2 reading-progress bar.
 * `targetId` is the article element whose title toggles the bar; progress spans the whole page (as on live).
 */
export function ArticleNavigation({
  title,
  prev,
  next,
  targetId,
}: {
  title: string;
  prev: NavLink | null;
  next: NavLink | null;
  targetId: string;
}) {
  const [visible, setVisible] = useState(false);
  const [top, setTop] = useState(0);
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const article = document.getElementById(targetId);
      const header = document.querySelector('header.header');
      if (!article) return;
      const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
      // live: `top: var(--header-height) - 1px` — the header's own height, ignoring the sticky
      // announcement bar above it on mobile, so there the bar tucks under the header and only its foot shows
      setTop(header instanceof HTMLElement ? Math.max(0, header.offsetHeight - 1) : 0);
      const rect = article.getBoundingClientRect();
      const titleEl = article.querySelector('h1');
      const titleBottom = titleEl ? titleEl.getBoundingClientRect().bottom : rect.top;
      setVisible(titleBottom < headerBottom);
      // live article.js: scrollY over the whole page's scrollable height
      const total = document.body.scrollHeight - window.innerHeight;
      const progress = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 1;
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [targetId]);

  const linkClass =
    'article-nav-link flex items-center whitespace-nowrap text-[11px] font-semibold uppercase leading-none tracking-btn';

  return (
    <div
      aria-hidden={!visible}
      style={{ top }}
      className={`fixed inset-x-0 z-40 grid h-[58px] grid-cols-[1fr_auto_1fr] items-center gap-10 bg-white px-[12.5px] shadow-[0_10px_15px_#0000001a] transition-all duration-[250ms] ease-theme md:h-16 md:px-10 ${
        visible ? 'visible opacity-100' : 'pointer-events-none invisible opacity-0'
      }`}
    >
      {prev ? (
        <Link href={prev.href} className={`${linkClass} prev mr-auto`} title={prev.title} tabIndex={visible ? 0 : -1}>
          <Arrow dir="left" />
          <span className="ml-5 hidden md:inline">Previous article</span>
        </Link>
      ) : (
        <div />
      )}
      <div className="w-full overflow-hidden">
        <div className="flex items-center overflow-hidden text-ellipsis whitespace-nowrap">
          <span className="mr-[5px] hidden text-[15px] md:inline">Now Reading:</span>
          <h6 className="m-0 overflow-hidden text-ellipsis !text-[17px] !leading-[inherit]">{title}</h6>
        </div>
      </div>
      {next ? (
        <Link href={next.href} className={`${linkClass} next ml-auto text-right`} title={next.title} tabIndex={visible ? 0 : -1}>
          <span className="mr-5 hidden md:inline">Next article</span>
          <Arrow dir="right" />
        </Link>
      ) : (
        <div />
      )}
      <span
        ref={barRef}
        className="absolute bottom-0 left-0 block h-1 w-full origin-left scale-x-0 bg-accent2"
        aria-hidden
      />
    </div>
  );
}
