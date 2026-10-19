import assert from 'node:assert/strict';
import test from 'node:test';
import { setup, subscription, checkout, event, deliver } from './helpers/billing-webhook.mjs';

for (const [name, values] of [
  ['unpaid subscription', { payment_status: 'unpaid' }],
  ['one-time payment', { mode: 'payment', subscription: null }],
  ['setup checkout', { mode: 'setup', payment_status: 'no_payment_required', subscription: null }],
]) {
  test(`${name} cannot grant paid access`, async (t) => {
    const db = setup(t);
    const response = await deliver(event(undefined, checkout(values)));
    assert.equal(response.status, 200);
    assert.equal(db.account().plan, 'free');
    assert.equal(db.account().stripe_customer_id, null);
    assert.equal(db.markers(), 1);
  });
}

for (const [type, payment_status] of [
  ['checkout.session.completed', 'paid'],
  ['checkout.session.completed', 'no_payment_required'],
  ['checkout.session.async_payment_succeeded', 'paid'],
]) {
  test(`${type} with ${payment_status} associates and activates the account`, async (t) => {
    const db = setup(t);
    const response = await deliver(event(type, checkout({ payment_status })));
    assert.equal(response.status, 200);
    assert.equal(db.account().plan, 'pro');
    assert.equal(db.account().stripe_customer_id, 'cus_test');
    assert.equal(db.markers(), 1);
  });
}

test('concurrent duplicate delivery mutates an account exactly once', async (t) => {
  const db = setup(t, { simultaneousReads: 8 });
  const responses = await Promise.all(Array.from({ length: 8 }, () => deliver(event())));
  assert.deepEqual(responses.map((response) => response.status), Array(8).fill(200));
  assert.equal(db.account().plan, 'pro');
  assert.equal(db.updates(), 1);
  assert.equal(db.markers(), 1);
});

test('a replay after cancellation cannot restore access from an earlier checkout', async (t) => {
  const db = setup(t);
  assert.equal((await deliver(event())).status, 200);
  db.sqlite.exec("UPDATE user SET plan = 'free'");
  assert.equal((await deliver(event())).status, 200);
  assert.equal(db.account().plan, 'free');
  assert.equal(db.markers(), 1);
});

test('marker failure rolls back the account update and a retry applies it once', async (t) => {
  const db = setup(t);
  db.sqlite.exec(`CREATE TRIGGER fail_marker BEFORE INSERT ON processed_webhook
    BEGIN SELECT RAISE(ABORT, 'private database failure details'); END`);
  const response = await deliver(event());
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /private|database|SQL|UPDATE/);
  assert.equal(db.account().plan, 'free');
  assert.equal(db.account().stripe_customer_id, null);
  assert.equal(db.markers(), 0);
  assert.equal(db.updates(), 0);
  db.sqlite.exec('DROP TRIGGER fail_marker');
  assert.equal((await deliver(event())).status, 200);
  assert.equal(db.account().plan, 'pro');
  assert.equal(db.updates(), 1);
});

for (const [name, payload] of [
  ['JSON null', null], ['array', []], ['empty event', {}], ['malformed JSON', '{'],
  ['missing id', { ...event(), id: '' }], ['missing data', { ...event(), data: null }],
  ['object event id', { ...event(), id: { id: 'evt_test' } }],
  ['invalid timestamp', { ...event(), created: '1760000000' }],
  ['wrong envelope object', { ...event(), object: 'checkout.session' }],
  ['array event object', { ...event(), data: { object: [] } }],
  ['invalid customer', event(undefined, checkout({ customer: {} }))],
  ['invalid payment status', event(undefined, checkout({ payment_status: 1 }))],
  ['conflicting account references', event(undefined, checkout({ client_reference_id: 'other' }))],
]) {
  test(`signed ${name} is rejected without persistence`, async (t) => {
    const db = setup(t);
    const response = await deliver(payload);
    assert.equal(response.status, 400);
    assert.equal(db.markers(), 0);
    assert.equal(db.account().plan, 'free');
  });
}

for (const options of [{ signature: 't=1,v1=wrong' }, { timestamp: 1 }]) {
  test('invalid or expired signatures cannot mutate account state', async (t) => {
    const db = setup(t);
    assert.equal((await deliver(event(), options)).status, 400);
    assert.equal(db.markers(), 0);
  });
}

for (const setting of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_PRO']) {
  test(`missing ${setting} returns unavailable without persistence`, async (t) => {
    const db = setup(t);
    delete db.env[setting];
    const response = await deliver(event());
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /STRIPE_/);
    assert.equal(db.markers(), 0);
  });
}

test('checkout cannot replace an existing account billing owner', async (t) => {
  const db = setup(t, { customer: 'cus_original' });
  assert.equal((await deliver(event())).status, 500);
  assert.equal(db.account().stripe_customer_id, 'cus_original');
  assert.equal(db.account().plan, 'free');
  assert.equal(db.markers(), 0);
});

test('checkout for a nonexistent account remains retryable without changing another account', async (t) => {
  const db = setup(t);
  const response = await deliver(event(undefined, checkout({
    client_reference_id: 'missing-account', metadata: { customer_id: 'missing-account' },
  })));
  assert.equal(response.status, 500);
  assert.equal(db.account().plan, 'free');
  assert.equal(db.account().stripe_customer_id, null);
  assert.equal(db.updates(), 0);
  assert.equal(db.markers(), 0);
});

test('a lifecycle event retries successfully after checkout establishes customer ownership', async (t) => {
  const db = setup(t);
  const lifecycle = event('customer.subscription.updated', subscription(), 'evt_before_checkout');
  assert.equal((await deliver(lifecycle)).status, 500);
  assert.equal(db.account().plan, 'free');
  assert.equal(db.account().stripe_customer_id, null);
  assert.equal(db.updates(), 0);
  assert.equal(db.markers(), 0);
  assert.equal((await deliver(event())).status, 200);
  assert.equal((await deliver(lifecycle)).status, 200);
  assert.equal(db.account().stripe_customer_id, 'cus_test');
  assert.equal(db.account().plan, 'pro');
  assert.equal(db.markers(), 2);
});

test('Stripe failure remains retryable and does not expose provider details', async (t) => {
  const db = setup(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'private provider detail' } }, { status: 503 }));
  const response = await deliver(event());
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /private|provider/);
  assert.equal(db.markers(), 0);
  assert.equal(db.account().plan, 'free');
});

for (const [type, currentStatus, expected] of [
  ['invoice.payment_failed', 'past_due', 'past_due'],
  ['invoice.paid', 'active', 'pro'],
  ['invoice.payment_succeeded', 'active', 'pro'],
  ['invoice.paid', 'canceled', 'free'],
  ['invoice.payment_failed', 'active', 'pro'],
  ['customer.subscription.updated', 'trialing', 'pro'],
  ['customer.subscription.deleted', 'canceled', 'free'],
]) {
  test(`${type} reconciles current ${currentStatus} subscription to ${expected}`, async (t) => {
    const db = setup(t, { customer: 'cus_test', plan: 'past_due' });
    const current = subscription({ status: currentStatus });
    t.mock.method(globalThis, 'fetch', async () => Response.json({ object: 'list', data: [current], has_more: false }));
    const object = type.startsWith('invoice.')
      ? { id: 'in_test', object: 'invoice', customer: 'cus_test', parent: {
        type: 'subscription_details', subscription_details: { subscription: 'sub_test' } } }
      : subscription();
    assert.equal((await deliver(event(type, object))).status, 200);
    assert.equal(db.account().plan, expected);
    assert.equal(db.markers(), 1);
  });
}

for (const overrides of [{ metadata: { customer_id: 'unrelated-account' } },
  { items: { data: [{ price: { id: 'price_unrelated' } }], has_more: false } }]) {
  test('unrelated subscriptions cannot grant or revoke this account entitlement', async (t) => {
    const db = setup(t, { customer: 'cus_test', plan: 'past_due' });
    t.mock.method(globalThis, 'fetch', async () => Response.json({ object: 'list', data: [subscription(overrides)], has_more: false }));
    assert.equal((await deliver(event('customer.subscription.updated', subscription()))).status, 200);
    assert.equal(db.account().plan, 'past_due');
    assert.equal(db.updates(), 0);
  });
}

test('an invoice using the older subscription field recovers payment', async (t) => {
  const db = setup(t, { customer: 'cus_test', plan: 'past_due' });
  const invoice = { id: 'in_test', object: 'invoice', customer: 'cus_test', subscription: 'sub_test' };
  assert.equal((await deliver(event('invoice.paid', invoice))).status, 200);
  assert.equal(db.account().plan, 'pro');
});

test('a one-off invoice cannot change subscription access', async (t) => {
  const db = setup(t, { customer: 'cus_test', plan: 'past_due' });
  const invoice = { id: 'in_test', object: 'invoice', customer: 'cus_test', parent: null };
  assert.equal((await deliver(event('invoice.paid', invoice))).status, 200);
  assert.equal(db.account().plan, 'past_due');
});

test('a stale paid checkout cannot reactivate its canceled subscription', async (t) => {
  const db = setup(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ object: 'list',
    data: [subscription({ status: 'canceled' })], has_more: false }));
  assert.equal((await deliver(event())).status, 200);
  assert.equal(db.account().plan, 'free');
});

for (const data of [null, { data: [] }, { object: 'list', data: [], has_more: false },
  { object: 'list', data: [subscription({ customer: 'cus_wrong' })], has_more: false },
  { object: 'list', data: [subscription({ status: 'future_status' })], has_more: false },
  { object: 'list', data: [subscription({ items: { data: [], has_more: true } })], has_more: false }]) {
  test('an invalid or incomplete Stripe response cannot record successful processing', async (t) => {
    const db = setup(t);
    t.mock.method(globalThis, 'fetch', async () => Response.json(data));
    assert.equal((await deliver(event())).status, 500);
    assert.equal(db.account().plan, 'free');
    assert.equal(db.markers(), 0);
  });
}

test('subscription lookup targets the billing customer with a bounded request', async (t) => {
  const db = setup(t);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const request = new URL(url);
    assert.equal(request.origin, 'https://api.stripe.com');
    assert.equal(request.pathname, '/v1/subscriptions');
    assert.equal(request.searchParams.get('customer'), 'cus_test');
    assert.equal(request.searchParams.get('status'), 'all');
    assert.equal(request.searchParams.get('limit'), '100');
    assert.equal(options.headers.Authorization, 'Bearer sk_test_local_fixture');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ object: 'list', data: [subscription()], has_more: false });
  });
  assert.equal((await deliver(event())).status, 200);
  assert.equal(db.account().plan, 'pro');
});

test('a canceled previous subscription does not revoke a current active subscription', async (t) => {
  const db = setup(t, { customer: 'cus_test', plan: 'pro' });
  const canceled = subscription({ status: 'canceled' });
  const active = subscription({ id: 'sub_current' });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ object: 'list', data: [canceled, active], has_more: false }));
  assert.equal((await deliver(event('customer.subscription.deleted', canceled))).status, 200);
  assert.equal(db.account().plan, 'pro');
});

test('incomplete subscription lists are retried without downgrading the account', async (t) => {
  const db = setup(t, { customer: 'cus_test', plan: 'pro' });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ object: 'list',
    data: [subscription({ status: 'canceled' })], has_more: true }));
  assert.equal((await deliver(event('customer.subscription.deleted', subscription()))).status, 500);
  assert.equal(db.account().plan, 'pro');
  assert.equal(db.markers(), 0);
});

test('unknown valid events are acknowledged once without touching an account', async (t) => {
  const db = setup(t);
  const ignored = event('charge.refunded', { id: 'ch_test', object: 'charge' });
  assert.equal((await deliver(ignored)).status, 200);
  assert.equal((await deliver(ignored)).status, 200);
  assert.equal(db.updates(), 0);
  assert.equal(db.markers(), 1);
});
