/**
 * Stripe webhook event dispatch.
 *
 * This module is a pure function of `(kv, event) → Promise<void>`. The
 * caller is responsible for:
 *   1. Reading the raw request body (HMAC must see the exact bytes).
 *   2. Calling `verifyWebhookSignature` from `lib/stripe.ts`.
 *   3. Idempotency: check `["stripe_events", event.id]` in KV with CAS
 *      before invoking `handleStripeEvent`. We deliberately mark the
 *      event as seen before dispatch — this prevents a bad handler from
 *      DoS'ing itself via infinite Stripe retries.
 *
 * Known event types (any others are logged + ignored so Stripe does not
 * retry):
 *   - checkout.session.completed        → attach stripe_customer_id, flip to pro/active
 *   - customer.subscription.updated     → persist SubscriptionRecord, reconcile tier/status
 *   - customer.subscription.deleted     → tier → free, status → cancelled
 *   - invoice.payment_failed            → status → past_due (tier held; dunning handles downgrade)
 *
 * Storage schema:
 *   ["subscriptions", <customer_id>]  → SubscriptionRecord
 */

import type { StripeEvent } from "./stripe.ts";
import {
  attachStripeCustomer,
  type CustomerRecord,
  lookupCustomerById,
  lookupCustomerByStripeId,
  updateCustomerStatus,
  updateCustomerTier,
} from "./customers.ts";
import { StripeWebhookError } from "./errors.ts";

export interface SubscriptionRecord {
  customer_id: string;
  stripe_subscription_id: string;
  tier: "pro";
  current_period_start: string; // ISO 8601
  current_period_end: string; // ISO 8601
  cancel_at_period_end: boolean;
  updated_at: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

export async function saveSubscription(
  kv: Deno.Kv,
  record: SubscriptionRecord,
): Promise<void> {
  await kv.set(["subscriptions", record.customer_id], record);
}

export async function lookupSubscription(
  kv: Deno.Kv,
  customerId: string,
): Promise<SubscriptionRecord | null> {
  const entry = await kv.get<SubscriptionRecord>(["subscriptions", customerId]);
  return entry.value;
}

async function deleteSubscription(kv: Deno.Kv, customerId: string): Promise<void> {
  await kv.delete(["subscriptions", customerId]);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatch a verified Stripe event to the right handler. Unknown event
 * types are logged and ignored (returning 200 to Stripe) so its retry
 * machine does not hammer us over events we do not care about.
 *
 * Errors are raised for events that we *should* understand but whose
 * payload is malformed or references an unknown customer — these
 * indicate data drift or bugs, not Stripe misbehaviour.
 */
export async function handleStripeEvent(
  kv: Deno.Kv,
  event: StripeEvent,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutSessionCompleted(kv, event);
      return;
    case "customer.subscription.updated":
    case "customer.subscription.created":
      await onSubscriptionUpdated(kv, event);
      return;
    case "customer.subscription.deleted":
      await onSubscriptionDeleted(kv, event);
      return;
    case "invoice.payment_failed":
      await onInvoicePaymentFailed(kv, event);
      return;
    default:
      // Not an error — Stripe has hundreds of event types; we only care
      // about the subscription lifecycle. Log for observability and move on.
      console.warn(`[stripe] ignoring unhandled event type: ${event.type} (${event.id})`);
      return;
  }
}

// ---------------------------------------------------------------------------
// Individual event handlers
// ---------------------------------------------------------------------------

async function onCheckoutSessionCompleted(
  kv: Deno.Kv,
  event: StripeEvent,
): Promise<void> {
  const session = event.data.object;
  const customerId = extractOurCustomerId(session);
  if (!customerId) {
    throw new StripeWebhookError("checkout.session.completed missing customer_id");
  }
  const customer = await lookupCustomerById(kv, customerId);
  if (!customer) {
    throw new StripeWebhookError(`Unknown customer_id on checkout session: ${customerId}`);
  }
  const stripeCustomerId = asString(session.customer);
  if (!stripeCustomerId) {
    throw new StripeWebhookError("checkout.session.completed missing customer (Stripe id)");
  }
  await attachStripeCustomer(kv, customerId, stripeCustomerId);
  await updateCustomerTier(kv, customerId, "pro");
  await updateCustomerStatus(kv, customerId, "active");
  // Subscription record is populated by the follow-on
  // customer.subscription.updated event which Stripe always fires
  // alongside a completed checkout — one fewer outbound call here.
}

async function onSubscriptionUpdated(
  kv: Deno.Kv,
  event: StripeEvent,
): Promise<void> {
  const sub = event.data.object;
  const customer = await resolveCustomerForSubscription(kv, sub);
  const subscriptionId = asString(sub.id);
  if (!subscriptionId) {
    throw new StripeWebhookError("subscription event missing id");
  }
  const status = asString(sub.status) ?? "";

  // Derive our tier + status from Stripe's subscription status.
  let tier: "free" | "pro" = "pro";
  let customerStatus: "active" | "past_due" | "cancelled" = "active";
  switch (status) {
    case "active":
    case "trialing":
      tier = "pro";
      customerStatus = "active";
      break;
    case "past_due":
      tier = "pro"; // grace period — Stripe Smart Retries may recover
      customerStatus = "past_due";
      break;
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      tier = "free";
      customerStatus = "cancelled";
      break;
    default:
      // "incomplete", "paused", etc. — leave tier alone but surface the
      // status for operators.
      console.warn(`[stripe] subscription ${subscriptionId} status=${status} — no tier change`);
      return;
  }

  const record: SubscriptionRecord = {
    customer_id: customer.id,
    stripe_subscription_id: subscriptionId,
    tier: "pro",
    current_period_start: toIso(sub.current_period_start) ?? "",
    current_period_end: toIso(sub.current_period_end) ?? "",
    cancel_at_period_end: sub.cancel_at_period_end === true,
    updated_at: new Date().toISOString(),
  };
  await saveSubscription(kv, record);
  await updateCustomerTier(kv, customer.id, tier);
  await updateCustomerStatus(kv, customer.id, customerStatus);
}

async function onSubscriptionDeleted(
  kv: Deno.Kv,
  event: StripeEvent,
): Promise<void> {
  const sub = event.data.object;
  const customer = await resolveCustomerForSubscription(kv, sub);
  await updateCustomerTier(kv, customer.id, "free");
  await updateCustomerStatus(kv, customer.id, "cancelled");
  await deleteSubscription(kv, customer.id);
}

async function onInvoicePaymentFailed(
  kv: Deno.Kv,
  event: StripeEvent,
): Promise<void> {
  const invoice = event.data.object;
  const stripeCustomerId = asString(invoice.customer);
  if (!stripeCustomerId) {
    throw new StripeWebhookError("invoice.payment_failed missing customer");
  }
  const customer = await lookupCustomerByStripeId(kv, stripeCustomerId);
  if (!customer) {
    throw new StripeWebhookError(
      `invoice.payment_failed for unknown Stripe customer: ${stripeCustomerId}`,
    );
  }
  // Status flip only — tier stays "pro" until dunning gives up and a
  // subsequent subscription.deleted/updated event downgrades.
  await updateCustomerStatus(kv, customer.id, "past_due");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Walk through the three places we plant our customer id on a Stripe
 * session (`client_reference_id`, top-level `metadata.customer_id`,
 * and — for subscription updates — `subscription_data.metadata.customer_id`).
 */
function extractOurCustomerId(obj: Record<string, unknown>): string | null {
  const direct = asString(obj.client_reference_id);
  if (direct) return direct;
  const md = obj.metadata as Record<string, unknown> | undefined;
  if (md && typeof md === "object") {
    const fromMeta = asString(md.customer_id);
    if (fromMeta) return fromMeta;
  }
  return null;
}

/**
 * Resolve a CustomerRecord for a subscription-like payload. Prefers
 * metadata.customer_id (our id); falls back to the reverse index on
 * `sub.customer` (Stripe's id). Throws if neither resolves — that would
 * mean we received a subscription we have no record of.
 */
async function resolveCustomerForSubscription(
  kv: Deno.Kv,
  obj: Record<string, unknown>,
): Promise<CustomerRecord> {
  const fromMeta = extractOurCustomerId(obj);
  if (fromMeta) {
    const c = await lookupCustomerById(kv, fromMeta);
    if (c) return c;
  }
  const stripeCustomerId = asString(obj.customer);
  if (stripeCustomerId) {
    const c = await lookupCustomerByStripeId(kv, stripeCustomerId);
    if (c) return c;
  }
  throw new StripeWebhookError("Could not resolve our customer for subscription event");
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Stripe sends unix-seconds as numbers; convert to ISO 8601. */
function toIso(v: unknown): string | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return new Date(v * 1000).toISOString();
}
