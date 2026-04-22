/**
 * Tests for the Stripe webhook event dispatcher.
 *
 * Covers each handler's KV side effects + failure modes. The `handleStripeEvent`
 * dispatcher itself is exercised indirectly through per-event-type tests plus
 * an "unknown type is logged and ignored" case.
 */

import { assert, assertEquals, assertRejects } from "jsr:@std/assert@^1.0.0";
import {
  handleStripeEvent,
  lookupSubscription,
  saveSubscription,
  type SubscriptionRecord,
} from "../lib/webhooks.ts";
import type { StripeEvent } from "../lib/stripe.ts";
import { attachStripeCustomer, createCustomer, lookupCustomerById } from "../lib/customers.ts";
import { StripeWebhookError } from "../lib/errors.ts";

async function memKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

function makeEvent(type: string, object: Record<string, unknown>): StripeEvent {
  return {
    id: `evt_${Math.random().toString(16).slice(2, 10)}`,
    type,
    created: 1_700_000_000,
    livemode: false,
    data: { object },
  };
}

// ---------------------------------------------------------------------------
// saveSubscription / lookupSubscription round-trip
// ---------------------------------------------------------------------------

Deno.test("saveSubscription + lookupSubscription: round-trip", async () => {
  const kv = await memKv();
  try {
    const rec: SubscriptionRecord = {
      customer_id: "c_abc",
      stripe_subscription_id: "sub_1",
      tier: "pro",
      current_period_start: "2026-01-01T00:00:00.000Z",
      current_period_end: "2026-02-01T00:00:00.000Z",
      cancel_at_period_end: false,
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    await saveSubscription(kv, rec);
    const got = await lookupSubscription(kv, "c_abc");
    assertEquals(got?.stripe_subscription_id, "sub_1");
    assertEquals(got?.current_period_end, "2026-02-01T00:00:00.000Z");
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------

Deno.test("checkout.session.completed: attaches stripe_customer_id + flips to pro/active", async () => {
  const kv = await memKv();
  try {
    const customer = await createCustomer(kv, "alice@example.com");
    assert(customer);
    const event = makeEvent("checkout.session.completed", {
      id: "cs_1",
      customer: "cus_stripe_1",
      client_reference_id: customer!.id,
    });
    await handleStripeEvent(kv, event);
    const after = await lookupCustomerById(kv, customer!.id);
    assertEquals(after?.tier, "pro");
    assertEquals(after?.status, "active");
    assertEquals(after?.stripe_customer_id, "cus_stripe_1");
  } finally {
    kv.close();
  }
});

Deno.test("checkout.session.completed: resolves customer via metadata.customer_id", async () => {
  const kv = await memKv();
  try {
    const customer = await createCustomer(kv, "bob@example.com");
    assert(customer);
    const event = makeEvent("checkout.session.completed", {
      id: "cs_2",
      customer: "cus_stripe_2",
      metadata: { customer_id: customer!.id },
    });
    await handleStripeEvent(kv, event);
    const after = await lookupCustomerById(kv, customer!.id);
    assertEquals(after?.tier, "pro");
  } finally {
    kv.close();
  }
});

Deno.test("checkout.session.completed: missing customer id → StripeWebhookError", async () => {
  const kv = await memKv();
  try {
    const event = makeEvent("checkout.session.completed", {
      id: "cs_3",
      customer: "cus_x",
    });
    await assertRejects(
      () => handleStripeEvent(kv, event),
      StripeWebhookError,
      "missing customer_id",
    );
  } finally {
    kv.close();
  }
});

Deno.test("checkout.session.completed: unknown customer id → StripeWebhookError", async () => {
  const kv = await memKv();
  try {
    const event = makeEvent("checkout.session.completed", {
      id: "cs_4",
      customer: "cus_x",
      client_reference_id: "c_does_not_exist",
    });
    await assertRejects(
      () => handleStripeEvent(kv, event),
      StripeWebhookError,
      "Unknown customer_id",
    );
  } finally {
    kv.close();
  }
});

Deno.test("checkout.session.completed: missing Stripe customer id → StripeWebhookError", async () => {
  const kv = await memKv();
  try {
    const customer = await createCustomer(kv, "nostripe@example.com");
    assert(customer);
    const event = makeEvent("checkout.session.completed", {
      id: "cs_5",
      client_reference_id: customer!.id,
      // note: no `customer` field
    });
    await assertRejects(
      () => handleStripeEvent(kv, event),
      StripeWebhookError,
      "missing customer",
    );
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// customer.subscription.updated / .created
// ---------------------------------------------------------------------------

Deno.test("customer.subscription.updated: active → pro/active + subscription record", async () => {
  const kv = await memKv();
  try {
    const customer = await createCustomer(kv, "carol@example.com");
    assert(customer);
    await attachStripeCustomer(kv, customer!.id, "cus_c");
    const event = makeEvent("customer.subscription.updated", {
      id: "sub_active",
      status: "active",
      customer: "cus_c",
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_000_000,
      cancel_at_period_end: false,
      metadata: { customer_id: customer!.id },
    });
    await handleStripeEvent(kv, event);
    const after = await lookupCustomerById(kv, customer!.id);
    assertEquals(after?.tier, "pro");
    assertEquals(after?.status, "active");
    const sub = await lookupSubscription(kv, customer!.id);
    assertEquals(sub?.stripe_subscription_id, "sub_active");
    assertEquals(sub?.cancel_at_period_end, false);
    assertEquals(sub?.current_period_end, new Date(1_702_000_000 * 1000).toISOString());
  } finally {
    kv.close();
  }
});

Deno.test("customer.subscription.updated: past_due → tier held, status=past_due", async () => {
  const kv = await memKv();
  try {
    const customer = await createCustomer(kv, "dan@example.com", { tier: "pro" });
    assert(customer);
    await attachStripeCustomer(kv, customer!.id, "cus_d");
    const event = makeEvent("customer.subscription.updated", {
      id: "sub_pd",
      status: "past_due",
      customer: "cus_d",
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_000_000,
      cancel_at_period_end: false,
      metadata: { customer_id: customer!.id },
    });
    await handleStripeEvent(kv, event);
    const after = await lookupCustomerById(kv, customer!.id);
    assertEquals(after?.tier, "pro");
    assertEquals(after?.status, "past_due");
  } finally {
    kv.close();
  }
});

Deno.test("customer.subscription.updated: canceled → free/cancelled", async () => {
  const kv = await memKv();
  try {
    const customer = await createCustomer(kv, "eve@example.com", { tier: "pro" });
    assert(customer);
    await attachStripeCustomer(kv, customer!.id, "cus_e");
    const event = makeEvent("customer.subscription.updated", {
      id: "sub_cx",
      status: "canceled",
      customer: "cus_e",
      current_period_start: 1,
      current_period_end: 2,
      cancel_at_period_end: false,
      metadata: { customer_id: customer!.id },
    });
    await handleStripeEvent(kv, event);
    const after = await lookupCustomerById(kv, customer!.id);
    assertEquals(after?.tier, "free");
    assertEquals(after?.status, "cancelled");
  } finally {
    kv.close();
  }
});

Deno.test("customer.subscription.updated: trialing → pro/active", async () => {
  const kv = await memKv();
  try {
    const customer = await createCustomer(kv, "frank@example.com");
    assert(customer);
    await attachStripeCustomer(kv, customer!.id, "cus_f");
    const event = makeEvent("customer.subscription.updated", {
      id: "sub_tr",
      status: "trialing",
      customer: "cus_f",
      current_period_start: 1,
      current_period_end: 2,
      cancel_at_period_end: false,
      metadata: { customer_id: customer!.id },
    });
    await handleStripeEvent(kv, event);
    const after = await lookupCustomerById(kv, customer!.id);
    assertEquals(after?.tier, "pro");
    assertEquals(after?.status, "active");
  } finally {
    kv.close();
  }
});

Deno.test("customer.subscription.updated: unknown status (incomplete) is a no-op", async () => {
  const kv = await memKv();
  try {
    const customer = await createCustomer(kv, "grace@example.com");
    assert(customer);
    await attachStripeCustomer(kv, customer!.id, "cus_g");
    const event = makeEvent("customer.subscription.updated", {
      id: "sub_inc",
      status: "incomplete",
      customer: "cus_g",
      current_period_start: 1,
      current_period_end: 2,
      cancel_at_period_end: false,
      metadata: { customer_id: customer!.id },
    });
    await handleStripeEvent(kv, event);
    const after = await lookupCustomerById(kv, customer!.id);
    // Unchanged from the default free/active.
    assertEquals(after?.tier, "free");
    assertEquals(after?.status, "active");
    // No subscription record was written.
    assertEquals(await lookupSubscription(kv, customer!.id), null);
  } finally {
    kv.close();
  }
});

Deno.test("customer.subscription.updated: resolves via Stripe reverse index when metadata missing", async () => {
  const kv = await memKv();
  try {
    const customer = await createCustomer(kv, "henry@example.com");
    assert(customer);
    await attachStripeCustomer(kv, customer!.id, "cus_h");
    // No metadata.customer_id — must fall back on customers_by_stripe.
    const event = makeEvent("customer.subscription.updated", {
      id: "sub_rev",
      status: "active",
      customer: "cus_h",
      current_period_start: 1,
      current_period_end: 2,
      cancel_at_period_end: false,
    });
    await handleStripeEvent(kv, event);
    const after = await lookupCustomerById(kv, customer!.id);
    assertEquals(after?.tier, "pro");
  } finally {
    kv.close();
  }
});

Deno.test("customer.subscription.updated: unknown customer → StripeWebhookError", async () => {
  const kv = await memKv();
  try {
    const event = makeEvent("customer.subscription.updated", {
      id: "sub_lost",
      status: "active",
      customer: "cus_ghost",
      current_period_start: 1,
      current_period_end: 2,
      cancel_at_period_end: false,
    });
    await assertRejects(
      () => handleStripeEvent(kv, event),
      StripeWebhookError,
      "Could not resolve",
    );
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// customer.subscription.deleted
// ---------------------------------------------------------------------------

Deno.test("customer.subscription.deleted: → free/cancelled + subscription row removed", async () => {
  const kv = await memKv();
  try {
    const customer = await createCustomer(kv, "ivy@example.com", { tier: "pro" });
    assert(customer);
    await attachStripeCustomer(kv, customer!.id, "cus_i");
    await saveSubscription(kv, {
      customer_id: customer!.id,
      stripe_subscription_id: "sub_ivy",
      tier: "pro",
      current_period_start: "2026-01-01T00:00:00.000Z",
      current_period_end: "2026-02-01T00:00:00.000Z",
      cancel_at_period_end: false,
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const event = makeEvent("customer.subscription.deleted", {
      id: "sub_ivy",
      customer: "cus_i",
      metadata: { customer_id: customer!.id },
    });
    await handleStripeEvent(kv, event);
    const after = await lookupCustomerById(kv, customer!.id);
    assertEquals(after?.tier, "free");
    assertEquals(after?.status, "cancelled");
    assertEquals(await lookupSubscription(kv, customer!.id), null);
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// invoice.payment_failed
// ---------------------------------------------------------------------------

Deno.test("invoice.payment_failed: flips status=past_due, tier held", async () => {
  const kv = await memKv();
  try {
    const customer = await createCustomer(kv, "jane@example.com", { tier: "pro" });
    assert(customer);
    await attachStripeCustomer(kv, customer!.id, "cus_j");
    const event = makeEvent("invoice.payment_failed", {
      id: "in_1",
      customer: "cus_j",
    });
    await handleStripeEvent(kv, event);
    const after = await lookupCustomerById(kv, customer!.id);
    assertEquals(after?.tier, "pro"); // dunning still in flight
    assertEquals(after?.status, "past_due");
  } finally {
    kv.close();
  }
});

Deno.test("invoice.payment_failed: unknown Stripe customer → StripeWebhookError", async () => {
  const kv = await memKv();
  try {
    const event = makeEvent("invoice.payment_failed", {
      id: "in_lost",
      customer: "cus_nope",
    });
    await assertRejects(
      () => handleStripeEvent(kv, event),
      StripeWebhookError,
      "unknown Stripe customer",
    );
  } finally {
    kv.close();
  }
});

Deno.test("invoice.payment_failed: missing customer field → StripeWebhookError", async () => {
  const kv = await memKv();
  try {
    const event = makeEvent("invoice.payment_failed", { id: "in_bad" });
    await assertRejects(
      () => handleStripeEvent(kv, event),
      StripeWebhookError,
      "missing customer",
    );
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// unknown types
// ---------------------------------------------------------------------------

Deno.test("handleStripeEvent: unknown types are logged + ignored (no throw)", async () => {
  const kv = await memKv();
  const warnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (m: string) => warnings.push(m);
  try {
    const event = makeEvent("customer.updated", { id: "cus_foo" });
    await handleStripeEvent(kv, event); // must not throw
    assert(warnings.some((w) => w.includes("unhandled event type")));
  } finally {
    console.warn = origWarn;
    kv.close();
  }
});
