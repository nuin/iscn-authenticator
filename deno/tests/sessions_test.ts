import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  readCookie,
  SESSION_COOKIE_NAME,
  validateSessionCookie,
  validateSessionFromRequest,
} from "../lib/sessions.ts";
import { authenticateSession } from "../lib/auth.ts";
import { UnauthenticatedError } from "../lib/errors.ts";

async function memKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

const SECRET = "unit-test-secret";

Deno.test("createSession: persists a row and returns a signed Set-Cookie", async () => {
  const kv = await memKv();
  try {
    const out = await createSession(kv, "c_alice", SECRET);
    assert(out.record.id.startsWith("s_"));
    assertEquals(out.record.customer_id, "c_alice");
    assert(out.set_cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
    assert(out.set_cookie.includes("HttpOnly"));
    assert(out.set_cookie.includes("SameSite=Lax"));
    assert(out.set_cookie.includes("Max-Age="));
    assert(out.set_cookie.includes("Secure"));
    // KV row exists.
    const row = await kv.get(["sessions", out.record.id]);
    assert(row.value !== null);
  } finally {
    kv.close();
  }
});

Deno.test("createSession: Secure flag can be opted out for dev", async () => {
  const kv = await memKv();
  try {
    const out = await createSession(kv, "c_x", SECRET, { secure: false });
    assert(!out.set_cookie.includes("Secure"));
  } finally {
    kv.close();
  }
});

Deno.test("validateSessionCookie: round-trip ok", async () => {
  const kv = await memKv();
  try {
    const out = await createSession(kv, "c_alice", SECRET);
    const got = await validateSessionCookie(kv, out.cookie_value, SECRET);
    assert(got !== null);
    assertEquals(got!.id, out.record.id);
    assertEquals(got!.customer_id, "c_alice");
  } finally {
    kv.close();
  }
});

Deno.test("validateSessionCookie: wrong secret → null", async () => {
  const kv = await memKv();
  try {
    const out = await createSession(kv, "c_x", SECRET);
    const got = await validateSessionCookie(kv, out.cookie_value, "wrong");
    assertEquals(got, null);
  } finally {
    kv.close();
  }
});

Deno.test("validateSessionCookie: tampered signature → null", async () => {
  const kv = await memKv();
  try {
    const out = await createSession(kv, "c_x", SECRET);
    // Flip the final hex digit.
    const last = out.cookie_value.slice(-1);
    const swapped = last === "0" ? "1" : "0";
    const tampered = out.cookie_value.slice(0, -1) + swapped;
    const got = await validateSessionCookie(kv, tampered, SECRET);
    assertEquals(got, null);
  } finally {
    kv.close();
  }
});

Deno.test("validateSessionCookie: malformed shapes → null", async () => {
  const kv = await memKv();
  try {
    assertEquals(await validateSessionCookie(kv, "", SECRET), null);
    assertEquals(await validateSessionCookie(kv, "no-dot", SECRET), null);
    assertEquals(await validateSessionCookie(kv, ".onlydot", SECRET), null);
    assertEquals(await validateSessionCookie(kv, "x.y", SECRET), null);
    assertEquals(
      await validateSessionCookie(kv, "s_notHex.aa", SECRET),
      null,
    );
  } finally {
    kv.close();
  }
});

Deno.test("validateSessionCookie: empty secret → null", async () => {
  const kv = await memKv();
  try {
    const out = await createSession(kv, "c_x", SECRET);
    assertEquals(await validateSessionCookie(kv, out.cookie_value, ""), null);
  } finally {
    kv.close();
  }
});

Deno.test("validateSessionCookie: expired row → null", async () => {
  const kv = await memKv();
  try {
    const nowMs = Date.parse("2026-01-01T00:00:00Z");
    const out = await createSession(kv, "c_x", SECRET, {
      now: () => new Date(nowMs),
      ttlMs: 1000,
    });
    // Advance now well past expiry.
    const got = await validateSessionCookie(kv, out.cookie_value, SECRET, {
      now: () => new Date(nowMs + 60_000),
    });
    assertEquals(got, null);
  } finally {
    kv.close();
  }
});

Deno.test("destroySession: row is gone → validate → null", async () => {
  const kv = await memKv();
  try {
    const out = await createSession(kv, "c_x", SECRET);
    await destroySession(kv, out.record.id);
    const got = await validateSessionCookie(kv, out.cookie_value, SECRET);
    assertEquals(got, null);
  } finally {
    kv.close();
  }
});

Deno.test("validateSessionFromRequest: reads the iscn_session cookie", async () => {
  const kv = await memKv();
  try {
    const out = await createSession(kv, "c_alice", SECRET);
    const req = new Request("http://x/", {
      headers: {
        cookie: `other=1; ${SESSION_COOKIE_NAME}=${out.cookie_value}; more=2`,
      },
    });
    const got = await validateSessionFromRequest(req, kv, SECRET);
    assert(got !== null);
    assertEquals(got!.customer_id, "c_alice");
  } finally {
    kv.close();
  }
});

Deno.test("validateSessionFromRequest: no Cookie header → null", async () => {
  const kv = await memKv();
  try {
    const req = new Request("http://x/");
    const got = await validateSessionFromRequest(req, kv, SECRET);
    assertEquals(got, null);
  } finally {
    kv.close();
  }
});

Deno.test("validateSessionFromRequest: Cookie header without our cookie → null", async () => {
  const kv = await memKv();
  try {
    const req = new Request("http://x/", {
      headers: { cookie: "unrelated=1" },
    });
    const got = await validateSessionFromRequest(req, kv, SECRET);
    assertEquals(got, null);
  } finally {
    kv.close();
  }
});

Deno.test("authenticateSession: success returns the record", async () => {
  const kv = await memKv();
  try {
    const out = await createSession(kv, "c_alice", SECRET);
    const req = new Request("http://x/", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${out.cookie_value}` },
    });
    const record = await authenticateSession(req, kv, SECRET);
    assertEquals(record.customer_id, "c_alice");
  } finally {
    kv.close();
  }
});

Deno.test("authenticateSession: missing cookie throws UnauthenticatedError", async () => {
  const kv = await memKv();
  try {
    const req = new Request("http://x/");
    let caught: unknown = null;
    try {
      await authenticateSession(req, kv, SECRET);
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof UnauthenticatedError);
  } finally {
    kv.close();
  }
});

Deno.test("createSession: missing customerId / secret → throws", async () => {
  const kv = await memKv();
  try {
    let threw = 0;
    try {
      await createSession(kv, "", SECRET);
    } catch {
      threw++;
    }
    try {
      await createSession(kv, "c_x", "");
    } catch {
      threw++;
    }
    assertEquals(threw, 2);
  } finally {
    kv.close();
  }
});

Deno.test("clearSessionCookie: Max-Age=0 + attrs", () => {
  const header = clearSessionCookie();
  assert(header.startsWith(`${SESSION_COOKIE_NAME}=`));
  assert(header.includes("Max-Age=0"));
  assert(header.includes("HttpOnly"));
  assert(header.includes("Secure"));
});

Deno.test("clearSessionCookie: dev can drop Secure", () => {
  const header = clearSessionCookie({ secure: false });
  assert(!header.includes("Secure"));
});

Deno.test("readCookie: returns value for named cookie", () => {
  assertEquals(readCookie("a=1; b=2; c=3", "b"), "2");
  assertEquals(readCookie("only=here", "only"), "here");
  assertEquals(readCookie("a=1", "b"), null);
});

Deno.test("readCookie: handles leading/trailing whitespace", () => {
  assertEquals(readCookie("  a=1 ;  b=2 ", "b"), "2");
});
