'use client';

import { useState } from 'react';
import { ThemeArrowRight } from '@/components/icons';

/**
 * Footer newsletter sign-up. There is no mailing service: it posts to the shared /api/contact endpoint with
 * subject "Newsletter" (one row per email address), and the owner finds the sign-ups in Admin → Messages →
 * Newsletter sign-ups, with a CSV download.
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
          message: `Signed up for the newsletter in the website footer: ${trimmed}`,
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
      <p className="m-0 text-[15px] leading-[25.5px] text-accent" role="status">
        Thanks for subscribing!
      </p>
    );
  }

  return (
    <form className="signup-container" onSubmit={onSubmit} noValidate>
      <label htmlFor="newsletter-email" className="mb-[3px] block text-[13px] font-semibold leading-[1.4] tracking-soft text-accent">
        Email
      </label>
      <div className="relative">
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your mail address"
          autoComplete="email"
          className="h-[52px] w-full rounded-none border-0 border-b border-[#2b2b2b] bg-transparent py-[17px] pl-0 pr-10 text-[13px] text-accent outline-none placeholder:text-accent/40"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          aria-label="Enter your mail address"
          className="absolute bottom-0 right-0 flex h-full max-h-[52px] w-10 items-center justify-center text-accent disabled:opacity-50"
        >
          <ThemeArrowRight />
        </button>
      </div>
      {status === 'error' && error && <p className="m-0 mt-2 text-[13px] text-sale">{error}</p>}
    </form>
  );
}
