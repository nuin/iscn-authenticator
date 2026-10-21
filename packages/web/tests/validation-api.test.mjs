import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { reviewKaryotype } from '../src/lib/validation.ts';
import { setupApi, validationRequest } from './helpers/validation-api.mjs';
import { createIntegrationKey, revokeIntegrationKey } from '../src/lib/server/validation-api/keys.ts';
import { consumeValidation, getEntitlement } from '../src/lib/server/validation-api/usage.ts';

test('completed checks match browser results and never log notation or credentials', async (t) => {
  const api = await setupApi(t);
  for (const input of ['46,XX', '46,XX,unknown', '47,XX,+21[5]/47,XX,+99[10]', 'bad notation']) {
    const response = await api.call(validationRequest(api.key.plaintext, { karyotype: input }));
    assert.equal(response.status, 200);
    const body = await response.json();
    const review = reviewKaryotype(input);
    assert.deepEqual(body.result, review.result);
    assert.deepEqual(body.coverage, review.coverage);
    assert.equal(body.status, review.status);
    assert.equal(body.validation.rule_version, '2026-10-20.2');
    assert.equal(response.headers.get('x-request-id'), body.request_id);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.ok(!api.logs.join('').includes(input));
  }
  assert.equal(api.used(), 4);
  assert.ok(!api.logs.join('').includes(api.key.plaintext));
});

for (const value of [null, [], {}, { karyotype: 46 }, { karyotype: '' }, { karyotype: ' ' },
  { karyotype: 'x'.repeat(4097) }, { karyotype: '46,XX', patient: 'not accepted' }]) {
  test('malformed request envelopes do not consume paid units', async (t) => {
    const api = await setupApi(t);
    const response = await api.call(validationRequest(api.key.plaintext, value));
    assert.equal(response.status, 400);
    assert.equal(api.used(), 0);
  });
}

test('size, encoding, media type and JSON checks bound untrusted request bodies', async (t) => {
  const api = await setupApi(t);
  const headers = { authorization: `Bearer ${api.key.plaintext}`, 'Content-Type': 'application/json' };
  for (const [options, status] of [
    [{ body: '{' }, 400], [{ body: new Uint8Array([255]) }, 400],
    [{ headers: { ...headers, 'Content-Type': 'text/plain' } }, 415],
    [{ headers: { ...headers, 'Content-Encoding': 'gzip' } }, 415],
    [{ headers: { ...headers, 'Content-Length': '16385' } }, 413],
    [{ body: ' '.repeat(16385) }, 413],
  ]) assert.equal((await api.call(validationRequest(api.key.plaintext, undefined, options))).status, status);
  let canceled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(4096)); }, cancel() { canceled = true; } });
  assert.equal((await api.call(validationRequest(api.key.plaintext, undefined, { body, duplex: 'half' }))).status, 413);
  assert.equal(canceled, true);
  assert.equal(api.used(), 0);
});

test('account keys, cookies and revoked integration keys cannot authenticate', async (t) => {
  const api = await setupApi(t);
  for (const headers of [{ cookie: 'iscn_session=anything' }, { authorization: 'Bearer iscn_live_123' },
    { authorization: `Bearer iscn_api_${'0'.repeat(64)}` }]) {
    assert.equal((await api.call(validationRequest('', undefined, { headers }))).status, 401);
  }
  await revokeIntegrationKey(api.db, 'api-user', api.key.id);
  assert.equal((await api.call(validationRequest(api.key.plaintext))).status, 401);
  assert.equal(api.used(), 0);
});

for (const options of [{ plan: 'free' }, { plan: 'past_due' }, { plan: 'canceled' }, { expires: Math.floor(Date.now() / 1000) - 1 }]) {
  test('unpaid or expired subscriptions cannot consume validation units', async (t) => {
    const api = await setupApi(t, options);
    assert.equal((await api.call(validationRequest(api.key.plaintext))).status, 402);
    assert.equal(api.used(), 0);
  });
}

test('concurrent keys share one atomic subscription-period allowance', async (t) => {
  const api = await setupApi(t, { limit: 3 });
  const second = await createIntegrationKey(api.db, 'api-user', 'Second integration');
  const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => api.call(validationRequest(i % 2 ? second.plaintext : api.key.plaintext))));
  assert.equal(responses.filter((response) => response.status === 200).length, 3);
  assert.equal(responses.filter((response) => response.status === 429).length, 9);
  assert.equal(api.used(), 3);
  const denied = responses.find((response) => response.status === 429);
  assert.equal((await denied.json()).error.code, 'quota_exceeded');
  assert.ok(Number(denied.headers.get('retry-after')) > 0);
  assert.equal(denied.headers.get('x-quota-remaining'), '0');
});

test('minute limits remain atomic and reopening a minute does not reset paid usage', async (t) => {
  const api = await setupApi(t, { limit: 1000 });
  let time = api.now * 1000;
  t.mock.method(Date, 'now', () => time);
  const responses = await Promise.all(Array.from({ length: 70 }, () => api.call(validationRequest(api.key.plaintext))));
  assert.equal(responses.filter((response) => response.status === 200).length, 60);
  assert.equal(api.used(), 60);
  assert.equal((await responses.find((response) => response.status === 429).json()).error.code, 'rate_limited');
  time += 60000;
  assert.equal((await api.call(validationRequest(api.key.plaintext))).status, 200);
  assert.equal(api.used(), 61);
});

test('revocation between authentication and consumption cannot yield a paid result', async (t) => {
  const api = await setupApi(t);
  const entitlement = await getEntitlement(api.db, 'api-user', api.now);
  await revokeIntegrationKey(api.db, 'api-user', api.key.id);
  await assert.rejects(consumeValidation(api.db, { id: api.key.id, user_id: 'api-user' }, entitlement, api.now), { status: 401 });
  assert.equal(api.used(), 0);
});

test('database failures are sanitized and do not disclose SQL, notation or secrets', async (t) => {
  const api = await setupApi(t);
  api.sqlite.exec('DROP TABLE api_usage');
  const response = await api.call(validationRequest(api.key.plaintext));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /SQL|TABLE|api_usage|46,XX/);
  assert.doesNotMatch(api.logs.join(''), /api_usage|46,XX|iscn_api_/);
});

test('all 90 complex corpus cases keep their browser result and review status over the API', async (t) => {
  const api = await setupApi(t, { limit: 1000 });
  const cases = JSON.parse(await readFile(new URL('../../core/tests/data/complex-karyotypes.json', import.meta.url), 'utf8'));
  assert.equal(cases.length, 90);
  let clock = api.now * 1000;
  t.mock.method(Date, 'now', () => clock);
  for (const [index, item] of cases.entries()) {
    clock = (api.now + Math.floor(index / 50) * 60) * 1000;
    const response = await api.call(validationRequest(api.key.plaintext, { karyotype: item.input }));
    assert.equal(response.status, 200, item.id);
    const body = await response.json();
    assert.equal(body.status, item.status, item.id);
    assert.deepEqual(body.result, reviewKaryotype(item.input).result, item.id);
  }
  assert.equal(api.used(), 90);
});
