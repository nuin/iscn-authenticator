import assert from 'node:assert/strict';
import test from 'node:test';
import { setup } from './helpers/billing-webhook.mjs';
import { createIntegrationKey } from '../src/lib/server/validation-api/keys.ts';
const { actions, load } = await import('../src/routes/dashboard/api/+page.server.ts');

test('dashboard key actions require sign-in and cannot affect another customer', async (t) => {
  const { env, sqlite } = setup(t);
  sqlite.exec("INSERT INTO user (id, email, created_at) VALUES ('another', 'another@example.test', 1)");
  const other = await createIntegrationKey(env.DB, 'another', 'Other laboratory');
  for (const action of [actions.create, actions.revoke, load]) {
    await assert.rejects(action({ locals: {} }), (error) => error.status === 302 && error.location === '/login');
  }
  const form = new FormData();
  form.set('key_id', other.id);
  await actions.revoke({ locals: { user: { id: 'account-test' } }, request: new Request('https://app.example.test/dashboard/api', { method: 'POST', body: form }) });
  assert.equal(sqlite.prepare('SELECT revoked_at FROM validation_api_key WHERE id = ?').get(other.id).revoked_at, null);
  const headers = {};
  const loaded = await load({ locals: { user: { id: 'account-test' } }, url: new URL('https://app.example.test/dashboard/api'), setHeaders: (value) => Object.assign(headers, value) });
  assert.deepEqual(loaded.keys, []);
  assert.equal(loaded.usage, null);
  assert.equal(headers['Cache-Control'], 'private, no-store');
});
