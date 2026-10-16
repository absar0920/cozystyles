import type { BrokenLink } from '@/lib/link-targets';
import { Notice } from './ui';

/** Lists links in the saved text that lead nowhere, so the owner can fix them with the editor's Link button. */
export function BrokenLinksNotice({ links }: { links: BrokenLink[] }) {
  if (!links.length) return null;
  const total = links.reduce((n, l) => n + l.count, 0);
  return (
    <div data-testid="broken-links">
      <Notice tone="warning" title={total === 1 ? '1 link in this text no longer works' : `${total} links in this text no longer work`}>
        <p>Click the link text in the editor, press the Link button and pick another page (or remove the link).</p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
          {links.slice(0, 20).map((l, i) => (
            <li key={i}>
              <span className="font-semibold">“{l.text.length > 60 ? `${l.text.slice(0, 59)}…` : l.text}”</span>
              <span className="text-xs">
                {' '}
                — {l.label}
                {l.count > 1 ? ` (${l.count} times)` : ''}
              </span>
            </li>
          ))}
        </ul>
        {links.length > 20 && <p className="mt-1 text-xs">…and {links.length - 20} more.</p>}
      </Notice>
    </div>
  );
}
