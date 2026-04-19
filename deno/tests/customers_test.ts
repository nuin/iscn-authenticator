import {
  assert,
  assertEquals,
  assertMatch,
  assertRejects,
} from "jsr:@std/assert@^1.0.0";
import {
  attachStripeCustomer,
  canonicaliseEmail,
  createCustomer,
  isPlausibleEmail,
  listCustomers,
  lookupCustomerByEmail,
  lookupCustomerById,
  newCustomerId,
  updateCustomerStatus,
  updateCustomerTier,
} from "../lib/customers.ts";

async function openMemoryKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

Deno.test("newCustomerId: has c_ prefix + 16 hex", () => {
  assertMatch(newCustomerId(), /^c_[0-9a-f]{16}$/);
});

Deno.test("canonicaliseEmail: lowercases and trims", () => {
  assertEquals(canonicaliseEmail("  Alice@Example.COM "), "alice@example.com");
});

Deno.test("isPlausibleEmail: accepts valid, rejects obvious garbage", () => {
  assert(isPlausibleEmail("a@b.co"));
  assert(isPlausibleEmail("Alice+tag@Sub.Example.com"));
  assert(!isPlausibleEmail(""));
  assert(!isPlausibleEmail("foo"));
  assert(!isPlausibleEmail("foo@bar"));
  assert(!isPlausibleEmail("foo @bar.baz"));
  assert(!isPlausibleEmail("foo@bar@baz.com"));
});

Deno.test("createCustomer: returns record with defaults", async () => {
  const kv = await openMemoryKv();
  try {
    const record = await createCustomer(kv, "Alice@Example.com");
    assert(record !== null);
    assertMatch(record.id, /^c_[0-9a-f]{16}$/);
    assertEquals(record.email, "alice@example.com");
    assertEquals(record.tier, "free");
    assertEquals(record.status, "active");
    assertEquals(record.stripe_customer_id, null);
    assertMatch(record.created_at, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    kv.close();
  }
});

Deno.test("createCustomer: duplicate email returns null", async () => {
  const kv = await openMemoryKv();
  try {
    const first = await createCustomer(kv, "dup@example.com");
    const second = await createCustomer(kv, "DUP@example.com"); // case-insensitive
    assert(first !== null);
    assertEquals(second, null);
  } finally {
    kv.close();
  }
});

Deno.test("createCustomer: throws on obviously invalid email", async () => {
  const kv = await openMemoryKv();
  try {
    await assertRejects(
      () => createCustomer(kv, "not-an-email"),
      Error,
      "Invalid email",
    );
  } finally {
    kv.close();
  }
});

Deno.test("lookupCustomerById: returns record", async () => {
  const kv = await openMemoryKv();
  try {
    const record = await createCustomer(kv, "alice@example.com");
    assert(record !== null);
    const found = await lookupCustomerById(kv, record.id);
    assertEquals(found?.id, record.id);
  } finally {
    kv.close();
  }
});

Deno.test("lookupCustomerById: returns null for unknown id", async () => {
  const kv = await openMemoryKv();
  try {
    assertEquals(await lookupCustomerById(kv, "c_doesnotexist"), null);
  } finally {
    kv.close();
  }
});

Deno.test("lookupCustomerByEmail: case-insensitive match", async () => {
  const kv = await openMemoryKv();
  try {
    const record = await createCustomer(kv, "Bob@Example.com");
    assert(record !== null);
    const found = await lookupCustomerByEmail(kv, "  BOB@example.COM ");
    assertEquals(found?.id, record.id);
  } finally {
    kv.close();
  }
});

Deno.test("lookupCustomerByEmail: returns null for unknown email", async () => {
  const kv = await openMemoryKv();
  try {
    assertEquals(await lookupCustomerByEmail(kv, "nobody@nowhere.com"), null);
    assertEquals(await lookupCustomerByEmail(kv, "garbage"), null);
  } finally {
    kv.close();
  }
});

Deno.test("updateCustomerTier: switches free → pro", async () => {
  const kv = await openMemoryKv();
  try {
    const created = await createCustomer(kv, "alice@example.com");
    assert(created !== null);
    const updated = await updateCustomerTier(kv, created.id, "pro");
    assertEquals(updated?.tier, "pro");
    const reloaded = await lookupCustomerById(kv, created.id);
    assertEquals(reloaded?.tier, "pro");
  } finally {
    kv.close();
  }
});

Deno.test("updateCustomerTier: idempotent", async () => {
  const kv = await openMemoryKv();
  try {
    const created = await createCustomer(kv, "alice@example.com");
    assert(created !== null);
    const a = await updateCustomerTier(kv, created.id, "free");
    const b = await updateCustomerTier(kv, created.id, "free");
    assertEquals(a?.tier, "free");
    assertEquals(b?.tier, "free");
  } finally {
    kv.close();
  }
});

Deno.test("updateCustomerTier: returns null for unknown id", async () => {
  const kv = await openMemoryKv();
  try {
    assertEquals(await updateCustomerTier(kv, "c_nope", "pro"), null);
  } finally {
    kv.close();
  }
});

Deno.test("updateCustomerStatus: switches active → past_due → cancelled", async () => {
  const kv = await openMemoryKv();
  try {
    const created = await createCustomer(kv, "alice@example.com");
    assert(created !== null);
    const past = await updateCustomerStatus(kv, created.id, "past_due");
    assertEquals(past?.status, "past_due");
    const cancelled = await updateCustomerStatus(kv, created.id, "cancelled");
    assertEquals(cancelled?.status, "cancelled");
  } finally {
    kv.close();
  }
});

Deno.test("attachStripeCustomer: stores stripe id", async () => {
  const kv = await openMemoryKv();
  try {
    const created = await createCustomer(kv, "alice@example.com");
    assert(created !== null);
    const updated = await attachStripeCustomer(kv, created.id, "cus_abc123");
    assertEquals(updated?.stripe_customer_id, "cus_abc123");
  } finally {
    kv.close();
  }
});

Deno.test("listCustomers: newest-first ordering", async () => {
  const kv = await openMemoryKv();
  try {
    const first = await createCustomer(kv, "first@example.com");
    await new Promise((r) => setTimeout(r, 5));
    const second = await createCustomer(kv, "second@example.com");
    const listed = await listCustomers(kv);
    assertEquals(listed.length, 2);
    assertEquals(listed[0].id, second!.id);
    assertEquals(listed[1].id, first!.id);
  } finally {
    kv.close();
  }
});

Deno.test("listCustomers: empty store returns []", async () => {
  const kv = await openMemoryKv();
  try {
    assertEquals(await listCustomers(kv), []);
  } finally {
    kv.close();
  }
});
