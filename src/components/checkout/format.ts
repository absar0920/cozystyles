/** Shopify checkout money format: "Rs 33,600.00" (space, two decimals). */
export function formatCheckoutPrice(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}Rs ${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Cart note typed on /cart, prefilled into the checkout order notes (live: Shopify `cart.note`). */
export const CART_NOTE_KEY = 'iw-cart-note';

/** Variant label shown under a line title; Shopify hides the "Default Title" placeholder. */
export function variantLabel(variantTitle?: string | null): string {
  return variantTitle && variantTitle !== 'Default Title' ? variantTitle : '';
}

export type PaymentMethod = 'COD' | 'CARD' | 'INSTALLMENTS' | 'BANK_TRANSFER';

/** Checkout labels, in live order (COD first: ours, not offered on live). */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  COD: 'Cash on Delivery',
  CARD: 'Debit / Credit Card',
  INSTALLMENTS: 'Installments Plans',
  BANK_TRANSFER: 'Bank Deposit',
};

/** "Pay now" for redirect-style methods, "Complete order" for offline ones (as live). */
export function payButtonLabel(method: string): string {
  return method === 'CARD' || method === 'INSTALLMENTS' ? 'Pay now' : 'Complete order';
}

/** Blue Shopify primary button (Pay now / Complete order / Continue shopping). */
export const primaryButton =
  'flex h-[50px] w-full items-center justify-center rounded-xl bg-[#005bd1] px-6 text-[16px] font-semibold text-white transition-colors hover:bg-[#004cb0] disabled:cursor-not-allowed disabled:bg-[#f5f5f5] disabled:text-[#707070] disabled:shadow-[inset_0_0_0_1px_#dedede]';

/** Underlined #005bd1 link style used across checkout. */
export const blueLink = 'text-[#005bd1] underline underline-offset-2 hover:text-[#004cb0]';

/** Live checkout has no Province field (City + Postal code only): infer it from the city for the order record. */
const CITY_PROVINCE: Record<string, string> = {
  karachi: 'Sindh',
  hyderabad: 'Sindh',
  sukkur: 'Sindh',
  larkana: 'Sindh',
  islamabad: 'Islamabad Capital Territory',
  peshawar: 'Khyber Pakhtunkhwa',
  abbottabad: 'Khyber Pakhtunkhwa',
  mardan: 'Khyber Pakhtunkhwa',
  quetta: 'Balochistan',
  gwadar: 'Balochistan',
  gilgit: 'Gilgit-Baltistan',
  skardu: 'Gilgit-Baltistan',
  muzaffarabad: 'Azad Kashmir',
  mirpur: 'Azad Kashmir',
};

export function provinceForCity(city: string): string {
  return CITY_PROVINCE[city.trim().toLowerCase()] ?? 'Punjab';
}
