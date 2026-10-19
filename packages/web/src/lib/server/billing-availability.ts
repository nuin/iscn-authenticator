interface BillingConfiguration {
	STRIPE_SECRET_KEY?: string;
	STRIPE_PRICE_ID_PRO?: string;
	STRIPE_WEBHOOK_SECRET?: string;
}

export function checkoutAvailable(configuration: BillingConfiguration): boolean {
	return Boolean(
		configuration.STRIPE_SECRET_KEY?.trim() &&
		configuration.STRIPE_PRICE_ID_PRO?.trim() &&
		configuration.STRIPE_WEBHOOK_SECRET?.trim()
	);
}
