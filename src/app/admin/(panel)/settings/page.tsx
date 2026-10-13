import type { Metadata } from 'next';
import { getSettingsMap } from '@/lib/queries';
import { saveSettingsAction } from '@/app/admin/actions/settings';
import { AdminPageHeader, Field, TextArea, TextInput } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { CheckIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

type FieldDef = {
  key: string;
  label: string;
  hint?: string;
  type?: 'text' | 'url' | 'number' | 'textarea';
  placeholder?: string;
};

type Section = { title: string; description: string; fields: FieldDef[] };

const SECTIONS: Section[] = [
  {
    title: 'General',
    description: 'Contact details shown across the storefront header, footer and contact page.',
    fields: [
      {
        key: 'announcement',
        label: 'Announcement Bar',
        type: 'textarea',
        hint: 'Text strip shown above the site header. Leave empty to hide the bar.',
        placeholder: 'Flat 20% off on all sofas — limited time only!',
      },
      {
        key: 'phone',
        label: 'Phone',
        hint: 'Main helpline, e.g. +92-42-111-203-203',
        placeholder: '+92-42-111-203-203',
      },
      {
        key: 'whatsapp',
        label: 'WhatsApp Number',
        hint: 'Digits only with country code (no spaces or +) — powers the WhatsApp chat button.',
        placeholder: '9242111203203',
      },
      {
        key: 'email',
        label: 'Customer Care Email',
        hint: 'General enquiries email, e.g. info@interwood.pk',
        placeholder: 'info@interwood.pk',
      },
      {
        key: 'complaintsEmail',
        label: 'Complaints Email',
        hint: 'Shown on the complaints section of the contact page.',
        placeholder: 'complaints@interwood.pk',
      },
      {
        key: 'address',
        label: 'Head Office Address',
        type: 'textarea',
        hint: 'Displayed in the footer and contact page.',
        placeholder: '12-KM Ferozepur Road, Lahore, Pakistan',
      },
    ],
  },
  {
    title: 'Social Links',
    description: 'Full URLs for the social icons in the footer. Leave empty to hide an icon.',
    fields: [
      { key: 'facebook', label: 'Facebook', type: 'url', placeholder: 'https://www.facebook.com/interwood' },
      { key: 'instagram', label: 'Instagram', type: 'url', placeholder: 'https://www.instagram.com/interwood' },
      { key: 'youtube', label: 'YouTube', type: 'url', placeholder: 'https://www.youtube.com/@interwood' },
      { key: 'linkedin', label: 'LinkedIn', type: 'url', placeholder: 'https://www.linkedin.com/company/interwood' },
    ],
  },
  {
    title: 'Shipping',
    description: 'Charges applied at checkout. Prices are in PKR rupees.',
    fields: [
      {
        key: 'shippingFee',
        label: 'Shipping Fee (Rs.)',
        type: 'number',
        hint: 'Flat delivery & installation charge, e.g. 2000',
        placeholder: '2000',
      },
      {
        key: 'freeShippingThreshold',
        label: 'Free Shipping Threshold (Rs.)',
        type: 'number',
        hint: 'Orders at or above this subtotal get free delivery, e.g. 50000',
        placeholder: '50000',
      },
    ],
  },
  {
    title: 'Store Ratings',
    description: 'The rating summary highlighted on the home page.',
    fields: [
      {
        key: 'ratingSummary',
        label: 'Overall Rating',
        type: 'number',
        hint: 'Value out of 5, e.g. 4.9',
        placeholder: '4.9',
      },
      {
        key: 'ratingSummaryCount',
        label: 'Rating Count Label',
        hint: 'Human-friendly count shown next to the stars, e.g. 2,500+ happy customers',
        placeholder: '2,500+ happy customers',
      },
    ],
  },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [settings, sp] = await Promise.all([getSettingsMap(), searchParams]);
  const saved = sp.saved === '1';

  return (
    <div>
      <AdminPageHeader
        title="Settings"
        subtitle="Store-wide content and configuration — changes go live immediately"
      />

      {saved && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckIcon className="h-4 w-4 shrink-0" />
          Settings saved successfully — the storefront has been updated.
        </div>
      )}

      <form action={saveSettingsAction}>
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.title} className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <header className="border-b border-gray-100 px-5 py-3.5">
                <h2 className="font-heading text-sm font-bold text-ink-dark">{section.title}</h2>
                <p className="mt-0.5 text-xs text-gray-400">{section.description}</p>
              </header>
              <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
                {section.fields.map((f) => (
                  <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <Field label={f.label} hint={f.hint}>
                      {f.type === 'textarea' ? (
                        <TextArea name={f.key} rows={2} defaultValue={settings[f.key] ?? ''} placeholder={f.placeholder} />
                      ) : (
                        <TextInput
                          name={f.key}
                          type={f.type === 'number' ? 'number' : f.type === 'url' ? 'url' : 'text'}
                          step={f.key === 'ratingSummary' ? '0.01' : undefined}
                          min={f.type === 'number' ? 0 : undefined}
                          defaultValue={settings[f.key] ?? ''}
                          placeholder={f.placeholder}
                        />
                      )}
                    </Field>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur">
          <p className="hidden text-xs text-gray-400 sm:block">
            {SECTIONS.reduce((n, s) => n + s.fields.length, 0)} settings · saved to the database and applied site-wide
          </p>
          <SubmitButton className="px-6">Save Settings</SubmitButton>
        </div>
      </form>
    </div>
  );
}
