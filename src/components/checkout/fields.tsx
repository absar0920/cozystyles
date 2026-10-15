'use client';


/**
 * Shopify one-page-checkout form primitives (system font, #dedede borders, radius 12,
 * floating labels, #005bd1 focus). Shared by /checkout and /account/login.
 */

export const SHOPIFY_BLUE = '#005bd1';

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

export function QuestionIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" fill="none" className={className} aria-hidden>
      <circle cx="7" cy="7" r="6.3" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M5.3 5.4a1.75 1.75 0 1 1 2.5 1.6c-.5.25-.8.6-.8 1.1v.3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="7" cy="10.2" r=".75" fill="currentColor" />
    </svg>
  );
}

export function ChevronGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" fill="none" className={className} aria-hidden>
      {/* Shopify checkout sprite #chevronDown, rendered with its 1.68px stroke. */}
      <path
        d="M12 4.75 7.354 9.396a.5.5 0 0 1-.708 0L2 4.75"
        stroke="currentColor"
        strokeWidth="1.68"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BagIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 22" fill="none" className={className} aria-hidden>
      <path
        d="M7 7.5V6a4 4 0 1 1 8 0v1.5M4.6 7.5h12.8a.9.9 0 0 1 .9.95l-.62 9.73A2.7 2.7 0 0 1 15 20.7H7a2.7 2.7 0 0 1-2.68-2.52L3.7 8.45a.9.9 0 0 1 .9-.95Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 11.2a3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
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

/** Floating-label select (label always floated, chevron on the right). */
export function FloatingSelect({
  id,
  label,
  value,
  onValueChange,
  options,
  error,
  disabled,
  className = '',
}: {
  id: string;
  label: string;
  value: string;
  onValueChange?: (next: string) => void;
  options: readonly string[];
  error?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className={`${fieldBox} ${error ? 'border-[#e32c2b]' : 'border-[#dedede]'}`}>
        <label htmlFor={id} className="pointer-events-none absolute left-[10px] top-[7px] text-[12px] leading-[1.35] text-[#707070]">
          {label}
        </label>
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onValueChange?.(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="block h-[47px] w-full appearance-none rounded-xl bg-transparent pb-[6px] pl-[10px] pr-[30px] pt-[21px] text-[14px] text-black outline-none disabled:opacity-100"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronGlyph className="pointer-events-none absolute right-4 top-1/2 h-[10px] w-[10px] -translate-y-1/2 text-[#707070]" />
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

/** Shopify radio dot: 18px, 1px #dedede; selected = thick #005bd1 ring around a white centre. */
export function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`block h-[18px] w-[18px] shrink-0 rounded-full bg-white ${
        selected ? 'border-[6px] border-[#005bd1]' : 'border border-[#dedede]'
      }`}
    />
  );
}

/** Radio-accordion group (payment / billing / shipping method). */
export function RadioGroup<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: React.ReactNode; aside?: React.ReactNode; panel?: React.ReactNode }[];
}) {
  return (
    <div role="radiogroup" className="rounded-xl border border-[#dedede]">
      {options.map((o, i) => {
        const selected = o.value === value;
        const first = i === 0;
        const last = i === options.length - 1;
        const open = selected && !!o.panel;
        return (
          <div key={o.value} className={first ? '' : 'border-t border-[#dedede]'}>
            {/* Selected row: #f5f6ff fill and a 1px #005bd1 outline drawn over the group border. */}
            <label
              className={`relative flex cursor-pointer items-center gap-[10px] p-[14px] ${first ? 'rounded-t-[11px]' : ''} ${
                last && !open ? 'rounded-b-[11px]' : ''
              } ${
                selected
                  ? `z-[1] bg-[#f5f6ff] after:pointer-events-none after:absolute after:inset-[-1px] after:border after:border-[#005bd1] ${
                      first ? 'after:rounded-t-xl' : ''
                    } ${last && !open ? 'after:rounded-b-xl' : ''}`
                  : ''
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={selected}
                onChange={() => onChange(o.value)}
                className="peer sr-only"
              />
              <RadioDot selected={selected} />
              <strong className="flex-1 text-[14px] font-semibold leading-[1.35] text-black">{o.label}</strong>
              {/* live: 24px badges sit in a 22px grid row (rows with badges are 50px, plain rows 46.9px) */}
              {o.aside && <span className="-my-px block shrink-0">{o.aside}</span>}
            </label>
            {open && (
              <div
                className={`border-t border-[#dedede] bg-[rgba(0,0,0,0.043)] p-[14px] text-[14px] leading-[1.35] text-black ${
                  last ? 'rounded-b-[11px]' : ''
                }`}
              >
                {o.panel}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Payment brand tiles, 38×24 — the same card-brand SVGs live checkout serves (public/images/checkout). */
function Tile({ src, label }: { src: string; label: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- static 38×24 SVG, nothing to optimise
  return <img src={src} alt={label} width={38} height={24} className="block h-6 w-[38px]" />;
}

export function VisaBadge() {
  return <Tile src="/images/checkout/visa.svg" label="Visa" />;
}

export function MastercardBadge() {
  return <Tile src="/images/checkout/mastercard.svg" label="Mastercard" />;
}

export function AmexBadge() {
  return <Tile src="/images/checkout/amex.svg" label="American Express" />;
}

export function UnionPayBadge() {
  return <Tile src="/images/checkout/unionpay.svg" label="UnionPay" />;
}
