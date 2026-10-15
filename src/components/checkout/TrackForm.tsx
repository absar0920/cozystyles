'use client';

import { useState } from 'react';
import { StatusTimeline } from '@/components/checkout/StatusTimeline';

type TrackedOrder = {
  orderNumber: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

type LookupResponse = { ok: boolean; order?: TrackedOrder; error?: string };

const STATUS_TITLE: Record<string, string> = {
  PENDING: 'Order Placed',
  CONFIRMED: 'Order Confirmed',
  PROCESSING: 'In Production',
  SHIPPED: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Order Cancelled',
};

/** "#100020", "100020", "cf-100020" → "CF-100020" (stored numbers are uppercase CF-xxxxxx). */
function normalizeOrderNumber(input: string): string {
  const v = input.trim().replace(/^#/, '').trim().toUpperCase();
  return /^\d+$/.test(v) ? `CF-${v}` : v;
}

function formatWhen(iso?: string): string {
  if (!iso) return 'Not available';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not available';
  return d.toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function TruckGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 7.5C3 6.12 4.12 5 5.5 5H15V16H5.5C4.12 16 3 14.88 3 13.5V7.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15 8H18.2C18.7 8 19.16 8.25 19.43 8.67L21 11.1V16H15V8Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7.5 19C8.33 19 9 18.33 9 17.5C9 16.67 8.33 16 7.5 16C6.67 16 6 16.67 6 17.5C6 18.33 6.67 19 7.5 19Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M17.5 19C18.33 19 19 18.33 19 17.5C19 16.67 18.33 16 17.5 16C16.67 16 16 16.67 16 17.5C16 18.33 16.67 19 17.5 19Z" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

const inputClass =
  'mb-5 block h-[52px] min-h-12 w-full rounded-[10px] border border-[#d6d6d6] bg-white px-[14px] py-3 text-[15px] leading-[1.15] text-[#222] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-transparent focus:border-[#087443] focus:shadow-[0_0_0_3px_rgba(0,120,80,0.12)]';

function Result({ order }: { order: TrackedOrder }) {
  const delivered = order.status === 'DELIVERED';
  const cancelled = order.status === 'CANCELLED';
  const pill = delivered
    ? { text: 'Delivered', cls: 'bg-[#e6f7ef] text-[#087443]' }
    : cancelled
      ? { text: 'Action Required', cls: 'bg-[#fdecec] text-[#b42318]' }
      : { text: 'In Progress', cls: 'bg-[#fff7e6] text-[#9a5b00]' };
  const title = STATUS_TITLE[order.status] ?? order.status;
  const updated = order.updatedAt ?? order.createdAt;

  const rows: [string, string][] = [
    ['Order Number', order.orderNumber],
    ['Courier', 'Cozy Furnitures Delivery'],
    ['Tracking Number', order.status === 'SHIPPED' || delivered ? order.orderNumber : 'Tracking will be available after shipment booking'],
    ['Order Reference', order.orderNumber],
    ['Delivery Date', delivered ? formatWhen(updated) : 'Not delivered yet'],
    ['Last Updated', formatWhen(updated)],
  ];

  const events = [{ status: 'Order Placed', meta: formatWhen(order.createdAt) }];
  if (order.status !== 'PENDING') events.push({ status: title, meta: formatWhen(updated) });

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white">
      <div className="border-b border-[#e2e8f0] bg-[#f8fafc] p-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-[14px]">
          <h2 className="m-0 text-[24px] font-extrabold leading-[1.2] text-[#1f2937]">{title}</h2>
          <span className={`inline-flex items-center rounded-full px-3 py-[7px] text-[13px] font-bold leading-[1.4] ${pill.cls}`}>
            {pill.text}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="border-b border-[#eef2f7] px-[22px] py-4 md:odd:border-r">
            <span className="mb-[5px] block text-[13px] leading-[1.4] text-[#6b7280]">{label}</span>
            <span className="break-words text-[15px] font-[650] leading-[1.5] text-[#111827]">{value}</span>
          </div>
        ))}
      </div>
      <div className="p-[22px]">
        <h3 className="m-0 mb-4 text-[18px] font-extrabold leading-[1.3] text-[#1f2937]">Tracking Timeline</h3>
        <StatusTimeline events={events} />
      </div>
      {cancelled && (
        <div className="mx-[22px] mb-[22px] rounded-xl bg-[#f9fafb] px-4 py-[14px] text-[14px] leading-[1.55] text-[#555]">
          <strong className="font-medium">Need help?</strong> Your shipment could not be completed by the courier. Please
          contact Cozy Furnitures customer support for assistance.
        </div>
      )}
    </div>
  );
}

/** Live "Track Your Order" card (`.iw-track-card`): icon header, 3-column inline form, note, result card. */
export function TrackForm({ initialOrder = '' }: { initialOrder?: string }) {
  const [orderNo, setOrderNo] = useState(initialOrder);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'info' } | null>(null);
  const [result, setResult] = useState<TrackedOrder | null>(null);

  async function trackOrder() {
    if (loading) return;
    setResult(null);
    const order = orderNo.trim();
    const mobile = phone.trim();
    if (!order || !mobile) {
      setMessage({ text: 'Please enter both order number and mobile number.', type: 'error' });
      return;
    }
    if (mobile.replace(/\D/g, '').length < 10) {
      setMessage({ text: 'Please enter a valid mobile number.', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage({ text: 'Checking your order status...', type: 'info' });
    try {
      const qs = new URLSearchParams({ order: normalizeOrderNumber(order), phone: mobile });
      const res = await fetch(`/api/orders/lookup?${qs.toString()}`, { headers: { Accept: 'application/json' } });
      const data = (await res.json().catch(() => null)) as LookupResponse | null;
      if (!res.ok || !data?.ok || !data.order) {
        setMessage({
          text:
            res.status === 429 && data?.error
              ? data.error
              : 'Order not found. Please check your order number and mobile number.',
          type: 'error',
        });
        return;
      }
      setMessage(null);
      setResult(data.order);
    } catch {
      setMessage({ text: 'Unable to fetch tracking status right now. Please try again later.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      trackOrder();
    }
  };

  return (
    <div className="rounded-[14px] border border-[#e7e7e7] bg-white p-[22px] shadow-[0_10px_30px_rgba(0,0,0,0.06)] md:rounded-[18px] md:p-[34px]">
      <div className="mb-7 flex flex-col items-start gap-4 md:flex-row">
        <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-2xl bg-[#087443] text-white">
          <TruckGlyph />
        </div>
        <div>
          <h1 className="m-0 mb-2 text-[26px] font-bold leading-[1.15] text-[#222] md:text-[32px]">Track Your Order</h1>
          <p className="m-0 text-[16px] leading-[1.6] text-[#666]">
            Enter your order number and mobile number to check the latest delivery status.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-end gap-[14px] md:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="iwOrderNumber" className="mb-[7px] block text-[14px] font-semibold leading-[1.75] tracking-soft text-[#333]">
            Order Number
          </label>
          <input
            id="iwOrderNumber"
            type="text"
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Example: 9868 or #9868"
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="iwPhone" className="mb-[7px] block text-[14px] font-semibold leading-[1.75] tracking-soft text-[#333]">
            Mobile Number
          </label>
          <input
            id="iwPhone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Example: 03001234567"
            autoComplete="tel"
            className={inputClass}
          />
        </div>
        <button
          type="button"
          onClick={trackOrder}
          disabled={loading}
          className="min-h-12 w-full whitespace-nowrap rounded-[10px] border-0 bg-[#087443] px-[22px] py-3 text-[15px] font-bold leading-none text-white transition-[transform,opacity] duration-150 hover:-translate-y-px hover:opacity-[.92] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-[.65] md:w-auto"
        >
          {loading ? 'Checking...' : 'Track Order'}
        </button>
      </div>

      <div
        role={message?.type === 'error' ? 'alert' : 'status'}
        className={`text-[15px] font-semibold ${message?.text ? 'mt-[18px]' : ''} ${
          message?.type === 'error' ? 'text-[#b42318]' : 'text-[#444]'
        }`}
      >
        {message?.text}
      </div>

      {result && <Result order={result} />}

      <div className="mt-[18px] rounded-xl bg-[#f9fafb] px-4 py-[14px] text-[14px] leading-[1.55] text-[#555]">
        <strong className="font-medium">Note:</strong> Please enter the same mobile number used at the time of order placement.
      </div>
    </div>
  );
}
