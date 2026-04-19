/**
 * Fixed-window rate limiter backed by Deno KV atomic counters.
 *
 * Storage schema:
 *   ["rl", <key_id>, <window_start_unix_seconds>]  -> Deno.KvU64
 *
 * Each call to `checkRateLimit` atomically increments the counter for the
 * current window, then returns `{ allowed, limit, remaining, reset_at }`.
 * Buckets expire via `expireIn` (TTL = 2 * window duration) so stale keys
 * do not accumulate and adjacent buckets remain readable for diagnostics.
 *
 * Trade-offs (documented in the M1 plan):
 *   - Fixed windows permit 2x burst at the boundary (last second of window N
 *     + first second of window N+1). Acceptable for M1; swap to a token
 *     bucket if abuse is observed in production.
 *   - Denied requests still increment the counter. That is intentional --
 *     abusive clients don't get a "free" retry until the window rolls over.
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  /** Remaining requests in the current window (0 when blocked). */
  remaining: number;
  /** Unix seconds at which the current window resets. */
  reset_at: number;
  /** Seconds until the current window resets (for Retry-After). */
  retry_after: number;
}

export interface RateLimitOptions {
  /** Max requests per window. Must be >= 1. */
  limit: number;
  /** Window duration in seconds. Default 60. */
  windowSeconds?: number;
  /** Override current time (for tests). Milliseconds since epoch. */
  now?: () => number;
}

const DEFAULT_WINDOW_SECONDS = 60;

/** Produce HTTP response headers describing the rate-limit state. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset_at),
  };
  if (!result.allowed) {
    headers["Retry-After"] = String(Math.max(1, result.retry_after));
  }
  return headers;
}

/**
 * Increment the current-window counter and return the rate-limit decision.
 *
 * Uses a check-and-retry read-modify-write loop so we can attach
 * `expireIn` on the counter (not supported by `atomic().sum`). TTL is
 * refreshed on every successful commit so active buckets stay alive for
 * the duration of their window; dormant buckets are reclaimed by KV.
 *
 * If contention exceeds the retry budget (very rare outside stress tests),
 * we fail open rather than blocking legitimate traffic on a KV stall. A
 * genuine abuser will trip again on the next request.
 */
export async function checkRateLimit(
  kv: Deno.Kv,
  keyId: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  if (opts.limit < 1) {
    throw new Error(`rate limit must be >= 1 (got ${opts.limit})`);
  }
  const windowSeconds = opts.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  const now = opts.now ? opts.now() : Date.now();
  const nowSeconds = Math.floor(now / 1000);
  const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
  const windowEnd = windowStart + windowSeconds;
  const retryAfter = Math.max(0, windowEnd - nowSeconds);

  const bucketKey = ["rl", keyId, windowStart];
  const expireIn = windowSeconds * 2 * 1000; // 2x window, in ms.

  const MAX_RETRIES = 4;
  for (let i = 0; i < MAX_RETRIES; i++) {
    const entry = await kv.get<Deno.KvU64>(bucketKey);
    const current = entry.value?.value ?? 0n;
    const next = current + 1n;
    const result = await kv.atomic()
      .check(entry)
      .set(bucketKey, new Deno.KvU64(next), { expireIn })
      .commit();
    if (result.ok) {
      const count = Number(next);
      return {
        allowed: count <= opts.limit,
        limit: opts.limit,
        remaining: Math.max(0, opts.limit - count),
        reset_at: windowEnd,
        retry_after: retryAfter,
      };
    }
  }

  return {
    allowed: true,
    limit: opts.limit,
    remaining: opts.limit,
    reset_at: windowEnd,
    retry_after: retryAfter,
  };
}
