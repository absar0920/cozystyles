import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { adminRoutes } from '../helpers/admin-routes';

/**
 * SPEC §8.2 #7 / decision 18: nowhere in the admin does the owner type a URL, HTML, JSON or a position number.
 * Every admin screen is opened and scanned; the only typed web addresses allowed live inside a LinkPicker
 * ("Custom web address" and the social profile links).
 */

const prisma = new PrismaClient();
test.afterAll(async () => {
  await prisma.$disconnect();
});

/** Runs in the page: returns one human-readable line per violation. */
function scan(): string[] {
  const out: string[] = [];
  const visible = (el: Element) => {
    const s = getComputedStyle(el);
    return (el as HTMLElement).getClientRects().length > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const inPicker = (el: Element) => !!el.closest('[data-testid=link-picker], [data-testid=link-picker-popover]');
  const describe = (el: Element) => {
    const id = el.getAttribute('id');
    const label = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim()) || el.getAttribute('aria-label') || '';
    return `${el.tagName.toLowerCase()}[name=${el.getAttribute('name') ?? ''}] "${label}"`;
  };

  for (const el of Array.from(document.querySelectorAll('input[type=url]'))) {
    if (!inPicker(el)) out.push(`url input: ${describe(el)}`);
  }
  for (const el of Array.from(document.querySelectorAll('textarea'))) {
    if (!visible(el)) continue;
    const name = el.getAttribute('name') ?? '';
    if (name === 'address' || name === 'seoDescription' || el.hasAttribute('readonly')) continue;
    // plain prose (icon texts, customer quotes): allowed, but never markup or JSON
    if (el.hasAttribute('data-plain-text')) {
      if (/^\s*(<[a-z!][\s\S]*>|\{[\s\S]*\}|\[[\s\S]*\])\s*$/i.test((el as HTMLTextAreaElement).value)) out.push(`markup in plain text: ${describe(el)}`);
      continue;
    }
    out.push(`textarea: ${describe(el)}`);
  }
  const typedLooking = /^(\/|https?:|\{|\[)/i;
  const markupOrJson = /^\s*(<[a-z!][\s\S]*>|\{[\s\S]*\}|\[[\s\S]*\])\s*$/i;
  for (const el of Array.from(document.querySelectorAll<HTMLInputElement>('input:not([type=hidden]):not([type=file])'))) {
    if (!visible(el) || inPicker(el)) continue;
    const ph = el.getAttribute('placeholder') ?? '';
    const v = el.value ?? '';
    if (typedLooking.test(ph) || typedLooking.test(v) || markupOrJson.test(v)) out.push(`typed-looking input: ${describe(el)} placeholder="${ph}" value="${v.slice(0, 60)}"`);
  }
  const banned = /json|html|handle|position|compare-at|metafield|badge/i;
  for (const el of Array.from(document.querySelectorAll('label, legend'))) {
    if (!visible(el)) continue;
    const text = (el as HTMLElement).innerText.trim();
    if ((banned.test(text) || /\b(ratio|class(name)?|hex)\b/i.test(text)) && !/^web address/i.test(text)) out.push(`label: "${text.slice(0, 80)}"`);
  }
  for (const el of Array.from(document.querySelectorAll('input[type=number]'))) {
    if (/position/i.test(describe(el))) out.push(`position number: ${describe(el)}`);
  }
  return out;
}

test('no admin screen asks for a typed URL, HTML, JSON or position', async ({ page }) => {
  test.setTimeout(240_000);
  const problems: string[] = [];
  for (const r of await adminRoutes(prisma)) {
    const res = await page.goto(r.path);
    expect(res?.status(), r.name).toBe(200);
    await page.waitForLoadState('networkidle');
    if (r.prepare) await r.prepare(page);
    for (const p of await page.evaluate(scan)) problems.push(`${r.name} (${r.path}): ${p}`);
  }
  expect(problems).toEqual([]);
});
