interface BillingConfiguration {
	BILLING_CHECKOUT_ENABLED?: string;
	STRIPE_SECRET_KEY?: string;
	STRIPE_PRICE_ID_PRO?: string;
	STRIPE_WEBHOOK_SECRET?: string;
}

export function checkoutAvailable(configuration: BillingConfiguration): boolean {
	return Boolean(
		configuration.BILLING_CHECKOUT_ENABLED === 'true' &&
		configuration.STRIPE_SECRET_KEY?.trim() &&
		configuration.STRIPE_PRICE_ID_PRO?.trim() &&
		configuration.STRIPE_WEBHOOK_SECRET?.trim()
	);
}
import { getApiOffering } from './api-offering.ts';


export async function getCheckoutOffering(configuration: BillingConfiguration) {
  if (!checkoutAvailable(configuration)) return null;
  try {
    const offering = await getApiOffering(configuration.STRIPE_SECRET_KEY!, configuration.STRIPE_PRICE_ID_PRO!);
    if (!offering) return null;
    const zeroDecimal = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
    const threeDecimal = new Set(['bhd', 'jod', 'kwd', 'omr', 'tnd']);
    const decimals = zeroDecimal.has(offering.currency) ? 0 : threeDecimal.has(offering.currency) ? 3 : 2;
    const displayPrice = `${offering.currency.toUpperCase()} ${(offering.amount / 10 ** decimals).toFixed(decimals)}`;
    return { ...offering, displayPrice };
  } catch {
    console.error('Configured API offering could not be verified; checkout unavailable.');
    return null;
  }
}
