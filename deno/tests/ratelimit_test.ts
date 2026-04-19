import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import { checkRateLimit, rateLimitHeaders } from "../lib/ratelimit.ts";

async function openMemoryKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

/** Fixed clock helper — ms since epoch. */
function frozenClock(startMs: number): () => number {
  let t = startMs;
  const clock = () => t;
  (clock as unknown as { advance: (n: number) => void }).advance = (n: number) => {
    t += n;
  };
  return clock;
}

Deno.test("checkRateLimit: first request is allowed with correct remaining", async () => {
  const kv = await openMemoryKv();
  try {
    const result = await checkRateLimit(kv, "k_test", {
      limit: 5,
      windowSeconds: 60,
      now: () => 1_700_000_000_000, // fixed
    });
    assert(result.allowed);
    assertEquals(result.limit, 5);
    assertEquals(result.remaining, 4);
    // reset_at is the next window boundary (unix seconds)
    assertEquals(result.reset_at % 60, 0);
    assert(result.retry_after > 0);
  } finally {
    kv.close();
  }
});

Deno.test("checkRateLimit: allows up to limit, blocks from limit+1", async () => {
  const kv = await openMemoryKv();
  try {
    const opts = { limit: 3, windowSeconds: 60, now: () => 1_700_000_000_000 };
    const r1 = await checkRateLimit(kv, "k_1", opts);
    const r2 = await checkRateLimit(kv, "k_1", opts);
    const r3 = await checkRateLimit(kv, "k_1", opts);
    const r4 = await checkRateLimit(kv, "k_1", opts);
    const r5 = await checkRateLimit(kv, "k_1", opts);

    assertEquals(
      [r1.allowed, r2.allowed, r3.allowed, r4.allowed, r5.allowed],
      [true, true, true, false, false],
    );
    assertEquals(
      [r1.remaining, r2.remaining, r3.remaining, r4.remaining, r5.remaining],
      [2, 1, 0, 0, 0],
    );
  } finally {
    kv.close();
  }
});

Deno.test("checkRateLimit: separate keys have separate counters", async () => {
  const kv = await openMemoryKv();
  try {
    const opts = { limit: 2, windowSeconds: 60, now: () => 1_700_000_000_000 };
    await checkRateLimit(kv, "k_a", opts);
    await checkRateLimit(kv, "k_a", opts);
    const aBlocked = await checkRateLimit(kv, "k_a", opts);
    const bAllowed = await checkRateLimit(kv, "k_b", opts);
    assert(!aBlocked.allowed);
    assert(bAllowed.allowed);
    assertEquals(bAllowed.remaining, 1);
  } finally {
    kv.close();
  }
});

Deno.test("checkRateLimit: window rollover resets counter", async () => {
  const kv = await openMemoryKv();
  try {
    let t = 1_700_000_000_000; // exact window start
    const now = () => t;

    const opts = { limit: 2, windowSeconds: 60, now };
    await checkRateLimit(kv, "k_r", opts);
    await checkRateLimit(kv, "k_r", opts);
    const blocked = await checkRateLimit(kv, "k_r", opts);
    assert(!blocked.allowed);

    // Advance past the window boundary (+61s).
    t += 61_000;
    const nextWindow = await checkRateLimit(kv, "k_r", opts);
    assert(nextWindow.allowed);
    assertEquals(nextWindow.remaining, 1);
  } finally {
    kv.close();
  }
});

Deno.test("checkRateLimit: reset_at is at the next window boundary", async () => {
  const kv = await openMemoryKv();
  try {
    const now = () => 1_700_000_030_000; // 30s into a 60s window
    const result = await checkRateLimit(kv, "k_x", { limit: 10, windowSeconds: 60, now });
    // At t=1700000030s, window started at t=1700000000-? Actually:
    //   nowSeconds = 1_700_000_030
    //   windowStart = floor(1_700_000_030 / 60) * 60
    //   windowEnd = windowStart + 60
    const nowSec = 1_700_000_030;
    const windowStart = Math.floor(nowSec / 60) * 60;
    const windowEnd = windowStart + 60;
    assertEquals(result.reset_at, windowEnd);
    assertEquals(result.retry_after, windowEnd - nowSec);
  } finally {
    kv.close();
  }
});

Deno.test("checkRateLimit: throws on limit < 1", async () => {
  const kv = await openMemoryKv();
  try {
    let threw = false;
    try {
      await checkRateLimit(kv, "k_z", { limit: 0 });
    } catch {
      threw = true;
    }
    assert(threw);
  } finally {
    kv.close();
  }
});

Deno.test("rateLimitHeaders: allowed response has no Retry-After", () => {
  const headers = rateLimitHeaders({
    allowed: true,
    limit: 60,
    remaining: 42,
    reset_at: 1_700_000_060,
    retry_after: 30,
  });
  assertEquals(headers["X-RateLimit-Limit"], "60");
  assertEquals(headers["X-RateLimit-Remaining"], "42");
  assertEquals(headers["X-RateLimit-Reset"], "1700000060");
  assertEquals(headers["Retry-After"], undefined);
});

Deno.test("rateLimitHeaders: blocked response sets Retry-After >= 1", () => {
  const headers = rateLimitHeaders({
    allowed: false,
    limit: 60,
    remaining: 0,
    reset_at: 1_700_000_060,
    retry_after: 0, // boundary: still surface 1
  });
  assertEquals(headers["Retry-After"], "1");
  const headers2 = rateLimitHeaders({
    allowed: false,
    limit: 60,
    remaining: 0,
    reset_at: 1_700_000_090,
    retry_after: 30,
  });
  assertEquals(headers2["Retry-After"], "30");
});
