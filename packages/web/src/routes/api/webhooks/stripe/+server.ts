import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform) {
		return json({ error: 'Platform not available' }, { status: 500 });
	}

	const signature = request.headers.get('stripe-signature');
	const secret = platform.env.STRIPE_WEBHOOK_SECRET;

	if (!signature || !secret) {
		return json({ error: 'Unauthorized' }, { status: 400 });
	}

	const body = await request.text();

	// In a real app, you'd use the stripe library to verify the signature:
	// const event = stripe.webhooks.constructEvent(body, signature, secret);
	// For now, we'll implement the logic based on the event type.

	let event;
	try {
		event = JSON.parse(body);
	} catch (err) {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const db = platform.env.DB;

	// Idempotency check
	const existing = await db
		.prepare('SELECT 1 FROM processed_webhook WHERE event_id = ?')
		.bind(event.id)
		.first();
	if (existing) {
		return json({ received: true });
	}

	try {
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object;
				const customerId = session.metadata?.customer_id;
				const stripeCustomerId = session.customer;

				if (customerId) {
					await db
						.prepare('UPDATE user SET stripe_customer_id = ?, plan = ? WHERE id = ?')
						.bind(stripeCustomerId, 'pro', customerId)
						.run();
				}
				break;
			}

			case 'customer.subscription.deleted': {
				const subscription = event.data.object;
				const stripeCustomerId = subscription.customer;
				await db
					.prepare("UPDATE user SET plan = 'canceled' WHERE stripe_customer_id = ?")
					.bind(stripeCustomerId)
					.run();
				break;
			}
		}

		// Mark as processed
		await db
			.prepare('INSERT INTO processed_webhook (event_id, processed_at) VALUES (?, ?)')
			.bind(event.id, Math.floor(Date.now() / 1000))
			.run();

		return json({ received: true });
	} catch (err: any) {
		console.error('Webhook error:', err);
		return json({ error: err.message }, { status: 500 });
	}
};
