import type { ReactNode } from 'react';

/** Live `.collection-empty`: line-art illustration + one 20px sentence, centred, 10vh padding on all sides (narrows the text on mobile).
 * Paragraphs keep the theme's default `margin: 0 0 20px`. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="p-[10vh] text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/catalog/search-empty.svg" alt="" width={171} height={137} className="mx-auto mb-[30px] block" />
      <div className="mx-auto max-w-[1100px] break-words pt-[10px] text-[20px] leading-[34px] text-accent [&_p]:mb-5 [&_p]:mt-0">{children}</div>
    </div>
  );
}
