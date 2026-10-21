import assert from 'node:assert/strict';
import test from 'node:test';
import { setupEmail, TEST_EMAIL_SECRET } from './helpers/email-auth.mjs';
import { requestCode, readChallenge, normalizeEmail } from '../src/lib/server/email-auth/challenges.ts';
import { verifyCode } from '../src/lib/server/email-auth/verify.ts';

test('signup sends a code without creating an account, then verifies and starts a session', async (t) => {
  const { db, sqlite, issue, messages, now } = setupEmail(t);
  const issued = await issue({ email: ' LAB@Example.test ' });
  assert.equal(sqlite.prepare('SELECT count(*) n FROM user').get().n, 0);
  assert.equal(messages[0].to, 'lab@example.test');
  assert.match(messages[0].subject, /verify/);
  const stored = JSON.stringify(sqlite.prepare('SELECT * FROM email_challenge').all());
  assert.ok(!stored.includes(issued.code));
  assert.ok(!stored.includes(issued.token));
  const session = await verifyCode(db, issued.token, issued.code, 'signup', TEST_EMAIL_SECRET, now);
  assert.equal(session.expires_at, now + 2592000);
  assert.equal(sqlite.prepare('SELECT email FROM user').get().email, 'lab@example.test');
  assert.equal(sqlite.prepare('SELECT verified_at FROM account_email_verification').get().verified_at, now);
  assert.equal(sqlite.prepare('SELECT user_id FROM session').get().user_id, session.user_id);
});

test('simultaneous verification and replay can create only one session', async (t) => {
  const { db, sqlite, issue, now } = setupEmail(t);
  const { token, code } = await issue();
  const attempts = await Promise.allSettled(Array.from({ length: 8 }, () => verifyCode(db, token, code, 'signup', TEST_EMAIL_SECRET, now)));
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM session').get().n, 1);
  await assert.rejects(verifyCode(db, token, code, 'signup', TEST_EMAIL_SECRET, now), { status: 400 });
});

test('wrong browser, wrong purpose and exact expiry boundary reject codes', async (t) => {
  const { db, sqlite, issue, now } = setupEmail(t);
  const { token, code } = await issue();
  await assert.rejects(verifyCode(db, 'a'.repeat(64), code, 'signup', TEST_EMAIL_SECRET, now), { status: 400 });
  await assert.rejects(verifyCode(db, token, code, 'recover', TEST_EMAIL_SECRET, now), { status: 400 });
  await assert.rejects(verifyCode(db, token, code, 'signup', TEST_EMAIL_SECRET, now + 600), { status: 400 });
  assert.equal(await readChallenge(db, token, 'signup', now + 600), null);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM session').get().n, 0);
});

test('five wrong attempts lock the challenge including concurrent guesses', async (t) => {
  const { db, sqlite, issue, now } = setupEmail(t);
  const { token, code } = await issue();
  await Promise.allSettled(Array.from({ length: 12 }, () => verifyCode(db, token, 'wrong', 'signup', TEST_EMAIL_SECRET, now)));
  assert.equal(sqlite.prepare('SELECT attempts FROM email_challenge').get().attempts, 5);
  await assert.rejects(verifyCode(db, token, code, 'signup', TEST_EMAIL_SECRET, now), { status: 400 });
  assert.equal(await readChallenge(db, token, 'signup', now), null);
});

test('resend replaces the code for this browser without accepting the previous code', async (t) => {
  const { db, issue, now } = setupEmail(t);
  const old = await issue();
  const replacement = await issue({ previous: old.token }, now + 60);
  await assert.rejects(verifyCode(db, old.token, old.code, 'signup', TEST_EMAIL_SECRET, now + 61), { status: 400 });
  await verifyCode(db, replacement.token, replacement.code, 'signup', TEST_EMAIL_SECRET, now + 61);
});

test('mailer failures never leave a usable challenge or account', async (t) => {
  const { db, sqlite, now } = setupEmail(t);
  for (const [index, fetch] of [async () => new Response('', { status: 502 }), async () => { throw new Error('provider secret'); }].entries()) {
    await assert.rejects(requestCode(db, { fetch }, { email: `lab${index}@example.test`, purpose: 'signup', secret: TEST_EMAIL_SECRET, ip: '192.0.2.1', url: 'https://app.example.test' }, now),
      (error) => error.status === 503 && !error.message.includes('provider secret'));
  }
  assert.equal(sqlite.prepare('SELECT count(*) n FROM email_challenge').get().n, 0);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM user').get().n, 0);
});

test('login and recovery cannot create accounts for unknown addresses', async (t) => {
  const { db, sqlite, issue, now } = setupEmail(t);
  for (const purpose of ['login', 'recover']) {
    const { token, code } = await issue({ purpose, email: `${purpose}@example.test` });
    await assert.rejects(verifyCode(db, token, code, purpose, TEST_EMAIL_SECRET, now), { status: 400 });
  }
  assert.equal(sqlite.prepare('SELECT count(*) n FROM user').get().n, 0);
});

test('first verification retires pre-verification credentials and preserves account billing', async (t) => {
  const { db, sqlite, issue, now } = setupEmail(t);
  sqlite.exec(`INSERT INTO user (id,email,created_at,plan,stripe_customer_id) VALUES ('legacy','Lab@Example.test',1,'pro','cus_legacy');
    INSERT INTO session VALUES ('old-session','legacy',1900000000);
    INSERT INTO api_key (id,user_id,label,hash,env,created_at) VALUES ('old-key','legacy','old','hash','live',1);
    INSERT INTO validation_api_key (id,user_id,label,hash,created_at) VALUES ('integration','legacy','LIMS','api-hash',1);`);
  const { token, code } = await issue({ purpose: 'login' });
  const session = await verifyCode(db, token, code, 'login', TEST_EMAIL_SECRET, now);
  assert.equal(session.user_id, 'legacy');
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM session').get().n, 1);
  assert.equal(sqlite.prepare('SELECT revoked_at FROM api_key').get().revoked_at, now);
  assert.equal(sqlite.prepare('SELECT revoked_at FROM validation_api_key').get().revoked_at, now);
  assert.equal(sqlite.prepare('SELECT stripe_customer_id FROM user').get().stripe_customer_id, 'cus_legacy');
});

test('normal sign-in preserves other verified sessions; recovery invalidates them and keeps API keys', async (t) => {
  const { db, sqlite, issue, now } = setupEmail(t);
  const first = await issue();
  const initial = await verifyCode(db, first.token, first.code, 'signup', TEST_EMAIL_SECRET, now);
  sqlite.prepare(`INSERT INTO validation_api_key (id,user_id,label,hash,created_at) VALUES ('integration',?,'LIMS','hash',1)`).run(initial.user_id);
  const login = await issue({ purpose: 'login' }, now + 60);
  await verifyCode(db, login.token, login.code, 'login', TEST_EMAIL_SECRET, now + 60);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM session').get().n, 2);
  const recovery = await issue({ purpose: 'recover' }, now + 120);
  const recovered = await verifyCode(db, recovery.token, recovery.code, 'recover', TEST_EMAIL_SECRET, now + 120);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM session').get().n, 1);
  assert.equal(sqlite.prepare('SELECT id FROM session').get().id, recovered.id);
  assert.equal(sqlite.prepare('SELECT revoked_at FROM validation_api_key').get().revoked_at, null);
});

test('ambiguous legacy addresses never merge accounts or grant access', async (t) => {
  const { db, sqlite, issue, now } = setupEmail(t);
  sqlite.exec("INSERT INTO user (id,email,created_at) VALUES ('one','lab@example.test',1),('two','LAB@example.test',1)");
  const { token, code } = await issue();
  await assert.rejects(verifyCode(db, token, code, 'signup', TEST_EMAIL_SECRET, now), { status: 400 });
  assert.equal(sqlite.prepare('SELECT count(*) n FROM session').get().n, 0);
});

test('recovery invalidates other pending login codes as well as old sessions', async (t) => {
  const { db, issue, now } = setupEmail(t);
  const signup = await issue();
  await verifyCode(db, signup.token, signup.code, 'signup', TEST_EMAIL_SECRET, now);
  const pending = await issue({ purpose: 'login' }, now + 60);
  const recovery = await issue({ purpose: 'recover' }, now + 120);
  await verifyCode(db, recovery.token, recovery.code, 'recover', TEST_EMAIL_SECRET, now + 120);
  await assert.rejects(verifyCode(db, pending.token, pending.code, 'login', TEST_EMAIL_SECRET, now + 121), { status: 400 });
});

test('codes cannot be verified with a different deployment secret', async (t) => {
  const { db, issue, now } = setupEmail(t);
  const { token, code } = await issue();
  await assert.rejects(verifyCode(db, token, code, 'signup', 'a-different-secret-with-at-least-32-characters', now), { status: 400 });
  await verifyCode(db, token, code, 'signup', TEST_EMAIL_SECRET, now);
});

test('database failures roll back consumption and account creation together', async (t) => {
  const { db, sqlite, issue, now } = setupEmail(t);
  const { token, code } = await issue();
  sqlite.exec("CREATE TRIGGER fail_session BEFORE INSERT ON session BEGIN SELECT RAISE(ABORT, 'failed'); END");
  await assert.rejects(verifyCode(db, token, code, 'signup', TEST_EMAIL_SECRET, now));
  assert.equal(sqlite.prepare('SELECT count(*) n FROM user').get().n, 0);
  sqlite.exec('DROP TRIGGER fail_session');
  await verifyCode(db, token, code, 'signup', TEST_EMAIL_SECRET, now);
});

test('email normalization rejects header injection and oversized input', () => {
  assert.equal(normalizeEmail(' LAB@Example.test '), 'lab@example.test');
  for (const input of ['bad', 'a@b', 'a\r\nb@example.test', 'x'.repeat(255) + '@example.test']) {
    assert.throws(() => normalizeEmail(input), { status: 400 });
  }
});
