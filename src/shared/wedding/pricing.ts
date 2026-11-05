import pricingConfig from '../../config/wedding-pricing.json' with { type: 'json' };

/** All storefront copy and checkout amounts derive from this USD config. */
export function createWeddingPackPricing(config = pricingConfig) {
  const cents = (value: number) => {
    const amount = Math.round(value * 100);
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      Math.abs(amount / 100 - value) > 1e-8
    ) {
      throw new Error(
        'Wedding prices must be positive USD amounts with at most two decimal places'
      );
    }
    return amount;
  };
  const amount = cents(config.priceUsd);
  const originalAmount = cents(config.originalPriceUsd);
  const savingsAmount = Math.max(0, originalAmount - amount);
  return {
    amount,
    currency: 'USD',
    price: `$${amount / 100}`,
    originalPrice: savingsAmount > 0 ? `$${originalAmount / 100}` : '',
    savings: `$${savingsAmount / 100}`,
    discountPercent: Math.round((savingsAmount / originalAmount) * 100),
  };
}

export const WEDDING_PACK_PRICING = createWeddingPackPricing();

/** Pure transformation; never mutate cached locale JSON or unrelated products. */
export function applyWeddingPricing(
  path: string,
  messages: unknown,
  pricing = WEDDING_PACK_PRICING
): any {
  if (path !== 'pages/pricing' && path !== 'pages/design') return messages;
  const replacements: Record<string, string> = {
    __WEDDING_PRICE__: pricing.price,
    __WEDDING_ORIGINAL_PRICE__: pricing.originalPrice,
    __WEDDING_SAVINGS__: pricing.savings,
    __WEDDING_DISCOUNT__: String(pricing.discountPercent),
  };
  const replace = (value: any): any => {
    if (typeof value === 'string') {
      return value.replace(
        /__WEDDING_\w+__/g,
        (token) => replacements[token] ?? token
      );
    }
    if (Array.isArray(value)) return value.map(replace);
    if (!value || typeof value !== 'object') return value;
    const result = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replace(item)])
    );
    if (result.product_id === 'wedding_identity_pack') {
      Object.assign(result, {
        amount: pricing.amount,
        currency: pricing.currency,
        price: pricing.price,
        original_price: pricing.originalPrice,
      });
      // No sale messaging when the current price reaches/exceeds the reference.
      if (!pricing.originalPrice && typeof result.tip === 'string') {
        result.tip = result.tip.split(' · ').slice(1).join(' · ');
        result.label = '';
      }
    }
    return result;
  };
  const result = replace(messages);
  if (path === 'pages/design' && !pricing.originalPrice) {
    result.unlock_offer = '';
    result.unlock_savings = '';
  }
  return result;
}
