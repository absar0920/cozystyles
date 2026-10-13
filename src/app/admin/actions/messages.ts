'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

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

  await prisma.contactSubmission.update({ where: { id }, data: { status } });
  revalidateMessages();
}

export async function deleteMessageAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;

  await prisma.contactSubmission.delete({ where: { id } });
  revalidateMessages();
}
