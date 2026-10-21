import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

test('billing actions redirect to Stripe after the SvelteKit upgrade', async (t) => {
  const bindings = {
    STRIPE_SECRET_KEY: 'sk_test_migration',
    STRIPE_PRICE_ID_PRO: 'price_test_migration',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_migration',
  };
  const moduleUrl = `data:text/javascript,${encodeURIComponent(`export const env = ${JSON.stringify(bindings)}`)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      return specifier === 'cloudflare:workers'
        ? { url: moduleUrl, shortCircuit: true }
        : next(specifier, context);
    },
  });
  t.after(() => hooks.deregister());
  const { actions, load } = await import('../.svelte-kit/output/server/entries/pages/dashboard/billing/_page.server.ts.js');
  const { env } = await import(moduleUrl);
  const event = {
    locals: { user: { id: 'user-test', email: 'billing@example.test', stripe_customer_id: 'cus_test' } },
    url: new URL('https://app.example.test/dashboard/billing'),
  };

  const price = { id: bindings.STRIPE_PRICE_ID_PRO, object: 'price', active: true, type: 'recurring', billing_scheme: 'per_unit', unit_amount: 2500,
    currency: 'cad', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' }, metadata: { validations_per_month: '500' } };
  t.mock.method(globalThis, 'fetch', async () => Response.json(price));
  await t.test('checkout requires a valid configured monthly price and allowance', async () => {
    const available = await load(event);
    assert.equal(available.offering.monthlyLimit, 500);
    assert.equal(available.offering.displayPrice, 'CAD 25.00');
    assert.equal(available.checkoutAvailable, true);
    assert.equal(available.portalAvailable, true);
    for (const setting of ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID_PRO', 'STRIPE_WEBHOOK_SECRET']) {
      const value = env[setting];
      delete env[setting];
      try {
        const availability = await load(event);
        assert.equal(availability.checkoutAvailable, false);
        const result = await actions.upgrade(event);
        assert.equal(result.status, 503);
        assert.doesNotMatch(result.data.message, /STRIPE_/);
      } finally {
        env[setting] = value;
      }
    }
  });

  for (const [action, path, destination] of [
    ['upgrade', '/checkout/sessions', 'https://checkout.stripe.com/c/pay/test'],
    ['manage', '/billing_portal/sessions', 'https://billing.stripe.com/p/session/test'],
  ]) {
    await t.test(action, async (subtest) => {
      let called = false;
      subtest.mock.method(globalThis, 'fetch', async (url, options) => {
        if (String(url).includes('/prices/')) return Response.json(price);
        if (String(url).includes('/subscriptions?')) return Response.json({ object: 'list', data: [], has_more: false });
        assert.equal(url, `https://api.stripe.com/v1${path}`);
        assert.equal(options.method, 'POST');
        assert.equal(options.headers.Authorization, `Bearer ${bindings.STRIPE_SECRET_KEY}`);
        called = true;
        return Response.json({ id: 'session-test', url: destination });
      });
      await assert.rejects(actions[action](event), (error) => {
        assert.equal(error.status, 303);
        assert.equal(error.location, destination);
        return true;
      });
      assert.ok(called);
    });
  }
  await t.test('existing subscriptions use the portal instead of a second checkout', async (subtest) => {
    subtest.mock.method(globalThis, 'fetch', async (url) => {
      if (String(url).includes('/prices/')) return Response.json(price);
      assert.ok(String(url).includes('/subscriptions?'));
      return Response.json({ object: 'list', has_more: false, data: [{ id: 'sub_existing', object: 'subscription',
        customer: 'cus_test', status: 'active', metadata: { customer_id: 'user-test' },
        items: { has_more: false, data: [{ price: { id: bindings.STRIPE_PRICE_ID_PRO } }] } }] });
    });
    const result = await actions.upgrade(event);
    assert.equal(result.status, 409);
    assert.match(result.data.message, /Manage subscription/);
  });
});
