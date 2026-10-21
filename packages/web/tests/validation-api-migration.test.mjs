import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { setupApi } from './helpers/validation-api.mjs';

test('reapplying the additive API migration preserves existing accounts and entitlements', async (t) => {
  const api = await setupApi(t);
  const directory = new URL('../migrations/', import.meta.url);
  const migrations = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  const before = api.sqlite.prepare('SELECT * FROM api_entitlement').all();
  api.sqlite.prepare('INSERT INTO api_checkout_attempt (user_id, id, created_at, parameters) VALUES (?, ?, ?, ?)')
    .run('api-user', 'pending-test', api.now, '{}');
  for (const file of migrations) api.sqlite.exec(await readFile(new URL(file, directory), 'utf8'));
  assert.deepEqual(api.sqlite.prepare('SELECT * FROM api_entitlement').all(), before);
  assert.equal(api.sqlite.prepare('SELECT COUNT(*) AS n FROM validation_api_key').get().n, 1);
  assert.equal(api.sqlite.prepare('SELECT id FROM api_checkout_attempt').get().id, 'pending-test');
});
