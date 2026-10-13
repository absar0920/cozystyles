/** Format integer PKR as "Rs. 84,000" */
export function formatPKR(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const n = Math.abs(Math.round(amount));
  const s = n.toString();
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return `${sign}Rs. ${out}`;
}

export function discountPercent(price: number, compareAt?: number | null): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
