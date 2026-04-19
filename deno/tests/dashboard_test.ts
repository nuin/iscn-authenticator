/**
 * Dashboard tests — exercise `handleDashboardRoute` against a real in-memory
 * KV. These cover the full dispatcher branching, session gating, HTMX
 * fragment semantics, and cross-customer defence.
 */

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { escHtml, handleDashboardRoute, isDashboardPath } from "../lib/dashboard.ts";
import type { DashboardCtx } from "../lib/dashboard.ts";
import { defaultConfig } from "../lib/config.ts";
import { createCustomer } from "../lib/customers.ts";
import { createKey, listKeysByCustomer, lookupKeyByPlaintext } from "../lib/keys.ts";
import { createSession, destroySession, SESSION_COOKIE_NAME } from "../lib/sessions.ts";
import { NotFoundError, UnauthenticatedError } from "../lib/errors.ts";

async function openKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

function ctxFor(kv: Deno.Kv): DashboardCtx {
  return { kv, config: defaultConfig() };
}

function fixedCtx(kv: Deno.Kv, nowIso: string): DashboardCtx {
  return { kv, config: defaultConfig(), now: () => new Date(nowIso) };
}

async function seedCustomerWithKey(
  kv: Deno.Kv,
  email = "owner@example.com",
  label = "prod",
) {
  const customer = await createCustomer(kv, email);
  assert(customer !== null);
  const created = await createKey(kv, label, { customerId: customer!.id });
  return { customer: customer!, created };
}

function sessionCookieHeader(cookieValue: string): HeadersInit {
  return { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` };
}

async function sessionFor(
  kv: Deno.Kv,
  customerId: string,
): Promise<string> {
  const out = await createSession(kv, customerId, defaultConfig().sessionSecret, {
    secure: false,
  });
  return out.cookie_value;
}

// ---------------------------------------------------------------------------
// isDashboardPath
// ---------------------------------------------------------------------------

Deno.test("isDashboardPath: matches dashboard routes only", () => {
  assert(isDashboardPath("/login"));
  assert(isDashboardPath("/logout"));
  assert(isDashboardPath("/dashboard"));
  assert(isDashboardPath("/dashboard/keys"));
  assert(isDashboardPath("/dashboard/keys/rotate"));
  assert(isDashboardPath("/dashboard/billing"));
  assert(!isDashboardPath("/"));
  assert(!isDashboardPath("/health"));
  assert(!isDashboardPath("/validate"));
  assert(!isDashboardPath("/keys/rotate"));
});

// ---------------------------------------------------------------------------
// escHtml
// ---------------------------------------------------------------------------

Deno.test("escHtml: escapes the five HTML-sensitive chars", () => {
  assertEquals(escHtml("&"), "&amp;");
  assertEquals(escHtml("<script>"), "&lt;script&gt;");
  assertEquals(escHtml(`"`), "&quot;");
  assertEquals(escHtml("'"), "&#39;");
  assertEquals(
    escHtml(`<img src="x" onerror='alert(1)'>`),
    "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;",
  );
});

// ---------------------------------------------------------------------------
// /login
// ---------------------------------------------------------------------------

Deno.test("GET /login renders a login form", async () => {
  const kv = await openKv();
  try {
    const res = await handleDashboardRoute(
      new Request("http://x/login"),
      ctxFor(kv),
    );
    assertEquals(res.status, 200);
    assertStringIncludes(res.headers.get("content-type") ?? "", "text/html");
    const body = await res.text();
    assertStringIncludes(body, `name="api_key"`);
    assertStringIncludes(body, `action="/login"`);
  } finally {
    kv.close();
  }
});

Deno.test("POST /login with empty form → 400 with error message", async () => {
  const kv = await openKv();
  try {
    const res = await handleDashboardRoute(
      new Request("http://x/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "api_key=",
      }),
      ctxFor(kv),
    );
    assertEquals(res.status, 400);
    const body = await res.text();
    assertStringIncludes(body, "Please provide an API key.");
  } finally {
    kv.close();
  }
});

Deno.test("POST /login with unknown key → 401 generic error", async () => {
  const kv = await openKv();
  try {
    const res = await handleDashboardRoute(
      new Request("http://x/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "api_key=iscn_live_deadbeefdeadbeefdeadbeefdeadbeef",
      }),
      ctxFor(kv),
    );
    assertEquals(res.status, 401);
    const body = await res.text();
    assertStringIncludes(body, "not valid for dashboard access");
  } finally {
    kv.close();
  }
});

Deno.test("POST /login with grandfathered (customer_id=null) key → 401", async () => {
  const kv = await openKv();
  try {
    const grand = await createKey(kv, "internal"); // no customerId → null
    const res = await handleDashboardRoute(
      new Request("http://x/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `api_key=${encodeURIComponent(grand.plaintext)}`,
      }),
      ctxFor(kv),
    );
    assertEquals(res.status, 401);
  } finally {
    kv.close();
  }
});

Deno.test("POST /login success → 303 + Set-Cookie + Location=/dashboard", async () => {
  const kv = await openKv();
  try {
    const { created } = await seedCustomerWithKey(kv);
    const res = await handleDashboardRoute(
      new Request("http://x/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `api_key=${encodeURIComponent(created.plaintext)}`,
      }),
      ctxFor(kv),
    );
    assertEquals(res.status, 303);
    assertEquals(res.headers.get("location"), "/dashboard");
    const setCookie = res.headers.get("set-cookie") ?? "";
    assert(setCookie.startsWith(`${SESSION_COOKIE_NAME}=`));
    assert(setCookie.includes("HttpOnly"));
    // http:// → Secure must NOT be set.
    assert(!setCookie.includes("Secure"));
  } finally {
    kv.close();
  }
});

Deno.test("POST /login over https → Set-Cookie includes Secure", async () => {
  const kv = await openKv();
  try {
    const { created } = await seedCustomerWithKey(kv);
    const res = await handleDashboardRoute(
      new Request("https://x/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `api_key=${encodeURIComponent(created.plaintext)}`,
      }),
      ctxFor(kv),
    );
    assertEquals(res.status, 303);
    const setCookie = res.headers.get("set-cookie") ?? "";
    assert(setCookie.includes("Secure"));
  } finally {
    kv.close();
  }
});

Deno.test("POST /login requires form content-type", async () => {
  const kv = await openKv();
  try {
    const { created } = await seedCustomerWithKey(kv);
    let threw = false;
    try {
      await handleDashboardRoute(
        new Request("http://x/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ api_key: created.plaintext }),
        }),
        ctxFor(kv),
      );
    } catch {
      threw = true;
    }
    assert(threw);
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// /logout
// ---------------------------------------------------------------------------

Deno.test("POST /logout with valid session destroys row and clears cookie", async () => {
  const kv = await openKv();
  try {
    const { customer } = await seedCustomerWithKey(kv);
    const cookie = await sessionFor(kv, customer.id);
    const res = await handleDashboardRoute(
      new Request("http://x/logout", {
        method: "POST",
        headers: sessionCookieHeader(cookie),
      }),
      ctxFor(kv),
    );
    assertEquals(res.status, 303);
    assertEquals(res.headers.get("location"), "/login");
    const setCookie = res.headers.get("set-cookie") ?? "";
    assert(setCookie.includes("Max-Age=0"));
  } finally {
    kv.close();
  }
});

Deno.test("POST /logout without session still 303s to /login", async () => {
  const kv = await openKv();
  try {
    const res = await handleDashboardRoute(
      new Request("http://x/logout", { method: "POST" }),
      ctxFor(kv),
    );
    assertEquals(res.status, 303);
    assertEquals(res.headers.get("location"), "/login");
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// /dashboard (Overview)
// ---------------------------------------------------------------------------

Deno.test("GET /dashboard without session → UnauthenticatedError", async () => {
  const kv = await openKv();
  try {
    let caught: unknown = null;
    try {
      await handleDashboardRoute(
        new Request("http://x/dashboard"),
        ctxFor(kv),
      );
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof UnauthenticatedError);
  } finally {
    kv.close();
  }
});

Deno.test("GET /dashboard with valid session renders overview", async () => {
  const kv = await openKv();
  try {
    const { customer } = await seedCustomerWithKey(kv, "alice@example.com");
    const cookie = await sessionFor(kv, customer.id);
    const res = await handleDashboardRoute(
      new Request("http://x/dashboard", {
        headers: sessionCookieHeader(cookie),
      }),
      fixedCtx(kv, "2026-04-15T12:00:00Z"),
    );
    assertEquals(res.status, 200);
    const body = await res.text();
    assertStringIncludes(body, "alice@example.com");
    assertStringIncludes(body, customer.id);
    assertStringIncludes(body, "202604"); // month tag (YYYYMM)
    assertStringIncludes(body, "Free");
    // HTMX script pinned via SRI:
    assertStringIncludes(body, `unpkg.com/htmx.org@1.9.10`);
    assertStringIncludes(body, `integrity="sha384-`);
  } finally {
    kv.close();
  }
});

Deno.test("GET /dashboard with session for deleted customer → 401 + destroy", async () => {
  const kv = await openKv();
  try {
    const { customer } = await seedCustomerWithKey(kv);
    const cookie = await sessionFor(kv, customer.id);
    // Simulate a deleted customer by nuking the customer row directly.
    await kv.delete(["customers", customer.id]);

    let caught: unknown = null;
    try {
      await handleDashboardRoute(
        new Request("http://x/dashboard", {
          headers: sessionCookieHeader(cookie),
        }),
        ctxFor(kv),
      );
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof UnauthenticatedError);
    // Session row should be gone (clean re-login, not a loop).
    const sessions: unknown[] = [];
    for await (const _ of kv.list({ prefix: ["sessions"] })) sessions.push(1);
    assertEquals(sessions.length, 0);
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// /dashboard/keys
// ---------------------------------------------------------------------------

Deno.test("GET /dashboard/keys shows only the session's own keys", async () => {
  const kv = await openKv();
  try {
    const alice = await seedCustomerWithKey(kv, "alice@example.com", "alice-prod");
    const bob = await seedCustomerWithKey(kv, "bob@example.com", "bob-prod");
    const cookie = await sessionFor(kv, alice.customer.id);
    const res = await handleDashboardRoute(
      new Request("http://x/dashboard/keys", {
        headers: sessionCookieHeader(cookie),
      }),
      ctxFor(kv),
    );
    assertEquals(res.status, 200);
    const body = await res.text();
    assertStringIncludes(body, alice.created.record.id);
    assertStringIncludes(body, "alice-prod");
    // Bob's key must NOT leak into Alice's dashboard.
    assert(!body.includes(bob.created.record.id));
    assert(!body.includes("bob-prod"));
  } finally {
    kv.close();
  }
});

Deno.test("POST /dashboard/keys/rotate rotates own key and reveals new plaintext once", async () => {
  const kv = await openKv();
  try {
    const { customer, created } = await seedCustomerWithKey(kv);
    const cookie = await sessionFor(kv, customer.id);
    const res = await handleDashboardRoute(
      new Request("http://x/dashboard/keys/rotate", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: `${SESSION_COOKIE_NAME}=${cookie}`,
        },
        body: `key_id=${encodeURIComponent(created.record.id)}`,
      }),
      ctxFor(kv),
    );
    assertEquals(res.status, 200);
    const body = await res.text();
    // Fragment, not full doc — we should see the keys-panel marker.
    assertStringIncludes(body, `id="keys-panel"`);
    assert(!body.includes("<!DOCTYPE html>"));
    // Old key now revoked.
    const stillValid = await lookupKeyByPlaintext(kv, created.plaintext);
    assertEquals(stillValid, null);
    // Plaintext-reveal block present; it contains an iscn_ prefixed token.
    assertStringIncludes(body, "iscn_live_");
    // And the new key is owned by the same customer.
    const ownKeys = await listKeysByCustomer(kv, customer.id);
    assertEquals(ownKeys.length, 2); // old (revoked) + new
  } finally {
    kv.close();
  }
});

Deno.test("POST /dashboard/keys/rotate on another customer's key → NotFoundError", async () => {
  const kv = await openKv();
  try {
    const alice = await seedCustomerWithKey(kv, "alice@example.com");
    const bob = await seedCustomerWithKey(kv, "bob@example.com");
    const aliceCookie = await sessionFor(kv, alice.customer.id);

    let caught: unknown = null;
    try {
      await handleDashboardRoute(
        new Request("http://x/dashboard/keys/rotate", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: `${SESSION_COOKIE_NAME}=${aliceCookie}`,
          },
          body: `key_id=${encodeURIComponent(bob.created.record.id)}`,
        }),
        ctxFor(kv),
      );
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof NotFoundError);
    // Bob's key must still be valid (not touched).
    const bobKey = await lookupKeyByPlaintext(kv, bob.created.plaintext);
    assert(bobKey !== null);
  } finally {
    kv.close();
  }
});

Deno.test("POST /dashboard/keys/revoke revokes own key and returns fragment", async () => {
  const kv = await openKv();
  try {
    const { customer, created } = await seedCustomerWithKey(kv);
    const cookie = await sessionFor(kv, customer.id);
    const res = await handleDashboardRoute(
      new Request("http://x/dashboard/keys/revoke", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: `${SESSION_COOKIE_NAME}=${cookie}`,
        },
        body: `key_id=${encodeURIComponent(created.record.id)}`,
      }),
      ctxFor(kv),
    );
    assertEquals(res.status, 200);
    const body = await res.text();
    assertStringIncludes(body, `id="keys-panel"`);
    assertStringIncludes(body, "Revoked");
    // Old plaintext no longer validates.
    const stillValid = await lookupKeyByPlaintext(kv, created.plaintext);
    assertEquals(stillValid, null);
  } finally {
    kv.close();
  }
});

Deno.test("POST /dashboard/keys/revoke on another customer's key → NotFoundError", async () => {
  const kv = await openKv();
  try {
    const alice = await seedCustomerWithKey(kv, "alice@example.com");
    const bob = await seedCustomerWithKey(kv, "bob@example.com");
    const aliceCookie = await sessionFor(kv, alice.customer.id);

    let caught: unknown = null;
    try {
      await handleDashboardRoute(
        new Request("http://x/dashboard/keys/revoke", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: `${SESSION_COOKIE_NAME}=${aliceCookie}`,
          },
          body: `key_id=${encodeURIComponent(bob.created.record.id)}`,
        }),
        ctxFor(kv),
      );
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof NotFoundError);
    const bobKey = await lookupKeyByPlaintext(kv, bob.created.plaintext);
    assert(bobKey !== null);
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// /dashboard/billing
// ---------------------------------------------------------------------------

Deno.test("GET /dashboard/billing shows Free plan for free customer", async () => {
  const kv = await openKv();
  try {
    const { customer } = await seedCustomerWithKey(kv);
    const cookie = await sessionFor(kv, customer.id);
    const res = await handleDashboardRoute(
      new Request("http://x/dashboard/billing", {
        headers: sessionCookieHeader(cookie),
      }),
      ctxFor(kv),
    );
    assertEquals(res.status, 200);
    const body = await res.text();
    assertStringIncludes(body, "Free");
  } finally {
    kv.close();
  }
});

Deno.test("GET /dashboard/billing shows Pro plan for pro customer", async () => {
  const kv = await openKv();
  try {
    const customer = await createCustomer(kv, "pro@example.com", { tier: "pro" });
    assert(customer !== null);
    const cookie = await sessionFor(kv, customer!.id);
    const res = await handleDashboardRoute(
      new Request("http://x/dashboard/billing", {
        headers: sessionCookieHeader(cookie),
      }),
      ctxFor(kv),
    );
    assertEquals(res.status, 200);
    const body = await res.text();
    assertStringIncludes(body, "Pro");
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// Unknown route under /dashboard/*
// ---------------------------------------------------------------------------

Deno.test("GET /dashboard/bogus → NotFoundError", async () => {
  const kv = await openKv();
  try {
    const { customer } = await seedCustomerWithKey(kv);
    const cookie = await sessionFor(kv, customer.id);
    let caught: unknown = null;
    try {
      await handleDashboardRoute(
        new Request("http://x/dashboard/bogus", {
          headers: sessionCookieHeader(cookie),
        }),
        ctxFor(kv),
      );
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof NotFoundError);
  } finally {
    kv.close();
  }
});

// ---------------------------------------------------------------------------
// Stale session after explicit destroy
// ---------------------------------------------------------------------------

Deno.test("session destroyed externally → dashboard request unauth'd", async () => {
  const kv = await openKv();
  try {
    const { customer } = await seedCustomerWithKey(kv);
    const cookie = await sessionFor(kv, customer.id);
    // Simulate session revocation (e.g., from another tab).
    const secret = defaultConfig().sessionSecret;
    // Pull session id back out via validation to destroy it.
    const { validateSessionCookie } = await import("../lib/sessions.ts");
    const rec = await validateSessionCookie(kv, cookie, secret);
    assert(rec !== null);
    await destroySession(kv, rec!.id);

    let caught: unknown = null;
    try {
      await handleDashboardRoute(
        new Request("http://x/dashboard", {
          headers: sessionCookieHeader(cookie),
        }),
        ctxFor(kv),
      );
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof UnauthenticatedError);
  } finally {
    kv.close();
  }
});
