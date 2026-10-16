import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

test('billing actions redirect to Stripe after the SvelteKit upgrade', async (t) => {
  const bindings = {
    STRIPE_SECRET_KEY: 'sk_test_migration',
    STRIPE_PRICE_ID_PRO: 'price_test_migration',
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
  const { actions } = await import('../.svelte-kit/output/server/entries/pages/dashboard/billing/_page.server.ts.js');
  const event = {
    locals: { user: { id: 'user-test', email: 'billing@example.test', stripe_customer_id: 'cus_test' } },
    url: new URL('https://app.example.test/dashboard/billing'),
  };

  for (const [action, path, destination] of [
    ['upgrade', '/checkout/sessions', 'https://checkout.stripe.com/c/pay/test'],
    ['manage', '/billing_portal/sessions', 'https://billing.stripe.com/p/session/test'],
  ]) {
    await t.test(action, async (subtest) => {
      let called = false;
      subtest.mock.method(globalThis, 'fetch', async (url, options) => {
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
});
