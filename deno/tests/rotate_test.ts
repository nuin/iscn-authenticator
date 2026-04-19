import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  createKey,
  isWellFormedKey,
  lookupKeyByPlaintext,
  revokeKey,
  rotateKey,
} from "../lib/keys.ts";

async function openMemoryKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

Deno.test("rotateKey: unknown id → null", async () => {
  const kv = await openMemoryKv();
  try {
    const result = await rotateKey(kv, "k_doesnotexist");
    assertEquals(result, null);
  } finally {
    kv.close();
  }
});

Deno.test("rotateKey: already-revoked key → null", async () => {
  const kv = await openMemoryKv();
  try {
    const created = await createKey(kv, "stale");
    await revokeKey(kv, created.record.id);
    const result = await rotateKey(kv, created.record.id);
    assertEquals(result, null);
  } finally {
    kv.close();
  }
});

Deno.test("rotateKey: issues a new plaintext + id, revokes the old record", async () => {
  const kv = await openMemoryKv();
  try {
    const created = await createKey(kv, "rotate-me");
    const result = await rotateKey(kv, created.record.id);
    assert(result !== null);

    // Different id + different plaintext, same label/env/customer.
    assert(result.new.record.id !== created.record.id);
    assert(result.new.plaintext !== created.plaintext);
    assert(isWellFormedKey(result.new.plaintext));
    assertEquals(result.new.record.label, created.record.label);
    assertEquals(result.new.record.env, created.record.env);
    assertEquals(result.new.record.customer_id, null);

    // Old key is revoked → lookup rejects it.
    const oldLookup = await lookupKeyByPlaintext(kv, created.plaintext);
    assertEquals(oldLookup, null);

    // New key is active.
    const newLookup = await lookupKeyByPlaintext(kv, result.new.plaintext);
    assert(newLookup !== null);
    assertEquals(newLookup.id, result.new.record.id);
  } finally {
    kv.close();
  }
});

Deno.test("rotateKey: preserves customer_id + repopulates denorm index", async () => {
  const kv = await openMemoryKv();
  try {
    const created = await createKey(kv, "paying", { customerId: "c_123" });
    const result = await rotateKey(kv, created.record.id);
    assert(result !== null);
    assertEquals(result.new.record.customer_id, "c_123");
    // Denorm entry exists for the new id.
    const denorm = await kv.get<string>(["key_customer", result.new.record.id]);
    assertEquals(denorm.value, "c_123");
  } finally {
    kv.close();
  }
});

Deno.test("rotateKey: second rotate on old id (now revoked) → null", async () => {
  const kv = await openMemoryKv();
  try {
    const created = await createKey(kv, "double-rotate");
    const first = await rotateKey(kv, created.record.id);
    assert(first !== null);
    // Re-rotating the original (now-revoked) id must not succeed.
    const second = await rotateKey(kv, created.record.id);
    assertEquals(second, null);
  } finally {
    kv.close();
  }
});
