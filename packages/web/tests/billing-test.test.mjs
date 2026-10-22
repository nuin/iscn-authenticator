import assert from 'node:assert/strict';
import test from 'node:test';
import { createPrivateCheckout, inspectPrivateCheckout, expirePrivateCheckout } from '../scripts/lib/billing-test.mjs';

const secret = 'sk_test_fixture';
const args = { secret, returnUrl: 'https://app.example.test/dashboard/billing', attempt: 'first-checkout' };
const price = { id: 'price_fixture', object: 'price', livemode: false, active: true, type: 'recurring',
  currency: 'cad', unit_amount: 100, billing_scheme: 'per_unit',
  recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' }, metadata: { validations_per_month: '100' } };
const session = { id: 'cs_test_fixture', object: 'checkout.session', livemode: false, mode: 'subscription',
  status: 'open', payment_status: 'unpaid', subscription: null, metadata: { iscn_private_test: 'true' },
  url: 'https://checkout.stripe.com/c/pay/cs_test_fixture' };

test('private checkout rejects live or missing credentials before making any request', async (t) => {
  const requests = t.mock.method(globalThis, 'fetch', async () => Response.json(price));
  for (const key of [undefined, '', 'sk_live_private', 'rk_live_private', 'pk_test_public']) {
    await assert.rejects(createPrivateCheckout({ ...args, secret: key }), /sandbox.*key/i);
    await assert.rejects(inspectPrivateCheckout(key, session.id), /sandbox.*key/i);
  }
  assert.equal(requests.mock.callCount(), 0);
});

test('private checkout creates a labelled sandbox subscription without production customer identifiers', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ path: new URL(url).pathname, body: new URLSearchParams(options.body), headers: options.headers });
    return Response.json(calls.length === 1 ? price : session);
  });
  const result = await createPrivateCheckout(args);
  assert.equal(result.checkoutUrl, 'https://checkout.stripe.com/c/pay/cs_test_fixture');
  assert.equal(result.sessionId, 'cs_test_fixture');
  assert.deepEqual(calls.map(({ path }) => path), ['/v1/prices', '/v1/checkout/sessions']);
  assert.equal(calls[0].body.get('unit_amount'), '100');
  assert.equal(calls[0].body.get('currency'), 'cad');
  assert.equal(calls[0].body.get('recurring[interval]'), 'month');
  assert.match(calls[0].body.get('product_data[name]'), /private.*test/i);
  assert.equal(calls[1].body.get('mode'), 'subscription');
  assert.equal(calls[1].body.get('line_items[0][price]'), 'price_fixture');
  assert.equal(calls[1].body.get('line_items[0][quantity]'), '1');
  assert.equal(calls[1].body.get('metadata[iscn_private_test]'), 'true');
  assert.equal(calls[1].body.get('subscription_data[metadata][iscn_private_test]'), 'true');
  for (const key of ['metadata[customer_id]', 'client_reference_id', 'customer', 'customer_email']) {
    assert.equal(calls[1].body.has(key), false);
  }
  assert.ok(calls.every(({ headers }) => headers.Authorization === 'Bearer sk_test_fixture'));
  assert.notEqual(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
});

test('retries reuse the same price and session idempotency keys', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ key: options.headers['Idempotency-Key'], body: options.body });
    return Response.json(String(url).endsWith('/prices') ? price : session);
  });
  await createPrivateCheckout(args);
  await createPrivateCheckout(args);
  assert.deepEqual(calls.slice(0, 2), calls.slice(2));
});

test('invalid return URLs and absent attempt names fail before a Stripe write', async (t) => {
  const requests = t.mock.method(globalThis, 'fetch', async () => Response.json(price));
  for (const returnUrl of ['javascript:alert(1)', 'http://example.test', 'https://user:password@example.test', 'invalid']) {
    await assert.rejects(createPrivateCheckout({ ...args, returnUrl }), /return URL/i);
  }
  await assert.rejects(createPrivateCheckout({ ...args, attempt: '' }), /attempt/i);
  assert.equal(requests.mock.callCount(), 0);
});

test('a live or invalid price cannot reach session creation', async (t) => {
  for (const overrides of [{ livemode: true }, { livemode: undefined }, { active: false }, { recurring: { interval: 'year' } }]) {
    const requests = t.mock.method(globalThis, 'fetch', async () => Response.json({ ...price, ...overrides }));
    await assert.rejects(createPrivateCheckout(args), /sandbox price/i);
    assert.equal(requests.mock.callCount(), 1);
    requests.mock.restore();
  }
});

test('status exposes only safe fields from a tagged test session', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...session, status: 'complete', payment_status: 'paid',
    subscription: 'sub_fixture', customer_details: { email: 'private@example.test' }, client_secret: 'never-print' }));
  const result = await inspectPrivateCheckout(secret, session.id);
  assert.equal(result.status, 'complete');
  assert.equal(result.paymentStatus, 'paid');
  assert.equal(result.subscriptionId, 'sub_fixture');
  assert.doesNotMatch(JSON.stringify(result), /private@example|never-print/);
});

test('status and expiry refuse unrelated, live, or malformed sessions', async (t) => {
  for (const overrides of [{ metadata: {} }, { livemode: true }, { id: 'cs_test_other' }, { url: 'https://attacker.example.test' }]) {
    const requests = t.mock.method(globalThis, 'fetch', async () => Response.json({ ...session, ...overrides }));
    await assert.rejects(expirePrivateCheckout(secret, session.id), /test session/i);
    assert.equal(requests.mock.callCount(), 1);
    requests.mock.restore();
  }
});

test('expiry closes only an open, tagged test session', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, method: options.method });
    return Response.json({ ...session, status: calls.length === 1 ? 'open' : 'expired', url: calls.length === 1 ? session.url : null });
  });
  assert.equal((await expirePrivateCheckout(secret, session.id)).status, 'expired');
  assert.equal(calls[1].method, 'POST');
  assert.equal(calls[1].url, 'https://api.stripe.com/v1/checkout/sessions/cs_test_fixture/expire');
});

test('retrying cleanup of an expired checkout succeeds without another mutation', async (t) => {
  const requests = t.mock.method(globalThis, 'fetch', async () => Response.json({ ...session, status: 'expired', url: null }));
  assert.equal((await expirePrivateCheckout(secret, session.id)).status, 'expired');
  assert.equal(requests.mock.callCount(), 1);
  assert.equal(requests.mock.calls[0].arguments[1].method, 'GET');
});

test('a completed test checkout cannot be expired as a substitute for subscription cancellation', async (t) => {
  const requests = t.mock.method(globalThis, 'fetch', async () => Response.json({ ...session, status: 'complete',
    payment_status: 'paid', subscription: 'sub_fixture', url: null }));
  await assert.rejects(expirePrivateCheckout(secret, session.id), /completed test subscription/i);
  assert.equal(requests.mock.callCount(), 1);
});

test('provider failures do not reveal their response body', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'sk_test_secret private@example.test' } }, { status: 403 }));
  await assert.rejects(createPrivateCheckout(args), (error) => {
    assert.match(error.message, /403/);
    assert.doesNotMatch(error.message, /sk_test_secret|private@example/);
    return true;
  });
});
