/**
 * Tests for GET /usage — customer quota snapshot JSON.
 *
 * End-to-end via buildHandler with an in-memory KV. We exercise:
 *   - happy path (free tier, fresh counter)
 *   - happy path (pro tier, counter nonzero)
 *   - side-effect-free: /usage does NOT bump the counter
 *   - grandfathered key (customer_id=null) → 404
 *   - unauthenticated → 401
 *   - wrong method → 405
 *   - revoked key → 401
 */

import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import { buildHandler } from "../lib/middleware.ts";
import { defaultConfig } from "../lib/config.ts";
import { createKey, revokeKey } from "../lib/keys.ts";
import { createCustomer, updateCustomerTier } from "../lib/customers.ts";
import { currentMonthYYYYMM, incrementUsage, quotaFor } from "../lib/quota.ts";

function testHandler(
  opts: {
    kv: Deno.Kv;
    configOverrides?: Partial<ReturnType<typeof defaultConfig>>;
    now?: () => number;
  },
) {
  const config = { ...defaultConfig(), ...(opts.configOverrides ?? {}) };
  return buildHandler({
    kv: opts.kv,
    config,
    staticHtml: "<html></html>",
    now: opts.now,
    logSink: () => {},
    errorSink: () => {},
  });
}

Deno.test("GET /usage: free-tier customer gets zero-usage snapshot", async () => {
  const kv = await Deno.openKv(":memory:");
  try {
    const customer = await createCustomer(kv, "usage@example.com");
    assert(customer);
    const created = await createKey(kv, "t", { customerId: customer.id });

    const handler = testHandler({ kv });
    const res = await handler(
      new Request("http://x/usage", {
        headers: { authorization: `Bearer ${created.plaintext}` },
      }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.customer_id, customer.id);
    assertEquals(body.tier, "free");
    assertEquals(body.used, 0);
    assertEquals(body.limit, quotaFor("free", defaultConfig()));
    assertEquals(body.remaining, body.limit);
    assertEquals(typeof body.reset_at, "number");
    // Wire format: YYYY-MM
    const month = currentMonthYYYYMM();
    assertEquals(body.month, `${month.slice(0, 4)}-${month.slice(4, 6)}`);
    // Advertised quota headers mirror the body.
    assertEquals(res.headers.get("X-Monthly-Quota-Limit"), String(body.limit));
    assertEquals(res.headers.get("X-Monthly-Quota-Remaining"), String(body.remaining));
  } finally {
    kv.close();
  }
});

Deno.test("GET /usage: pro-tier customer with nonzero usage", async () => {
  const kv = await Deno.openKv(":memory:");
  try {
    const customer = await createCustomer(kv, "pro@example.com");
    assert(customer);
    await updateCustomerTier(kv, customer.id, "pro");
    const created = await createKey(kv, "p", { customerId: customer.id });

    // Simulate 3 prior requests via the same API the hot path uses.
    const limit = quotaFor("pro", defaultConfig());
    for (let i = 0; i < 3; i++) {
      await incrementUsage(kv, customer.id, { tier: "pro", limit });
    }

    const handler = testHandler({ kv });
    const res = await handler(
      new Request("http://x/usage", {
        headers: { authorization: `Bearer ${created.plaintext}` },
      }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.tier, "pro");
    assertEquals(body.used, 3);
    assertEquals(body.limit, limit);
    assertEquals(body.remaining, limit - 3);
  } finally {
    kv.close();
  }
});

Deno.test("GET /usage: does NOT bump the counter (read-only)", async () => {
  const kv = await Deno.openKv(":memory:");
  try {
    const customer = await createCustomer(kv, "peek@example.com");
    assert(customer);
    const created = await createKey(kv, "r", { customerId: customer.id });
    const handler = testHandler({ kv });

    // Two back-to-back /usage calls.
    const req1 = new Request("http://x/usage", {
      headers: { authorization: `Bearer ${created.plaintext}` },
    });
    const req2 = new Request("http://x/usage", {
      headers: { authorization: `Bearer ${created.plaintext}` },
    });
    const b1 = await (await handler(req1)).json();
    const b2 = await (await handler(req2)).json();
    assertEquals(b1.used, 0);
    assertEquals(b2.used, 0);
  } finally {
    kv.close();
  }
});

Deno.test("GET /usage: grandfathered key (no customer_id) → 404", async () => {
  const kv = await Deno.openKv(":memory:");
  try {
    // createKey with no customerId mirrors the pre-M2 admin CLI flow.
    const created = await createKey(kv, "internal");
    const handler = testHandler({ kv });
    const res = await handler(
      new Request("http://x/usage", {
        headers: { authorization: `Bearer ${created.plaintext}` },
      }),
    );
    assertEquals(res.status, 404);
    const body = await res.json();
    assertEquals(body.error, "not_found");
  } finally {
    kv.close();
  }
});

Deno.test("GET /usage: missing auth → 401", async () => {
  const kv = await Deno.openKv(":memory:");
  try {
    const handler = testHandler({ kv });
    const res = await handler(new Request("http://x/usage"));
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "unauthenticated");
  } finally {
    kv.close();
  }
});

Deno.test("GET /usage: revoked key → 401", async () => {
  const kv = await Deno.openKv(":memory:");
  try {
    const customer = await createCustomer(kv, "revoked@example.com");
    assert(customer);
    const created = await createKey(kv, "x", { customerId: customer.id });
    await revokeKey(kv, created.record.id);
    const handler = testHandler({ kv });
    const res = await handler(
      new Request("http://x/usage", {
        headers: { authorization: `Bearer ${created.plaintext}` },
      }),
    );
    assertEquals(res.status, 401);
  } finally {
    kv.close();
  }
});

Deno.test("POST /usage → 405 with Allow: GET", async () => {
  const kv = await Deno.openKv(":memory:");
  try {
    const customer = await createCustomer(kv, "m@example.com");
    assert(customer);
    const created = await createKey(kv, "m", { customerId: customer.id });
    const handler = testHandler({ kv });
    const res = await handler(
      new Request("http://x/usage", {
        method: "POST",
        headers: { authorization: `Bearer ${created.plaintext}` },
      }),
    );
    assertEquals(res.status, 405);
    assertEquals(res.headers.get("allow"), "GET");
  } finally {
    kv.close();
  }
});
