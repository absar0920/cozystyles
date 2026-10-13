'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

/** Every setting key the admin panel may write. */
const SETTING_KEYS = [
  'announcement',
  'phone',
  'email',
  'complaintsEmail',
  'whatsapp',
  'address',
  'facebook',
  'instagram',
  'youtube',
  'linkedin',
  'shippingFee',
  'freeShippingThreshold',
  'ratingSummary',
  'ratingSummaryCount',
] as const;

/** Keys stored as plain numbers (digits + optional decimal point). */
const NUMERIC_KEYS = new Set<string>(['shippingFee', 'freeShippingThreshold', 'ratingSummary']);

export async function saveSettingsAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  for (const key of SETTING_KEYS) {
    const raw = formData.get(key);
    if (raw == null) continue; // field not present in the submitted form
    let value = String(raw).trim();
    if (NUMERIC_KEYS.has(key)) {
      value = value.replace(/[^\d.]/g, '');
    }
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // Settings are read across the entire storefront (header, footer, checkout…).
  revalidatePath('/', 'layout');
  redirect('/admin/settings?saved=1');
}
