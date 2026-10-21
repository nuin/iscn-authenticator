import { createHmac } from 'node:crypto';
import { registerHooks } from 'node:module';
import { createTestDatabase } from './sqlite.mjs';

const bindingsUrl = 'data:text/javascript,export const env = {}';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers') return { url: bindingsUrl, shortCircuit: true };
    if (specifier.startsWith('#lib/') && specifier.endsWith('.js')) {
      return { url: new URL(`../../src/lib/${specifier.slice(5, -3)}.ts`, import.meta.url).href,
        shortCircuit: true };
    }
    return next(specifier, context);
  },
});
const { env } = await import(bindingsUrl);
const { POST } = await import('../../src/routes/api/webhooks/stripe/+server.ts');
export function setup(t, { plan = 'free', customer = null, simultaneousReads = 0 } = {}) {
  const barrier = Promise.withResolvers();
  let remaining = simultaneousReads;
  const gate = async (sql) => {
    if (!sql.includes('FROM processed_webhook') || remaining <= 0) return;
    remaining -= 1;
    if (remaining === 0) barrier.resolve();
    await barrier.promise;
  };
  const { sqlite, db } = createTestDatabase(t, gate);
  sqlite.exec('CREATE TABLE billing_updates (user_id TEXT)');
  sqlite.exec(`CREATE TRIGGER count_updates AFTER UPDATE ON user
    BEGIN INSERT INTO billing_updates VALUES (NEW.id); END`);
  sqlite.prepare('INSERT INTO user (id, email, created_at, plan, stripe_customer_id) VALUES (?, ?, 1, ?, ?)')
    .run('account-test', 'billing@example.test', plan, customer);
  Object.assign(env, {
    STRIPE_WEBHOOK_SECRET: 'whsec_local_fixture', STRIPE_SECRET_KEY: 'sk_test_local_fixture',
    STRIPE_PRICE_ID_PRO: 'price_pro',
    DB: db,
  });
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => Response.json({ object: 'list',
    data: [subscription()], has_more: false }));
  return {
    sqlite, env,
    account: () => sqlite.prepare('SELECT * FROM user').get(),
    markers: () => sqlite.prepare('SELECT COUNT(*) AS count FROM processed_webhook').get().count,
    updates: () => sqlite.prepare('SELECT COUNT(*) AS count FROM billing_updates').get().count,
  };
}

export function subscription(overrides = {}) {
  return { id: 'sub_test', object: 'subscription', customer: 'cus_test', status: 'active',
    metadata: { customer_id: 'account-test' },
    items: { object: 'list', has_more: false, data: [{ price: { id: 'price_pro' } }] }, ...overrides };
}

export function checkout(overrides = {}) {
  return { id: 'cs_test', object: 'checkout.session', mode: 'subscription',
    payment_status: 'paid', customer: 'cus_test', subscription: 'sub_test',
    client_reference_id: 'account-test', metadata: { customer_id: 'account-test' }, ...overrides };
}

export function event(type = 'checkout.session.completed', object = checkout(), id = 'evt_test') {
  return { id, object: 'event', created: 1_760_000_000, type, data: { object } };
}

export async function deliver(payload, { signature, timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hash = createHmac('sha256', 'whsec_local_fixture').update(`${timestamp}.${body}`).digest('hex');
  return POST({ request: new Request('https://app.example.test/api/webhooks/stripe', {
    method: 'POST', body, headers: { 'stripe-signature': signature ?? `t=${timestamp},v1=${hash}` },
  }) });
}
