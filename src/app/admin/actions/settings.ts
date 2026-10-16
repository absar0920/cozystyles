'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { normalizeHref, validateHref } from '@/lib/links';
import { parseWhatsAppNumberInput } from '@/lib/whatsapp';

/** Store settings (SPEC §5.6). */

export type SettingKey =
  | 'announcement'
  | 'announcementHref'
  | 'announcementCta'
  | 'announcementCtaHref'
  | 'phone'
  | 'email'
  | 'complaintsEmail'
  | 'address'
  | 'facebook'
  | 'instagram'
  | 'youtube'
  | 'linkedin'
  | 'whatsapp'
  | 'whatsappGreeting'
  | 'whatsappAvailabilityGreeting'
  | 'whatsappClosing'
  | 'ratingSummary'
  | 'ratingSummaryCount';

export type SettingsFormState = {
  ok: boolean;
  savedAt?: number;
  error?: string | null;
  fieldErrors?: Partial<Record<SettingKey, string>>;
  /** what was stored (after normalising), so the form can show it */
  values?: Partial<Record<SettingKey, string>>;
};

/** Every setting key the admin panel may write (plain const: 'use server' files export only async functions). */
const SETTING_KEYS: SettingKey[] = [
  'announcement',
  'announcementHref',
  'announcementCta',
  'announcementCtaHref',
  'phone',
  'email',
  'complaintsEmail',
  'address',
  'facebook',
  'instagram',
  'youtube',
  'linkedin',
  'whatsapp',
  'whatsappGreeting',
  'whatsappAvailabilityGreeting',
  'whatsappClosing',
  'ratingSummary',
  'ratingSummaryCount',
];

const SOCIAL_HOSTS: Record<'facebook' | 'instagram' | 'youtube' | 'linkedin', { name: string; hosts: string[] }> = {
  facebook: { name: 'Facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'] },
  instagram: { name: 'Instagram', hosts: ['instagram.com', 'instagr.am'] },
  youtube: { name: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  linkedin: { name: 'LinkedIn', hosts: ['linkedin.com'] },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const oneLine = (v: string) => v.replace(/[\r\n\t]+/g, ' ');

export async function saveSettingsAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireAdmin();

  const raw = (key: SettingKey) => String(formData.get(key) ?? '');
  const v: Partial<Record<SettingKey, string>> = {};
  const fe: Partial<Record<SettingKey, string>> = {};

  // WhatsApp
  const wa = raw('whatsapp').trim();
  if (wa) {
    const n = parseWhatsAppNumberInput(wa);
    if (n) v.whatsapp = n;
    else fe.whatsapp = 'Enter a Pakistani mobile number like 0309 2050463.';
  } else v.whatsapp = '';
  for (const key of ['whatsappGreeting', 'whatsappAvailabilityGreeting'] as const) {
    v[key] = oneLine(raw(key)).trim();
    if (v[key]!.length > 200) fe[key] = 'Keep it under 200 characters.';
  }
  // the closing line keeps its trailing space: the customer types their city right after it
  v.whatsappClosing = oneLine(raw('whatsappClosing')).replace(/^\s+/, '');
  if (v.whatsappClosing.trim() === '') v.whatsappClosing = '';
  if (v.whatsappClosing.length > 200) fe.whatsappClosing = 'Keep it under 200 characters.';

  // Announcement bar
  v.announcement = oneLine(raw('announcement')).trim();
  if (v.announcement.length > 120) fe.announcement = 'Keep it under 120 characters so it fits on one line.';
  v.announcementCta = oneLine(raw('announcementCta')).trim().slice(0, 40);
  for (const key of ['announcementHref', 'announcementCtaHref'] as const) {
    v[key] = normalizeHref(raw(key));
    const err = validateHref(v[key]!, { allowEmpty: true });
    if (err) fe[key] = err;
  }
  if (v.announcementCta && !v.announcementCtaHref) fe.announcementCtaHref = 'Choose where the button goes, or clear the button text.';

  // Contact details
  v.phone = oneLine(raw('phone')).trim().slice(0, 40);
  for (const key of ['email', 'complaintsEmail'] as const) {
    v[key] = raw(key).trim();
    if (v[key] && !EMAIL.test(v[key]!)) fe[key] = 'That email address is not valid.';
  }
  v.address = raw('address')
    .replace(/<[^>]*>/g, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 400);

  // Social links: full web addresses on the right site
  for (const key of ['facebook', 'instagram', 'youtube', 'linkedin'] as const) {
    let url = raw(key).trim();
    if (url && !/^https?:\/\//i.test(url) && /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url)) url = `https://${url}`;
    v[key] = url;
    if (!url) continue;
    const err = validateHref(url, { allowEmpty: true, allowInternal: false, allowExternal: true });
    if (err || !/^https?:\/\//i.test(url)) {
      fe[key] = err ?? 'Please enter a full web address starting with https://';
      continue;
    }
    const host = new URL(url).hostname.toLowerCase().replace(/^www\.|^m\./, '');
    const { name, hosts } = SOCIAL_HOSTS[key];
    if (!hosts.some((h) => host === h || host.endsWith(`.${h}`))) fe[key] = `This doesn't look like a ${name} address.`;
  }

  // Store rating
  const rating = raw('ratingSummary').trim().replace(',', '.');
  if (rating === '') v.ratingSummary = '';
  else if (!/^\d(\.\d{1,2})?$/.test(rating) || Number(rating) > 5) fe.ratingSummary = 'Enter a number from 0 to 5, like 4.9.';
  else v.ratingSummary = rating;
  v.ratingSummaryCount = oneLine(raw('ratingSummaryCount')).trim().slice(0, 60);

  if (Object.keys(fe).length) {
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: fe };
  }

  await prisma.$transaction(
    SETTING_KEYS.map((key) =>
      prisma.siteSetting.upsert({ where: { key }, update: { value: v[key] ?? '' }, create: { key, value: v[key] ?? '' } }),
    ),
  );

  // Buttons, the bubble, the announcement bar, the footer and the admin's WhatsApp warning all read settings.
  revalidatePath('/', 'layout');
  revalidatePath('/admin', 'layout');
  return { ok: true, savedAt: Date.now(), values: v };
}
