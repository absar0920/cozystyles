import type { ReactNode } from 'react';

/** Minimal centered shell for the admin auth screens (login). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-brand-900 px-4 py-12">
      {/* subtle ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl"
      />
      <div className="relative z-10 w-full max-w-md">{children}</div>
      <p className="relative z-10 mt-8 text-center text-xs text-white/35">
        © {new Date().getFullYear()} Cozy Furnitures (Pvt.) Ltd. — Admin Panel
      </p>
    </div>
  );
}
