/**
 * End-to-end integration tests for the composed request pipeline.
 * Uses an in-memory KV + synthetic Request objects; no sockets.
 */

import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import { buildHandler } from "../lib/middleware.ts";
import { defaultConfig } from "../lib/config.ts";
import { createKey, revokeKey } from "../lib/keys.ts";
import { attachStripeCustomer, createCustomer } from "../lib/customers.ts";

async function openMemoryKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

function testHandler(
  opts: {
    kv: Deno.Kv;
    configOverrides?: Partial<ReturnType<typeof defaultConfig>>;
    now?: () => number;
  },
) {
  const config = { ...defaultConfig(), ...(opts.configOverrides ?? {}) };
  // Silence logs during tests.
  return buildHandler({
    kv: opts.kv,
    config,
    staticHtml: "<html><body>hi</body></html>",
    now: opts.now,
    logSink: () => {},
  });
}

Deno.test("GET / returns embedded HTML with security headers", async () => {
  const kv = await openMemoryKv();
  try {
    const handler = testHandler({ kv });
    const res = await handler(new Request("http://x/"));
    assertEquals(res.status, 200);
    assert(res.headers.get("content-type")?.includes("text/html"));
    assertEquals(res.headers.get("x-content-type-options"), "nosniff");
    assertEquals(res.headers.get("x-frame-options"), "DENY");
    assert(res.headers.get("content-security-policy"));
    assert(res.headers.get("x-request-id"));
    const body = await res.text();
    assert(body.includes("<html"));
  } finally {
    kv.close();
  }
});

Deno.test("GET /health returns 200 without auth", async () => {
  const kv = await openMemoryKv();
  try {
    const handler = testHandler({ kv });
    const res = await handler(new Request("http://x/health"));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.ok, true);
  } finally {
    kv.close();
  }
});

Deno.test("GET /validate without key → 401 unauthenticated", async () => {
  const kv = await openMemoryKv();
  try {
    const handler = testHandler({ kv });
    const res = await handler(new Request("http://x/validate?karyotype=46,XX"));
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "unauthenticated");
    assert(typeof body.request_id === "string");
    assert(res.headers.get("www-authenticate"));
  } finally {
    kv.close();
  }
});

Deno.test("GET /validate with valid key → 200 + rate-limit headers", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({ kv });
    const req = new Request("http://x/validate?karyotype=46,XX", {
      headers: { authorization: `Bearer ${plaintext}` },
    });
    const res = await handler(req);
    assertEquals(res.status, 200);
    assert(res.headers.get("x-ratelimit-limit"));
    assert(res.headers.get("x-ratelimit-remaining"));
    assert(res.headers.get("x-ratelimit-reset"));
    const body = await res.json();
    assertEquals(body.valid, true);
  } finally {
    kv.close();
  }
});

Deno.test("POST /validate with valid key → 200", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({ kv });
    const req = new Request("http://x/validate", {
      method: "POST",
      headers: {
        authorization: `Bearer ${plaintext}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ karyotype: "46,XX" }),
    });
    const res = await handler(req);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.valid, true);
  } finally {
    kv.close();
  }
});

Deno.test("POST /validate without Content-Type → 400 invalid_request", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({ kv });
    const req = new Request("http://x/validate", {
      method: "POST",
      headers: { authorization: `Bearer ${plaintext}` },
      body: "plain text",
    });
    const res = await handler(req);
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "invalid_request");
  } finally {
    kv.close();
  }
});

Deno.test("POST /validate with oversized body → 413 body_too_large", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({
      kv,
      configOverrides: { maxBodyBytes: 32 },
    });
    const oversized = JSON.stringify({ karyotype: "A".repeat(100) });
    const req = new Request("http://x/validate", {
      method: "POST",
      headers: {
        authorization: `Bearer ${plaintext}`,
        "content-type": "application/json",
      },
      body: oversized,
    });
    const res = await handler(req);
    assertEquals(res.status, 413);
    const body = await res.json();
    assertEquals(body.error, "body_too_large");
  } finally {
    kv.close();
  }
});

Deno.test("POST /validate with invalid JSON → 400", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({ kv });
    const req = new Request("http://x/validate", {
      method: "POST",
      headers: {
        authorization: `Bearer ${plaintext}`,
        "content-type": "application/json",
      },
      body: "{not json",
    });
    const res = await handler(req);
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "invalid_request");
  } finally {
    kv.close();
  }
});

Deno.test("revoked key → 401", async () => {
  const kv = await openMemoryKv();
  try {
    const { record, plaintext } = await createKey(kv, "test");
    await revokeKey(kv, record.id);
    const handler = testHandler({ kv });
    const req = new Request("http://x/validate?karyotype=46,XX", {
      headers: { authorization: `Bearer ${plaintext}` },
    });
    const res = await handler(req);
    assertEquals(res.status, 401);
  } finally {
    kv.close();
  }
});

Deno.test("rate limit: over quota → 429 with Retry-After + X-RateLimit-*", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({
      kv,
      configOverrides: { rateLimitPerMin: 2, rateLimitBurst: 2 },
      now: () => 1_700_000_000_000,
    });
    const mk = () =>
      new Request("http://x/validate?karyotype=46,XX", {
        headers: { authorization: `Bearer ${plaintext}` },
      });

    const r1 = await handler(mk());
    const r2 = await handler(mk());
    const r3 = await handler(mk());
    assertEquals(r1.status, 200);
    assertEquals(r2.status, 200);
    assertEquals(r3.status, 429);

    const body = await r3.json();
    assertEquals(body.error, "rate_limited");
    assert(r3.headers.get("retry-after"));
    assertEquals(r3.headers.get("x-ratelimit-limit"), "2");
    assertEquals(r3.headers.get("x-ratelimit-remaining"), "0");
  } finally {
    kv.close();
  }
});

Deno.test("monthly quota: customer-owned key over quota → 402 quota_exceeded", async () => {
  const kv = await openMemoryKv();
  try {
    const customer = await createCustomer(kv, "quota@example.com");
    assert(customer !== null);
    const { plaintext } = await createKey(kv, "pay-test", {
      customerId: customer.id,
    });
    const handler = testHandler({
      kv,
      configOverrides: { monthlyQuotaFree: 2, rateLimitPerMin: 100 },
    });
    const mk = () =>
      new Request("http://x/validate?karyotype=46,XX", {
        headers: { authorization: `Bearer ${plaintext}` },
      });

    const r1 = await handler(mk());
    const r2 = await handler(mk());
    const r3 = await handler(mk());
    assertEquals(r1.status, 200);
    assertEquals(r1.headers.get("x-monthly-quota-limit"), "2");
    assertEquals(r1.headers.get("x-monthly-quota-remaining"), "1");
    assertEquals(r2.status, 200);
    assertEquals(r2.headers.get("x-monthly-quota-remaining"), "0");
    assertEquals(r3.status, 402);
    const body = await r3.json();
    assertEquals(body.error, "quota_exceeded");
    assertEquals(r3.headers.get("x-monthly-quota-limit"), "2");
    assertEquals(r3.headers.get("x-monthly-quota-remaining"), "0");
    assert(r3.headers.get("x-monthly-quota-reset"));
  } finally {
    kv.close();
  }
});

Deno.test("monthly quota: grandfathered key (no customer) skips enforcement", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "internal-admin"); // no customer
    const handler = testHandler({
      kv,
      configOverrides: { monthlyQuotaFree: 1, rateLimitPerMin: 100 },
    });
    const mk = () =>
      new Request("http://x/validate?karyotype=46,XX", {
        headers: { authorization: `Bearer ${plaintext}` },
      });
    // Both requests must succeed even though Free limit is 1 — internal keys
    // never hit the counter.
    const r1 = await handler(mk());
    const r2 = await handler(mk());
    assertEquals(r1.status, 200);
    assertEquals(r2.status, 200);
    assertEquals(r1.headers.get("x-monthly-quota-limit"), null);
    assertEquals(r2.headers.get("x-monthly-quota-limit"), null);
  } finally {
    kv.close();
  }
});

Deno.test("OPTIONS preflight returns 204 with CORS headers", async () => {
  const kv = await openMemoryKv();
  try {
    const handler = testHandler({
      kv,
      configOverrides: { allowedOrigins: ["https://app.example"] },
    });
    const req = new Request("http://x/validate", {
      method: "OPTIONS",
      headers: {
        origin: "https://app.example",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,content-type",
      },
    });
    const res = await handler(req);
    assertEquals(res.status, 204);
    assertEquals(res.headers.get("access-control-allow-origin"), "https://app.example");
    assert(res.headers.get("access-control-allow-methods")?.includes("POST"));
    assert(
      res.headers.get("access-control-allow-headers")?.toLowerCase().includes("authorization"),
    );
  } finally {
    kv.close();
  }
});

Deno.test("CORS: disallowed origin → no allow-origin header", async () => {
  const kv = await openMemoryKv();
  try {
    const handler = testHandler({
      kv,
      configOverrides: { allowedOrigins: ["https://app.example"] },
    });
    const req = new Request("http://x/health", {
      headers: { origin: "https://evil.example" },
    });
    const res = await handler(req);
    assertEquals(res.headers.get("access-control-allow-origin"), null);
  } finally {
    kv.close();
  }
});

Deno.test("unknown route → 404 not_found", async () => {
  const kv = await openMemoryKv();
  try {
    const handler = testHandler({ kv });
    const res = await handler(new Request("http://x/no-such-path"));
    assertEquals(res.status, 404);
    const body = await res.json();
    assertEquals(body.error, "not_found");
  } finally {
    kv.close();
  }
});

Deno.test("log sink emits JSON with no karyotype field", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const lines: string[] = [];
    const config = defaultConfig();
    const handler = buildHandler({
      kv,
      config,
      staticHtml: "<html></html>",
      logSink: (line) => lines.push(line),
    });
    const req = new Request("http://x/validate", {
      method: "POST",
      headers: {
        authorization: `Bearer ${plaintext}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ karyotype: "46,XX" }),
    });
    await handler(req);
    assertEquals(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assertEquals(parsed.path, "/validate");
    assertEquals(parsed.status, 200);
    assert(parsed.request_id);
    assert(parsed.key_id);
    // Critical: no payload in logs.
    assertEquals(parsed.karyotype, undefined);
    assertEquals(parsed.body, undefined);
    assertEquals(parsed.input, undefined);
    assertEquals(parsed.payload, undefined);
  } finally {
    kv.close();
  }
});

Deno.test("POST /validate with missing karyotype field → 400", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({ kv });
    const req = new Request("http://x/validate", {
      method: "POST",
      headers: {
        authorization: `Bearer ${plaintext}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ wrong_field: "46,XX" }),
    });
    const res = await handler(req);
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "invalid_request");
  } finally {
    kv.close();
  }
});

Deno.test("GET /validate without karyotype query → 400", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({ kv });
    const req = new Request("http://x/validate", {
      headers: { authorization: `Bearer ${plaintext}` },
    });
    const res = await handler(req);
    assertEquals(res.status, 400);
  } finally {
    kv.close();
  }
});

Deno.test("POST /validate: karyotype too long → 400", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({
      kv,
      configOverrides: { maxKaryotypeLength: 10, maxBodyBytes: 1024 },
    });
    const req = new Request("http://x/validate", {
      method: "POST",
      headers: {
        authorization: `Bearer ${plaintext}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ karyotype: "A".repeat(50) }),
    });
    const res = await handler(req);
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "invalid_request");
    assert(body.message.toLowerCase().includes("max length"));
  } finally {
    kv.close();
  }
});

Deno.test("GET /validate: karyotype too long → 400", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({
      kv,
      configOverrides: { maxKaryotypeLength: 5 },
    });
    const url = `http://x/validate?karyotype=${"A".repeat(50)}`;
    const req = new Request(url, {
      headers: { authorization: `Bearer ${plaintext}` },
    });
    const res = await handler(req);
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "invalid_request");
  } finally {
    kv.close();
  }
});

Deno.test("POST /validate: empty karyotype string → 400", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({ kv });
    const req = new Request("http://x/validate", {
      method: "POST",
      headers: {
        authorization: `Bearer ${plaintext}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ karyotype: "" }),
    });
    const res = await handler(req);
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "invalid_request");
  } finally {
    kv.close();
  }
});

Deno.test("POST /validate: karyotype non-string → 400", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({ kv });
    const req = new Request("http://x/validate", {
      method: "POST",
      headers: {
        authorization: `Bearer ${plaintext}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ karyotype: 42 }),
    });
    const res = await handler(req);
    assertEquals(res.status, 400);
  } finally {
    kv.close();
  }
});

Deno.test("POST /validate: Content-Length over max → 413 (no body read)", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({
      kv,
      configOverrides: { maxBodyBytes: 16 },
    });
    // Create a Request with a real body larger than limit; Content-Length
    // is set implicitly by the Request constructor.
    const req = new Request("http://x/validate", {
      method: "POST",
      headers: {
        authorization: `Bearer ${plaintext}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ karyotype: "46,XX", padding: "X".repeat(200) }),
    });
    const res = await handler(req);
    assertEquals(res.status, 413);
  } finally {
    kv.close();
  }
});

Deno.test("DELETE /validate → 405 method_not_allowed", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({ kv });
    const req = new Request("http://x/validate", {
      method: "DELETE",
      headers: { authorization: `Bearer ${plaintext}` },
    });
    const res = await handler(req);
    assertEquals(res.status, 405);
    assert(res.headers.get("allow")?.includes("GET"));
  } finally {
    kv.close();
  }
});

Deno.test("security headers: HSTS + nosniff + frame-deny + referrer-policy on 4xx", async () => {
  const kv = await openMemoryKv();
  try {
    const handler = testHandler({ kv });
    // 401 response
    const res = await handler(new Request("http://x/validate?karyotype=46,XX"));
    assertEquals(res.status, 401);
    assertEquals(
      res.headers.get("strict-transport-security"),
      "max-age=31536000; includeSubDomains",
    );
    assertEquals(res.headers.get("x-content-type-options"), "nosniff");
    assertEquals(res.headers.get("x-frame-options"), "DENY");
    assertEquals(res.headers.get("referrer-policy"), "no-referrer");
    assert(res.headers.get("x-request-id"));
  } finally {
    kv.close();
  }
});

Deno.test("CSP: only applied to HTML responses, not JSON", async () => {
  const kv = await openMemoryKv();
  try {
    const handler = testHandler({ kv });
    const htmlRes = await handler(new Request("http://x/"));
    assert(htmlRes.headers.get("content-security-policy"));
    const jsonRes = await handler(new Request("http://x/health"));
    assertEquals(jsonRes.headers.get("content-security-policy"), null);
  } finally {
    kv.close();
  }
});

Deno.test("error body never leaks stack trace (401/404/413)", async () => {
  const kv = await openMemoryKv();
  try {
    const handler = testHandler({ kv });
    const paths = [
      new Request("http://x/validate?karyotype=46,XX"), // 401
      new Request("http://x/no-such-route"), // 404
    ];
    for (const req of paths) {
      const res = await handler(req);
      const body = await res.text();
      assert(!body.toLowerCase().includes("at "), `stack frame found in ${body}`);
      assert(!body.toLowerCase().includes("stack"), `"stack" found in ${body}`);
      assert(!body.includes("middleware.ts"), `module path leaked: ${body}`);
    }
  } finally {
    kv.close();
  }
});

Deno.test("uncaught error → 500 'internal' + generic message + errorSink called", async () => {
  // Close the KV before running the handler to force KV operations to throw.
  const kv = await openMemoryKv();
  const { plaintext } = await createKey(kv, "test");
  kv.close(); // Intentionally close -- subsequent kv.get will throw.

  const captured: Array<{ rid: string; err: unknown }> = [];
  const config = defaultConfig();
  const handler = buildHandler({
    kv,
    config,
    staticHtml: "<html></html>",
    logSink: () => {},
    errorSink: (rid, err) => captured.push({ rid, err }),
  });
  const req = new Request("http://x/validate?karyotype=46,XX", {
    headers: { authorization: `Bearer ${plaintext}` },
  });
  const res = await handler(req);
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "internal");
  assertEquals(body.message, "Internal server error");
  assert(body.request_id);
  // Server-side: errorSink fired with the same request_id.
  assertEquals(captured.length, 1);
  assertEquals(captured[0].rid, body.request_id);
  assert(captured[0].err);
});

Deno.test("POST /keys/rotate without auth → 401 unauthenticated", async () => {
  const kv = await openMemoryKv();
  try {
    const handler = testHandler({ kv });
    const res = await handler(
      new Request("http://x/keys/rotate", { method: "POST" }),
    );
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "unauthenticated");
  } finally {
    kv.close();
  }
});

Deno.test("GET /keys/rotate → 405 method_not_allowed", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "test");
    const handler = testHandler({ kv });
    const res = await handler(
      new Request("http://x/keys/rotate", {
        headers: { authorization: `Bearer ${plaintext}` },
      }),
    );
    assertEquals(res.status, 405);
    assert(res.headers.get("allow")?.includes("POST"));
  } finally {
    kv.close();
  }
});

Deno.test("POST /keys/rotate: valid key rotates; old rejected, new accepted", async () => {
  const kv = await openMemoryKv();
  try {
    const { record: oldRecord, plaintext: oldPlain } = await createKey(
      kv,
      "rotate-integration",
    );
    const handler = testHandler({ kv });

    const rotateRes = await handler(
      new Request("http://x/keys/rotate", {
        method: "POST",
        headers: { authorization: `Bearer ${oldPlain}` },
      }),
    );
    assertEquals(rotateRes.status, 200);
    const body = await rotateRes.json();
    assertEquals(body.old_key_id, oldRecord.id);
    assert(typeof body.new_key === "string");
    assert(body.new_key.startsWith("iscn_live_"));
    assert(typeof body.new_key_id === "string");
    assert(body.new_key_id !== oldRecord.id);

    // Old key is now rejected.
    const oldRes = await handler(
      new Request("http://x/validate?karyotype=46,XX", {
        headers: { authorization: `Bearer ${oldPlain}` },
      }),
    );
    assertEquals(oldRes.status, 401);

    // New key works.
    const newRes = await handler(
      new Request("http://x/validate?karyotype=46,XX", {
        headers: { authorization: `Bearer ${body.new_key}` },
      }),
    );
    assertEquals(newRes.status, 200);
  } finally {
    kv.close();
  }
});

Deno.test("debugErrors=true exposes error message in 500 body (dev only)", async () => {
  const kv = await openMemoryKv();
  const { plaintext } = await createKey(kv, "test");
  kv.close();

  const config = { ...defaultConfig(), debugErrors: true };
  const handler = buildHandler({
    kv,
    config,
    staticHtml: "<html></html>",
    logSink: () => {},
    errorSink: () => {},
  });
  const req = new Request("http://x/validate?karyotype=46,XX", {
    headers: { authorization: `Bearer ${plaintext}` },
  });
  const res = await handler(req);
  assertEquals(res.status, 500);
  const body = await res.json();
  // Debug mode exposes the raw message but NEVER a stack field.
  assert(body.message !== "Internal server error");
  assertEquals(body.stack, undefined);
});

// ---------------------------------------------------------------------------
// /billing/webhook — signature verification + idempotency end-to-end
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = "whsec_integration";

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signedWebhookRequest(
  body: string,
  secret: string,
  ts: number,
): Promise<Request> {
  const sig = await hmacHex(secret, `${ts}.${body}`);
  return new Request("http://x/billing/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${ts},v1=${sig}`,
    },
    body,
  });
}

Deno.test("POST /billing/webhook: verified event flips tier to pro + is idempotent", async () => {
  const kv = await openMemoryKv();
  try {
    const customer = await createCustomer(kv, "webhook@example.com");
    assert(customer);
    const now = 1_700_000_000;
    const handler = testHandler({
      kv,
      configOverrides: { stripeWebhookSecret: WEBHOOK_SECRET },
      now: () => now * 1000,
    });

    const body = JSON.stringify({
      id: "evt_int_1",
      type: "checkout.session.completed",
      created: now,
      livemode: false,
      data: {
        object: {
          id: "cs_test_1",
          client_reference_id: customer.id,
          customer: "cus_test_1",
        },
      },
    });

    // First delivery — processed and marked seen.
    const res1 = await handler(await signedWebhookRequest(body, WEBHOOK_SECRET, now));
    assertEquals(res1.status, 200);
    const seen = await kv.get<number>(["stripe_events", "evt_int_1"]);
    assertEquals(seen.value, 1);

    // Second delivery (Stripe retry) — short-circuits on idempotency CAS.
    const res2 = await handler(await signedWebhookRequest(body, WEBHOOK_SECRET, now));
    assertEquals(res2.status, 200);
  } finally {
    kv.close();
  }
});

Deno.test("POST /billing/webhook: missing signature header → 400", async () => {
  const kv = await openMemoryKv();
  try {
    const handler = testHandler({
      kv,
      configOverrides: { stripeWebhookSecret: WEBHOOK_SECRET },
    });
    const res = await handler(
      new Request("http://x/billing/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "stripe_error");
  } finally {
    kv.close();
  }
});

Deno.test("POST /billing/webhook: bad signature → 400, event NOT marked seen", async () => {
  const kv = await openMemoryKv();
  try {
    const now = 1_700_000_000;
    const handler = testHandler({
      kv,
      configOverrides: { stripeWebhookSecret: WEBHOOK_SECRET },
      now: () => now * 1000,
    });
    const body = JSON.stringify({
      id: "evt_bad_sig",
      type: "checkout.session.completed",
      created: now,
      livemode: false,
      data: { object: { id: "cs_bad" } },
    });
    // Sign under a different secret.
    const req = await signedWebhookRequest(body, "whsec_other", now);
    const res = await handler(req);
    assertEquals(res.status, 400);
    // Idempotency marker must not be set — otherwise an attacker could
    // poison future legitimate deliveries of the same event id.
    const seen = await kv.get(["stripe_events", "evt_bad_sig"]);
    assertEquals(seen.value, null);
  } finally {
    kv.close();
  }
});

Deno.test("POST /billing/webhook: no secret configured → 400", async () => {
  const kv = await openMemoryKv();
  try {
    // Default config has stripeWebhookSecret: "".
    const handler = testHandler({ kv });
    const now = 1_700_000_000;
    const req = await signedWebhookRequest(
      JSON.stringify({
        id: "evt_x",
        type: "checkout.session.completed",
        created: now,
        livemode: false,
        data: { object: {} },
      }),
      WEBHOOK_SECRET,
      now,
    );
    const res = await handler(req);
    assertEquals(res.status, 400);
  } finally {
    kv.close();
  }
});

Deno.test("POST /billing/webhook: GET → 405", async () => {
  const kv = await openMemoryKv();
  try {
    const handler = testHandler({
      kv,
      configOverrides: { stripeWebhookSecret: WEBHOOK_SECRET },
    });
    const res = await handler(
      new Request("http://x/billing/webhook", { method: "GET" }),
    );
    assertEquals(res.status, 405);
  } finally {
    kv.close();
  }
});

Deno.test("POST /billing/webhook: invoice.payment_failed flips status to past_due", async () => {
  const kv = await openMemoryKv();
  try {
    const customer = await createCustomer(kv, "pd@example.com");
    assert(customer);
    await attachStripeCustomer(kv, customer.id, "cus_pd");
    const now = 1_700_000_000;
    const handler = testHandler({
      kv,
      configOverrides: { stripeWebhookSecret: WEBHOOK_SECRET },
      now: () => now * 1000,
    });
    const body = JSON.stringify({
      id: "evt_pd_1",
      type: "invoice.payment_failed",
      created: now,
      livemode: false,
      data: { object: { id: "in_1", customer: "cus_pd" } },
    });
    const res = await handler(await signedWebhookRequest(body, WEBHOOK_SECRET, now));
    assertEquals(res.status, 200);
    const entry = await kv.get<{ status: string }>(["customers", customer.id]);
    assertEquals(entry.value?.status, "past_due");
  } finally {
    kv.close();
  }
});
