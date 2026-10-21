import assert from 'node:assert/strict';
import test from 'node:test';
import { setupApi, validationRequest } from './helpers/validation-api.mjs';
import { createIntegrationKey, listIntegrationKeys, revokeIntegrationKey } from '../src/lib/server/validation-api/keys.ts';
import { validateKey } from '../src/lib/server/db.ts';

test('integration secrets are hashed, tenant scoped, and capped atomically', async (t) => {
  const { db, sqlite, key, call } = await setupApi(t);
  sqlite.exec("INSERT INTO user (id, email, created_at) VALUES ('other-user', 'other@example.test', 1)");
  const other = await createIntegrationKey(db, 'other-user', 'Other account');
  await revokeIntegrationKey(db, 'api-user', other.id);
  assert.equal(sqlite.prepare('SELECT revoked_at FROM validation_api_key WHERE id = ?').get(other.id).revoked_at, null);
  const stored = sqlite.prepare('SELECT hash FROM validation_api_key WHERE id = ?').get(key.id).hash;
  assert.match(stored, /^[a-f0-9]{64}$/);
  assert.notEqual(stored, key.plaintext);
  assert.equal(await validateKey(db, key.plaintext), null);
  const attempts = await Promise.allSettled(Array.from({ length: 15 }, (_, i) => createIntegrationKey(db, 'api-user', `Device ${i}`)));
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 9);
  const listed = await listIntegrationKeys(db, 'api-user');
  assert.equal(listed.length, 10);
  assert.ok(listed.every((item) => item.user_id === 'api-user' && !('hash' in item) && !('plaintext' in item)));
  const usage = await call(new Request('https://app.example.test/api/v1/usage', { headers: { Authorization: `Bearer ${key.plaintext}` } }), 'usage');
  assert.equal(usage.status, 200);
  assert.equal((await usage.json()).usage.used, 0);
  await revokeIntegrationKey(db, 'api-user', key.id);
  assert.equal((await call(validationRequest(key.plaintext))).status, 401);
});
