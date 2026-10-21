import assert from 'node:assert/strict';
import test from 'node:test';
import { startPages } from './helpers/pages.mjs';

test('Cloudflare Pages build serves the dashboard with local D1 bindings', { timeout: 60_000 }, async (t) => {
  const { origin, request, emailCode, executeSQL } = await startPages(t);
  let cookie = '';
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
    for (const path of ['/validate', '/review', '/docs', '/docs/getting-started', '/docs/coverage',
      '/docs/report-review', '/docs/fish-builder', '/docs/cnv-evidence', '/docs/review-references',
      '/docs/integration', '/docs/lab-evaluation', '/explain', '/explain/del(5)(p15)', '/about', '/privacy', '/terms']) {
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

  await t.test('public evaluation downloads provide notation and a blank review worksheet', async () => {
    const inputs = await request('/evaluation/inputs.txt');
    assert.equal(inputs.status, 200);
    assert.match(inputs.headers.get('content-disposition'), /attachment; filename="iscn-evaluation-inputs.txt"/);
    assert.equal((await inputs.text()).trimEnd().split('\n').length, 10);
    const worksheet = await request('/evaluation/worksheet.csv');
    assert.equal(worksheet.status, 200);
    assert.match(worksheet.headers.get('content-type'), /text\/csv/);
    assert.match(await worksheet.text(), /"Observed UI status","Observed core valid","Reviewer notes"/);
    assert.equal((await request('/evaluation/missing.txt')).status, 404);
  });

  await t.test('signup waits for email verification and then creates a secure session', async () => {
    const response = await post('/signup?/request', { email: 'upgrade@example.test' });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Check your email/);
    assert.doesNotMatch(html, /iscn_live_/);
    const challenge = response.headers.get('set-cookie');
    assert.match(challenge, /HttpOnly/i);
    assert.match(challenge, /Secure/i);
    assert.doesNotMatch(challenge, /iscn_session=/);
    cookie = challenge.split(';')[0];
    assert.equal((await request('/dashboard', { headers: { cookie } })).status, 302);
    const verify = await post('/signup?/verify', { code: await emailCode('upgrade@example.test') });
    assert.equal(verify.status, 303);
    assert.equal(verify.headers.get('location'), '/dashboard');
    cookie = verify.headers.getSetCookie().find((value) => value.startsWith('iscn_session=')).split(';')[0];
    const dashboard = await request('/dashboard', { headers: { cookie } });
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.headers.get('cache-control'), 'private, no-store');
    assert.match(await dashboard.text(), /upgrade@example\.test/);
  });

  await t.test('retired account-key creation is unavailable and email access is explained', async () => {
    assert.equal((await post('/dashboard/keys?/create')).status, 405);
    const access = await request('/dashboard/keys', { headers: { cookie } });
    assert.match(await access.text(), /one-time code/);
  });

  await t.test('billing reports missing configuration', async () => {
    const response = await post('/dashboard/billing?/upgrade');
    assert.equal(response.status, 503);
    assert.match(await response.text(), /Paid checkout is not available/);
  });

  await t.test('logout invalidates the session and email-code login works', async () => {
    const logout = await post('/dashboard?/logout');
    assert.equal(logout.status, 302);
    assert.equal(logout.headers.get('location'), '/login');
    assert.equal((await request('/dashboard', { headers: { cookie } })).status, 302);
    cookie = '';
    await executeSQL('UPDATE email_auth_limit SET resets_at = 0');
    const login = await post('/login?/request', { email: 'upgrade@example.test' });
    assert.equal(login.status, 200);
    cookie = login.headers.get('set-cookie').split(';')[0];
    const signedIn = await post('/login?/verify', { code: await emailCode('upgrade@example.test') });
    assert.equal(signedIn.status, 303);
    assert.match(signedIn.headers.get('set-cookie'), /iscn_session=/);
    const oldKey = await post('/login', { api_key: 'iscn_live_retired' });
    assert.equal(oldKey.status, 404);
  });

  await t.test('cross-origin code requests and oversized forms are rejected', async () => {
    const crossOrigin = await request('/signup?/request', {
      method: 'POST', headers: { origin: 'https://other.example.test' }, body: new URLSearchParams({ email: 'csrf@example.test' }),
    });
    assert.equal(crossOrigin.status, 403);
    assert.equal((await post('/signup?/request', { email: 'x'.repeat(9000) })).status, 413);
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
