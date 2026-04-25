// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: import('./lib/server/db').Session | null;
			user: import('./lib/server/db').User | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				KV: KVNamespace;
				BUCKET: R2Bucket;
				AXIOM_API_TOKEN?: string;
				AXIOM_DATASET?: string;
				STRIPE_SECRET_KEY?: string;
				STRIPE_WEBHOOK_SECRET?: string;
				STRIPE_PRICE_ID_PRO?: string;
				PUBLIC_BASE_URL?: string;
			};
			context: {
				waitUntil(promise: Promise<any>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
