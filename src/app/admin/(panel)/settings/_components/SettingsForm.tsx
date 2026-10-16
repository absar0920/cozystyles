'use client';

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveSettingsAction, type SettingsFormState } from '@/app/admin/actions/settings';
import type { LinkTarget } from '@/lib/links';
import { WHATSAPP_DEFAULTS, buildProductMessage, parseWhatsAppNumberInput, waLink } from '@/lib/whatsapp';
import { Field, FormError, Notice, SectionCard, TextArea, TextInput } from '@/components/admin/ui';
import { LinkPicker } from '@/components/admin/LinkPicker';
import { StickySaveBar } from '@/components/admin/StickySaveBar';
import { UnsavedChangesGuard } from '@/components/admin/UnsavedChangesGuard';
import { ExternalLinkIcon } from '@/components/admin/icons';
import type { SettingsValues } from '../_lib/fields';

const INITIAL_STATE: SettingsFormState = { ok: false };
const TEST_TEXT = 'Test message from your Cozy Furnitures website admin.';

type Key = keyof SettingsValues;

/** "923092050463" → "0309 2050463" (how Pakistanis write it) */
function displayNumber(n: string): string {
  return /^923\d{9}$/.test(n) ? `0${n.slice(2, 5)} ${n.slice(5)}` : n;
}

export function SettingsForm({ initial, targets }: { initial: SettingsValues; targets: Record<string, LinkTarget> }) {
  const start = { ...initial, whatsapp: displayNumber(initial.whatsapp) };
  const [values, setValues] = useState<SettingsValues>(start);
  const [baseline, setBaseline] = useState<SettingsValues>(start);
  const [state, formAction, pending] = useActionState(saveSettingsAction, INITIAL_STATE);
  const [origin, setOrigin] = useState('https://cozyfurnitures.pk');
  const handled = useRef<number | undefined>(undefined);
  const submitted = useRef<SettingsValues | null>(null);
  const formId = useId();
  const router = useRouter();

  useEffect(() => setOrigin(window.location.origin), []);

  // After a save: the baseline becomes what was stored (e.g. the number in its normal form). Fields still
  // holding what was submitted show the stored value; anything edited while the save ran is kept (still unsaved).
  useEffect(() => {
    if (!state.ok || !state.savedAt || state.savedAt === handled.current) return;
    handled.current = state.savedAt;
    const sent = submitted.current;
    const stored = { ...(sent ?? baseline), ...(state.values as Partial<SettingsValues>) };
    stored.whatsapp = displayNumber(stored.whatsapp);
    setBaseline(stored);
    setValues((current) => {
      if (!sent) return stored;
      const next = { ...current };
      for (const key of Object.keys(stored) as Key[]) if (current[key] === sent[key]) next[key] = stored[key];
      return next;
    });
    // re-render the admin layout so the "WhatsApp ordering is off" banner matches the saved number
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
  const fe = state.ok ? {} : state.fieldErrors ?? {};
  const set = (key: Key, v: string) => setValues((prev) => ({ ...prev, [key]: v }));
  const text = (key: Key) => ({
    id: `${formId}-${key}`,
    name: key,
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value),
  });

  const number = parseWhatsAppNumberInput(values.whatsapp);
  const numberInvalid = values.whatsapp.trim() !== '' && !number;
  const preview = buildProductMessage(
    {
      kind: 'ORDER',
      title: 'Alexa Sofa Chair',
      options: [{ name: 'Color', value: 'Maroon' }],
      quantity: 2,
      price: 45000,
      compareAtPrice: 52000,
      url: `${origin}/products/alexa-sofa-chair?variant=123`,
    },
    {
      number: number ?? '',
      greeting: values.whatsappGreeting.trim() || WHATSAPP_DEFAULTS.greeting,
      availabilityGreeting: values.whatsappAvailabilityGreeting.trim() || WHATSAPP_DEFAULTS.availabilityGreeting,
      closing: values.whatsappClosing.trim() ? values.whatsappClosing : WHATSAPP_DEFAULTS.closing,
    },
  );

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        submitted.current = values;
        startTransition(() => formAction(fd));
      }}
      className="space-y-5"
    >
      {state.ok && !dirty && <Notice tone="success">Saved. The store is updated.</Notice>}
      {!state.ok && state.error && <Notice tone="error">{state.error}</Notice>}

      {/* 1. WhatsApp ordering */}
      <SectionCard id="whatsapp" title="WhatsApp ordering" description="Customers order by sending you a WhatsApp message from the product page.">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
            <Field
              label="WhatsApp number"
              htmlFor={`${formId}-whatsapp`}
              hint="Pakistani mobile number. Customers' WhatsApp messages go here. Example: 0309 2050463."
            >
              <TextInput {...text('whatsapp')} inputMode="tel" autoComplete="tel" placeholder="0309 2050463" />
            </Field>
            <div className="md:pt-6">
              <a
                href={number ? waLink(number, TEST_TEXT) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!number}
                data-testid="whatsapp-test-link"
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-semibold ${
                  number ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50' : 'pointer-events-none border-gray-200 text-gray-300'
                }`}
              >
                Send test message
                <ExternalLinkIcon className="h-3.5 w-3.5" />
              </a>
              <p className="mt-1 max-w-[16rem] text-xs text-gray-400">Opens WhatsApp with a sample message so you can check the number works.</p>
            </div>
          </div>
          {(fe.whatsapp || numberInvalid) && <FormError message={fe.whatsapp ?? 'Enter a Pakistani mobile number like 0309 2050463.'} />}
          {values.whatsapp.trim() === '' && (
            <Notice tone="warning">Leave empty to hide all WhatsApp buttons. Customers will not be able to order until you add a number.</Notice>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <Field label="Greeting (order button)" htmlFor={`${formId}-whatsappGreeting`} hint="The first line of the message when a customer taps “Order on WhatsApp”.">
                <TextInput {...text('whatsappGreeting')} maxLength={200} showCount placeholder={WHATSAPP_DEFAULTS.greeting} />
              </Field>
              <FormError message={fe.whatsappGreeting} />
              <Field
                label="Greeting (availability button)"
                htmlFor={`${formId}-whatsappAvailabilityGreeting`}
                hint="Used instead for pre-order and sold-out items (“Ask about availability”)."
              >
                <TextInput {...text('whatsappAvailabilityGreeting')} maxLength={200} showCount placeholder={WHATSAPP_DEFAULTS.availabilityGreeting} />
              </Field>
              <FormError message={fe.whatsappAvailabilityGreeting} />
              <Field label="Closing line" htmlFor={`${formId}-whatsappClosing`} hint="Added at the end. Product details are always added automatically.">
                <TextInput {...text('whatsappClosing')} maxLength={200} showCount placeholder={WHATSAPP_DEFAULTS.closing} />
              </Field>
              <FormError message={fe.whatsappClosing} />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Example message</p>
              <div data-testid="whatsapp-preview" className="whitespace-pre-wrap break-words rounded-xl rounded-tr-sm bg-[#dcf8c6] px-4 py-3 text-sm leading-relaxed text-gray-800 shadow-sm">
                {preview}
              </div>
              <p className="mt-1 text-xs text-gray-400">What a customer sends for 2 × a sample sofa chair.</p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 2. Announcement bar */}
      <SectionCard title="Announcement bar" description="The thin dark strip at the very top of every page.">
        <div className="space-y-4">
          <Field label="Text" htmlFor={`${formId}-announcement`} hint="One short line. Leave empty to hide the bar.">
            <TextInput {...text('announcement')} maxLength={120} showCount placeholder="e.g. Save more this wedding season!" />
          </Field>
          <FormError message={fe.announcement} />
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <LinkPicker
                name="announcementHref"
                value={values.announcementHref}
                onChange={(h) => set('announcementHref', h)}
                initialTarget={targets[initial.announcementHref]}
                label="Bar link (optional)"
                hint="Where a tap on the text goes."
              />
              <FormError message={fe.announcementHref} />
            </div>
            <div>
              <Field label="Button text (optional)" htmlFor={`${formId}-announcementCta`} hint="A small red button after the text.">
                <TextInput {...text('announcementCta')} maxLength={40} placeholder="e.g. Shop Now!" />
              </Field>
            </div>
            <div>
              <LinkPicker
                name="announcementCtaHref"
                value={values.announcementCtaHref}
                onChange={(h) => set('announcementCtaHref', h)}
                initialTarget={targets[initial.announcementCtaHref]}
                label="Button link"
                hint={values.announcementCta.trim() ? 'Required when there is button text.' : 'Only used when there is button text.'}
              />
              <FormError message={fe.announcementCtaHref} />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Preview</p>
            {values.announcement.trim() ? (
              <div className="flex min-h-9 items-center justify-center gap-3 rounded-lg bg-accent px-3 py-2 text-center">
                <span className="text-[11px] tracking-[0.1em] text-cream">{values.announcement}</span>
                {values.announcementCta.trim() && (
                  <span className="whitespace-nowrap bg-maroon px-3 py-1.5 text-[12px] font-bold leading-none text-white">{values.announcementCta}</span>
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500">The bar is hidden.</p>
            )}
          </div>
        </div>
      </SectionCard>

      {/* 3. Contact details */}
      <SectionCard title="Contact details" description="Shown in the website footer.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Phone" htmlFor={`${formId}-phone`}>
            <TextInput {...text('phone')} inputMode="tel" placeholder="+92-42-111-269-926" />
          </Field>
          <div>
            <Field label="Customer care email" htmlFor={`${formId}-email`}>
              <TextInput {...text('email')} type="email" inputMode="email" placeholder="info@cozyfurnitures.pk" />
            </Field>
            <FormError message={fe.email} />
          </div>
          <div>
            <Field label="Complaints email" htmlFor={`${formId}-complaintsEmail`}>
              <TextInput {...text('complaintsEmail')} type="email" inputMode="email" placeholder="complaints@cozyfurnitures.pk" />
            </Field>
            <FormError message={fe.complaintsEmail} />
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-400">The footer shows the complaints email, or the customer care email if that is empty.</p>
        <div className="mt-4 max-w-xl">
          <Field label="Address" htmlFor={`${formId}-address`} hint="Shown in the website footer. Each line shows on its own line.">
            <TextArea {...text('address')} rows={3} placeholder={'Main Boulevard, Gulberg III\nLahore, Pakistan'} />
          </Field>
        </div>
      </SectionCard>

      {/* 4. Social links */}
      <SectionCard title="Social links" description="Icons under “Follow Us” in the footer. Leave a box empty to hide that icon.">
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ['facebook', 'Facebook', 'https://www.facebook.com/yourpage'],
              ['instagram', 'Instagram', 'https://www.instagram.com/yourpage'],
              ['youtube', 'YouTube', 'https://www.youtube.com/@yourchannel'],
              ['linkedin', 'LinkedIn', 'https://www.linkedin.com/company/yourpage'],
            ] as const
          ).map(([key, label, example]) => (
            <div key={key}>
              <LinkPicker
                name={key}
                value={values[key]}
                onChange={(h) => set(key, h)}
                label={label}
                hint={`Example: ${example}`}
                allowInternal={false}
                allowEmpty
              />
              <FormError message={fe[key]} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 5. Store rating */}
      <SectionCard title="Store rating" description="The score shown above the customer reviews on the home page.">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Field label="Store rating (out of 5)" htmlFor={`${formId}-ratingSummary`} hint="Shown next to the stars on the home page.">
              <TextInput {...text('ratingSummary')} inputMode="decimal" placeholder="4.9" className="max-w-[8rem]" />
            </Field>
            <FormError message={fe.ratingSummary} />
          </div>
          <Field label="Reviews text" htmlFor={`${formId}-ratingSummaryCount`} hint="Example: 2,500+ verified reviews.">
            <TextInput {...text('ratingSummaryCount')} placeholder="2,500+ verified reviews" />
          </Field>
        </div>
      </SectionCard>

      <UnsavedChangesGuard dirty={dirty && !pending} />
      <StickySaveBar
        dirty={dirty}
        saving={pending}
        error={!state.ok ? state.error : null}
        status={state.ok ? 'Saved' : undefined}
        actions={[
          ...(dirty ? [{ label: 'Undo changes', shortLabel: 'Undo', variant: 'secondary' as const, type: 'button' as const, onClick: () => setValues(baseline) }] : []),
          { label: 'Save settings', shortLabel: 'Save', type: 'submit', form: formId, disabled: !dirty },
        ]}
      />
    </form>
  );
}
