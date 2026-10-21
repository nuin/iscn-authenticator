import assert from 'node:assert/strict';
import test from 'node:test';
import { setupApi } from './helpers/validation-api.mjs';
import { consumeValidation, getEntitlement } from '../src/lib/server/validation-api/usage.ts';

for (const mode of ['delayed minute', 'renewal within minute']) {
  test(`${mode} cannot reopen an exhausted account minute`, async (t) => {
    const api = await setupApi(t, { limit: 1000 });
    const now = Math.floor(api.now / 60) * 60 + 20;
    const key = { ...api.key, user_id: 'api-user' };
    let entitlement = await getEntitlement(api.db, 'api-user', now);
    for (let i = 0; i < 60; i++) await consumeValidation(api.db, key, entitlement, now);
    if (mode === 'delayed minute') {
      await assert.rejects(consumeValidation(api.db, key, entitlement, now - 60), { status: 429 });
    } else {
      api.sqlite.prepare('UPDATE api_entitlement SET period_start = ?').run(now);
      entitlement = await getEntitlement(api.db, 'api-user', now);
    }
    await assert.rejects(consumeValidation(api.db, key, entitlement, now + 1), { status: 429 });
    assert.equal(api.used(), 60);
    await consumeValidation(api.db, key, entitlement, now + 60);
    assert.equal(api.used(), 61);
  });
}

test('quota write failure rolls back the reserved minute slot', async (t) => {
  const api = await setupApi(t);
  const entitlement = await getEntitlement(api.db, 'api-user', api.now);
  const key = { ...api.key, user_id: 'api-user' };
  api.sqlite.exec("CREATE TRIGGER fail_quota BEFORE INSERT ON api_usage BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
  await assert.rejects(consumeValidation(api.db, key, entitlement, api.now));
  assert.equal(api.sqlite.prepare('SELECT COUNT(*) AS n FROM api_rate_limit').get().n, 0);
  assert.equal(api.used(), 0);
  api.sqlite.exec('DROP TRIGGER fail_quota');
  await consumeValidation(api.db, key, entitlement, api.now);
  assert.equal(api.used(), 1);
  assert.equal(api.sqlite.prepare('SELECT requests FROM api_rate_limit').get().requests, 1);
});
