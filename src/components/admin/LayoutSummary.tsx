import { shortKindName, type LayoutSummaryData } from '@/lib/product-layout-draft';

/**
 * The live contents of a product page layout as chips ("Big photo with text · Photo and text ×3 · …") plus warning
 * tags (SPEC product-layouts §9.2). Hidden sections are struck through. Server and client safe (no hooks).
 */
export function LayoutSummary({ summary, compact = false }: { summary: LayoutSummaryData; compact?: boolean }) {
  const chip = compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs';
  return (
    <div data-testid="layout-summary" className="flex min-w-0 flex-wrap items-center gap-1">
      {summary.chips.length === 0 && <span className="text-xs text-gray-500">No sections</span>}
      {summary.chips.map((c, i) => (
        <span
          key={i}
          className={`inline-flex max-w-full items-center rounded-full border ${chip} ${
            c.hidden ? 'border-dashed border-gray-300 bg-white text-gray-400 line-through' : 'border-gray-200 bg-gray-50 text-gray-700'
          }`}
        >
          <span className="truncate">
            {shortKindName(c.kind)}
            {c.count > 1 ? ` ×${c.count}` : ''}
          </span>
          {c.hidden && <span className="sr-only"> (hidden)</span>}
        </span>
      ))}
      {summary.deadButton && (
        <span className={`inline-flex items-center rounded-full bg-amber-100 font-semibold text-amber-800 ${chip}`}>⚠ Button goes nowhere</span>
      )}
      {summary.deletedCollection && (
        <span className={`inline-flex items-center rounded-full bg-red-100 font-semibold text-red-700 ${chip}`}>⚠ Collection was deleted</span>
      )}
    </div>
  );
}
