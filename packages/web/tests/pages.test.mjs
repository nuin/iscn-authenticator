import assert from 'node:assert/strict';
import test from 'node:test';
import { startPages } from './helpers/pages.mjs';

test('Cloudflare Pages build serves the dashboard with local D1 bindings', { timeout: 60_000 }, async (t) => {
  const { origin, request } = await startPages(t);
  let cookie = '';
  let initialKey;
  let keyId;
  const post = (path, values = {}) => request(path, {
    method: 'POST', body: new URLSearchParams(values), headers: { origin, cookie, accept: 'text/html' },
  });

  await t.test('public pages and authentication redirect', async () => {
    const home = await request('/');
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Every karyotype/);
    const dashboard = await request('/dashboard');
    assert.equal(dashboard.status, 302);
    assert.equal(dashboard.headers.get('location'), '/login');
  });

  await t.test('product documentation and example links resolve', async () => {
    for (const path of ['/validate', '/docs', '/docs/getting-started', '/docs/coverage',
      '/docs/integration', '/explain', '/explain/del(5)(p15)', '/about', '/privacy', '/terms']) {
      const response = await request(path);
      assert.equal(response.status, 200, path);
    }
    assert.equal((await request('/docs/not-a-guide')).status, 404);
    const legacy = await request('/?karyotype=46%2CXX');
    assert.equal(legacy.status, 302);
    assert.equal(legacy.headers.get('location'), '/validate?karyotype=46%2CXX');
    const pricing = await request('/pricing');
    const html = await pricing.text();
    assert.match(html, /Paid checkout is not available yet/);
    assert.doesNotMatch(html, /100,000 API requests|\$29/);
  });

  await t.test('signup creates a key and secure session', async () => {
    const response = await post('/signup', { email: 'upgrade@example.test' });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Account created/);
    initialKey = html.match(/iscn_live_[a-f0-9]{32}/)?.[0];
    assert.ok(initialKey);
    const session = response.headers.get('set-cookie');
    assert.match(session, /HttpOnly/i);
    assert.match(session, /Secure/i);
    cookie = session.split(';')[0];
    const dashboard = await request('/dashboard', { headers: { cookie } });
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /upgrade@example\.test/);
  });

  await t.test('keys can be created and revoked', async () => {
    const created = await post('/dashboard/keys?/create');
    assert.equal(created.status, 200);
    const html = await created.text();
    assert.match(html, /iscn_live_[a-f0-9]{32}/);
    keyId = html.match(/Manual key[\s\S]*?name="key_id" value="([^"]+)"/)?.[1];
    assert.ok(keyId);
    const revoked = await post('/dashboard/keys?/revoke', { key_id: keyId });
    assert.equal(revoked.status, 200);
    assert.match(await revoked.text(), /Revoked/);
  });

  await t.test('billing reports missing configuration', async () => {
    const response = await post('/dashboard/billing?/upgrade');
    assert.equal(response.status, 503);
    assert.match(await response.text(), /Paid checkout is not available/);
  });

  await t.test('logout invalidates the session and API-key login works', async () => {
    const logout = await post('/dashboard?/logout');
    assert.equal(logout.status, 302);
    assert.equal(logout.headers.get('location'), '/login');
    const expired = await request('/dashboard', { headers: { cookie } });
    assert.equal(expired.status, 302);
    cookie = '';
    const login = await post('/login', { api_key: initialKey });
    assert.equal(login.status, 302);
    assert.equal(login.headers.get('location'), '/dashboard');
    assert.match(login.headers.get('set-cookie'), /iscn_session=/);
  });

  await t.test('explanation miss endpoint validates JSON input', async () => {
    for (const body of [{}, { signature: 42 }, null]) {
      const response = await request('/api/explain/miss', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
    }
  });
});
