'use client';

import { useState } from 'react';
import { StarIcon } from '@/components/icons';

type Status = 'idle' | 'sending' | 'sent' | 'error';

/** Storefront "Write a review" form. Submitted reviews wait for admin approval. */
export function ReviewForm({ productId }: { productId: number }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [author, setAuthor] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  if (status === 'sent') {
    return (
      <p role="status" className="rounded-xl border border-brand/20 bg-brand-50 p-4 text-sm font-medium text-brand-700">
        Thank you! Your review has been submitted and will appear once it&rsquo;s approved.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
        Write a Review
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError('Please choose a star rating.');
      return;
    }
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, rating, author, title, body }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        setStatus('sent');
        return;
      }
      setError(data?.error ?? 'We could not submit your review. Please try again.');
      setStatus('error');
    } catch {
      setError('Network error — please check your connection and try again.');
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-xl border border-cream-border bg-white p-5 shadow-card">
      <h3 className="font-heading text-base font-semibold text-ink-dark">Write a Review</h3>
      <fieldset>
        <legend className="label">
          Your rating <span className="text-terra">*</span>
        </legend>
        <div className="flex gap-1 text-[#f5a623]">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i} star${i > 1 ? 's' : ''}`}
              aria-pressed={rating === i}
              onClick={() => setRating(i)}
              className="rounded p-0.5 transition hover:scale-110"
            >
              <StarIcon className="h-6 w-6" filled={rating >= i} />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="review-author" className="label">
            Your name <span className="text-terra">*</span>
          </label>
          <input id="review-author" className="input" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={80} required />
        </div>
        <div>
          <label htmlFor="review-title" className="label">
            Title
          </label>
          <input id="review-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>
      </div>
      <div>
        <label htmlFor="review-body" className="label">
          Your review <span className="text-terra">*</span>
        </label>
        <textarea
          id="review-body"
          className="input min-h-28 resize-y"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          minLength={10}
          maxLength={2000}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-sale">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className="btn-primary" disabled={status === 'sending'}>
          {status === 'sending' ? 'Submitting…' : 'Submit Review'}
        </button>
      </div>
    </form>
  );
}
