import type { BillingEvent, BillingTarget } from '#lib/server/stripe-events.js';
import { listCurrentSubscriptions } from '#lib/server/stripe.js';

interface BillingAccount {
  id: string;
  stripe_customer_id: string | null;
}

interface AccountChange {
  userId: string;
  customerId: string;
  plan: 'free' | 'past_due' | 'pro';
}

async function accountChange(
  db: D1Database, target: BillingTarget, secretKey: string, priceId: string,
): Promise<AccountChange | null> {
  const account = await db.prepare(target.userId
    ? 'SELECT id, stripe_customer_id FROM user WHERE id = ?'
    : 'SELECT id, stripe_customer_id FROM user WHERE stripe_customer_id = ?')
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
  return { userId: account.id, customerId: target.customerId, plan };
}

function stateStatements(db: D1Database, eventId: string, change: AccountChange): D1PreparedStatement[] {
  return [
    db.prepare(`UPDATE user SET stripe_customer_id = ?, plan = ?, plan_expires_at = NULL
      WHERE id = ? AND (stripe_customer_id IS NULL OR stripe_customer_id = ?)
      AND NOT EXISTS (SELECT 1 FROM processed_webhook WHERE event_id = ?)`)
      .bind(change.customerId, change.plan, change.userId, change.customerId, eventId),
    db.prepare(`INSERT OR IGNORE INTO processed_webhook (event_id, processed_at)
      SELECT ?, ? WHERE EXISTS (SELECT 1 FROM user WHERE id = ? AND stripe_customer_id = ?)`)
      .bind(eventId, Math.floor(Date.now() / 1000), change.userId, change.customerId),
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
