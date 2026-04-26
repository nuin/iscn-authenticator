import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	createBillingPortalSession,
	createCheckoutSession,
} from '$lib/server/stripe';

export const load: PageServerLoad = async ({ locals }) => {
	// Session verified in +layout.server.ts
	if (!locals.user) throw redirect(302, '/login');
	return {};
};

/**
 * Resolve the Pro pricing → checkout flow and the Billing Portal flow.
 *
 * Both actions require the platform's Stripe env vars; if they're missing
 * (e.g. local dev without secrets configured) we return a `fail(503)` with
 * an actionable message instead of throwing.
 */
export const actions: Actions = {
	upgrade: async ({ locals, platform, url }) => {
		if (!locals.user || !platform) throw redirect(302, '/login');

		const secretKey = platform.env.STRIPE_SECRET_KEY;
		const priceId = platform.env.STRIPE_PRICE_ID_PRO;
		const baseUrl = platform.env.PUBLIC_BASE_URL ?? url.origin;
		if (!secretKey || !priceId) {
			return fail(503, {
				message:
					'Billing is not configured: STRIPE_SECRET_KEY and STRIPE_PRICE_ID_PRO must be set.',
			});
		}

		try {
			const session = await createCheckoutSession(secretKey, {
				priceId,
				customerEmail: locals.user.email,
				customerId: locals.user.id,
				stripeCustomerId: locals.user.stripe_customer_id,
				successUrl: `${baseUrl}/dashboard/billing?upgrade=success`,
				cancelUrl: `${baseUrl}/dashboard/billing?upgrade=cancel`,
			});
			throw redirect(303, session.url);
		} catch (err) {
			// SvelteKit redirects throw; let those propagate.
			if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
				throw err;
			}
			console.error('checkout session creation failed:', err);
			return fail(502, { message: 'Could not start checkout. Try again shortly.' });
		}
	},

	manage: async ({ locals, platform, url }) => {
		if (!locals.user || !platform) throw redirect(302, '/login');

		const secretKey = platform.env.STRIPE_SECRET_KEY;
		const baseUrl = platform.env.PUBLIC_BASE_URL ?? url.origin;
		if (!secretKey) {
			return fail(503, {
				message: 'Billing is not configured: STRIPE_SECRET_KEY must be set.',
			});
		}
		if (!locals.user.stripe_customer_id) {
			return fail(400, {
				message: 'No Stripe customer on file yet. Upgrade to Pro first.',
			});
		}

		try {
			const session = await createBillingPortalSession(secretKey, {
				stripeCustomerId: locals.user.stripe_customer_id,
				returnUrl: `${baseUrl}/dashboard/billing`,
			});
			throw redirect(303, session.url);
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
				throw err;
			}
			console.error('billing portal session creation failed:', err);
			return fail(502, { message: 'Could not open the billing portal. Try again shortly.' });
		}
	},
};
