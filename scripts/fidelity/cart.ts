/**
 * Cart / checkout fidelity data (live interwood.pk → Cozy Furnitures).
 *
 *   npx tsx scripts/fidelity/cart.ts
 *
 * Idempotent; re-run after `npm run db:seed`. The live checkout footer lists six store policies
 * (Refund policy · Shipping · Privacy policy · Terms of service · Cancellations · Contact). The seed
 * has no page for two of them, so this upserts:
 *  - `refund-policy`: body of the live /policies/refund-policy (raw copy in
 *    data/raw/policies/refund-policy.html), rebranded like the other content pages.
 *  - `cancellations`: Shopify's standard cancellation policy text the live checkout shows.
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { innerOf, rebrandHtml } from './content';

const RAW = path.resolve(__dirname, '../..', 'data', 'raw', 'policies');

function refundPolicyBody(): string | null {
  const file = path.join(RAW, 'refund-policy.html');
  if (!existsSync(file)) return null;
  const html = readFileSync(file, 'utf8');
  const start = html.search(/<div class="rte">/);
  if (start < 0) return null;
  const body = innerOf(html, start)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(?:https?:\/\/)?(?:www\.)?interwoodmobel\.com/gi, 'www.cozyfurnitures.pk')
    .replace(/INTERWOOD MOBEL PRIVATE LIMITED/g, 'COZY FURNITURES PRIVATE LIMITED')
    .trim();
  return rebrandHtml(body);
}

const CANCELLATIONS = `<p>Some items in our store may be offered to you as a subscription, a pre-order or try before you buy. This cancellation policy lays out how you can change or cancel these kinds of purchases.</p>
<h2>Subscriptions</h2>
<p>When you purchase a subscription you'll receive repeat deliveries. These are based on the subscription duration and frequency that you select.</p>
<p>Your payment details will be stored securely and you'll be charged for each of these deliveries, unless you choose to pay in advance.</p>
<p>Some subscriptions may auto-renew at the end of their duration. If you don't want to renew a subscription you can cancel it.</p>
<p>If you want to cancel or change your subscription, you can do it at any time. Your order confirmation emails have links to your order. You can manage your subscription from there.</p>
<p>See our returns policy for more details on returns and refunds.</p>
<h2>Pre-orders</h2>
<p>When you purchase a pre-order, you are buying an out-of-stock or soon-to-be-available product not yet in inventory. We may collect no payment or a partial deposit at checkout, store your payment method, then fulfill and charge the full or remaining payment at a future date.</p>
<p>You can cancel a partially paid pre-order order that has not yet been fulfilled. If the order has been fulfilled, then you can't cancel the order, but you can request a full or partial refund. See our returns policy for more details on returns and refunds.</p>
<h2>Try before you buy</h2>
<p>When you purchase a try before you buy item, we authorize your payment method before fulfilling the order. You will have a certain amount of time to decide if you want to keep the item. Once the time period has passed, if you have not returned the item, we will charge your payment method for the full amount.</p>`;

export async function applyCartFidelity(prisma: PrismaClient) {
  const pages: { handle: string; title: string; bodyHtml: string | null }[] = [
    { handle: 'refund-policy', title: 'Refund policy', bodyHtml: refundPolicyBody() },
    { handle: 'cancellations', title: 'Cancellations', bodyHtml: CANCELLATIONS },
  ];
  let n = 0;
  for (const p of pages) {
    if (!p.bodyHtml) continue;
    await prisma.page.upsert({
      where: { handle: p.handle },
      update: { title: p.title, bodyHtml: p.bodyHtml, published: true, isBlogPost: false },
      create: { handle: p.handle, title: p.title, bodyHtml: p.bodyHtml },
    });
    n++;
  }
  console.log(`cart fidelity: ${n} policy pages upserted`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  applyCartFidelity(prisma)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
