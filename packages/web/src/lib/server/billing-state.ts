import type { BillingEvent, BillingTarget } from '#lib/server/stripe-events.js';
import { listCurrentSubscriptions } from '#lib/server/stripe.js';
import type { Entitlement } from '#lib/server/validation-api/usage.js';

interface BillingAccount {
  id: string;
  stripe_customer_id: string | null;
  revision: number;
}

interface AccountChange {
  userId: string;
  customerId: string;
  plan: 'free' | 'past_due' | 'pro';
  entitlement: Entitlement | null;
  revision: number;
}

async function accountChange(
  db: D1Database, target: BillingTarget, secretKey: string, priceId: string,
): Promise<AccountChange | null> {
  const account = await db.prepare(`SELECT u.id, u.stripe_customer_id, COALESCE(s.revision, 0) AS revision
    FROM user u LEFT JOIN api_billing_state s ON s.user_id = u.id
    WHERE ${target.userId ? 'u.id' : 'u.stripe_customer_id'} = ?`)
    .bind(target.userId ?? target.customerId).first<BillingAccount>();
  if (!account || (account.stripe_customer_id && account.stripe_customer_id !== target.customerId)) {
    throw new Error('Billing account association unavailable');
  }
  const subscriptions = await listCurrentSubscriptions(secretKey, target.customerId);
  const relevant = subscriptions.filter((subscription) =>
    subscription.userId === account.id && subscription.prices.includes(priceId));
  const triggering = subscriptions.find((subscription) => subscription.id === target.subscriptionId);
  if (!triggering) throw new Error('Subscription missing from current state');
  if (!relevant.some((subscription) => subscription.id === target.subscriptionId)) return null;
  const plan = relevant.some((subscription) => ['active', 'trialing'].includes(subscription.status))
    ? 'pro' : relevant.some((subscription) => subscription.status === 'past_due') ? 'past_due' : 'free';
  const candidates = relevant.flatMap((subscription) => subscription.apiPeriods
    .filter((period) => period.offering.id === priceId)
    .map((period) => ({ user_id: account.id, subscription_id: subscription.id, price_id: priceId,
      period_start: period.start, period_end: period.end, monthly_limit: period.offering.monthlyLimit })));
  const now = Math.floor(Date.now() / 1000);
  const entitlement = candidates.filter((period) => period.period_start <= now && period.period_end > now)
    .sort((left, right) => right.period_start - left.period_start || right.period_end - left.period_end)[0] ?? null;
  return { userId: account.id, customerId: target.customerId, plan, entitlement, revision: account.revision };
}

function entitlementStatement(db: D1Database, eventId: string, change: AccountChange): D1PreparedStatement {
  const entitlement = change.entitlement;
  if (!entitlement) return db.prepare(`DELETE FROM api_entitlement WHERE user_id = ?
    AND NOT EXISTS (SELECT 1 FROM processed_webhook WHERE event_id = ?)
    AND EXISTS (SELECT 1 FROM api_billing_state WHERE user_id = ? AND event_id = ?)`)
    .bind(change.userId, eventId, change.userId, eventId);
  return db.prepare(`INSERT INTO api_entitlement (user_id, subscription_id, price_id, period_start, period_end, monthly_limit)
    SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM processed_webhook WHERE event_id = ?)
    AND EXISTS (SELECT 1 FROM user WHERE id = ? AND stripe_customer_id = ?)
    AND EXISTS (SELECT 1 FROM api_billing_state WHERE user_id = ? AND event_id = ?)
    ON CONFLICT(user_id) DO UPDATE SET subscription_id = excluded.subscription_id, price_id = excluded.price_id,
      period_start = excluded.period_start, period_end = excluded.period_end, monthly_limit = excluded.monthly_limit`)
    .bind(entitlement.user_id, entitlement.subscription_id, entitlement.price_id, entitlement.period_start,
      entitlement.period_end, entitlement.monthly_limit, eventId, change.userId, change.customerId, change.userId, eventId);
}

function stateStatements(db: D1Database, eventId: string, change: AccountChange): D1PreparedStatement[] {
  return [
    db.prepare(`INSERT INTO api_billing_state (user_id, revision, event_id)
      SELECT ?, 1, ? WHERE NOT EXISTS (SELECT 1 FROM processed_webhook WHERE event_id = ?)
      AND EXISTS (SELECT 1 FROM user WHERE id = ? AND (stripe_customer_id IS NULL OR stripe_customer_id = ?))
      ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1, event_id = excluded.event_id
      WHERE revision = ?`)
      .bind(change.userId, eventId, eventId, change.userId, change.customerId, change.revision),
    db.prepare(`UPDATE user SET stripe_customer_id = ?, plan = ?, plan_expires_at = ?
      WHERE id = ? AND (stripe_customer_id IS NULL OR stripe_customer_id = ?)
      AND NOT EXISTS (SELECT 1 FROM processed_webhook WHERE event_id = ?)
      AND EXISTS (SELECT 1 FROM api_billing_state WHERE user_id = ? AND event_id = ?)`)
      .bind(change.customerId, change.plan, change.entitlement?.period_end ?? null, change.userId, change.customerId, eventId, change.userId, eventId),
    entitlementStatement(db, eventId, change),
    db.prepare(`INSERT OR IGNORE INTO processed_webhook (event_id, processed_at)
      SELECT ?, ? WHERE EXISTS (SELECT 1 FROM user WHERE id = ? AND stripe_customer_id = ?)
      AND EXISTS (SELECT 1 FROM api_billing_state WHERE user_id = ? AND event_id = ?)`)
      .bind(eventId, Math.floor(Date.now() / 1000), change.userId, change.customerId, change.userId, eventId),
  ];
}

export async function applyBillingEvent(
  db: D1Database, event: BillingEvent, secretKey: string, priceId: string,
): Promise<void> {
  const processed = () => db.prepare('SELECT 1 FROM processed_webhook WHERE event_id = ?').bind(event.id).first();
  if (await processed()) return;
  const change = event.target ? await accountChange(db, event.target, secretKey, priceId) : null;
  const statements = change ? stateStatements(db, event.id, change) : [
    db.prepare('INSERT OR IGNORE INTO processed_webhook (event_id, processed_at) VALUES (?, ?)')
      .bind(event.id, Math.floor(Date.now() / 1000)),
  ];
  await db.batch(statements);
  if (!(await processed())) throw new Error('Billing account changed during processing');
}
