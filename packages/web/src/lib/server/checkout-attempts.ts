import { createCheckoutSession } from '#lib/server/stripe.js';
import { STRIPE_API, stripeHeaders } from './stripe-config.ts';
import { stripeId, stripeObject } from './stripe-events.ts';

type CheckoutParameters = Omit<Parameters<typeof createCheckoutSession>[1], 'idempotencyKey'>;
interface Attempt { id: string; created_at: number; parameters: string; stripe_session_id: string | null }

export class CheckoutPending extends Error {}

async function retrieveSession(secret: string, id: string) {
  const response = await fetch(`${STRIPE_API}/checkout/sessions/${stripeId(id, 'cs_')}`, {
    headers: stripeHeaders(secret), signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Checkout lookup failed');
  const session = stripeObject(await response.json());
  if (session.object !== 'checkout.session' || session.id !== id || session.mode !== 'subscription') {
    throw new Error('Invalid checkout session');
  }
  return session;
}

function usableSession(value: { id: unknown; url: unknown }) {
  const id = stripeId(value.id, 'cs_');
  if (typeof value.url !== 'string' || new URL(value.url).protocol !== 'https:') throw new Error('Checkout URL unavailable');
  return { id, url: value.url };
}

export async function createOrResumeCheckout(db: D1Database, secret: string, args: CheckoutParameters, endedSubscriptions: string[] = []) {
  for (let retry = 0; retry < 2; retry++) {
    const now = Math.floor(Date.now() / 1000);
    await db.prepare(`INSERT OR IGNORE INTO api_checkout_attempt (user_id, id, created_at, parameters)
      VALUES (?, ?, ?, ?)`)
      .bind(args.customerId, crypto.randomUUID(), now, JSON.stringify(args)).run();
    const attempt = await db.prepare('SELECT * FROM api_checkout_attempt WHERE user_id = ?')
      .bind(args.customerId).first<Attempt>();
    if (!attempt) throw new Error('Checkout reservation unavailable');
    const parameters = JSON.parse(attempt.parameters) as CheckoutParameters;
    if (attempt.stripe_session_id) {
      const session = await retrieveSession(secret, attempt.stripe_session_id);
      const ended = session.status === 'complete' && session.subscription != null &&
        endedSubscriptions.includes(stripeId(session.subscription, 'sub_'));
      if (session.status === 'expired' || ended) {
        await db.prepare('DELETE FROM api_checkout_attempt WHERE user_id = ? AND id = ?')
          .bind(args.customerId, attempt.id).run();
        continue;
      }
      if (session.status === 'complete') throw new CheckoutPending('Checkout already completed. Check Billing for payment confirmation or manage your subscription.');
      if (session.status !== 'open') throw new Error('Unknown checkout state');
      if (parameters.priceId !== args.priceId) throw new CheckoutPending('An earlier checkout uses a different price. Let it expire before starting a new checkout.');
      return usableSession({ id: session.id, url: session.url });
    }
    if (attempt.created_at + 23 * 3600 <= now) {
      throw new CheckoutPending('An earlier checkout attempt needs billing reconciliation before another can be started.');
    }
    if (parameters.priceId !== args.priceId) throw new CheckoutPending('An earlier checkout attempt needs billing reconciliation after a price change.');
    const session = usableSession(await createCheckoutSession(secret, { ...parameters, idempotencyKey: `iscn-checkout-${attempt.id}` }));
    await db.prepare('UPDATE api_checkout_attempt SET stripe_session_id = ? WHERE user_id = ? AND id = ?')
      .bind(session.id, args.customerId, attempt.id).run();
    return session;
  }
  throw new CheckoutPending('Checkout changed during this request. Try again shortly.');
}
