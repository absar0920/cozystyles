import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { formatPKR } from '@/lib/money';
import { ORDER_STATUSES, PAYMENT_METHODS } from '@/lib/constants';
import { updateOrderAction, deleteOrderAction } from '@/app/admin/actions/orders';
import { AdminCard, AdminPageHeader, Badge, Field, Select, TextArea } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { ChevronLeft, MailIcon, MapPinIcon, PackageIcon, PhoneIcon, TruckIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order details',
  robots: { index: false, follow: false },
};

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDateTime = (d: Date) =>
  `${new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })} · ${new Date(d).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })}`;

const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) notFound();

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) notFound();

  // Resolve storefront handles for the ordered products so admins can jump to the product page.
  const productIds = [...new Set(order.items.map((i) => i.productId).filter((v): v is number => v != null))];
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, handle: true } })
    : [];
  const handleFor = new Map(products.map((p) => [p.id, p.handle]));

  const payment = PAYMENT_METHODS.find((m) => m.value === order.paymentMethod);
  const totalQty = order.items.reduce((n, i) => n + i.quantity, 0);
  const created = new Date(order.createdAt);
  const updated = new Date(order.updatedAt);

  return (
    <div>
      <Link href="/admin/orders" className={`${ghostBtn} mb-4`}>
        <ChevronLeft className="h-3.5 w-3.5" /> All orders
      </Link>

      <AdminPageHeader
        title={order.orderNumber}
        subtitle={`Placed ${fmtDate(created)} · ${order.items.length} item${order.items.length === 1 ? '' : 's'} (${totalQty} pcs) · ${formatPKR(order.total)}`}
        actions={
          <>
            <Badge>{order.status}</Badge>
            <details className="relative inline-block text-left">
              <summary className="inline-flex cursor-pointer select-none items-center rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 [&::-webkit-details-marker]:hidden">
                Delete
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                <p className="text-sm font-semibold text-ink-dark">Delete {order.orderNumber}?</p>
                <p className="mt-1 text-xs text-gray-500">
                  This permanently removes the order and its {order.items.length} line item
                  {order.items.length === 1 ? '' : 's'}. This cannot be undone.
                </p>
                <form action={deleteOrderAction} className="mt-3">
                  <input type="hidden" name="id" value={order.id} />
                  <button
                    type="submit"
                    className="w-full rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    Yes, delete permanently
                  </button>
                </form>
              </div>
            </details>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ------------------------------------------------ left: items + management */}
        <div className="space-y-6 lg:col-span-2">
          <AdminCard title={`Items (${order.items.length})`}>
            {order.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">This order has no line items.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {order.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                      {item.image ? (
                        <img src={item.image} alt="" width={64} height={64} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-gray-300">
                          <PackageIcon className="h-6 w-6" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-heading text-sm font-bold text-ink-dark">{item.title}</p>
                      {item.variantTitle && item.variantTitle !== 'Default Title' && (
                        <p className="mt-0.5 text-xs text-gray-500">{item.variantTitle}</p>
                      )}
                      {item.productId != null && handleFor.has(item.productId) && (
                        <Link
                          href={`/products/${handleFor.get(item.productId)}`}
                          className="mt-1 inline-block text-xs text-brand hover:underline"
                        >
                          View product →
                        </Link>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="whitespace-nowrap text-sm text-ink">
                        {formatPKR(item.price)} <span className="text-gray-400">×</span>{' '}
                        <span className="font-semibold">{item.quantity}</span>
                      </p>
                      <p className="whitespace-nowrap font-heading text-sm font-bold text-ink-dark">
                        {formatPKR(item.price * item.quantity)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard title="Status & internal notes">
            <form action={updateOrderAction} className="space-y-4">
              <input type="hidden" name="id" value={order.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Order status" hint="The customer sees this when tracking their order.">
                  <Select name="status" defaultValue={order.status}>
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex items-end">
                  <p className="text-xs text-gray-400">
                    Last updated {fmtDateTime(updated)}
                    <br />
                    Placed {fmtDateTime(created)}
                  </p>
                </div>
              </div>
              <Field label="Admin notes" hint="Internal only — never shown to the customer.">
                <TextArea
                  name="adminNotes"
                  rows={5}
                  defaultValue={order.adminNotes}
                  placeholder="e.g. Customer requested delivery after 6pm. Confirmed on WhatsApp."
                />
              </Field>
              <div className="flex justify-end">
                <SubmitButton>Save changes</SubmitButton>
              </div>
            </form>
          </AdminCard>
        </div>

        {/* ------------------------------------------------ right: customer + totals */}
        <div className="space-y-6">
          <AdminCard title="Customer">
            <div className="space-y-4">
              <div>
                <p className="font-heading text-base font-bold text-ink-dark">{order.customerName}</p>
                <div className="mt-2 space-y-1.5 text-sm">
                  <a href={`tel:${order.phone}`} className="flex items-center gap-2 text-ink hover:text-brand">
                    <PhoneIcon className="h-4 w-4 shrink-0 text-gray-400" />
                    {order.phone}
                  </a>
                  {order.email && (
                    <a href={`mailto:${order.email}`} className="flex items-center gap-2 break-all text-ink hover:text-brand">
                      <MailIcon className="h-4 w-4 shrink-0 text-gray-400" />
                      {order.email}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex gap-2 rounded-lg bg-gray-50 p-3 text-sm text-ink">
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div>
                  <p>{order.address}</p>
                  <p className="text-gray-500">
                    {order.city}
                    {order.province ? `, ${order.province}` : ''}
                  </p>
                </div>
              </div>
              {order.notes && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Customer notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{order.notes}</p>
                </div>
              )}
            </div>
          </AdminCard>

          <AdminCard title="Payment">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand">
                <TruckIcon className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="font-heading text-sm font-bold text-ink-dark">{payment?.label ?? order.paymentMethod}</p>
                <p className="mt-0.5 text-xs text-gray-500">{payment?.note ?? 'Payment method on file for this order.'}</p>
              </div>
            </div>
          </AdminCard>

          <AdminCard title="Totals">
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Subtotal</dt>
                <dd className="font-medium text-ink-dark">{formatPKR(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">Discount</dt>
                  <dd className="font-medium text-emerald-700">−{formatPKR(order.discount)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Delivery</dt>
                <dd className="font-medium text-ink-dark">
                  {order.shippingFee > 0 ? formatPKR(order.shippingFee) : 'Free'}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                <dt className="font-heading font-bold text-ink-dark">Total</dt>
                <dd className="font-heading text-lg font-bold text-brand-700">{formatPKR(order.total)}</dd>
              </div>
            </dl>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
