import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { setupApi } from './helpers/validation-api.mjs';

test('reapplying the additive API migration preserves existing accounts and entitlements', async (t) => {
  const api = await setupApi(t);
  const migration = await readFile(new URL('../migrations/0001_validation_api.sql', import.meta.url), 'utf8');
  const before = api.sqlite.prepare('SELECT * FROM api_entitlement').all();
  api.sqlite.exec(migration);
  assert.deepEqual(api.sqlite.prepare('SELECT * FROM api_entitlement').all(), before);
  assert.equal(api.sqlite.prepare('SELECT COUNT(*) AS n FROM validation_api_key').get().n, 1);
});
