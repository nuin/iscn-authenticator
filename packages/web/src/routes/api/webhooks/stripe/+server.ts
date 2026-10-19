import { env } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyBillingEvent } from '#lib/server/billing-state.js';
import { parseBillingEvent, type BillingEvent } from '#lib/server/stripe-events.js';
import { verifyWebhookSignature } from '#lib/server/stripe.js';

export const POST: RequestHandler = async ({ request }) => {
  const secret = env.STRIPE_WEBHOOK_SECRET?.trim();
  const apiKey = env.STRIPE_SECRET_KEY?.trim();
  const priceId = env.STRIPE_PRICE_ID_PRO?.trim();
  if (!secret || !apiKey || !priceId || !env.DB) {
    return json({ error: 'Billing is temporarily unavailable' }, { status: 503 });
  }
  let event: BillingEvent;
  try {
    const payload = await verifyWebhookSignature(await request.text(), request.headers.get('stripe-signature'), secret);
    event = parseBillingEvent(payload);
  } catch {
    return json({ error: 'Invalid webhook payload or signature' }, { status: 400 });
  }
  try {
    await applyBillingEvent(env.DB, event, apiKey, priceId);
    return json({ received: true });
  } catch {
    console.error('Billing webhook processing failed', { eventId: event.id });
    return json({ error: 'Webhook processing failed; retry delivery' }, { status: 500 });
  }
};
