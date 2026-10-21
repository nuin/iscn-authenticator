import assert from 'node:assert/strict';
import test from 'node:test';
import { setup } from './helpers/billing-webhook.mjs';
const { createOrResumeCheckout } = await import('../src/lib/server/checkout-attempts.ts');
const parameters = { priceId: 'price_pro', customerId: 'account-test', customerEmail: 'billing@example.test',
  successUrl: 'https://app.example.test/success', cancelUrl: 'https://app.example.test/cancel' };

test('simultaneous initial checkouts share a durable attempt and reuse the Stripe session', async (t) => {
  const { env, sqlite } = setup(t);
  const keys = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    keys.push(options.headers['Idempotency-Key']);
    return Response.json({ id: 'cs_same', url: 'https://checkout.stripe.com/c/pay/same', status: 'open' });
  });
  const args = { priceId: 'price_pro', customerId: 'account-test', customerEmail: 'billing@example.test',
    successUrl: 'https://app.example.test/success', cancelUrl: 'https://app.example.test/cancel' };
  const create = () => createOrResumeCheckout(env.DB, 'sk_test_fixture', args);
  const sessions = await Promise.all(Array.from({ length: 8 }, create));
  assert.ok(keys.every((key) => typeof key === 'string' && key.startsWith('iscn-checkout-')));
  assert.equal(new Set(keys).size, 1);
  assert.ok(sessions.every((session) => session.id === 'cs_same'));
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM api_checkout_attempt').get().n, 1);
});

test('open checkout is reused, completed checkout blocks, expired checkout can be replaced', async (t) => {
  const { env } = setup(t);
  let status = 'open';
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.method === 'POST') {
      writes.push(options.headers['Idempotency-Key']);
      return Response.json({ id: `cs_${writes.length}`, url: 'https://checkout.stripe.com/c/pay/fixture' });
    }
    return Response.json({ id: `cs_${writes.length}`, object: 'checkout.session', mode: 'subscription',
      status, url: 'https://checkout.stripe.com/c/pay/fixture', subscription: status === 'complete' ? 'sub_done' : null });
  });
  await createOrResumeCheckout(env.DB, 'sk_test_fixture', parameters);
  await createOrResumeCheckout(env.DB, 'sk_test_fixture', parameters);
  assert.equal(writes.length, 1);
  status = 'complete';
  await assert.rejects(createOrResumeCheckout(env.DB, 'sk_test_fixture', parameters), /already completed/);
  assert.equal(writes.length, 1);
  await createOrResumeCheckout(env.DB, 'sk_test_fixture', parameters, ['sub_done']);
  assert.equal(writes.length, 2);
  status = 'expired';
  await createOrResumeCheckout(env.DB, 'sk_test_fixture', parameters);
  assert.equal(writes.length, 3);
  assert.equal(new Set(writes).size, 3);
});

test('unknown outcomes reuse identical parameters and stop before Stripe can prune the idempotency key', async (t) => {
  const { env, sqlite } = setup(t);
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    writes.push({ key: options.headers['Idempotency-Key'], body: options.body });
    throw new Error('network timeout');
  });
  await assert.rejects(createOrResumeCheckout(env.DB, 'sk_test_fixture', parameters), /timeout/);
  await assert.rejects(createOrResumeCheckout(env.DB, 'sk_test_fixture', { ...parameters, successUrl: 'https://another.example.test/success' }), /timeout/);
  assert.deepEqual(writes[0], writes[1]);
  sqlite.exec('UPDATE api_checkout_attempt SET created_at = created_at - 86400');
  await assert.rejects(createOrResumeCheckout(env.DB, 'sk_test_fixture', parameters), /reconciliation/);
  assert.equal(writes.length, 2);
});
