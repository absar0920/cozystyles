/**
 * Delivery charge rule, shared by the order API (what the customer is charged)
 * and the cart/checkout summaries (what the customer is shown).
 */
export type ShippingRule = { fee: number; freeThreshold: number };

/** Read the admin-controlled rule from SiteSetting values. */
export function shippingRuleFromSettings(settings: Record<string, string>): ShippingRule {
  return {
    fee: Math.max(0, parseInt(settings.shippingFee ?? '', 10) || 0),
    freeThreshold: Math.max(0, parseInt(settings.freeShippingThreshold ?? '', 10) || 0),
  };
}

/** Free when no threshold is configured or the subtotal reaches it; otherwise the flat fee. */
export function shippingFeeFor(subtotal: number, rule: ShippingRule): number {
  return rule.freeThreshold > 0 && subtotal < rule.freeThreshold ? rule.fee : 0;
}
