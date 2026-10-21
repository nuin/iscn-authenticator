import assert from 'node:assert/strict';
import test from 'node:test';
import { setup, subscription, event, deliver } from './helpers/billing-webhook.mjs';

const start = Math.floor(Date.now() / 1000) - 60;
const end = start + 30 * 86400;
const price = { id: 'price_pro', object: 'price', active: true, type: 'recurring', billing_scheme: 'per_unit', unit_amount: 1000,
  currency: 'usd', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' }, metadata: { validations_per_month: '100' } };

function current(overrides = {}) {
  return subscription({ latest_invoice: { object: 'invoice', status: 'paid' }, items: { has_more: false, data: [{ price, quantity: 1, current_period_start: start, current_period_end: end }] }, ...overrides });
}

test('paid access has an explicit subscription-period expiry and allowance', async (t) => {
  const db = setup(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ object: 'list', data: [current()], has_more: false }));
  assert.equal((await deliver(event())).status, 200);
  assert.equal(db.account().plan_expires_at, end);
  const entitlement = db.sqlite.prepare('SELECT * FROM api_entitlement').get();
  assert.equal(entitlement.period_start, start);
  assert.equal(entitlement.period_end, end);
  assert.equal(entitlement.monthly_limit, 100);
});

for (const [name, overrides] of Object.entries({
  trial: { status: 'trialing' }, overdue: { status: 'past_due' }, canceled: { status: 'canceled' },
  paused: { pause_collection: { behavior: 'void' } }, unpaid: { latest_invoice: { status: 'open', paid: false } },
  unexpandedInvoice: { latest_invoice: 'in_test' },
  missingMetadata: { items: { has_more: false, data: [{ price: { ...price, metadata: {} }, quantity: 1, current_period_start: start, current_period_end: end }] } },
  missingPeriod: { items: { has_more: false, data: [{ price, quantity: 1 }] } },
  wrongQuantity: { items: { has_more: false, data: [{ price, quantity: 2, current_period_start: start, current_period_end: end }] } },
})) {
  test(`${name} cannot retain paid API access`, async (t) => {
    const db = setup(t);
    let state = current();
    t.mock.method(globalThis, 'fetch', async () => Response.json({ object: 'list', data: [state], has_more: false }));
    assert.equal((await deliver(event())).status, 200);
    assert.ok(db.sqlite.prepare('SELECT * FROM api_entitlement').get());
    state = current(overrides);
    assert.equal((await deliver(event('customer.subscription.updated', state, 'evt_change'))).status, 200);
    assert.equal(db.sqlite.prepare('SELECT * FROM api_entitlement').get(), undefined);
  });
}

test('duplicates, renewal and stale events never reset usage or revive canceled access', async (t) => {
  const db = setup(t);
  let state = current();
  t.mock.method(globalThis, 'fetch', async () => Response.json({ object: 'list', data: [state], has_more: false }));
  await deliver(event());
  db.sqlite.prepare('INSERT INTO api_usage VALUES (?, ?, 73, ?, 1)').run('account-test', start, start);
  await deliver(event());
  await deliver(event('customer.subscription.updated', state, 'evt_repeat'));
  assert.equal(db.sqlite.prepare('SELECT validations FROM api_usage').get().validations, 73);
  const next = start + 30 * 86400;
  t.mock.method(Date, 'now', () => (next + 1) * 1000);
  state = current({ items: { has_more: false, data: [{ price, quantity: 1, current_period_start: next, current_period_end: next + 30 * 86400 }] } });
  await deliver(event('customer.subscription.updated', state, 'evt_renew'));
  assert.equal(db.sqlite.prepare('SELECT period_start FROM api_entitlement').get().period_start, next);
  assert.equal(db.sqlite.prepare('SELECT validations FROM api_usage').get().validations, 73);
  state = current({ status: 'canceled' });
  await deliver(event('customer.subscription.deleted', state, 'evt_cancel'));
  await deliver(event('customer.subscription.updated', current(), 'evt_stale'));
  assert.equal(db.sqlite.prepare('SELECT * FROM api_entitlement').get(), undefined);
});

test('a delayed active snapshot cannot overwrite a newer cancellation', async (t) => {
  const db = setup(t, { customer: 'cus_test' });
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    if (calls === 1) {
      entered.resolve();
      await release.promise;
      return Response.json({ object: 'list', data: [current()], has_more: false });
    }
    return Response.json({ object: 'list', data: [current({ status: 'canceled' })], has_more: false });
  });
  const stale = deliver(event('customer.subscription.updated', current(), 'evt_delayed'));
  await entered.promise;
  assert.equal((await deliver(event('customer.subscription.deleted', current({ status: 'canceled' }), 'evt_newer'))).status, 200);
  release.resolve();
  assert.equal((await stale).status, 500);
  assert.equal(db.sqlite.prepare('SELECT * FROM api_entitlement').get(), undefined);
  assert.equal(db.account().plan, 'free');
  assert.equal((await deliver(event('customer.subscription.updated', current(), 'evt_delayed'))).status, 200);
  assert.equal(db.sqlite.prepare('SELECT * FROM api_entitlement').get(), undefined);
});
