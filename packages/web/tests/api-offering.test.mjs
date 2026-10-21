import assert from 'node:assert/strict';
import test from 'node:test';
import { parseApiOffering } from '../src/lib/server/api-offering.ts';
import { getCheckoutOffering } from '../src/lib/server/billing-availability.ts';

const price = { id: 'price_test', object: 'price', type: 'recurring', active: true, currency: 'usd', unit_amount: 1000,
  billing_scheme: 'per_unit', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' }, metadata: { validations_per_month: '100' } };
const config = { STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_PRICE_ID_PRO: price.id, STRIPE_WEBHOOK_SECRET: 'whsec_fixture' };

test('only a fixed monthly licensed price with a finite allowance enables checkout', async (t) => {
  let response = price;
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers['Stripe-Version'], '2025-03-31.basil');
    return Response.json(response);
  });
  assert.equal((await getCheckoutOffering(config)).displayPrice, 'USD 10.00');
  for (const overrides of [
    { metadata: {} }, { metadata: { validations_per_month: '1e9' } }, { metadata: { validations_per_month: '-1' } },
    { metadata: { validations_per_month: '9999999999999999999999999999' } }, { unit_amount: 0 }, { unit_amount: 1.5 },
    { recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } },
    { recurring: { interval: 'month', interval_count: 1, usage_type: 'metered' } },
    { transform_quantity: { divide_by: 10, round: 'up' } }, { billing_scheme: 'tiered' },
  ]) {
    response = { ...price, ...overrides };
    assert.equal(parseApiOffering(response), null, JSON.stringify(overrides));
    assert.equal(await getCheckoutOffering(config), null);
  }
  response = { ...price, active: false };
  assert.equal(await getCheckoutOffering(config), null);
  response = { ...price, id: 'price_other' };
  assert.equal(await getCheckoutOffering(config), null);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('provider unavailable'); });
  assert.equal(await getCheckoutOffering(config), null);
});
