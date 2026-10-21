import { ApiError, unauthorized } from './errors.ts';

export interface IntegrationKey {
  id: string;
  user_id: string;
  label: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

async function hashKey(plaintext: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plaintext));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createIntegrationKey(db: D1Database, userId: string, label: string, requiredSessionId?: string) {
  if (!label.trim() || label.trim().length > 80) {
    throw new ApiError(400, 'invalid_label', 'Use a key label between 1 and 80 characters.');
  }
  const id = crypto.randomUUID();
  const entropy = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const plaintext = `iscn_api_${entropy}`;
  const createdAt = Math.floor(Date.now() / 1000);
  const result = await db.prepare(`INSERT INTO validation_api_key (id, user_id, label, hash, created_at)
    SELECT ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM validation_api_key WHERE user_id = ? AND revoked_at IS NULL) < 10
      AND (? IS NULL OR EXISTS (SELECT 1 FROM session s JOIN user u ON u.id = s.user_id
        JOIN account_email_verification v ON v.user_id = u.id
        WHERE s.id = ? AND s.user_id = ? AND s.expires_at > ? AND v.email = lower(trim(u.email))))`)
    .bind(id, userId, label.trim(), await hashKey(plaintext), createdAt, userId,
      requiredSessionId ?? null, requiredSessionId ?? null, userId, createdAt).run();
  if (!result.meta.changes) {
    if (requiredSessionId && !(await db.prepare('SELECT id FROM session WHERE id = ? AND user_id = ? AND expires_at > ?')
      .bind(requiredSessionId, userId, createdAt).first())) {
      throw new ApiError(401, 'session_expired', 'Your session has ended. Sign in again to create an API key.');
    }
    throw new ApiError(409, 'key_limit', 'Revoke an unused key before creating another; ten active keys are allowed.');
  }
  return { id, plaintext };
}

export async function listIntegrationKeys(db: D1Database, userId: string): Promise<IntegrationKey[]> {
  const result = await db.prepare(`SELECT id, user_id, label, created_at, last_used_at, revoked_at
    FROM validation_api_key WHERE user_id = ? ORDER BY created_at DESC, id`)
    .bind(userId).all<IntegrationKey>();
  return result.results;
}

export async function revokeIntegrationKey(db: D1Database, userId: string, keyId: string): Promise<void> {
  await db.prepare('UPDATE validation_api_key SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
    .bind(Math.floor(Date.now() / 1000), keyId, userId).run();
}

export async function authenticateIntegrationKey(db: D1Database, request: Request): Promise<IntegrationKey> {
  const match = request.headers.get('authorization')?.match(/^Bearer (iscn_api_[a-f0-9]{64})$/i);
  if (!match) throw unauthorized();
  const key = await db.prepare(`SELECT id, user_id, label, created_at, last_used_at, revoked_at
    FROM validation_api_key WHERE hash = ? AND revoked_at IS NULL`)
    .bind(await hashKey(match[1])).first<IntegrationKey>();
  if (!key) throw unauthorized();
  return key;
}
