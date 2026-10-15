'use client';

import { useState } from 'react';
import { Roboto } from 'next/font/google';
import { SITE } from '@/lib/constants';
import { ThemeForm } from './ContactForm';

/** the reCAPTCHA anchor's own face (`Roboto, helvetica, arial, sans-serif`) */
const roboto = Roboto({ weight: '400', subsets: ['latin'], display: 'swap' });

/** Live /pages/lead-form: shadowed 60% card, "<brand> Information Form", 2-col floating fields, green submit. */
export function LeadForm() {
  return (
    <section>
      <div className="mx-auto w-full px-[15px] md:w-[60%] md:px-0">
        <div className="my-[45px] w-full px-[10px] py-[15px] shadow-[inset_0_0_1px_#00000026,0_0_15px_#00000026] md:my-[60px] md:p-10">
          <h4 className="mb-5 !text-[25px] md:!text-[30px]">
            <span>Cozy Furnitures</span> Information Form
          </h4>
          <p className="mb-5 leading-[1.7]">Send Us A Message</p>
          <ThemeForm
            subject="Sales"
            className="px-[7.5px] md:px-[15px]"
            submitClassName="mt-5"
            fields={[
              { name: 'name', label: 'Name', half: true },
              { name: 'email', label: 'Email', type: 'email', required: true, half: true },
              { name: 'city', label: 'City', required: true, half: true },
              { name: 'phone', label: 'Phone number', type: 'tel', half: true },
              {
                name: 'interest',
                label: 'Please Select One',
                required: true,
                options: ['Office', 'Home', 'Kitchen', 'Doors', 'Wardrobe'],
              },
            ]}
            compose={(v) => ({
              name: v.name?.trim() || 'Lead form',
              email: v.email ?? '',
              phone: v.phone ?? '',
              message: `Information/Lead form\nCity: ${v.city ?? ''}\nInterested in: ${v.interest ?? ''}`,
            })}
          />
        </div>
      </div>
    </section>
  );
}

type Status = 'idle' | 'sending' | 'sent' | 'error';

const iwInput =
  'w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-3 text-[16px] leading-[1.4] outline-none transition-[border] duration-150 placeholder:text-[#757575] focus:border-[#ff725e] focus:shadow-[0_0_0_3px_rgba(255,114,94,.15)]';
/** inputs typed `email`/`text` pick up the theme input style on live (3px radius, #dedede, 52px). */
const themeInput =
  'h-[52px] w-full rounded-btn border border-formline bg-transparent px-[22px] py-[17px] text-[13px] leading-none outline-none placeholder:text-transparent focus:border-accent';
const iwLabel = 'mb-[6px] block text-[14px] font-semibold tracking-[.02em] text-[#333]';
/** live text inputs type in #000; the textarea keeps the theme text colour */
const iwText = `${iwInput} text-black`;

/** Live /pages/support-complaint-form (custom liquid): info panel + "Submit a Complaint" card, coral submit. */
export function ComplaintForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const get = (k: string) => String(form.get(k) ?? '').trim();
    if (get('middle_name')) return; // honeypot
    setStatus('sending');
    setError('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${get('first_name')} ${get('last_name')}`.trim(),
          email: get('email'),
          phone: get('phone'),
          subject: 'Complaint',
          message: [
            `Order No.: ${get('order_no') || '—'}`,
            `City: ${get('city')}`,
            '',
            get('remarks') || '(no remarks)',
          ].join('\n'),
        }),
      });
      const data: { ok?: boolean; error?: string } = await response.json().catch(() => ({}));
      if (response.ok && data.ok) {
        setStatus('sent');
        formEl.reset();
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
      }
    } catch {
      setError('Network error — please check your connection and try again.');
      setStatus('error');
    }
  }

  const card = 'rounded-[14px] border border-line bg-white shadow-[0_6px_18px_rgba(0,0,0,.06)]';

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-[72px] pt-10">
      <div className="grid grid-cols-[1fr] gap-7 min-[960px]:grid-cols-[0.9fr_1.1fr]">
        <aside className={`${card} px-6 py-[26px]`}>
          <div className="text-[12px] uppercase tracking-[.08em] text-[#888]">Customer Care</div>
          {/* live's one-line "<brand> Complaint Form" box (54/62/72px). The longer "Cozy Furnitures" wraps,
              so its two lines share that box at half the line-height instead of doubling it. */}
          <h1 className="mb-2 mt-1 flex min-h-[54px] items-center !text-[clamp(22px,2.4vw,30px)] !font-bold !leading-[27px] md:min-h-[62px] md:!leading-[31px] lg:min-h-[72px] lg:!leading-[36px]">
            Cozy Furnitures Complaint Form
          </h1>
          <p className="mb-[14px] leading-[1.6] text-[#555]">
            Please share the basic details below. Our customer services team will review and get back to you as soon
            as possible.
          </p>
          <ul className="mb-0 mt-2 list-disc pl-[18px] leading-[1.7] text-[#444]">
            <li>
              Use your <strong className="font-medium">Order No.</strong> for faster resolution.
            </li>
            <li>
              Provide clear details in <strong className="font-medium">Remarks</strong>.
            </li>
            <li>
              We’ll update you via <strong className="font-medium">email / phone</strong>.
            </li>
          </ul>
          <div className={`${card} mt-[14px] px-[22px] py-6 [&_p]:mb-5 [&_p]:leading-[1.7]`}>
            <p>
              <strong className="font-medium">Need quick help?</strong>
            </p>
            <p>
              WhatsApp:{' '}
              <a href="https://wa.me/923458203203" target="_blank" rel="noopener noreferrer">
                92-345-820-3203
              </a>
            </p>
            <p>
              {/* live's unbreakable address is 295px wide and sets the mobile column's min-content (the cards
                  overflow a 390 viewport to 391px); the shorter local address keeps that footprint */}
              Email:{' '}
              <a href={`mailto:${SITE.complaintsEmail}`} className="inline-block min-w-[295px]">
                {SITE.complaintsEmail}
              </a>
            </p>
            <p>Hours: Mon–Sat, 09:00–17:30 (PKT)</p>
          </div>
        </aside>

        <section className={`${card} px-[22px] py-6`}>
          <h2 className="!mb-3 !text-[18px] !font-bold !leading-[48px] md:!leading-[54px] lg:!leading-[62px]">Submit a Complaint</h2>
          {status === 'sent' && (
            <p role="status" className="mb-4 text-[15px]">
              Thanks — your complaint has been submitted. Our customer services team will get back to you soon.
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className="mb-4 text-[15px] text-accent2">
              {error}
            </p>
          )}
          <form onSubmit={onSubmit} className="grid grid-cols-[1fr] gap-[14px] min-[700px]:grid-cols-2">
            <div>
              <label className={iwLabel} htmlFor="first_name">
                First Name *
              </label>
              <input className={iwText} id="first_name" name="first_name" required autoComplete="given-name" />
            </div>
            <div>
              <label className={iwLabel} htmlFor="last_name">
                Last Name *
              </label>
              <input className={iwText} id="last_name" name="last_name" required autoComplete="family-name" />
            </div>
            <div>
              <label className={iwLabel} htmlFor="order_no">
                Order No.
              </label>
              <input className={iwText} id="order_no" name="order_no" placeholder="Order ID or Document Number" />
            </div>
            <div>
              <label className={iwLabel} htmlFor="phone">
                Mobile Number *
              </label>
              <input
                className={iwText}
                id="phone"
                name="phone"
                required
                inputMode="tel"
                placeholder="+923001234567"
                pattern="^\+92\d{10}$"
                title="Format: +923001234567"
              />
              <div className="text-[12px] text-[#777]">Format: +923001234567</div>
            </div>
            <div>
              <label className={iwLabel} htmlFor="city">
                City *
              </label>
              <input className={iwText} id="city" name="city" required placeholder="e.g. Lahore, Karachi" />
            </div>
            <div>
              <label className={iwLabel} htmlFor="email">
                Email *
              </label>
              <input
                className={`${themeInput} mb-5`}
                id="email"
                name="email"
                type="email"
                required
                placeholder="name@email.com"
                autoComplete="email"
              />
            </div>
            <div className="col-span-full">
              <label className={iwLabel} htmlFor="remarks">
                Remarks
              </label>
              <textarea
                className={`${iwInput} mb-5 min-h-[120px] resize-y placeholder:text-transparent`}
                id="remarks"
                name="remarks"
                placeholder="Describe the issue in detail"
              />
            </div>
            <div className="hidden">
              <label htmlFor="middle_name">Middle name</label>
              <input type="text" id="middle_name" name="middle_name" autoComplete="off" tabIndex={-1} />
            </div>
            <div className="col-span-full mt-2">
              <HumanCheck />
            </div>
            <div className="col-span-full mt-5">
              <button
                type="submit"
                disabled={status === 'sending'}
                className="inline-flex cursor-pointer items-center justify-center rounded-[10px] border-0 bg-[#ff725e] px-[18px] py-3 font-bold leading-[17px] text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Submit
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

/**
 * Stand-in for live's reCAPTCHA v2 widget (304×78 "I'm not a robot" anchor above Submit). There are no
 * reCAPTCHA keys for this store, so it is a plain required confirmation checkbox drawn with the widget's
 * own metrics (measured inside live's anchor iframe): 28px checkbox at 13/23, Roboto 14/17 label at
 * x=53, 32px logo at 246/11 over a 10px "reCAPTCHA" caption.
 */
function HumanCheck() {
  return (
    <label
      className={`${roboto.className} relative block h-[78px] w-[304px] max-w-full cursor-pointer rounded-[3px] border border-[#d3d3d3] bg-[#f9f9f9] text-black shadow-[0_0_4px_1px_rgba(0,0,0,.08)]`}
    >
      <input
        type="checkbox"
        name="human"
        required
        className="peer absolute left-3 top-[22px] m-0 h-7 w-7 cursor-pointer appearance-none rounded-[2px] border-2 border-[#444746] bg-white checked:border-transparent checked:bg-transparent"
      />
      <svg
        aria-hidden
        viewBox="0 0 28 28"
        className="pointer-events-none absolute left-3 top-[22px] hidden h-7 w-7 peer-checked:block"
      >
        <path d="M4 15l7 7L25 6" fill="none" stroke="#009e55" strokeWidth="4" />
      </svg>
      <span className="absolute inset-y-0 left-[52px] flex items-center text-[14px] leading-[17px]">
        I&apos;m not a robot
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://www.gstatic.com/recaptcha/api2/logo_48.png"
        alt=""
        width={32}
        height={32}
        className="absolute left-[245px] top-[10px] h-8 w-8"
      />
      <span className="absolute left-[232px] top-[47px] w-[58px] text-center text-[10px] leading-[10px] text-[#555]">
        reCAPTCHA
      </span>
    </label>
  );
}

/** Live /pages/track-your-ticket: centred card with a ticket number field and a green "Check Status" button. */
export function TrackTicket() {
  const [ticket, setTicket] = useState('');
  const [message, setMessage] = useState('');

  function check() {
    const digits = ticket.trim().replace(/^HS-/i, '');
    if (!/^\d{6,}$/.test(digits)) {
      setMessage('Please enter a valid ticket number.');
      return;
    }
    setMessage('We couldn’t find a ticket with that number. Please check it and try again.');
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6">
      <div className="rounded-[14px] border border-[#e5e7eb] bg-white p-[22px] shadow-[0_8px_28px_rgba(0,0,0,.06)]">
        <h2 className="mb-[18px] mt-1 text-center !text-[clamp(24px,3vw,34px)] !font-bold !leading-[48px] !text-[#12a150] md:!leading-[54px] lg:!leading-[62px]">
          Track Your Ticket
        </h2>
        <div>
          <label className="mb-[6px] mt-[10px] block text-[13px] font-bold leading-[1.75] tracking-[.02em] text-[#1f2937]" htmlFor="iw-ticket">
            Ticket Number *
          </label>
          <input
            id="iw-ticket"
            type="text"
            required
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && check()}
            placeholder="HS-178320956117 or 178320956117"
            className={`${themeInput} mb-5`}
          />
        </div>
        <button
          type="button"
          onClick={check}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#12a150] px-[18px] py-3 font-bold leading-[1.0] text-white hover:bg-[#0d7e3e]"
        >
          Check Status
        </button>
        <div aria-live="polite" className="mt-[10px] min-h-[18px] text-center text-[13px] text-[#6b7280]">
          {message}
        </div>
      </div>
    </div>
  );
}
