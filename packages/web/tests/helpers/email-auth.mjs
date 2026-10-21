import { createTestDatabase } from './sqlite.mjs';
import { requestCode } from '../../src/lib/server/email-auth/challenges.ts';

export const TEST_EMAIL_SECRET = 'isolated-local-test-secret-never-use-in-production';

export function setupEmail(t) {
  const database = createTestDatabase(t);
  const messages = [];
  const mailer = { async fetch(url, options) {
    if (new URL(url).pathname !== '/send') throw new Error('Wrong mailer endpoint');
    messages.push(JSON.parse(options.body));
    return Response.json({ status: 'accepted', message_id: 'test-message' }, { status: 202 });
  } };
  return { ...database, messages, mailer, now: 1_800_000_000,
    async issue(overrides = {}, now = 1_800_000_000) {
      const input = { email: 'lab@example.test', purpose: 'signup', ip: '192.0.2.1', url: 'https://app.example.test', secret: TEST_EMAIL_SECRET, ...overrides };
      const issued = await requestCode(database.db, mailer, input, now);
      return { ...issued, code: messages.at(-1).text.match(/^\d{8}$/m)[0], purpose: input.purpose };
    },
  };
}
