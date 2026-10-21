import assert from 'node:assert/strict';
import test from 'node:test';
import { setupEmail } from './helpers/email-auth.mjs';

test('email cooldown is atomic, shared across purposes, and normalizes address casing', async (t) => {
  const { issue, messages, now } = setupEmail(t);
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => issue()));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(messages.length, 1);
  await assert.rejects(issue({ email: 'LAB@Example.test', purpose: 'recover', ip: '192.0.2.2' }, now + 59), { status: 429 });
  await issue({}, now + 60);
});

test('hourly email limit survives resends and different requesting addresses', async (t) => {
  const { issue, now } = setupEmail(t);
  for (let index = 0; index < 5; index++) await issue({ ip: `192.0.2.${index}` }, now + index * 61);
  await assert.rejects(issue({}, now + 5 * 61), { status: 429 });
  await issue({}, now + 3600);
});

test('IP and global caps bound requests to many different email addresses', async (t) => {
  const { issue, sqlite, now } = setupEmail(t);
  for (let index = 0; index < 20; index++) await issue({ email: `lab${index}@example.test` });
  await assert.rejects(issue({ email: 'overflow@example.test' }), { status: 429 });
  sqlite.prepare("UPDATE email_auth_limit SET count = 1000 WHERE id = 'service-day'").run();
  await assert.rejects(issue({ email: 'other@example.test', ip: '192.0.2.2' }), { status: 429 });
  await issue({}, now + 86400);
});
