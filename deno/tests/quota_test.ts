import {
  assert,
  assertEquals,
  assertRejects,
} from "jsr:@std/assert@^1.0.0";
import { defaultConfig } from "../lib/config.ts";
import { QuotaExceededError } from "../lib/errors.ts";
import {
  currentMonthYYYYMM,
  incrementUsage,
  monthlyQuotaHeaders,
  nextMonthResetEpochSeconds,
  peekUsage,
  quotaFor,
  usageKey,
} from "../lib/quota.ts";

async function openMemoryKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

Deno.test("currentMonthYYYYMM: pads month to 2 digits, uses UTC", () => {
  assertEquals(
    currentMonthYYYYMM(new Date("2026-04-18T10:00:00Z")),
    "202604",
  );
  assertEquals(
    currentMonthYYYYMM(new Date("2026-01-01T00:00:00Z")),
    "202601",
  );
  assertEquals(
    currentMonthYYYYMM(new Date("2026-12-31T23:59:59Z")),
    "202612",
  );
});

Deno.test("currentMonthYYYYMM: rolls on UTC boundary, not local", () => {
  // 2026-05-01T01:30:00Z is already May in UTC regardless of local TZ.
  assertEquals(
    currentMonthYYYYMM(new Date("2026-05-01T01:30:00Z")),
    "202605",
  );
});

Deno.test("nextMonthResetEpochSeconds: matches start of next UTC month", () => {
  const apr = new Date("2026-04-18T10:00:00Z");
  const may1 = Math.floor(Date.UTC(2026, 4, 1) / 1000);
  assertEquals(nextMonthResetEpochSeconds(apr), may1);
});

Deno.test("nextMonthResetEpochSeconds: handles December → January rollover", () => {
  const dec = new Date("2026-12-15T10:00:00Z");
  const jan1 = Math.floor(Date.UTC(2027, 0, 1) / 1000);
  assertEquals(nextMonthResetEpochSeconds(dec), jan1);
});

Deno.test("quotaFor: selects limit by tier", () => {
  const cfg = defaultConfig();
  assertEquals(quotaFor("free", cfg), cfg.monthlyQuotaFree);
  assertEquals(quotaFor("pro", cfg), cfg.monthlyQuotaPro);
});

Deno.test("peekUsage: missing counter → used=0, remaining=limit", async () => {
  const kv = await openMemoryKv();
  try {
    const snap = await peekUsage(kv, "c_missing", {
      tier: "free",
      limit: 100,
    });
    assertEquals(snap.used, 0);
    assertEquals(snap.remaining, 100);
    assertEquals(snap.limit, 100);
    assertEquals(snap.tier, "free");
    assert(Number.isFinite(snap.reset_at));
  } finally {
    kv.close();
  }
});

Deno.test("incrementUsage: first call → used=1, remaining=limit-1", async () => {
  const kv = await openMemoryKv();
  try {
    const snap = await incrementUsage(kv, "c_abc", {
      tier: "free",
      limit: 10,
    });
    assertEquals(snap.used, 1);
    assertEquals(snap.limit, 10);
    assertEquals(snap.remaining, 9);
    assertEquals(snap.tier, "free");
  } finally {
    kv.close();
  }
});

Deno.test("incrementUsage: monotonic under sequential calls", async () => {
  const kv = await openMemoryKv();
  try {
    const customerId = "c_seq";
    for (let i = 1; i <= 5; i++) {
      const snap = await incrementUsage(kv, customerId, {
        tier: "free",
        limit: 10,
      });
      assertEquals(snap.used, i);
      assertEquals(snap.remaining, 10 - i);
    }
  } finally {
    kv.close();
  }
});

Deno.test("incrementUsage: refuses at limit → throws QuotaExceededError", async () => {
  const kv = await openMemoryKv();
  try {
    const customerId = "c_limit";
    // Fill the bucket to the limit.
    for (let i = 0; i < 3; i++) {
      await incrementUsage(kv, customerId, { tier: "free", limit: 3 });
    }
    // Next call should be rejected without bumping.
    const err = await assertRejects(
      () => incrementUsage(kv, customerId, { tier: "free", limit: 3 }),
      QuotaExceededError,
    );
    assertEquals(err.status, 402);
    assertEquals(err.code, "quota_exceeded");
    assertEquals(err.headers["X-Monthly-Quota-Limit"], "3");
    assertEquals(err.headers["X-Monthly-Quota-Remaining"], "0");
    // Confirm no silent bump on refusal.
    const snap = await peekUsage(kv, customerId, { tier: "free", limit: 3 });
    assertEquals(snap.used, 3);
  } finally {
    kv.close();
  }
});

Deno.test("incrementUsage: counters are isolated per customer", async () => {
  const kv = await openMemoryKv();
  try {
    await incrementUsage(kv, "c_alice", { tier: "free", limit: 10 });
    await incrementUsage(kv, "c_alice", { tier: "free", limit: 10 });
    const alice = await peekUsage(kv, "c_alice", { tier: "free", limit: 10 });
    const bob = await peekUsage(kv, "c_bob", { tier: "free", limit: 10 });
    assertEquals(alice.used, 2);
    assertEquals(bob.used, 0);
  } finally {
    kv.close();
  }
});

Deno.test("incrementUsage: previous month's counter untouched at rollover", async () => {
  const kv = await openMemoryKv();
  try {
    const customerId = "c_rollover";
    const apr = new Date("2026-04-30T23:00:00Z");
    const may = new Date("2026-05-01T00:30:00Z");
    // Bump April.
    await incrementUsage(kv, customerId, {
      tier: "free",
      limit: 100,
      now: apr,
    });
    await incrementUsage(kv, customerId, {
      tier: "free",
      limit: 100,
      now: apr,
    });
    // Bump May (different bucket).
    const maySnap = await incrementUsage(kv, customerId, {
      tier: "free",
      limit: 100,
      now: may,
    });
    assertEquals(maySnap.used, 1);
    // April bucket still shows 2.
    const aprSnap = await peekUsage(kv, customerId, {
      tier: "free",
      limit: 100,
      now: apr,
    });
    assertEquals(aprSnap.used, 2);
  } finally {
    kv.close();
  }
});

Deno.test("incrementUsage: pro tier uses the higher limit", async () => {
  const kv = await openMemoryKv();
  try {
    const cfg = defaultConfig();
    const snap = await incrementUsage(kv, "c_pro", {
      tier: "pro",
      limit: quotaFor("pro", cfg),
    });
    assertEquals(snap.limit, cfg.monthlyQuotaPro);
    assertEquals(snap.remaining, cfg.monthlyQuotaPro - 1);
  } finally {
    kv.close();
  }
});

Deno.test("usageKey: consistent shape for a customer+month pair", () => {
  assertEquals(usageKey("c_abc", "202604"), ["usage", "c_abc", "202604"]);
});

Deno.test("monthlyQuotaHeaders: maps snapshot fields to canonical names", () => {
  const headers = monthlyQuotaHeaders({
    tier: "free",
    used: 5,
    limit: 100,
    remaining: 95,
    reset_at: 1_746_057_600,
  });
  assertEquals(headers["X-Monthly-Quota-Limit"], "100");
  assertEquals(headers["X-Monthly-Quota-Remaining"], "95");
  assertEquals(headers["X-Monthly-Quota-Reset"], "1746057600");
});

Deno.test("QuotaExceededError: reset_at header threaded from throw site", async () => {
  const kv = await openMemoryKv();
  try {
    const customerId = "c_reset";
    await incrementUsage(kv, customerId, {
      tier: "free",
      limit: 1,
      now: new Date("2026-04-18T10:00:00Z"),
    });
    const err = await assertRejects(
      () =>
        incrementUsage(kv, customerId, {
          tier: "free",
          limit: 1,
          now: new Date("2026-04-18T10:00:00Z"),
        }),
      QuotaExceededError,
    );
    const expectedReset = Math.floor(Date.UTC(2026, 4, 1) / 1000);
    assertEquals(err.headers["X-Monthly-Quota-Reset"], String(expectedReset));
  } finally {
    kv.close();
  }
});
