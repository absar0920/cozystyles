'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { Checkbox, FloatingInput, HideStoreChrome, SYSTEM_FONT, blueLink } from '@/components/account/ui';

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#0866ff" />
      <path
        fill="#fff"
        d="M15.3 15.2 15.8 12H12.7v-2.07c0-.88.43-1.73 1.81-1.73h1.4V5.47s-1.27-.22-2.49-.22c-2.54 0-4.2 1.54-4.2 4.33V12H6.4v3.2h2.82V23a11.2 11.2 0 0 0 3.48 0v-7.8h2.6Z"
      />
    </svg>
  );
}

/** Shop wordmark as live's sign-in button draws it (38.4×16, nudged 9.375% down to sit on the baseline). */
function ShopWordmark() {
  return (
    <svg viewBox="0 0 60 25" fill="currentColor" role="img" aria-label="Shop" className="h-4 w-auto translate-y-[9.375%] self-center">
      <path d="M7.74 11.067c-2.35-.509-3.396-.708-3.396-1.612 0-.85.708-1.274 2.125-1.274 1.246 0 2.157.544 2.828 1.609.05.082.155.11.24.066l2.644-1.334a.186.186 0 0 0 .076-.259c-1.098-1.9-3.125-2.94-5.794-2.94-3.507 0-5.686 1.727-5.686 4.47 0 2.914 2.653 3.65 5.006 4.16 2.353.509 3.403.708 3.403 1.612 0 .904-.765 1.33-2.293 1.33-1.41 0-2.457-.644-3.09-1.896a.185.185 0 0 0-.25-.082L.916 16.222a.188.188 0 0 0-.082.253c1.046 2.102 3.194 3.284 6.062 3.284 3.653 0 5.86-1.697 5.86-4.526 0-2.83-2.666-3.65-5.015-4.16v-.006ZM21.909 5.324c-1.5 0-2.824.53-3.776 1.476a.093.093 0 0 1-.158-.067V.7a.185.185 0 0 0-.187-.186H14.48a.185.185 0 0 0-.187.186v18.728c0 .105.083.187.187.187h3.308a.185.185 0 0 0 .187-.187v-8.215c0-1.586 1.217-2.803 2.859-2.803 1.641 0 2.83 1.191 2.83 2.803v8.215c0 .105.082.187.187.187h3.308a.185.185 0 0 0 .186-.187v-8.215c0-3.451-2.264-5.888-5.436-5.888ZM34.056 4.786c-1.796 0-3.478.55-4.687 1.344a.187.187 0 0 0-.06.25l1.458 2.487c.054.089.168.12.256.066a5.812 5.812 0 0 1 3.04-.834c2.887 0 5.01 2.035 5.01 4.725 0 2.292-1.7 3.99-3.853 3.99-1.755 0-2.973-1.022-2.973-2.463 0-.825.351-1.501 1.265-1.979a.183.183 0 0 0 .073-.259L32.21 9.787a.186.186 0 0 0-.224-.08c-1.844.683-3.137 2.327-3.137 4.533 0 3.338 2.66 5.829 6.369 5.829 4.333 0 7.448-3 7.448-7.302 0-4.611-3.624-7.98-8.609-7.98ZM52.342 5.295c-1.673 0-3.169.62-4.26 1.707a.092.092 0 0 1-.158-.066V5.627a.185.185 0 0 0-.186-.186h-3.223a.185.185 0 0 0-.187.186v18.7c0 .104.082.186.187.186h3.308a.185.185 0 0 0 .187-.187v-6.131c0-.083.098-.124.158-.07 1.088 1.012 2.527 1.602 4.174 1.602 3.88 0 6.907-3.138 6.907-7.216 0-4.077-3.03-7.216-6.907-7.216Zm-.626 11.265c-2.207 0-3.88-1.754-3.88-4.074s1.67-4.074 3.88-4.074 3.877 1.726 3.877 4.074c0 2.349-1.644 4.074-3.88 4.074h.003Z" />
    </svg>
  );
}

/**
 * Shopify new-customer-accounts sign-in, rendered chrome-less like live. Customer accounts are not
 * live locally, so any sign-in action swaps the form for a notice with tracking/contact routes.
 */
export default function AccountLoginPage() {
  const [email, setEmail] = useState('');
  const [newsletter, setNewsletter] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const signIn = () => setSubmitted(true);

  return (
    <div
      data-bare-page
      className="flex min-h-screen flex-col bg-white text-[14px] leading-[1.35] text-black antialiased [&_:is(h1,h2)]:[color:inherit] [&_:is(h1,h2)]:[font-family:inherit]"
      style={{ fontFamily: SYSTEM_FONT }}
    >
      <HideStoreChrome />
      <header className="flex h-[100px] justify-center pt-10">
        <Link href="/" aria-label="Cozy Furnitures" className="block">
          <Logo />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-[46px] pt-10">
        <div className="w-full max-w-[379px]">
          <h1 className="text-[20px] font-semibold leading-[24px]">
            {/* live: 22px/1.2 span inside the 20px/24px heading (line box grows to 26.4px) */}
            <span className="text-[22px] leading-[1.2]">Sign in</span>
          </h1>
          <p className="mt-1.5 text-black/[.56]">Sign in or create an account</p>

          {submitted ? (
            <div className="mt-5 rounded-xl border border-[#dedede] p-5">
              <p>Customer accounts are coming soon.</p>
              <p className="mt-2 text-black/[.56]">
                In the meantime you can{' '}
                <Link href="/pages/track-your-order" className={blueLink}>
                  Track your order
                </Link>{' '}
                or{' '}
                <Link href="/pages/contact" className={blueLink}>
                  Contact us
                </Link>
                .
              </p>
              <button type="button" onClick={() => setSubmitted(false)} className={`mt-4 ${blueLink}`}>
                Back
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={signIn}
                className="mt-5 flex h-[50px] w-full items-center justify-center gap-1 rounded-xl bg-[#5a31f4] text-[16px] font-semibold leading-[22px] tracking-[-0.5px] text-white transition-colors hover:bg-[#4e26e0]"
              >
                Continue with
                <ShopWordmark />
              </button>
              <div className="mt-[14px] grid grid-cols-2 gap-[10px]">
                <button
                  type="button"
                  onClick={signIn}
                  aria-label="Sign in with Google"
                  className="flex h-[49px] items-center justify-center rounded-xl border border-[#dedede] bg-white hover:bg-[#fafafa]"
                >
                  <GoogleLogo />
                </button>
                <button
                  type="button"
                  onClick={signIn}
                  aria-label="Sign in with Facebook"
                  className="flex h-[49px] items-center justify-center rounded-xl border border-[#dedede] bg-white hover:bg-[#fafafa]"
                >
                  <FacebookLogo />
                </button>
              </div>

              <div className="my-[14px] flex items-center gap-[14px] text-black/[.56]" role="separator">
                <span className="h-px flex-1 bg-[#dedede]" />
                or
                <span className="h-px flex-1 bg-[#dedede]" />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) signIn();
                }}
              >
                <FloatingInput
                  id="account-email"
                  label="Email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onValueChange={setEmail}
                  className="[&>div]:focus-within:shadow-[0_0_0_1px_#005bd1,0_0_0_4px_rgba(0,91,209,.2)]"
                  trailing={
                    <button type="submit" aria-label="Continue" className="flex h-[35px] w-[34px] items-center justify-center text-black">
                      <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5" aria-hidden>
                        <path d="M1.5 7h11m0 0L8 2.5M12.5 7 8 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  }
                />
                <Checkbox id="account-newsletter" checked={newsletter} onChange={setNewsletter} className="mt-[14px]">
                  Email me with news and offers
                </Checkbox>
              </form>

              <p className="mt-5 text-center text-[12px] text-black/[.56]">
                By continuing, you agree to our{' '}
                <Link href="/pages/terms-of-use" className="underline underline-offset-2 hover:text-black">
                  Terms of service
                </Link>
              </p>
            </>
          )}
        </div>
      </main>

      <footer className="pb-5 pt-[14px] text-center">
        <Link href="/pages/privacy-policy" className="text-[14px] text-[#005bd1] hover:text-[#004cb0] hover:underline">
          Privacy policy
        </Link>
      </footer>
    </div>
  );
}
