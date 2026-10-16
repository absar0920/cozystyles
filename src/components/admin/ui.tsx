import Link from 'next/link';
import type { ReactNode } from 'react';
import { CharCount, ToggleSwitch } from './ui-client';

/**
 * Admin UI primitives — presentational and server-component safe (no hooks here; the few interactive
 * pieces live in ./ui-client and are re-exported below).
 */

export { ToggleSwitch };

export function AdminPageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink-dark">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AdminCard({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
      {title && <div className="border-b border-gray-100 px-5 py-3.5 font-heading text-sm font-bold text-ink-dark">{title}</div>}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function AdminTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  DRAFT: 'bg-gray-100 text-gray-600',
  ARCHIVED: 'bg-gray-200 text-gray-500',
  NEW: 'bg-blue-100 text-blue-800',
  READ: 'bg-gray-100 text-gray-600',
  CLOSED: 'bg-gray-200 text-gray-500',
  ADMIN: 'bg-brand-100 text-brand-800',
  SUPERADMIN: 'bg-purple-100 text-purple-800',
};

export function Badge({ children }: { children: string }) {
  const style = badgeStyles[children] ?? 'bg-gray-100 text-gray-600';
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style}`}>{children}</span>;
}

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

/**
 * `maxLength` + `showCount`: a live "42 / 160" counter under the field that turns amber past the limit
 * (a soft, recommended limit: typing past it is allowed). Without `showCount`, `maxLength` is the usual hard limit.
 */
export function TextInput({ showCount, maxLength, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { showCount?: boolean }) {
  const input = (
    <input
      {...props}
      maxLength={showCount ? undefined : maxLength}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 ${props.className ?? ''}`}
    />
  );
  if (!showCount || !maxLength) return input;
  return (
    <div>
      {input}
      <CharCount max={maxLength} />
    </div>
  );
}

export function TextArea({ showCount, maxLength, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { showCount?: boolean }) {
  const area = (
    <textarea
      {...props}
      maxLength={showCount ? undefined : maxLength}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 ${props.className ?? ''}`}
    />
  );
  if (!showCount || !maxLength) return area;
  return (
    <div>
      {area}
      <CharCount max={maxLength} />
    </div>
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 ${props.className ?? ''}`} />;
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-gray-400">{message}</td>
    </tr>
  );
}

/* ------------------------------------------------------------------ easy-mode primitives (SPEC §4.3) */

const NOTICE_TONES = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-800',
} as const;

const NOTICE_ICON_TONES = {
  info: 'text-blue-500',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  error: 'text-red-500',
} as const;

export function Notice({
  tone,
  title,
  children,
  action,
}: {
  tone: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center ${NOTICE_TONES[tone]}`}
    >
      <span className={`hidden shrink-0 sm:block ${NOTICE_ICON_TONES[tone]}`} aria-hidden>
        {tone === 'success' ? '✓' : tone === 'info' ? 'ℹ' : '!'}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** A titled white card for one section of an edit page. `collapsible` renders a <details> (server-safe). */
export function SectionCard({
  id,
  title,
  description,
  children,
  collapsible,
  defaultOpen,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const head = (
    <>
      <h2 className="font-heading text-base font-bold text-ink-dark">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
    </>
  );
  if (collapsible) {
    return (
      <details id={id} open={defaultOpen} className="group scroll-mt-20 rounded-xl border border-gray-200 bg-white shadow-sm">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">{head}</span>
          <span aria-hidden className="text-gray-400 transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="border-t border-gray-100 px-4 py-4 sm:px-5">{children}</div>
      </details>
    );
  }
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3.5 sm:px-5">{head}</div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

/** Checkbox with a label and one line of help. Works uncontrolled (defaultChecked) or controlled (checked + onChange). */
export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
  checked,
  onChange,
}: {
  name?: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 cursor-pointer items-start gap-3 py-1">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        readOnly={checked !== undefined && !onChange}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-brand-400 focus:ring-brand/30"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-dark">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>}
      </span>
    </label>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-red-600">
      {message}
    </p>
  );
}

/** A row of tab links (horizontally scrollable on phones); `hint` of the active tab shows under the row. */
export function Tabs({ items, ariaLabel }: { items: { label: string; href: string; active: boolean; hint?: string }[]; ariaLabel: string }) {
  const active = items.find((i) => i.active);
  return (
    <div data-testid="tabs" className="mb-4">
      {/* phones: the tabs wrap onto several rows as pills, so none is hidden off screen */}
      <nav aria-label={ariaLabel} className="sm:overflow-x-auto">
        <ul role="tablist" className="flex flex-wrap gap-1.5 sm:w-max sm:min-w-full sm:flex-nowrap sm:gap-1 sm:border-b sm:border-gray-200">
          {items.map((t) => (
            <li key={t.href} role="presentation">
              <Link
                href={t.href}
                role="tab"
                aria-selected={t.active}
                aria-current={t.active ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center whitespace-nowrap px-3 text-sm font-semibold transition max-sm:rounded-lg max-sm:border sm:-mb-px sm:border-b-2 ${
                  t.active
                    ? 'max-sm:border-brand-400 max-sm:bg-brand-50 text-ink-dark sm:border-brand-400'
                    : 'max-sm:border-gray-200 max-sm:bg-white text-gray-500 hover:text-ink-dark sm:border-transparent'
                }`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {active?.hint && <p className="mt-2 text-xs text-gray-500">{active.hint}</p>}
    </div>
  );
}
