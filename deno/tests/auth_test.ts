import { assert, assertEquals, assertRejects } from "jsr:@std/assert@^1.0.0";
import { authenticate, extractCredential, hasAuthorizationHeader } from "../lib/auth.ts";
import { UnauthenticatedError } from "../lib/errors.ts";
import { createKey, revokeKey } from "../lib/keys.ts";

async function openMemoryKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

Deno.test("extractCredential: Authorization Bearer", () => {
  const req = new Request("http://x", { headers: { authorization: "Bearer abc123" } });
  assertEquals(extractCredential(req), "abc123");
});

Deno.test("extractCredential: Bearer scheme is case-insensitive", () => {
  for (const scheme of ["bearer", "BEARER", "BeArEr"]) {
    const req = new Request("http://x", { headers: { authorization: `${scheme} xyz` } });
    assertEquals(extractCredential(req), "xyz");
  }
});

Deno.test("extractCredential: X-API-Key fallback when no Authorization", () => {
  const req = new Request("http://x", { headers: { "x-api-key": "xyz" } });
  assertEquals(extractCredential(req), "xyz");
});

Deno.test("extractCredential: Authorization wins over X-API-Key", () => {
  const req = new Request("http://x", {
    headers: { authorization: "Bearer abc", "x-api-key": "xyz" },
  });
  assertEquals(extractCredential(req), "abc");
});

Deno.test("extractCredential: non-Bearer Authorization header is rejected (returns null)", () => {
  const req = new Request("http://x", {
    headers: { authorization: "Basic dXNlcjpwYXNz" },
  });
  assertEquals(extractCredential(req), null);
});

Deno.test("extractCredential: trims leading/trailing whitespace from token", () => {
  const req = new Request("http://x", { headers: { authorization: "Bearer   abc   " } });
  assertEquals(extractCredential(req), "abc");
});

Deno.test("extractCredential: no headers → null", () => {
  const req = new Request("http://x");
  assertEquals(extractCredential(req), null);
});

Deno.test("hasAuthorizationHeader: reflects presence of either header", () => {
  assert(!hasAuthorizationHeader(new Request("http://x")));
  assert(hasAuthorizationHeader(new Request("http://x", { headers: { authorization: "x" } })));
  assert(hasAuthorizationHeader(new Request("http://x", { headers: { "x-api-key": "x" } })));
});

Deno.test("authenticate: valid key → identity with key_id + label", async () => {
  const kv = await openMemoryKv();
  try {
    const { record, plaintext } = await createKey(kv, "acme-labs");
    const req = new Request("http://x", { headers: { authorization: `Bearer ${plaintext}` } });
    const id = await authenticate(req, kv);
    assertEquals(id.key_id, record.id);
    assertEquals(id.label, "acme-labs");
  } finally {
    kv.close();
  }
});

Deno.test("authenticate: valid key via X-API-Key", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext } = await createKey(kv, "acme-labs");
    const req = new Request("http://x", { headers: { "x-api-key": plaintext } });
    const id = await authenticate(req, kv);
    assertEquals(id.label, "acme-labs");
  } finally {
    kv.close();
  }
});

Deno.test("authenticate: no credential → UnauthenticatedError", async () => {
  const kv = await openMemoryKv();
  try {
    const req = new Request("http://x");
    await assertRejects(() => authenticate(req, kv), UnauthenticatedError);
  } finally {
    kv.close();
  }
});

Deno.test("authenticate: malformed Bearer → UnauthenticatedError", async () => {
  const kv = await openMemoryKv();
  try {
    const req = new Request("http://x", { headers: { authorization: "Basic xyz" } });
    await assertRejects(() => authenticate(req, kv), UnauthenticatedError);
  } finally {
    kv.close();
  }
});

Deno.test("authenticate: unknown key → UnauthenticatedError", async () => {
  const kv = await openMemoryKv();
  try {
    const req = new Request("http://x", {
      headers: { authorization: `Bearer iscn_live_${"0".repeat(32)}` },
    });
    await assertRejects(() => authenticate(req, kv), UnauthenticatedError);
  } finally {
    kv.close();
  }
});

Deno.test("authenticate: revoked key → UnauthenticatedError", async () => {
  const kv = await openMemoryKv();
  try {
    const { record, plaintext } = await createKey(kv, "acme-labs");
    await revokeKey(kv, record.id);
    const req = new Request("http://x", { headers: { authorization: `Bearer ${plaintext}` } });
    await assertRejects(() => authenticate(req, kv), UnauthenticatedError);
  } finally {
    kv.close();
  }
});

Deno.test("authenticate: malformed (non-iscn shape) key → UnauthenticatedError", async () => {
  const kv = await openMemoryKv();
  try {
    const req = new Request("http://x", { headers: { authorization: "Bearer not-a-key" } });
    await assertRejects(() => authenticate(req, kv), UnauthenticatedError);
  } finally {
    kv.close();
  }
});

Deno.test("authenticate: empty Bearer token → UnauthenticatedError", async () => {
  const kv = await openMemoryKv();
  try {
    const req = new Request("http://x", { headers: { authorization: "Bearer    " } });
    await assertRejects(() => authenticate(req, kv), UnauthenticatedError);
  } finally {
    kv.close();
  }
});

Deno.test("authenticate: does NOT differentiate reason (anti-probing)", async () => {
  // Reason-neutrality: all failure paths throw the same error class with the
  // same public message, so attackers can't distinguish unknown vs revoked.
  const kv = await openMemoryKv();
  try {
    const msgs: string[] = [];
    const cases: Record<string, string>[] = [
      {}, // no credential
      { authorization: "Basic x" }, // malformed
      { authorization: `Bearer iscn_live_${"0".repeat(32)}` }, // unknown
    ];
    for (const headers of cases) {
      const req = new Request("http://x", { headers });
      try {
        await authenticate(req, kv);
      } catch (e) {
        if (e instanceof UnauthenticatedError) msgs.push(e.message);
      }
    }
    // All three produced the same public message.
    assertEquals(new Set(msgs).size, 1);
  } finally {
    kv.close();
  }
});
