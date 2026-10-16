'use client';

/**
 * Shopify customer-account primitives for /account/login (system font, #dedede borders, radius 12, floating labels,
 * #005bd1 focus). Moved verbatim from the removed checkout components.
 */

/** System font stack Shopify checkout / customer accounts render with. */
export const SYSTEM_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

/**
 * Hides the storefront chrome (announcement, header, footer, drawer, floating buttons) while a
 * chrome-less page is mounted — Shopify checkout and customer accounts render outside the theme.
 * Plain <style> (no `precedence`) so React removes it again on client navigation away.
 */
export function HideStoreChrome() {
  return (
    <style>{`.theme-store:has([data-bare-page]) > :not(main){display:none !important}`}</style>
  );
}

export const blueLink = 'text-[#005bd1] underline underline-offset-2 hover:text-[#004cb0]';

const fieldBox =
  'relative rounded-xl border bg-white transition-[border-color,box-shadow] duration-200 focus-within:border-[#005bd1] focus-within:shadow-[0_0_0_1px_#005bd1]';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-[1.4] text-[#e32c2b]">
      <svg viewBox="0 0 14 14" className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden>
        <circle cx="7" cy="7" r="6.3" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7 3.8v3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="7" cy="10" r=".85" fill="currentColor" />
      </svg>
      {message}
    </p>
  );
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  id: string;
  label: string;
  value: string;
  onValueChange: (next: string) => void;
  error?: string;
  /** Right-hand adornment inside the field (e.g. "?" tooltip icon, Apply button). */
  trailing?: React.ReactNode;
};

/** Floating-label text input: label sits inside as a placeholder, moves to the top once filled. */
export function FloatingInput({ id, label, value, onValueChange, error, trailing, className = '', ...rest }: InputProps) {
  const filled = value !== '';
  return (
    <div className={className}>
      <div className={`${fieldBox} ${error ? 'border-[#e32c2b]' : 'border-[#dedede]'}`}>
        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-[10px] right-[10px] truncate text-[#707070] transition-all duration-150 ${
            filled ? 'top-[7px] text-[12px] leading-[1.35]' : 'top-[14px] text-[14px] leading-[1.35]'
          }`}
        >
          {label}
        </label>
        <input
          id={id}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`block h-[47px] w-full rounded-xl bg-transparent px-[10px] text-[14px] text-black outline-none ${
            filled ? 'pb-[6px] pt-[21px]' : 'py-[13.55px]'
          } ${trailing ? 'pr-11' : ''}`}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-[7px]">{trailing}</div>}
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** 20px Shopify checkbox (radius 8): white with inset #dedede, checked = #005bd1 with white tick. */
export function Checkbox({
  id,
  checked,
  onChange,
  children,
  className = '',
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={id} className={`flex cursor-pointer items-center text-[14px] leading-[1.35] text-black ${className}`}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={`-my-[0.55px] flex h-5 w-5 shrink-0 items-center justify-center rounded-lg transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#005bd1]/40 ${
          checked ? 'bg-[#005bd1] text-white' : 'bg-white shadow-[inset_0_0_0_1px_#dedede]'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 14 14" className="h-[10px] w-[10px]" fill="none">
            <path d="m2.5 7.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="pl-2">{children}</span>
    </label>
  );
}
