import { env } from 'cloudflare:workers';
import { redirect, fail, isRedirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getCheckoutOffering } from '#lib/server/billing-availability.js';
import { CheckoutPending, createOrResumeCheckout } from '#lib/server/checkout-attempts.ts';
import {
	createBillingPortalSession,
	listCurrentSubscriptions,
} from '#lib/server/stripe.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	const offering = await getCheckoutOffering(env);
	return {
		checkoutAvailable: Boolean(offering), offering,
		portalAvailable: Boolean(env.STRIPE_SECRET_KEY?.trim() && locals.user.stripe_customer_id)
	};
};

export const actions: Actions = {
	upgrade: async ({ locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');

		const secretKey = env.STRIPE_SECRET_KEY;
		const priceId = env.STRIPE_PRICE_ID_PRO;
		const baseUrl = env.PUBLIC_BASE_URL ?? url.origin;
		if (!secretKey || !priceId || !(await getCheckoutOffering(env))) {
			return fail(503, {
				message:
					'Paid checkout is not available at the moment. Your browser workspace remains available.',
			});
		}

		try {
			let endedSubscriptions: string[] = [];
			if (locals.user.stripe_customer_id) {
				const subscriptions = await listCurrentSubscriptions(secretKey, locals.user.stripe_customer_id);
				endedSubscriptions = subscriptions.filter((item) => item.userId === locals.user!.id && ['canceled', 'incomplete_expired'].includes(item.status)).map((item) => item.id);
				if (subscriptions.some((item) => item.userId === locals.user!.id && item.prices.includes(priceId) && !['canceled', 'incomplete_expired'].includes(item.status))) {
					return fail(409, { message: 'This account already has a subscription. Use Manage subscription to update it.' });
				}
			}
			const session = await createOrResumeCheckout(env.DB, secretKey, {
				priceId,
				customerEmail: locals.user.email,
				customerId: locals.user.id,
				stripeCustomerId: locals.user.stripe_customer_id,
				successUrl: `${baseUrl}/dashboard/billing?upgrade=success`,
				cancelUrl: `${baseUrl}/dashboard/billing?upgrade=cancel`,
			}, endedSubscriptions);
			throw redirect(303, session.url, { external: true });
		} catch (err) {
			if (err instanceof CheckoutPending) return fail(409, { message: err.message });
			// SvelteKit redirects throw; let those propagate.
			if (isRedirect(err)) {
				throw err;
			}
			console.error('Checkout session creation failed.');
			return fail(502, { message: 'Could not start checkout. Try again shortly.' });
		}
	},

	manage: async ({ locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');

		const secretKey = env.STRIPE_SECRET_KEY;
		const baseUrl = env.PUBLIC_BASE_URL ?? url.origin;
		if (!secretKey?.trim()) {
			return fail(503, {
				message: 'The billing portal is not available at the moment. Please try again later.',
			});
		}
		if (!locals.user.stripe_customer_id) {
			return fail(400, {
				message: 'This account does not have a billing profile yet.',
			});
		}

		try {
			const session = await createBillingPortalSession(secretKey, {
				stripeCustomerId: locals.user.stripe_customer_id,
				returnUrl: `${baseUrl}/dashboard/billing`,
			});
			throw redirect(303, session.url, { external: true });
		} catch (err) {
			if (isRedirect(err)) {
				throw err;
			}
			console.error('Billing portal session creation failed.');
			return fail(502, { message: 'Could not open the billing portal. Try again shortly.' });
		}
	},
};
