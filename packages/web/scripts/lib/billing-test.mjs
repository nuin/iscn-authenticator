import { parseApiOffering } from '../../src/lib/server/api-offering.ts';
import { STRIPE_API, stripeHeaders } from '../../src/lib/server/stripe-config.ts';

export class BillingTestError extends Error {}

function requireSandboxKey(secret) {
  if (typeof secret !== 'string' || !/^(sk|rk)_test_[A-Za-z0-9]+$/.test(secret)) {
    throw new BillingTestError('Set STRIPE_TEST_SECRET_KEY to a sandbox secret or restricted key. Live keys are rejected.');
  }
}

async function stripeTestRequest(secret, path, body, idempotencyKey) {
  requireSandboxKey(secret);
  let response;
  try {
    response = await fetch(`${STRIPE_API}${path}`, {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { ...stripeHeaders(secret), ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      ...(body ? { body: new URLSearchParams(body).toString() } : {}),
    });
  } catch {
    throw new BillingTestError('Could not reach Stripe. Retry the same attempt with unchanged arguments.');
  }
  if (!response.ok) throw new BillingTestError(`Stripe test request failed (HTTP ${response.status}). Check the sandbox request log and key permissions.`);
  try { return await response.json(); }
  catch { throw new BillingTestError('Stripe returned an invalid response. Check the sandbox request log.'); }
}

function checkoutReturnUrl(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new BillingTestError('An HTTPS return URL is required.'); }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new BillingTestError('Use an HTTPS return URL without credentials.');
  }
  return url.href;
}

function sessionSummary(session, expectedId) {
  if (!session || session.object !== 'checkout.session' || session.livemode !== false ||
      session.mode !== 'subscription' || !/^cs_test_[A-Za-z0-9]+$/.test(session.id) ||
      (expectedId && session.id !== expectedId) || session.metadata?.iscn_private_test !== 'true' ||
      !['open', 'complete', 'expired'].includes(session.status) ||
      !['paid', 'unpaid', 'no_payment_required'].includes(session.payment_status)) {
    throw new BillingTestError('Expected an ISCN private test session.');
  }
  if ((session.url !== null && (typeof session.url !== 'string' || !session.url.startsWith('https://checkout.stripe.com/c/pay/'))) ||
      (session.status === 'open' && !session.url) ||
      (session.subscription !== null && (typeof session.subscription !== 'string' || !/^sub_[A-Za-z0-9]+$/.test(session.subscription)))) {
    throw new BillingTestError('Invalid private test session response.');
  }
  return { sessionId: session.id, checkoutUrl: session.url, status: session.status,
    paymentStatus: session.payment_status, subscriptionId: session.subscription };
}

export async function createPrivateCheckout({ secret, returnUrl, attempt }) {
  requireSandboxKey(secret);
  const destination = checkoutReturnUrl(returnUrl);
  if (typeof attempt !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(attempt)) {
    throw new BillingTestError('Provide a unique --attempt name; reuse it only to retry this checkout within 24 hours.');
  }
  const price = await stripeTestRequest(secret, '/prices', {
    currency: 'cad', unit_amount: '100', 'recurring[interval]': 'month',
    'product_data[name]': 'ISCN private checkout test — not for sale',
    'metadata[validations_per_month]': '100', 'metadata[iscn_private_test]': 'true',
  }, `iscn-private-price-${attempt}`);
  if (price?.livemode !== false || !parseApiOffering(price)?.active) {
    throw new BillingTestError('Expected an active monthly sandbox price.');
  }
  const session = await stripeTestRequest(secret, '/checkout/sessions', {
    mode: 'subscription', 'line_items[0][price]': price.id, 'line_items[0][quantity]': '1',
    success_url: destination, cancel_url: destination,
    'metadata[iscn_private_test]': 'true', 'subscription_data[metadata][iscn_private_test]': 'true',
  }, `iscn-private-checkout-${attempt}`);
  return sessionSummary(session);
}

export async function inspectPrivateCheckout(secret, sessionId) {
  requireSandboxKey(secret);
  if (typeof sessionId !== 'string' || !/^cs_test_[A-Za-z0-9]+$/.test(sessionId)) {
    throw new BillingTestError('Provide a test session ID beginning with cs_test_.');
  }
  return sessionSummary(await stripeTestRequest(secret, `/checkout/sessions/${sessionId}`), sessionId);
}

export async function expirePrivateCheckout(secret, sessionId) {
  const session = await inspectPrivateCheckout(secret, sessionId);
  if (session.status === 'expired') return session;
  if (session.status !== 'open') throw new BillingTestError('Only an open test session can expire. Manage a completed test subscription in Stripe.');
  return sessionSummary(await stripeTestRequest(secret, `/checkout/sessions/${sessionId}/expire`, {},
    `iscn-private-expire-${sessionId}`), sessionId);
}
