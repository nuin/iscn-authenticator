import type { EmailPurpose } from './challenges.ts';
import { codeDigest, digest, randomToken } from './crypto.ts';
import { EmailAuthError } from './limits.ts';

const INVALID_CODE = 'The code is incorrect, expired or already used. Request a new code if needed. For a new account, use Create an account.';

export async function verifyCode(db: D1Database, token: string, code: string, purpose: EmailPurpose, secret: string | undefined, now = Math.floor(Date.now() / 1000)) {
  if (!/^[a-f0-9]{64}$/.test(token) || code.length > 32) throw new EmailAuthError(400, INVALID_CODE);
  const id = await digest(token);
  const hash = await codeDigest(secret, token, code.trim());
  const sessionId = randomToken();
  const userId = crypto.randomUUID();
  const expires = now + 30 * 86400;
  const owner = `SELECT u.id FROM user u JOIN email_challenge c ON lower(trim(u.email)) = c.email
    WHERE c.id = ? AND c.claim = ? AND (SELECT COUNT(*) FROM user WHERE lower(trim(email)) = c.email) = 1`;
  const needsReset = `(${owner}) AND ( ? = 'recover' OR NOT EXISTS
    (SELECT 1 FROM account_email_verification v WHERE v.user_id = session.user_id))`;
  const statements = [
    db.prepare(`UPDATE email_challenge SET attempts = attempts + 1, claim = CASE WHEN code_hash = ? THEN ? ELSE NULL END
      WHERE id = ? AND purpose = ? AND sent = 1 AND claim IS NULL AND attempts < 5 AND expires_at > ?`)
      .bind(hash, sessionId, id, purpose, now),
    db.prepare(`INSERT INTO user (id, email, created_at)
      SELECT ?, email, ? FROM email_challenge WHERE id = ? AND claim = ? AND purpose = 'signup'
      AND NOT EXISTS (SELECT 1 FROM user WHERE lower(trim(user.email)) = email_challenge.email)`)
      .bind(userId, now, id, sessionId),
    db.prepare(`DELETE FROM session WHERE user_id IN ${needsReset}`).bind(id, sessionId, purpose),
    db.prepare(`UPDATE api_key SET revoked_at = ? WHERE revoked_at IS NULL AND user_id IN (${owner})`)
      .bind(now, id, sessionId),
    // Credentials created before email ownership was established cannot be trusted.
    db.prepare(`UPDATE validation_api_key SET revoked_at = ? WHERE revoked_at IS NULL AND user_id IN (${owner})
      AND NOT EXISTS (SELECT 1 FROM account_email_verification v WHERE v.user_id = validation_api_key.user_id)`)
      .bind(now, id, sessionId),
    db.prepare(`INSERT INTO account_email_verification (user_id, email, verified_at)
      SELECT u.id, c.email, ? FROM user u JOIN email_challenge c ON lower(trim(u.email)) = c.email
      WHERE c.id = ? AND c.claim = ? AND (SELECT COUNT(*) FROM user WHERE lower(trim(email)) = c.email) = 1
      ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, verified_at = excluded.verified_at`)
      .bind(now, id, sessionId),
    db.prepare(`INSERT INTO session (id, user_id, expires_at) SELECT ?, id, ? FROM user WHERE id IN (${owner})`)
      .bind(sessionId, expires, id, sessionId),
    db.prepare(`DELETE FROM email_challenge WHERE id != ? AND email =
      (SELECT email FROM email_challenge WHERE id = ? AND claim = ? AND purpose = 'recover')`)
      .bind(id, id, sessionId),
    db.prepare('SELECT user_id FROM session WHERE id = ?').bind(sessionId),
  ];
  const results = await db.batch<{ user_id: string }>(statements);
  const session = results.at(-1)?.results[0];
  if (!session) throw new EmailAuthError(400, INVALID_CODE);
  return { id: sessionId, user_id: session.user_id, expires_at: expires };
}
