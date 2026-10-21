import assert from 'node:assert/strict';
import test from 'node:test';
import './helpers/billing-webhook.mjs';
import { createTestDatabase } from './helpers/sqlite.mjs';
import { setupEmail, TEST_EMAIL_SECRET } from './helpers/email-auth.mjs';
import { requestCode } from '../src/lib/server/email-auth/challenges.ts';
import { verifyCode } from '../src/lib/server/email-auth/verify.ts';
const { env } = await import('cloudflare:workers');
const { handle } = await import('../src/hooks.server.ts');
const { actions } = await import('../src/routes/dashboard/api/+page.server.ts');

test('first verification cannot authenticate a legacy session between database snapshots', { timeout: 5000 }, async (t) => {
  const read = Promise.withResolvers();
  const resume = Promise.withResolvers();
  let gated = false;
  const { db, sqlite } = createTestDatabase(t, async (sql) => {
    if (!gated && sql.includes('FROM session')) { gated = true; read.resolve(); await resume.promise; }
  });
  const now = Math.floor(Date.now() / 1000);
  sqlite.prepare("INSERT INTO user (id,email,created_at) VALUES ('legacy','lab@example.test',1)").run();
  sqlite.prepare("INSERT INTO session VALUES ('attacker-session','legacy',?)").run(now + 3600);
  Object.assign(env, { DB: db });
  let code;
  const issued = await requestCode(db, { fetch: async (_url, options) => {
    code = JSON.parse(options.body).text.match(/^\d{8}$/m)[0];
    return new Response(null, { status: 202 });
  } }, { email: 'lab@example.test', purpose: 'login', ip: '192.0.2.1', url: 'https://app.example.test', secret: TEST_EMAIL_SECRET }, now);
  const event = { url: new URL('https://app.example.test/dashboard'), cookies: { get: () => 'attacker-session', delete() {} }, locals: {} };
  const pending = handle({ event, resolve: async () => new Response('ok') });
  await read.promise;
  await verifyCode(db, issued.token, code, 'login', TEST_EMAIL_SECRET, now);
  resume.resolve();
  await pending;
  assert.equal(sqlite.prepare("SELECT id FROM session WHERE id = 'attacker-session'").get(), undefined);
  assert.equal(event.locals.user, null);
});

test('a key-creation request waiting for its body cannot survive session revocation', async (t) => {
  const { db, sqlite, issue, now } = setupEmail(t);
  env.DB = db;
  const signup = await issue();
  const session = await verifyCode(db, signup.token, signup.code, 'signup', TEST_EMAIL_SECRET, now);
  const body = Promise.withResolvers();
  const pending = actions.create({ locals: { user: { id: session.user_id }, session }, request: { formData: () => body.promise } });
  const recovery = await issue({ purpose: 'recover' }, now + 60);
  await verifyCode(db, recovery.token, recovery.code, 'recover', TEST_EMAIL_SECRET, now + 60);
  body.resolve(new URLSearchParams({ label: 'Late integration' }));
  const response = await pending;
  assert.equal(response.status, 401);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM validation_api_key').get().n, 0);
});
