/* Exact live (Habitat theme) PDP SVGs; colour follows `currentColor`. */

type P = { className?: string };

// The four trust-strip icons moved to pdp-icons.tsx (ready-made icon set); re-exported for any other importer.
export { AfterSaleSupportIcon, AssemblyAssistanceIcon, DoorstepDeliveryIcon, InternationalStandardIcon } from './pdp-icons';

export function ZoomIcon({ className }: P) {
  return (
    <svg viewBox="0 0 14 14" className={className} fill="none" aria-hidden focusable="false">
      <path d="M4.24998 6.25022H8.24996M6.24997 4.25023V8.25021M9.96205 9.96248L12.9996 13M11.4999 6.24997C11.4999 9.14945 9.14945 11.4999 6.24997 11.4999C3.35049 11.4999 1 9.14945 1 6.24997C1 3.35049 3.35049 1 6.24997 1C9.14945 1 11.4999 3.35049 11.4999 6.24997Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function MinusIcon({ className }: P) {
  return (
    <svg viewBox="0 0 8 2" className={className} aria-hidden focusable="false">
      <path d="M3.49692e-08 1.39998L0 0.599976L8 0.599976V1.39998L3.49692e-08 1.39998Z" fill="currentColor"/>
    </svg>
  );
}

export function PlusIcon({ className }: P) {
  return (
    <svg viewBox="0 0 8 8" className={className} aria-hidden focusable="false">
      <path d="M3.6 0H4.4V8H3.6V0Z" fill="currentColor"/><path d="M3.49692e-08 4.4L0 3.6L8 3.6V4.4L3.49692e-08 4.4Z" fill="currentColor"/>
    </svg>
  );
}

export function ShareFacebookIcon({ className }: P) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden focusable="false">
      <path fill="currentColor" d="M16.42.61c.27 0 .5.1.69.28.19.2.28.42.28.7v15.44c0 .27-.1.5-.28.69a.94.94 0 01-.7.28h-4.39v-6.7h2.25l.31-2.65h-2.56v-1.7c0-.4.1-.72.28-.93.18-.2.5-.32 1-.32h1.37V3.35c-.6-.06-1.27-.1-2.01-.1-1.01 0-1.83.3-2.45.9-.62.6-.93 1.44-.93 2.53v1.97H7.04v2.65h2.24V18H.98c-.28 0-.5-.1-.7-.28a.94.94 0 01-.28-.7V1.59c0-.27.1-.5.28-.69a.94.94 0 01.7-.28h15.44z" />
    </svg>
  );
}

export function ShareTwitterIcon({ className }: P) {
  return (
    <svg viewBox="0 0 18 15" className={className} aria-hidden focusable="false">
      <path fill="currentColor" d="M17.64 2.6a7.33 7.33 0 01-1.75 1.82c0 .05 0 .13.02.23l.02.23a9.97 9.97 0 01-1.69 5.54c-.57.85-1.24 1.62-2.02 2.28a9.09 9.09 0 01-2.82 1.6 10.23 10.23 0 01-8.9-.98c.34.02.61.04.83.04 1.64 0 3.1-.5 4.38-1.5a3.6 3.6 0 01-3.3-2.45A2.91 2.91 0 004 9.35a3.47 3.47 0 01-2.02-1.21 3.37 3.37 0 01-.8-2.22v-.03c.46.24.98.37 1.58.4a3.45 3.45 0 01-1.54-2.9c0-.61.14-1.2.45-1.79a9.68 9.68 0 003.2 2.6 10 10 0 004.08 1.07 3 3 0 01-.13-.8c0-.97.34-1.8 1.03-2.48A3.45 3.45 0 0112.4.96a3.49 3.49 0 012.54 1.1c.8-.15 1.54-.44 2.23-.85a3.4 3.4 0 01-1.54 1.94c.74-.1 1.4-.28 2.01-.54z" />
    </svg>
  );
}

export function SharePinterestIcon({ className }: P) {
  return (
    <svg viewBox="0 0 17 18" className={className} aria-hidden focusable="false">
      <path fill="currentColor" d="M8.48.58a8.42 8.42 0 015.9 2.45 8.42 8.42 0 011.33 10.08 8.28 8.28 0 01-7.23 4.16 8.5 8.5 0 01-2.37-.32c.42-.68.7-1.29.85-1.8l.59-2.29c.14.28.41.52.8.73.4.2.8.31 1.24.31.87 0 1.65-.25 2.34-.75a4.87 4.87 0 001.6-2.05 7.3 7.3 0 00.56-2.93c0-1.3-.5-2.41-1.49-3.36a5.27 5.27 0 00-3.8-1.43c-.93 0-1.8.16-2.58.48A5.23 5.23 0 002.85 8.6c0 .75.14 1.41.43 1.98.28.56.7.96 1.27 1.2.1.04.19.04.26 0 .07-.03.12-.1.15-.2l.18-.68c.05-.15.02-.3-.11-.45a2.35 2.35 0 01-.57-1.63A3.96 3.96 0 018.6 4.8c1.09 0 1.94.3 2.54.89.61.6.92 1.37.92 2.32 0 .8-.11 1.54-.33 2.21a3.97 3.97 0 01-.93 1.62c-.4.4-.87.6-1.4.6-.43 0-.78-.15-1.06-.47-.27-.32-.36-.7-.26-1.13a111.14 111.14 0 01.47-1.6l.18-.73c.06-.26.09-.47.09-.65 0-.36-.1-.66-.28-.89-.2-.23-.47-.35-.83-.35-.45 0-.83.2-1.13.62-.3.41-.46.93-.46 1.56a4.1 4.1 0 00.18 1.15l.06.15c-.6 2.58-.95 4.1-1.08 4.54-.12.55-.16 1.2-.13 1.94a8.4 8.4 0 01-5-7.65c0-2.3.81-4.28 2.44-5.9A8.04 8.04 0 018.48.57z" />
    </svg>
  );
}

