'use client';

import { useState } from 'react';
import { formatPKR } from '@/lib/money';
import { SearchIcon, PhoneIcon, PackageIcon, MapPinIcon } from '@/components/icons';
import { StatusTimeline } from '@/components/checkout/StatusTimeline';

type TrackedItem = { title: string; variantTitle: string; price: number; quantity: number; image: string };

type TrackedOrder = {
  orderNumber: string;
  customerName: string;
  city: string;
  status: string;
  subtotal: number;
  total: number;
  createdAt: string;
  items: TrackedItem[];
};

type LookupResponse = { ok: boolean; status?: string; order?: TrackedOrder; error?: string };

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-gold/15 text-ink-dark border-gold/40',
  CONFIRMED: 'bg-brand-50 text-brand-700 border-brand-200',
  PROCESSING: 'bg-brand-100 text-brand-700 border-brand-300',
  SHIPPED: 'bg-terra/10 text-terra-dark border-terra/30',
  DELIVERED: 'bg-brand text-white border-brand',
  CANCELLED: 'bg-sale/10 text-sale border-sale/30',
};

/** Order lookup form + result panel for /track. */
export function TrackForm({ initialOrder = '' }: { initialOrder?: string }) {
  const [orderNo, setOrderNo] = useState(initialOrder);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TrackedOrder | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setResult(null);

    if (!orderNo.trim() || !phone.trim()) {
      setError('Please enter both your order number and the phone number used at checkout.');
      return;
    }

    setLoading(true);
    try {
      const qs = new URLSearchParams({ order: orderNo.trim(), phone: phone.trim() });
      const res = await fetch(`/api/orders/lookup?${qs.toString()}`, { headers: { Accept: 'application/json' } });
      const data = (await res.json().catch(() => null)) as LookupResponse | null;
      if (res.ok && data?.ok && data.order) {
        setResult(data.order);
      } else {
        setError(data?.error ?? 'We could not find that order. Please check your details and try again.');
      }
    } catch {
      setError('Something went wrong while looking up your order. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-cream-border bg-white p-5 shadow-card sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="track-order" className="label">
              Order Number
            </label>
            <input
              id="track-order"
              type="text"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              placeholder="IW-100001"
              autoComplete="off"
              className="input uppercase placeholder:normal-case"
            />
          </div>
          <div>
            <label htmlFor="track-phone" className="label">
              Phone Number
            </label>
            <input
              id="track-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0300 1234567"
              autoComplete="tel"
              className="input"
            />
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted">
            You can find your order number in the confirmation shown after checkout.
          </p>
          <button type="submit" disabled={loading} className="btn-primary shrink-0">
            <SearchIcon className="h-4 w-4" />
            {loading ? 'Looking up…' : 'Track Order'}
          </button>
        </div>
      </form>

      {error && (
        <div role="alert" className="mt-5 rounded-xl border border-sale/30 bg-sale/5 px-5 py-4 text-sm text-sale">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 animate-fadeIn rounded-xl border border-cream-border bg-white p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-border pb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-muted">Order</p>
              <p className="font-heading text-lg font-bold text-ink-dark">{result.orderNumber}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Placed on {new Date(result.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                STATUS_STYLES[result.status] ?? 'bg-cream text-ink-dark border-cream-border'
              }`}
            >
              {result.status}
            </span>
          </div>

          <div className="grid gap-6 py-5 sm:grid-cols-[1fr_minmax(220px,2fr)]">
            <div>
              <h3 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Order Progress
              </h3>
              <StatusTimeline status={result.status} />
            </div>

            <div>
              <h3 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Order Details
              </h3>
              <ul className="divide-y divide-cream-border rounded-lg border border-cream-border">
                {result.items.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 p-3">
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-cream-border bg-cream-soft">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-ink-light">
                          <PackageIcon className="h-5 w-5" />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink-dark" title={item.title}>
                        {item.title}
                      </span>
                      {item.variantTitle && item.variantTitle !== 'Default Title' && (
                        <span className="block truncate text-xs text-ink-muted">{item.variantTitle}</span>
                      )}
                      <span className="block text-xs text-ink-muted">
                        Qty {item.quantity} × {formatPKR(item.price)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-ink-dark">
                      {formatPKR(item.price * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-cream px-4 py-3 text-sm">
                <span className="font-medium text-ink-muted">Total (incl. free delivery)</span>
                <span className="font-heading text-base font-bold text-brand">{formatPKR(result.total)}</span>
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <PhoneIcon className="h-3.5 w-3.5 text-brand" />
                  {result.customerName}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPinIcon className="h-3.5 w-3.5 text-brand" />
                  {result.city}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
