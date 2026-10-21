import { ApiError, subscriptionRequired, unauthorized } from './errors.ts';
import type { IntegrationKey } from './keys.ts';

export const REQUESTS_PER_MINUTE = 60;
export interface Entitlement {
  user_id: string;
  subscription_id: string;
  price_id: string;
  period_start: number;
  period_end: number;
  monthly_limit: number;
}
interface UsageRow { validations: number; minute_start: number; minute_requests: number }

export async function getEntitlement(db: D1Database, userId: string, now = Math.floor(Date.now() / 1000)): Promise<Entitlement | null> {
  return db.prepare(`SELECT e.* FROM api_entitlement e JOIN user u ON u.id = e.user_id
    WHERE e.user_id = ? AND u.plan = 'pro' AND e.period_start <= ? AND e.period_end > ?`)
    .bind(userId, now, now).first<Entitlement>();
}

export async function readUsage(db: D1Database, entitlement: Entitlement) {
  const row = await db.prepare('SELECT validations FROM api_usage WHERE user_id = ? AND period_start = ?')
    .bind(entitlement.user_id, entitlement.period_start).first<{ validations: number }>();
  return { period_start: entitlement.period_start, period_end: entitlement.period_end,
    limit: entitlement.monthly_limit, used: row?.validations ?? 0,
    remaining: Math.max(0, entitlement.monthly_limit - (row?.validations ?? 0)) };
}

function quotaHeaders(entitlement: Entitlement, used: number): Record<string, string> {
  return { 'X-Quota-Limit': String(entitlement.monthly_limit), 'X-Quota-Used': String(used),
    'X-Quota-Remaining': String(Math.max(0, entitlement.monthly_limit - used)), 'X-Quota-Reset': String(entitlement.period_end) };
}

export async function consumeValidation(db: D1Database, key: IntegrationKey, entitlement: Entitlement, now: number): Promise<Record<string, string>> {
  const minute = Math.floor(now / 60) * 60;
  const row = await db.prepare(`INSERT INTO api_usage (user_id, period_start, validations, minute_start, minute_requests)
    SELECT e.user_id, e.period_start, 1, ?, 1 FROM api_entitlement e
    JOIN validation_api_key k ON k.user_id = e.user_id JOIN user u ON u.id = e.user_id
    WHERE k.id = ? AND k.revoked_at IS NULL AND u.plan = 'pro' AND e.user_id = ?
      AND e.period_start = ? AND e.period_end = ? AND e.monthly_limit = ? AND e.period_start <= ? AND e.period_end > ?
    ON CONFLICT(user_id, period_start) DO UPDATE SET validations = validations + 1,
      minute_requests = CASE WHEN minute_start = excluded.minute_start THEN minute_requests + 1 ELSE 1 END,
      minute_start = excluded.minute_start
    WHERE validations < ? AND (minute_start != excluded.minute_start OR minute_requests < ?)
    RETURNING validations, minute_start, minute_requests`)
    .bind(minute, key.id, key.user_id, entitlement.period_start, entitlement.period_end,
      entitlement.monthly_limit, now, now, entitlement.monthly_limit, REQUESTS_PER_MINUTE).first<UsageRow>();
  if (!row) return rejectConsumption(db, key, entitlement, now);
  return { ...quotaHeaders(entitlement, row.validations), 'X-RateLimit-Limit': String(REQUESTS_PER_MINUTE),
    'X-RateLimit-Remaining': String(REQUESTS_PER_MINUTE - row.minute_requests), 'X-RateLimit-Reset': String(minute + 60) };
}

async function rejectConsumption(db: D1Database, key: IntegrationKey, previous: Entitlement, now: number): Promise<never> {
  const activeKey = await db.prepare('SELECT id FROM validation_api_key WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
    .bind(key.id, key.user_id).first();
  if (!activeKey) throw unauthorized();
  const entitlement = await getEntitlement(db, key.user_id, now);
  if (!entitlement) throw subscriptionRequired();
  if (entitlement.period_start !== previous.period_start || entitlement.period_end !== previous.period_end || entitlement.monthly_limit !== previous.monthly_limit) {
    throw new ApiError(503, 'subscription_changed', 'Subscription settings changed during this request. Retry shortly.', { 'Retry-After': '1' });
  }
  const usage = await readUsage(db, entitlement);
  const exhausted = usage.remaining === 0;
  const reset = exhausted ? entitlement.period_end : (Math.floor(now / 60) + 1) * 60;
  throw new ApiError(429, exhausted ? 'quota_exceeded' : 'rate_limited', exhausted
    ? 'The subscription-period allowance has been used. No overage charge was made.' : 'The per-minute validation limit has been reached.', {
    ...quotaHeaders(entitlement, usage.used), 'Retry-After': String(Math.max(1, reset - now)),
    ...(exhausted ? {} : { 'X-RateLimit-Limit': String(REQUESTS_PER_MINUTE), 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(reset) }),
  });
}
