'use client';

import { useState } from 'react';
import { CheckIcon, MailIcon } from '@/components/icons';

const SUBJECTS = [
  { value: 'General', label: 'General Inquiry' },
  { value: 'Sales', label: 'Sales' },
  { value: 'Complaint', label: 'Complaint' },
  { value: 'Corporate', label: 'Corporate' },
  { value: 'Careers', label: 'Careers' },
] as const;

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState<string>('General');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setError('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, subject, message }),
      });
      const data: { ok?: boolean; error?: string } = await response.json().catch(() => ({}));
      if (response.ok && data.ok) {
        setStatus('sent');
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
      }
    } catch {
      setError('Network error — please check your connection and try again.');
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-brand/30 bg-cream-soft px-6 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white">
          <CheckIcon className="h-7 w-7" />
        </span>
        <h3 className="mt-5 text-xl font-bold text-ink-dark">Thank you, your message is on its way!</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
          Our team typically responds within 1–2 business days. For urgent inquiries, call us at{' '}
          <a href="tel:+9242111203203" className="font-semibold text-brand">
            +92-42-111-203-203
          </a>{' '}
          or reach us on WhatsApp.
        </p>
        <button
          type="button"
          className="btn-outline mt-6"
          onClick={() => {
            setName('');
            setEmail('');
            setPhone('');
            setSubject('General');
            setMessage('');
            setError('');
            setStatus('idle');
          }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="contact-name" className="label">
          Full Name <span className="text-terra">*</span>
        </label>
        <input
          id="contact-name"
          name="name"
          className="input"
          placeholder="e.g. Ahmed Raza"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="label">
          Email Address
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          className="input"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
        />
      </div>
      <div>
        <label htmlFor="contact-phone" className="label">
          Phone Number
        </label>
        <input
          id="contact-phone"
          name="phone"
          type="tel"
          className="input"
          placeholder="03XX-XXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={40}
        />
      </div>
      <div>
        <label htmlFor="contact-subject" className="label">
          Subject
        </label>
        <select
          id="contact-subject"
          name="subject"
          className="input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          {SUBJECTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="contact-message" className="label">
          Message <span className="text-terra">*</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          className="input min-h-36 resize-y"
          placeholder="How can we help you?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={5000}
          required
        />
        <p className="mt-1 text-right text-xs text-ink-light">{message.length}/5000</p>
      </div>

      {status === 'error' && (
        <p role="alert" className="rounded-md bg-sale/10 px-4 py-3 text-sm font-medium text-sale sm:col-span-2">
          {error}
        </p>
      )}

      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={status === 'sending'}>
          {status === 'sending' ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
              Sending…
            </>
          ) : (
            <>
              <MailIcon className="h-4 w-4" aria-hidden />
              Send Message
            </>
          )}
        </button>
        <p className="mt-3 text-xs text-ink-muted">
          Your details stay confidential and are only used to respond to your inquiry.
        </p>
      </div>
    </form>
  );
}
