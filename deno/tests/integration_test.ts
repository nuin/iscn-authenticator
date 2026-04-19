/**
 * End-to-end integration tests for the composed request pipeline.
 * Uses an in-memory KV + synthetic Request objects; no sockets.
 */

import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import { buildHandler } from "../lib/middleware.ts";
import { defaultConfig } from "../lib/config.ts";
import { createKey, revokeKey } from "../lib/keys.ts";

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
      configOverrides: { rateLimitPerMin: 2 },
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
    assert(res.headers.get("access-control-allow-headers")?.toLowerCase().includes("authorization"));
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
