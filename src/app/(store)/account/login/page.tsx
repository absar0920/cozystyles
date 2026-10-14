'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserIcon } from '@/components/icons';

/**
 * Account login placeholder. Customer accounts are not live yet, so the form
 * simply surfaces a notice with the order-tracking and contact routes.
 */
export default function AccountLoginPage() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="container-iw flex items-center justify-center py-14 sm:py-20">
      <div className="w-full max-w-md rounded-2xl border border-cream-border bg-white p-7 shadow-card sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand">
          <UserIcon className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-heading text-2xl font-bold text-ink-dark">Login to Your Account</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Sign in to track orders, manage wishlists and check delivery status.
        </p>

        {submitted ? (
          <div className="mt-6 rounded-xl border border-cream-border bg-cream p-5">
            <p className="text-sm font-semibold text-ink-dark">
              Customer accounts are coming soon. Track your order or contact us.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/track" className="btn-primary px-5 py-2.5 text-sm">
                Track Your Order
              </Link>
              <Link href="/pages/contact" className="btn-outline px-5 py-2.5 text-sm">
                Contact Us
              </Link>
            </div>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <div>
              <label htmlFor="login-email" className="label">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="login-phone" className="label">
                Phone number
              </label>
              <input
                id="login-phone"
                type="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03XX-XXXXXXX"
                className="input"
              />
            </div>
            <button type="submit" className="btn-primary w-full py-3 text-sm">
              Sign In
            </button>
            <p className="text-center text-xs leading-relaxed text-ink-muted">
              New to Cozy Furnitures? Continue shopping as a guest — no account needed at checkout.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
