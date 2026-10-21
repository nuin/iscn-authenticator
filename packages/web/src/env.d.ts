declare namespace Cloudflare {
	interface Env {
		EMAIL_AUTH_SECRET?: string;
		AXIOM_API_TOKEN?: string;
		AXIOM_DATASET?: string;
		STRIPE_SECRET_KEY?: string;
		STRIPE_WEBHOOK_SECRET?: string;
		STRIPE_PRICE_ID_PRO?: string;
		PUBLIC_BASE_URL?: string;
	}
}
