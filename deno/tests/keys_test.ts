import { assert, assertEquals, assertMatch, assertNotEquals } from "jsr:@std/assert@^1.0.0";
import {
  createKey,
  isWellFormedKey,
  listKeys,
  lookupKeyByPlaintext,
  revokeKey,
  sha256Hex,
  touchKey,
} from "../lib/keys.ts";

async function openMemoryKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

Deno.test("sha256Hex: produces canonical hex for known input", async () => {
  const got = await sha256Hex("abc");
  assertEquals(got, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

Deno.test("isWellFormedKey: accepts valid live/test forms, rejects garbage", () => {
  assert(isWellFormedKey("iscn_live_" + "a".repeat(32)));
  assert(isWellFormedKey("iscn_test_" + "f".repeat(32)));
  assert(!isWellFormedKey(""));
  assert(!isWellFormedKey("iscn_live_" + "a".repeat(31))); // too short
  assert(!isWellFormedKey("iscn_live_" + "a".repeat(33))); // too long
  assert(!isWellFormedKey("iscn_prod_" + "a".repeat(32))); // wrong env
  assert(!isWellFormedKey("Bearer iscn_live_" + "a".repeat(32))); // extra prefix
  assert(!isWellFormedKey("iscn_live_" + "g".repeat(32))); // non-hex
});

Deno.test("createKey: returns plaintext with correct shape", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext, record } = await createKey(kv, "acme-labs");
    assertMatch(plaintext, /^iscn_live_[0-9a-f]{32}$/);
    assertEquals(record.env, "live");
    assertEquals(record.label, "acme-labs");
    assertMatch(record.id, /^k_[0-9a-f]{12}$/);
    assertEquals(record.last_used_at, null);
    assertEquals(record.revoked_at, null);
    assertMatch(record.created_at, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    kv.close();
  }
});

Deno.test("createKey: respects env=test", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext, record } = await createKey(kv, "ci-smoke", { env: "test" });
    assertMatch(plaintext, /^iscn_test_[0-9a-f]{32}$/);
    assertEquals(record.env, "test");
  } finally {
    kv.close();
  }
});

Deno.test("createKey → listKeys → revokeKey: full roundtrip", async () => {
  const kv = await openMemoryKv();
  try {
    const { record: a } = await createKey(kv, "acme-labs");
    const { record: b } = await createKey(kv, "beta-corp");
    let listed = await listKeys(kv);
    assertEquals(listed.length, 2);
    assertEquals(new Set(listed.map((k) => k.id)), new Set([a.id, b.id]));
    assert(listed.every((k) => k.revoked_at === null));

    const revoked = await revokeKey(kv, a.id);
    assert(revoked !== null);
    assertNotEquals(revoked.revoked_at, null);

    listed = await listKeys(kv);
    assertEquals(listed.length, 2);
    const revokedEntry = listed.find((k) => k.id === a.id)!;
    assertNotEquals(revokedEntry.revoked_at, null);
  } finally {
    kv.close();
  }
});

Deno.test("listKeys: sorted newest-first", async () => {
  const kv = await openMemoryKv();
  try {
    const { record: first } = await createKey(kv, "first");
    // Ensure the two created_at values differ.
    await new Promise((r) => setTimeout(r, 5));
    const { record: second } = await createKey(kv, "second");
    const listed = await listKeys(kv);
    assertEquals(listed.map((k) => k.id), [second.id, first.id]);
  } finally {
    kv.close();
  }
});

Deno.test("lookupKeyByPlaintext: returns record for active key", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext, record } = await createKey(kv, "acme-labs");
    const found = await lookupKeyByPlaintext(kv, plaintext);
    assert(found !== null);
    assertEquals(found.id, record.id);
    assertEquals(found.label, "acme-labs");
  } finally {
    kv.close();
  }
});

Deno.test("lookupKeyByPlaintext: returns null for revoked key", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext, record } = await createKey(kv, "acme-labs");
    await revokeKey(kv, record.id);
    const found = await lookupKeyByPlaintext(kv, plaintext);
    assertEquals(found, null);
  } finally {
    kv.close();
  }
});

Deno.test("lookupKeyByPlaintext: returns null for unknown key", async () => {
  const kv = await openMemoryKv();
  try {
    const found = await lookupKeyByPlaintext(kv, "iscn_live_" + "0".repeat(32));
    assertEquals(found, null);
  } finally {
    kv.close();
  }
});

Deno.test("lookupKeyByPlaintext: returns null for malformed input", async () => {
  const kv = await openMemoryKv();
  try {
    assertEquals(await lookupKeyByPlaintext(kv, ""), null);
    assertEquals(await lookupKeyByPlaintext(kv, "not-a-key"), null);
    assertEquals(await lookupKeyByPlaintext(kv, "iscn_live_xyz"), null);
  } finally {
    kv.close();
  }
});

Deno.test("revokeKey: idempotent", async () => {
  const kv = await openMemoryKv();
  try {
    const { record } = await createKey(kv, "acme-labs");
    const first = await revokeKey(kv, record.id);
    const second = await revokeKey(kv, record.id);
    assertEquals(first!.revoked_at, second!.revoked_at);
  } finally {
    kv.close();
  }
});

Deno.test("revokeKey: returns null for unknown id", async () => {
  const kv = await openMemoryKv();
  try {
    const got = await revokeKey(kv, "k_doesnotexist");
    assertEquals(got, null);
  } finally {
    kv.close();
  }
});

Deno.test("createKey: duplicate label allowed (only plaintext+id must be unique)", async () => {
  const kv = await openMemoryKv();
  try {
    const { record: a } = await createKey(kv, "acme-labs");
    const { record: b } = await createKey(kv, "acme-labs");
    assertNotEquals(a.id, b.id);
  } finally {
    kv.close();
  }
});

Deno.test("touchKey: updates last_used_at without throwing", async () => {
  const kv = await openMemoryKv();
  try {
    const { plaintext, record } = await createKey(kv, "acme-labs");
    assertEquals(record.last_used_at, null);
    await touchKey(kv, record.id);
    const found = await lookupKeyByPlaintext(kv, plaintext);
    assert(found !== null);
    assert(found.last_used_at !== null);
  } finally {
    kv.close();
  }
});

Deno.test("touchKey: silent on unknown id (best-effort)", async () => {
  const kv = await openMemoryKv();
  try {
    await touchKey(kv, "k_doesnotexist"); // must not throw
  } finally {
    kv.close();
  }
});
