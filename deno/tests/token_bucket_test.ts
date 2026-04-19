import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import { checkAndConsume, tokenBucketHeaders } from "../lib/token_bucket.ts";

async function openMemoryKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

/** Mutable clock helper — ms since epoch. */
function mutableClock(startMs: number): {
  now: () => number;
  advance: (ms: number) => void;
} {
  let t = startMs;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

Deno.test("checkAndConsume: first request on fresh bucket is allowed", async () => {
  const kv = await openMemoryKv();
  try {
    const clk = mutableClock(1_700_000_000_000);
    const r = await checkAndConsume(kv, "k_new", {
      ratePerMin: 60,
      burst: 10,
      now: clk.now,
    });
    assert(r.allowed);
    assertEquals(r.limit, 10);
    assertEquals(r.remaining, 9);
    assert(r.reset_at >= Math.floor(clk.now() / 1000));
  } finally {
    kv.close();
  }
});

Deno.test("checkAndConsume: drains burst then blocks", async () => {
  const kv = await openMemoryKv();
  try {
    const clk = mutableClock(1_700_000_000_000);
    const opts = { ratePerMin: 60, burst: 3, now: clk.now };

    const a = await checkAndConsume(kv, "k_drain", opts);
    const b = await checkAndConsume(kv, "k_drain", opts);
    const c = await checkAndConsume(kv, "k_drain", opts);
    const d = await checkAndConsume(kv, "k_drain", opts);

    assertEquals(
      [a.allowed, b.allowed, c.allowed, d.allowed],
      [true, true, true, false],
    );
    assertEquals(
      [a.remaining, b.remaining, c.remaining, d.remaining],
      [2, 1, 0, 0],
    );
    assert(d.retry_after >= 1);
  } finally {
    kv.close();
  }
});

Deno.test("checkAndConsume: refills tokens over time up to burst", async () => {
  const kv = await openMemoryKv();
  try {
    const clk = mutableClock(1_700_000_000_000);
    // 60/min = 1 tok/sec, burst 5.
    const opts = { ratePerMin: 60, burst: 5, now: clk.now };
    // Drain completely.
    for (let i = 0; i < 5; i++) await checkAndConsume(kv, "k_refill", opts);
    const blocked = await checkAndConsume(kv, "k_refill", opts);
    assert(!blocked.allowed);

    // Wait 3 seconds — should accrue ~3 tokens.
    clk.advance(3_000);
    const a = await checkAndConsume(kv, "k_refill", opts);
    const b = await checkAndConsume(kv, "k_refill", opts);
    const c = await checkAndConsume(kv, "k_refill", opts);
    const d = await checkAndConsume(kv, "k_refill", opts);
    assertEquals(
      [a.allowed, b.allowed, c.allowed, d.allowed],
      [true, true, true, false],
    );
  } finally {
    kv.close();
  }
});

Deno.test("checkAndConsume: refill caps at burst (no overflow)", async () => {
  const kv = await openMemoryKv();
  try {
    const clk = mutableClock(1_700_000_000_000);
    const opts = { ratePerMin: 60, burst: 4, now: clk.now };
    // Consume 1 to create bucket with state.
    await checkAndConsume(kv, "k_cap", opts);
    // Advance a long time — refill should saturate at burst, not pile up.
    clk.advance(60 * 60_000); // 1 hour
    const r = await checkAndConsume(kv, "k_cap", opts);
    assert(r.allowed);
    // Max remaining after consuming 1 from a full bucket is burst-1.
    assertEquals(r.remaining, 3);
  } finally {
    kv.close();
  }
});

Deno.test("checkAndConsume: separate keys have independent buckets", async () => {
  const kv = await openMemoryKv();
  try {
    const clk = mutableClock(1_700_000_000_000);
    const opts = { ratePerMin: 60, burst: 2, now: clk.now };
    await checkAndConsume(kv, "k_a", opts);
    await checkAndConsume(kv, "k_a", opts);
    const aBlocked = await checkAndConsume(kv, "k_a", opts);
    const bFresh = await checkAndConsume(kv, "k_b", opts);
    assert(!aBlocked.allowed);
    assert(bFresh.allowed);
    assertEquals(bFresh.remaining, 1);
  } finally {
    kv.close();
  }
});

Deno.test("checkAndConsume: Retry-After reflects rate, not window", async () => {
  const kv = await openMemoryKv();
  try {
    const clk = mutableClock(1_700_000_000_000);
    // 120/min = 2 tok/sec, burst 2, drain then immediately retry.
    const opts = { ratePerMin: 120, burst: 2, now: clk.now };
    await checkAndConsume(kv, "k_ra", opts);
    await checkAndConsume(kv, "k_ra", opts);
    const blocked = await checkAndConsume(kv, "k_ra", opts);
    assert(!blocked.allowed);
    // Need ~0.5s for 1 token at 2/sec → Retry-After ceil → 1.
    const h = tokenBucketHeaders(blocked);
    assertEquals(h["Retry-After"], "1");
  } finally {
    kv.close();
  }
});

Deno.test("checkAndConsume: reset_at is now + ceil((burst-tokens)/rate_per_sec)", async () => {
  const kv = await openMemoryKv();
  try {
    const nowMs = 1_700_000_000_000;
    const clk = mutableClock(nowMs);
    // 60/min = 1 tok/sec.
    const opts = { ratePerMin: 60, burst: 10, now: clk.now };
    const r = await checkAndConsume(kv, "k_reset", opts);
    const nowSec = Math.floor(nowMs / 1000);
    // Just consumed 1 token from a full bucket of 10 → 9 remaining, needs 1
    // second to refill to full.
    assertEquals(r.reset_at, nowSec + 1);
  } finally {
    kv.close();
  }
});

Deno.test("checkAndConsume: throws on invalid inputs", async () => {
  const kv = await openMemoryKv();
  try {
    let threw = 0;
    try {
      await checkAndConsume(kv, "k", { ratePerMin: 0, burst: 1 });
    } catch {
      threw++;
    }
    try {
      await checkAndConsume(kv, "k", { ratePerMin: 1, burst: 0 });
    } catch {
      threw++;
    }
    try {
      await checkAndConsume(kv, "k", { ratePerMin: 1, burst: 1, cost: 0 });
    } catch {
      threw++;
    }
    assertEquals(threw, 3);
  } finally {
    kv.close();
  }
});

Deno.test("tokenBucketHeaders: allowed response has no Retry-After", () => {
  const h = tokenBucketHeaders({
    allowed: true,
    limit: 60,
    remaining: 42,
    reset_at: 1_700_000_060,
    retry_after: 30,
  });
  assertEquals(h["X-RateLimit-Limit"], "60");
  assertEquals(h["X-RateLimit-Remaining"], "42");
  assertEquals(h["X-RateLimit-Reset"], "1700000060");
  assertEquals(h["Retry-After"], undefined);
});

Deno.test("tokenBucketHeaders: blocked response always sets Retry-After >= 1", () => {
  const h1 = tokenBucketHeaders({
    allowed: false,
    limit: 60,
    remaining: 0,
    reset_at: 1_700_000_060,
    retry_after: 0,
  });
  assertEquals(h1["Retry-After"], "1");
  const h2 = tokenBucketHeaders({
    allowed: false,
    limit: 60,
    remaining: 0,
    reset_at: 1_700_000_090,
    retry_after: 30,
  });
  assertEquals(h2["Retry-After"], "30");
});
