import assert from 'node:assert/strict';
import test from 'node:test';
import { setup } from './helpers/billing-webhook.mjs';
import { TEST_EMAIL_SECRET } from './helpers/email-auth.mjs';
const signup = await import('../src/routes/signup/+page.server.ts');

test('signup requires proof of email ownership before creating an account or session', async (t) => {
  const { env, sqlite } = setup(t);
  const cookies = new Map();
  env.EMAIL_AUTH_SECRET = TEST_EMAIL_SECRET;
  env.MAILER = { fetch: async () => Response.json({ status: 'accepted' }, { status: 202 }) };
  await (signup.actions.request ?? signup.actions.default)({
    request: new Request('https://app.example.test/signup', { method: 'POST', body: new URLSearchParams({ email: 'new@example.test' }) }),
    locals: {}, cookies: { get: (name) => cookies.get(name), set: (name, value) => cookies.set(name, value), delete: (name) => cookies.delete(name) },
    getClientAddress: () => '192.0.2.1', setHeaders() {},
  });
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM user WHERE email = 'new@example.test'").get().n, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM session').get().n, 0);
  assert.equal(cookies.has('iscn_session'), false);
});
