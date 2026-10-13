'use client';

import { useState } from 'react';

/**
 * Footer newsletter signup. Posts to the shared /api/contact endpoint with
 * subject "Newsletter"; the message body carries the email so submissions can
 * be reported from the admin Messages screen.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('error');
      setError('Please enter a valid email address.');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Newsletter Subscriber',
          email: trimmed,
          subject: 'Newsletter',
          message: `Newsletter signup: ${trimmed}`,
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok || (data && typeof data === 'object' && 'ok' in data && data.ok !== true)) {
        const msg =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Could not subscribe right now. Please try again.';
        throw new Error(msg);
      }
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not subscribe right now. Please try again.');
    }
  }

  if (status === 'done') {
    return (
      <div className="mt-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Newsletter</p>
        <p className="mt-2 text-[13px] font-semibold text-brand-200">Subscribed!</p>
        <p className="mt-1 text-[12.5px] text-white/60">
          You&rsquo;ll hear about new collections and seasonal offers first.
        </p>
      </div>
    );
  }

  return (
    <form className="mt-6" onSubmit={onSubmit} noValidate>
      <label htmlFor="newsletter-email" className="text-[11px] font-bold uppercase tracking-wider text-white/60">
        Newsletter
      </label>
      <p className="mt-1.5 text-[12.5px] text-white/60">
        New arrivals, seasonal offers and interior ideas — straight to your inbox.
      </p>
      <div className="mt-2.5 flex max-w-sm gap-2">
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          autoComplete="email"
          className="w-full min-w-0 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/40 outline-none transition focus:border-brand-300 focus:bg-white/15"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="shrink-0 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === 'loading' ? '…' : 'Subscribe'}
        </button>
      </div>
      {status === 'error' && error && <p className="mt-2 text-[12px] text-[#ffb4a8]">{error}</p>}
    </form>
  );
}
