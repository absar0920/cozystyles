'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { ALREADY_REMOVED, flashToast } from '@/components/toast/server';

const MESSAGE_STATUSES = ['NEW', 'READ', 'CLOSED'];

function revalidateMessages() {
  revalidatePath('/admin/messages');
  revalidatePath('/admin'); // dashboard "New Messages" stat + sidebar badge
}

export async function markMessageAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const id = Number(formData.get('id'));
  const status = String(formData.get('status') ?? '');
  if (!Number.isFinite(id) || !MESSAGE_STATUSES.includes(status)) return;

  // Guard: the row may have been deleted in another tab (matches the catalog.ts pattern).
  const existing = await prisma.contactSubmission.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) return await flashToast('warning', ALREADY_REMOVED);

  await prisma.contactSubmission.update({ where: { id }, data: { status } });
  revalidateMessages();
  const label = status === 'READ' ? 'read' : status === 'CLOSED' ? 'closed' : 'new';
  await flashToast('success', `Message from ${existing.name || 'a customer'} marked as ${label}`);
}

export async function deleteMessageAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;

  // Guard: already-deleted rows must not crash the action (matches the catalog.ts pattern).
  const existing = await prisma.contactSubmission.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) return await flashToast('warning', ALREADY_REMOVED);

  await prisma.contactSubmission.delete({ where: { id } });
  revalidateMessages();
  await flashToast('success', `Message from ${existing.name || 'a customer'} removed`);
}
