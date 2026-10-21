import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { startPages } from './helpers/pages.mjs';

test('hosted API exposes JSON authentication and protocol errors', async (t) => {
  const key = `iscn_api_${'b'.repeat(64)}`;
  const hash = createHash('sha256').update(key).digest('hex');
  const now = Math.floor(Date.now() / 1000);
  const { request } = await startPages(t, { seedSQL: `
    INSERT INTO user (id, email, created_at, plan) VALUES ('api-http', 'api-http@example.test', ${now}, 'pro');
    INSERT INTO validation_api_key (id, user_id, label, hash, created_at) VALUES ('key-http', 'api-http', 'HTTP test', '${hash}', ${now});
    INSERT INTO api_entitlement VALUES ('api-http', 'sub_http', 'price_http', ${now - 60}, ${now + 3600}, 2);
  ` });
  const response = await request('/api/v1/validate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ karyotype: '46,XX' }),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'unauthorized');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(response.headers.get('x-request-id'));
  const wrongMethod = await request('/api/v1/validate');
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'POST');
  assert.equal((await wrongMethod.json()).error.code, 'method_not_allowed');
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  for (const notation of ['46,XX', 'invalid']) {
    const checked = await request('/api/v1/validate', { method: 'POST', headers, body: JSON.stringify({ karyotype: notation }) });
    assert.equal(checked.status, 200);
    const review = await checked.json();
    assert.equal(review.result.valid, notation === '46,XX');
    assert.ok(review.validation.rule_version);
  }
  const exhausted = await request('/api/v1/validate', { method: 'POST', headers, body: JSON.stringify({ karyotype: '46,XX' }) });
  assert.equal(exhausted.status, 429);
  assert.equal((await exhausted.json()).error.code, 'quota_exceeded');
  const usage = await request('/api/v1/usage', { headers });
  assert.equal((await usage.json()).usage.used, 2);
  const spec = await request('/api/v1/openapi.json');
  assert.equal(spec.status, 200);
  assert.ok((await spec.json()).paths['/validate'].post.responses['402']);
});
