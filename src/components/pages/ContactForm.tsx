'use client';

import { useState } from 'react';
import { toast } from '@/components/toast/toast';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export type FieldSpec = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'textarea';
  required?: boolean;
  /** half-width at ≥768 (live `medium-6`) */
  half?: boolean;
  options?: string[];
};

/** Live floating-label `.field` (input/textarea/select + label). */
export function Field({ spec, value, onChange }: { spec: FieldSpec; value: string; onChange: (v: string) => void }) {
  const id = `field-${spec.name}`;
  const common = {
    id,
    name: spec.name,
    required: spec.required,
    value,
    placeholder: spec.label,
  };
  return (
    <div className={`sf-field w-full ${spec.half ? 'md:w-[calc(50%-15px)]' : ''}`}>
      {spec.options ? (
        <div className="sf-select">
          <select {...common} onChange={(e) => onChange(e.target.value)}>
            <option value="" disabled>
              {spec.label}
            </option>
            {spec.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <label htmlFor={id}>{spec.label}</label>
        </div>
      ) : spec.type === 'textarea' ? (
        <>
          <textarea {...common} rows={10} maxLength={5000} onChange={(e) => onChange(e.target.value)} />
          <label htmlFor={id}>{spec.label}</label>
        </>
      ) : (
        <>
          <input {...common} type={spec.type ?? 'text'} maxLength={200} onChange={(e) => onChange(e.target.value)} />
          <label htmlFor={id}>{spec.label}</label>
        </>
      )}
    </div>
  );
}

/**
 * Theme contact form posting to /api/contact. `compose` maps the field values onto the API's
 * { name, email, phone, subject, message } payload.
 */
export function ThemeForm({
  fields,
  subject,
  submitLabel = 'Send Message',
  compose,
  className = '',
  submitClassName = '',
}: {
  fields: FieldSpec[];
  subject: 'General' | 'Sales' | 'Complaint';
  submitLabel?: string;
  compose: (values: Record<string, string>) => { name: string; email: string; phone: string; message: string };
  className?: string;
  submitClassName?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
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
        body: JSON.stringify({ ...compose(values), subject }),
      });
      const data: { ok?: boolean; error?: string } = await response.json().catch(() => ({}));
      if (response.ok && data.ok) {
        setStatus('sent');
        setValues({});
        toast.success('Message sent');
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
        toast.error('Message not sent');
      }
    } catch {
      setError('Network error — please check your connection and try again.');
      setStatus('error');
      toast.error('Message not sent');
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {status === 'sent' && (
        <p role="status" className="mb-[15px] text-[15px]">
          Thanks for contacting us. We&apos;ll get back to you as soon as possible.
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="mb-[15px] text-[15px] text-accent2">
          {error}
        </p>
      )}
      <div className="flex flex-wrap md:gap-x-[30px]">
        {fields.map((spec) => (
          <Field
            key={spec.name}
            spec={spec}
            value={values[spec.name] ?? ''}
            onChange={(v) => setValues((prev) => ({ ...prev, [spec.name]: v }))}
          />
        ))}
      </div>
      <button type="submit" className={`sf-submit ${submitClassName}`} disabled={status === 'sending'}>
        <span>{submitLabel}</span>
      </button>
    </form>
  );
}

/** Live /pages/contact form: Name + Email, Phone number, Comment, green SEND MESSAGE. */
export function ContactForm() {
  return (
    <ThemeForm
      subject="General"
      className="max-w-[800px]"
      fields={[
        { name: 'name', label: 'Name', required: true, half: true },
        { name: 'email', label: 'Email', type: 'email', required: true, half: true },
        { name: 'phone', label: 'Phone number', type: 'tel', required: true },
        { name: 'body', label: 'Comment', type: 'textarea', required: true },
      ]}
      compose={(v) => ({ name: v.name ?? '', email: v.email ?? '', phone: v.phone ?? '', message: v.body ?? '' })}
    />
  );
}
