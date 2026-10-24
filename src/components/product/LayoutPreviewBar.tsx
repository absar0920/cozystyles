import { ToastOnMount } from '@/components/toast/ToastOnMount';

/**
 * Admin-only bar shown on a product page opened with `?layoutPreview=<token>` (docs/product-layouts/SPEC.md §6.2).
 * Rendered only after the page checked for an admin session.
 *
 * It is the LAST element of the page's content and `sticky bottom-0`: it stays in view along the
 * bottom edge while scrolling, then settles in its own space above the footer. It never sits over
 * the sticky site header (which is at the top), and the right padding keeps the text clear of the
 * floating WhatsApp / back-to-top buttons (60px + 15px from the right edge).
 */
export function LayoutPreviewBar({ expired, layoutId }: { expired: boolean; layoutId: number | null }) {
  return (
    <div
      role="status"
      data-testid="layout-preview-bar"
      className="sticky bottom-0 z-[60] flex flex-wrap items-center justify-start gap-x-4 gap-y-1 bg-yellow-300 py-2 pl-4 pr-[85px] text-left text-[14px] font-medium text-black shadow-[0_-2px_6px_rgba(0,0,0,0.15)] md:justify-center md:px-[85px] md:text-center"
    >
      {expired ? (
        <span>
          This preview has expired. Go back and press Preview again.
          <ToastOnMount tone="warning" message="Preview expired" />
        </span>
      ) : (
        // on a phone the second sentence would push the bar to three lines next to the WhatsApp button
        <span>
          Preview — not saved yet.<span className="hidden sm:inline"> Only you can see this.</span>
        </span>
      )}
      <a href={layoutId != null ? `/admin/product-layouts/${layoutId}` : '/admin/product-layouts'} className="underline underline-offset-2">
        Back to editing
      </a>
    </div>
  );
}
