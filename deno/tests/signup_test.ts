/**
 * Signup endpoint tests — exercise `handleSignupRoute` against an in-memory
 * KV. Covers the GET form, both POST body shapes (form + JSON), per-IP rate
 * limiting, duplicate/invalid/missing email paths, and the successful
 * "create customer + key + session + plaintext reveal" end-to-end flow.
 */

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { handleSignupRoute, isSignupPath, renderSignupPage } from "../lib/signup.ts";
import { defaultConfig } from "../lib/config.ts";
import { createCustomer, lookupCustomerByEmail } from "../lib/customers.ts";
import { listKeysByCustomer, lookupKeyByPlaintext } from "../lib/keys.ts";
import { SESSION_COOKIE_NAME, validateSessionCookie } from "../lib/sessions.ts";
import { InvalidSignupError, MethodNotAllowedError, RateLimitError } from "../lib/errors.ts";

async function openKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

function formRequest(body: Record<string, string>): Request {
  const params = new URLSearchParams(body);
  return new Request("http://localhost/signup", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// isSignupPath
// ---------------------------------------------------------------------------

Deno.test("isSignupPath: matches exact /signup only", () => {
  assert(isSignupPath("/signup"));
  assert(!isSignupPath("/signup/"));
  assert(!isSignupPath("/signup/extra"));
  assert(!isSignupPath("/login"));
  assert(!isSignupPath("/dashboard"));
});

// ---------------------------------------------------------------------------
// GET /signup
// ---------------------------------------------------------------------------

Deno.test("GET /signup: renders the signup form", async () => {
  const kv = await openKv();
  try {
    const req = new Request("http://localhost/signup");
    const res = await handleSignupRoute(req, {
      kv,
      config: defaultConfig(),
      ip: "1.2.3.4",
    });
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
    const body = await res.text();
    assertStringIncludes(body, "<form");
    assertStringIncludes(body, 'name="email"');
    assertStringIncludes(body, "Create an account");
  } finally {
    kv.close();
  }
});

Deno.test("renderSignupPage: inlines the error message when provided", () => {
  const html = renderSignupPage({ error: "something went <wrong>" });
  assertStringIncludes(html, "something went &lt;wrong&gt;");
  assertStringIncludes(html, 'class="error"');
});

// ---------------------------------------------------------------------------
// POST /signup — success
// ---------------------------------------------------------------------------

Deno.test("POST /signup (form): creates customer + key + session and reveals plaintext", async () => {
  const kv = await openKv();
  try {
    const req = formRequest({ email: "Alice@Example.COM " });
    const res = await handleSignupRoute(req, {
      kv,
      config: defaultConfig(),
      ip: "1.2.3.4",
    });
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");

    // Customer persisted, email canonicalised.
    const customer = await lookupCustomerByEmail(kv, "alice@example.com");
    assert(customer !== null);
    assertEquals(customer!.email, "alice@example.com");
    assertEquals(customer!.tier, "free");
    assertEquals(customer!.status, "active");

    // First key created and owned by the new customer.
    const keys = await listKeysByCustomer(kv, customer!.id);
    assertEquals(keys.length, 1);
    assertEquals(keys[0].env, "live");
    assertEquals(keys[0].customer_id, customer!.id);

    // Plaintext is revealed in the HTML body once (and only once).
    const body = await res.text();
    const m = body.match(/iscn_live_[0-9a-f]{32}/);
    assert(m !== null, "response should reveal the plaintext key");
    // The revealed plaintext resolves back to the created key record.
    const resolved = await lookupKeyByPlaintext(kv, m![0]);
    assert(resolved !== null);
    assertEquals(resolved!.id, keys[0].id);

    // Session cookie is set and validates against the stored session.
    const setCookie = res.headers.get("set-cookie");
    assert(setCookie !== null);
    assertStringIncludes(setCookie!, `${SESSION_COOKIE_NAME}=`);
    const cookieValue = setCookie!.split(";")[0].slice(SESSION_COOKIE_NAME.length + 1);
    const session = await validateSessionCookie(
      kv,
      cookieValue,
      defaultConfig().sessionSecret,
    );
    assert(session !== null);
    assertEquals(session!.customer_id, customer!.id);
  } finally {
    kv.close();
  }
});

Deno.test("POST /signup (json): accepts JSON bodies identical to form bodies", async () => {
  const kv = await openKv();
  try {
    const req = jsonRequest({ email: "bob@example.com" });
    const res = await handleSignupRoute(req, {
      kv,
      config: defaultConfig(),
      ip: "1.2.3.4",
    });
    assertEquals(res.status, 200);
    const customer = await lookupCustomerByEmail(kv, "bob@example.com");
    assert(customer !== null);
    const body = await res.text();
    assertStringIncludes(body, "iscn_live_");
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// POST /signup — validation failures
// ---------------------------------------------------------------------------

Deno.test("POST /signup: missing email → InvalidSignupError", async () => {
  const kv = await openKv();
  try {
    const req = formRequest({});
    let caught: unknown;
    try {
      await handleSignupRoute(req, { kv, config: defaultConfig(), ip: "1.2.3.4" });
    } catch (err) {
      caught = err;
    }
    assert(caught instanceof InvalidSignupError);
    assertEquals((caught as InvalidSignupError).status, 400);
    assertEquals((caught as InvalidSignupError).code, "invalid_signup");
  } finally {
    kv.close();
  }
});

Deno.test("POST /signup: missing email field in JSON → InvalidSignupError", async () => {
  const kv = await openKv();
  try {
    const req = jsonRequest({ not_email: "x" });
    let caught: unknown;
    try {
      await handleSignupRoute(req, { kv, config: defaultConfig(), ip: "1.2.3.4" });
    } catch (err) {
      caught = err;
    }
    assert(caught instanceof InvalidSignupError);
  } finally {
    kv.close();
  }
});

Deno.test("POST /signup: malformed email → InvalidSignupError", async () => {
  const kv = await openKv();
  try {
    const req = formRequest({ email: "not-an-email" });
    let caught: unknown;
    try {
      await handleSignupRoute(req, { kv, config: defaultConfig(), ip: "1.2.3.4" });
    } catch (err) {
      caught = err;
    }
    assert(caught instanceof InvalidSignupError);
    assertStringIncludes((caught as InvalidSignupError).message, "Invalid email");
  } finally {
    kv.close();
  }
});

Deno.test("POST /signup: duplicate email → InvalidSignupError", async () => {
  const kv = await openKv();
  try {
    // Seed a customer out-of-band.
    const seeded = await createCustomer(kv, "clash@example.com");
    assert(seeded !== null);

    const req = formRequest({ email: "clash@example.com" });
    let caught: unknown;
    try {
      await handleSignupRoute(req, { kv, config: defaultConfig(), ip: "1.2.3.4" });
    } catch (err) {
      caught = err;
    }
    assert(caught instanceof InvalidSignupError);
    assertStringIncludes((caught as InvalidSignupError).message, "already registered");
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// POST /signup — per-IP rate limit
// ---------------------------------------------------------------------------

Deno.test("POST /signup: per-IP rate limit trips after burst exhausted", async () => {
  const kv = await openKv();
  try {
    const config = defaultConfig();
    // Freeze clock so no refill happens between requests.
    const now = () => 1_700_000_000_000;
    const ip = "9.9.9.9";
    // First 10 signups (different emails) should succeed — burst is 10.
    for (let i = 0; i < 10; i++) {
      const res = await handleSignupRoute(
        formRequest({ email: `user${i}@example.com` }),
        { kv, config, ip, now },
      );
      assertEquals(res.status, 200, `request ${i} unexpectedly non-200`);
    }
    // 11th must 429 via RateLimitError.
    let caught: unknown;
    try {
      await handleSignupRoute(
        formRequest({ email: "over@example.com" }),
        { kv, config, ip, now },
      );
    } catch (err) {
      caught = err;
    }
    assert(caught instanceof RateLimitError);
    assertEquals((caught as RateLimitError).status, 429);
    assertStringIncludes(
      (caught as RateLimitError).message.toLowerCase(),
      "signup",
    );
    // And the 11th signup's email was never persisted.
    const leaked = await lookupCustomerByEmail(kv, "over@example.com");
    assertEquals(leaked, null);
  } finally {
    kv.close();
  }
});

Deno.test("POST /signup: falls back to 'unknown' bucket when ip is null", async () => {
  const kv = await openKv();
  try {
    // First signup with null IP succeeds.
    const res = await handleSignupRoute(
      formRequest({ email: "nullip@example.com" }),
      { kv, config: defaultConfig(), ip: null },
    );
    assertEquals(res.status, 200);
    // Bucket entry lives at tb:signup:unknown — sanity-check presence.
    const bucket = await kv.get(["tb", "signup:unknown"]);
    assert(bucket.value !== null);
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// Method + content-type guards
// ---------------------------------------------------------------------------

Deno.test("signup: non-GET/POST methods return 405", async () => {
  const kv = await openKv();
  try {
    const req = new Request("http://localhost/signup", { method: "PUT" });
    let caught: unknown;
    try {
      await handleSignupRoute(req, { kv, config: defaultConfig(), ip: "1.2.3.4" });
    } catch (err) {
      caught = err;
    }
    assert(caught instanceof MethodNotAllowedError);
    assertEquals((caught as MethodNotAllowedError).headers.Allow, "GET, POST");
  } finally {
    kv.close();
  }
});

Deno.test("signup: unsupported content-type POST → 400", async () => {
  const kv = await openKv();
  try {
    const req = new Request("http://localhost/signup", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "email=foo@bar.com",
    });
    let caught: unknown;
    try {
      await handleSignupRoute(req, { kv, config: defaultConfig(), ip: "1.2.3.4" });
    } catch (err) {
      caught = err;
    }
    assert(caught !== undefined);
    // BadRequestError from readEmailFromBody.
    assertEquals((caught as { status: number }).status, 400);
  } finally {
    kv.close();
  }
});
