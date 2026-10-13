/**
 * Shared checkout/order validation helpers — used by /checkout (client) and
 * /api/orders (server) so both sides enforce identical rules.
 */

/** Pakistani mobile: 03XXXXXXXXX or +923XXXXXXXXX */
export const PHONE_RE = /^(?:\+92|0)3\d{9}$/;

/** Strip everything except digits. */
export function digits(s: string): string {
  return (s ?? '').replace(/\D+/g, '');
}

/** Normalize user-typed phone numbers: remove spaces, dashes, dots and parentheses. */
export function normalizePhone(s: string): string {
  return (s ?? '').replace(/[\s\-().]/g, '');
}

export type CheckoutCustomer = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  notes: string;
};

export type CheckoutLine = { productId: number; variantId: number; qty: number };

export const MAX_QTY = 99;

/** Field-level errors; keys match CheckoutCustomer (+ paymentMethod). */
export function validateCheckout(
  customer: CheckoutCustomer,
  paymentMethod: string,
  itemCount: number,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!customer.name.trim() || customer.name.trim().length < 2) errors.name = 'Please enter your full name.';
  if (!PHONE_RE.test(normalizePhone(customer.phone.trim())))
    errors.phone = 'Enter a valid Pakistani mobile number, e.g. 0300 1234567 or +923001234567.';
  if (customer.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customer.email.trim()))
    errors.email = 'Enter a valid email address.';
  if (!customer.address.trim() || customer.address.trim().length < 8)
    errors.address = 'Please enter your complete delivery address.';
  if (!customer.city.trim()) errors.city = 'Please select your city.';
  if (!customer.province.trim()) errors.province = 'Please select your province.';
  if (!paymentMethod) errors.paymentMethod = 'Please select a payment method.';
  if (itemCount <= 0) errors.items = 'Your cart is empty.';
  return errors;
}
