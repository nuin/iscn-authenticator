import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyWebhookSignature } from '$lib/server/stripe';

interface StripeEvent {
	id: string;
	type: string;
	data: { object: Record<string, unknown> };
}

/**
 * Stripe webhook endpoint.
 *
 * Always returns 2xx to Stripe except on signature/parse failure (400).
 * Idempotency is enforced via the `processed_webhook` table — repeated
 * deliveries of the same `event.id` are short-circuited.
 *
 * Handlers we care about:
 *   - checkout.session.completed   → user.plan = 'pro', store stripe_customer_id
 *   - customer.subscription.deleted → user.plan = 'free', clear plan_expires_at
 *   - invoice.payment_failed       → user.plan = 'past_due'
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform) {
		return json({ error: 'Platform not available' }, { status: 500 });
	}

	const secret = platform.env.STRIPE_WEBHOOK_SECRET;
	if (!secret) {
		console.error('STRIPE_WEBHOOK_SECRET not configured');
		return json({ error: 'Webhook secret not configured' }, { status: 500 });
	}

	const signature = request.headers.get('stripe-signature');
	const body = await request.text();

	let event: StripeEvent;
	try {
		event = await verifyWebhookSignature<StripeEvent>(body, signature, secret);
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'invalid signature';
		console.error('webhook signature rejected:', msg);
		return json({ error: 'Invalid signature' }, { status: 400 });
	}

	const db = platform.env.DB;

	// Idempotency check: if we've seen this event id before, ack and return.
	const existing = await db
		.prepare('SELECT 1 FROM processed_webhook WHERE event_id = ?')
		.bind(event.id)
		.first();
	if (existing) {
		return json({ received: true, idempotent: true });
	}

	try {
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object as {
					metadata?: { customer_id?: string };
					customer?: string;
					client_reference_id?: string;
				};
				const userId = session.metadata?.customer_id ?? session.client_reference_id;
				const stripeCustomerId = session.customer;
				if (userId && stripeCustomerId) {
					await db
						.prepare('UPDATE user SET stripe_customer_id = ?, plan = ? WHERE id = ?')
						.bind(stripeCustomerId, 'pro', userId)
						.run();
				}
				break;
			}

			case 'customer.subscription.deleted': {
				const subscription = event.data.object as { customer?: string };
				if (subscription.customer) {
					await db
						.prepare(
							"UPDATE user SET plan = 'free', plan_expires_at = NULL WHERE stripe_customer_id = ?",
						)
						.bind(subscription.customer)
						.run();
				}
				break;
			}

			case 'invoice.payment_failed': {
				const invoice = event.data.object as { customer?: string };
				if (invoice.customer) {
					await db
						.prepare("UPDATE user SET plan = 'past_due' WHERE stripe_customer_id = ?")
						.bind(invoice.customer)
						.run();
				}
				break;
			}

			default:
				// Ignored event types are still recorded as processed so Stripe stops
				// retrying them.
				break;
		}

		await db
			.prepare('INSERT INTO processed_webhook (event_id, processed_at) VALUES (?, ?)')
			.bind(event.id, Math.floor(Date.now() / 1000))
			.run();

		return json({ received: true });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : 'webhook handler error';
		console.error('webhook handler error:', msg);
		// Do NOT mark as processed -- Stripe will retry.
		return json({ error: msg }, { status: 500 });
	}
};
