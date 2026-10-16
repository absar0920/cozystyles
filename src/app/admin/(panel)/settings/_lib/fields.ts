import type { SettingKey } from '@/app/admin/actions/settings';

/** The settings the form edits (same keys as saveSettingsAction writes). */
export const SETTINGS_FIELDS = [
  'whatsapp',
  'whatsappGreeting',
  'whatsappAvailabilityGreeting',
  'whatsappClosing',
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
  'ratingSummary',
  'ratingSummaryCount',
] as const satisfies readonly SettingKey[];

export type SettingsValues = Record<(typeof SETTINGS_FIELDS)[number], string>;
