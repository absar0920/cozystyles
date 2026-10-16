'use client';

import { useFormStatus } from 'react-dom';
import { usePendingUploads, WAITING_FOR_UPLOAD } from './upload-client';

export function SubmitButton({ children, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'neutral' }) {
  const { pending } = useFormStatus();
  const uploading = usePendingUploads() > 0;
  const styles =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : variant === 'neutral'
        ? 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
        : 'bg-brand hover:bg-brand-600 text-white';
  return (
    <button
      type="submit"
      {...props}
      disabled={pending || uploading || props.disabled}
      title={uploading ? WAITING_FOR_UPLOAD : props.title}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${props.className ?? ''}`}
    >
      {pending && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
      )}
      {children}
    </button>
  );
}
