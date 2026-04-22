/**
 * Unit tests for the Stripe HTTP client wrapper.
 *
 * We do NOT hit Stripe's real API here — that belongs in manual
 * verification / staging. This file covers the pure functions:
 *   - formEncode bracket-notation serialisation
 *   - constructEvent input validation
 *   - verifyWebhookSignature (replay window, single + multi-v1, mismatch)
 */

import { assert, assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@^1.0.0";
import { constructEvent, formEncode, verifyWebhookSignature } from "../lib/stripe.ts";
import { StripeWebhookError } from "../lib/errors.ts";

// ---------------------------------------------------------------------------
// formEncode
// ---------------------------------------------------------------------------

Deno.test("formEncode: flat primitives", () => {
  assertEquals(
    formEncode({ a: "1", b: 2, c: true }),
    "a=1&b=2&c=true",
  );
});

Deno.test("formEncode: skips null/undefined", () => {
  assertEquals(
    formEncode({ a: "1", b: null, c: undefined, d: "2" }),
    "a=1&d=2",
  );
});

Deno.test("formEncode: nested objects use bracket notation", () => {
  assertEquals(
    formEncode({ metadata: { customer_id: "c_abc" } }),
    "metadata%5Bcustomer_id%5D=c_abc",
  );
});

Deno.test("formEncode: arrays of primitives are indexed", () => {
  assertEquals(
    formEncode({ expand: ["a", "b"] }),
    "expand%5B0%5D=a&expand%5B1%5D=b",
  );
});

Deno.test("formEncode: arrays of objects recurse with index prefixes", () => {
  assertEquals(
    formEncode({ line_items: [{ price: "p1", quantity: 1 }] }),
    "line_items%5B0%5D%5Bprice%5D=p1&line_items%5B0%5D%5Bquantity%5D=1",
  );
});

Deno.test("formEncode: URL-encodes special characters", () => {
  assertEquals(
    formEncode({ redirect: "https://a.com/cb?x=1&y=2" }),
    "redirect=https%3A%2F%2Fa.com%2Fcb%3Fx%3D1%26y%3D2",
  );
});

// ---------------------------------------------------------------------------
// constructEvent
// ---------------------------------------------------------------------------

function validEventJson(): string {
  return JSON.stringify({
    id: "evt_123",
    type: "customer.subscription.updated",
    created: 1_700_000_000,
    livemode: false,
    data: { object: { id: "sub_1", status: "active" } },
  });
}

Deno.test("constructEvent: returns typed event for well-formed payload", () => {
  const ev = constructEvent(validEventJson());
  assertEquals(ev.id, "evt_123");
  assertEquals(ev.type, "customer.subscription.updated");
  assertEquals(ev.livemode, false);
  assertEquals(ev.data.object.id, "sub_1");
});

Deno.test("constructEvent: rejects non-JSON", () => {
  assertThrows(() => constructEvent("not json"), StripeWebhookError, "Malformed");
});

Deno.test("constructEvent: rejects non-object JSON", () => {
  assertThrows(() => constructEvent("42"), StripeWebhookError, "not an object");
});

Deno.test("constructEvent: rejects event missing fields", () => {
  assertThrows(
    () => constructEvent(JSON.stringify({ id: "x", type: "y" })),
    StripeWebhookError,
    "missing required",
  );
});

Deno.test("constructEvent: rejects event missing data.object", () => {
  assertThrows(
    () =>
      constructEvent(JSON.stringify({
        id: "evt_1",
        type: "x",
        created: 1,
        livemode: false,
        data: {},
      })),
    StripeWebhookError,
    "data.object",
  );
});

// ---------------------------------------------------------------------------
// verifyWebhookSignature
// ---------------------------------------------------------------------------

const SECRET = "whsec_test";

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.test("verifyWebhookSignature: accepts a valid header", async () => {
  const body = '{"hello":"world"}';
  const ts = 1_700_000_000;
  const sig = await sign(SECRET, `${ts}.${body}`);
  const header = `t=${ts},v1=${sig}`;
  await verifyWebhookSignature(body, header, SECRET, ts);
});

Deno.test("verifyWebhookSignature: accepts any matching v1 when rotation in flight", async () => {
  const body = "{}";
  const ts = 1_700_000_000;
  const good = await sign(SECRET, `${ts}.${body}`);
  // First v1 is bogus; second is real. Stripe emits this shape during rotation.
  const header = `t=${ts},v1=deadbeef,v1=${good}`;
  await verifyWebhookSignature(body, header, SECRET, ts);
});

Deno.test("verifyWebhookSignature: rejects when no secret configured", async () => {
  await assertRejects(
    () => verifyWebhookSignature("{}", "t=1,v1=x", "", 1),
    StripeWebhookError,
    "secret not configured",
  );
});

Deno.test("verifyWebhookSignature: rejects missing header", async () => {
  await assertRejects(
    () => verifyWebhookSignature("{}", null, SECRET, 1),
    StripeWebhookError,
    "Missing Stripe-Signature",
  );
});

Deno.test("verifyWebhookSignature: rejects when timestamp outside tolerance", async () => {
  const body = "{}";
  const ts = 1_700_000_000;
  const sig = await sign(SECRET, `${ts}.${body}`);
  const header = `t=${ts},v1=${sig}`;
  // Clock is 1 hour ahead — default tolerance is 300s.
  await assertRejects(
    () => verifyWebhookSignature(body, header, SECRET, ts + 3600),
    StripeWebhookError,
    "tolerance",
  );
});

Deno.test("verifyWebhookSignature: rejects on signature mismatch", async () => {
  const body = "{}";
  const ts = 1_700_000_000;
  // Sign under a different secret — v1 will not match.
  const sig = await sign("whsec_other", `${ts}.${body}`);
  const header = `t=${ts},v1=${sig}`;
  await assertRejects(
    () => verifyWebhookSignature(body, header, SECRET, ts),
    StripeWebhookError,
    "Signature mismatch",
  );
});

Deno.test("verifyWebhookSignature: rejects header missing timestamp", async () => {
  await assertRejects(
    () => verifyWebhookSignature("{}", "v1=abc", SECRET, 1),
    StripeWebhookError,
    "timestamp",
  );
});

Deno.test("verifyWebhookSignature: rejects header with no v1 entries", async () => {
  await assertRejects(
    () => verifyWebhookSignature("{}", "t=1", SECRET, 1),
    StripeWebhookError,
    "No v1",
  );
});

Deno.test("verifyWebhookSignature: body bytes are not normalised (HMAC over exact input)", async () => {
  // Stripe's documented behaviour: any mutation of the raw body breaks
  // verification. A reserialised JSON (spaces collapsed) must fail.
  const originalBody = '{ "a" : 1 }';
  const tamperedBody = '{"a":1}';
  const ts = 1_700_000_000;
  const sig = await sign(SECRET, `${ts}.${originalBody}`);
  const header = `t=${ts},v1=${sig}`;
  // Original body verifies.
  await verifyWebhookSignature(originalBody, header, SECRET, ts);
  // Tampered body is rejected.
  await assertRejects(
    () => verifyWebhookSignature(tamperedBody, header, SECRET, ts),
    StripeWebhookError,
  );
});

// Sanity: `assert` import reference so unused-import lint stays quiet.
Deno.test("stripe tests: sanity true", () => {
  assert(true);
});
