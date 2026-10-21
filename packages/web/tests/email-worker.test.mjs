import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../email-worker/worker.ts';

const payload = { to: 'recipient@example.test', subject: 'Account notification', text: 'Plain text', html: '<p>Plain text</p>' };
const request = (body = payload, headers = {}) => new Request('https://mailer.internal/send', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
function environment(send = async () => ({ messageId: 'provider-message-id' })) {
  return { EMAIL: { send }, EMAIL_FROM: 'iscn@example.test', EMAIL_REPLY_TO: 'support@example.test' };
}

test('private mailer uses its configured sender and reply-to and awaits provider acceptance', async () => {
  let sent;
  const response = await worker.fetch(request(), environment(async (message) => {
    sent = message;
    return { messageId: 'accepted-id' };
  }));
  assert.equal(response.status, 202);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await response.json()).message_id, 'accepted-id');
  assert.deepEqual(sent, { ...payload, from: { email: 'iscn@example.test', name: 'Bioinformat ISCN' }, replyTo: 'support@example.test' });
});

test('plain-text-only transactional emails are accepted', async () => {
  const textOnly = { ...payload };
  delete textOnly.html;
  assert.equal((await worker.fetch(request(textOnly), environment())).status, 202);
});

for (const [label, update] of [
  ['sender override', { from: 'attacker@example.test' }],
  ['recipient array', { to: ['recipient@example.test'] }],
  ['recipient header injection', { to: 'recipient@example.test\r\nBcc: other@example.test' }],
  ['recipient control character', { to: 'recipient\u0000@example.test' }],
  ['subject header injection', { subject: 'Hello\nBcc: other@example.test' }],
  ['empty subject', { subject: ' ' }],
  ['oversized subject', { subject: 'a'.repeat(201) }],
  ['missing plain text', { text: '' }],
  ['oversized text', { text: 'a'.repeat(12001) }],
  ['oversized HTML', { html: 'a'.repeat(16001) }],
  ['non-string HTML', { html: 123 }],
]) {
  test(`rejects ${label} before invoking the provider`, async () => {
    const response = await worker.fetch(request({ ...payload, ...update }), environment(() => assert.fail('Must not send')));
    assert.equal(response.status, 400);
  });
}

test('rejects malformed, compressed and oversized requests', async () => {
  const env = environment(() => assert.fail('Must not send'));
  const malformed = new Request('https://mailer.internal/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal((await worker.fetch(malformed, env)).status, 400);
  assert.equal((await worker.fetch(request(null), env)).status, 400);
  assert.equal((await worker.fetch(request(payload, { 'Content-Encoding': 'gzip' }), env)).status, 415);
  assert.equal((await worker.fetch(request(payload, { 'Content-Type': 'text/plain' }), env)).status, 415);
  assert.equal((await worker.fetch(request({ ...payload, text: 'a'.repeat(32769) }), env)).status, 413);
});

test('health checks and unsupported routes do not send mail', async () => {
  const env = environment(() => assert.fail('Must not send'));
  assert.equal((await worker.fetch(new Request('https://mailer.internal/health'), env)).status, 200);
  assert.equal((await worker.fetch(new Request('https://mailer.internal/send'), env)).status, 405);
  assert.equal((await worker.fetch(new Request('https://mailer.internal/other'), env)).status, 404);
});

test('provider failures are not accepted and do not expose message contents', async (t) => {
  const log = t.mock.method(console, 'error', () => {});
  const response = await worker.fetch(request(), environment(async () => {
    throw new Error('recipient@example.test secret-token provider diagnostic');
  }));
  assert.equal(response.status, 502);
  const output = await response.text();
  assert.equal(JSON.parse(output).error, 'email_send_failed');
  assert.doesNotMatch(output + JSON.stringify(log.mock.calls), /secret-token|recipient@example|provider diagnostic/);
});
