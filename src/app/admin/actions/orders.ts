'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { ORDER_STATUSES } from '@/lib/constants';

/** Flush every admin surface that reads orders (list, detail, dashboard counters). */
function revalidateOrders(id?: number) {
  revalidatePath('/admin/orders');
  revalidatePath('/admin'); // dashboard stats + sidebar pending badge
  if (id != null) revalidatePath(`/admin/orders/${id}`);
}

/** Update status and/or internal admin notes for one order. */
export async function updateOrderAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;

  const existing = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return;

  const data: { status?: string; adminNotes?: string } = {};

  const status = String(formData.get('status') ?? '');
  if ((ORDER_STATUSES as readonly string[]).includes(status)) data.status = status;

  if (formData.has('adminNotes')) data.adminNotes = String(formData.get('adminNotes') ?? '');

  if (Object.keys(data).length === 0) return;

  await prisma.order.update({ where: { id }, data });
  revalidateOrders(id);
}

/** Quick status change from the orders list. */
export async function setOrderStatusAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const id = Number(formData.get('id'));
  const status = String(formData.get('status') ?? '');
  if (!Number.isFinite(id) || !(ORDER_STATUSES as readonly string[]).includes(status)) return;

  const existing = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return;

  await prisma.order.update({ where: { id }, data: { status } });
  revalidateOrders(id);
}

/** Permanently delete an order (its line items cascade). */
export async function deleteOrderAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;

  const existing = await prisma.order.findUnique({ where: { id }, select: { orderNumber: true } });
  if (!existing) redirect('/admin/orders');

  await prisma.order.delete({ where: { id } });
  revalidateOrders();
  redirect(`/admin/orders?deleted=${encodeURIComponent(existing.orderNumber)}`);
}
