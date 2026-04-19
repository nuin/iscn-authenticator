/**
 * Token-bucket rate limiter backed by Deno KV atomic CAS.
 *
 * Storage schema:
 *   ["tb", <key_id>] -> { tokens: number, updated_ms: number }
 *
 * Each call to `checkAndConsume`:
 *   1. Reads the current bucket (or initialises full on first sight).
 *   2. Refills tokens at `rate_per_sec` up to `burst` based on elapsed time.
 *   3. Attempts to consume `cost` tokens (default 1).
 *   4. Writes the new state back under CAS.
 *
 * Replaces the earlier fixed-window limiter (deleted in M2/3). Token buckets
 * are the right primitive for client SDKs that use retry-with-jitter — a
 * fixed window's 2x-burst-at-boundary behaviour surprises those clients.
 *
 * Trade-offs:
 *   - Denied requests still update `updated_ms` so the refill clock keeps
 *     ticking; callers never get penalised indefinitely by racing their own
 *     blocked retries.
 *   - On CAS contention exceeding `MAX_RETRIES` we fail open — same policy
 *     as the old limiter. A genuine abuser will trip again immediately.
 */

export interface TokenBucketState {
  tokens: number;
  updated_ms: number;
}

export interface TokenBucketOptions {
  /** Refill rate in tokens per minute. Must be > 0 (fractional allowed). */
  ratePerMin: number;
  /** Maximum tokens the bucket can hold. Must be >= 1. */
  burst: number;
  /** Override current time for tests. Milliseconds since epoch. */
  now?: () => number;
  /** Tokens to charge for this request (default 1). */
  cost?: number;
}

export interface TokenBucketResult {
  allowed: boolean;
  /** Maximum bucket capacity (for headers). */
  limit: number;
  /** Integer tokens left after the decision (floored). */
  remaining: number;
  /** Unix seconds at which the bucket would refill to full. */
  reset_at: number;
  /** Seconds until enough tokens exist for one request (>= 1 when blocked). */
  retry_after: number;
}

const MAX_RETRIES = 5;

/** Produce HTTP response headers describing the bucket state. */
export function tokenBucketHeaders(
  result: TokenBucketResult,
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset_at),
  };
  if (!result.allowed) {
    headers["Retry-After"] = String(Math.max(1, Math.ceil(result.retry_after)));
  }
  return headers;
}

/**
 * Atomically refill + consume a token for `keyId`.
 *
 * Returns `{ allowed: false }` with `retry_after` set when the bucket has
 * fewer than `cost` tokens; the caller should translate that to a 429.
 */
export async function checkAndConsume(
  kv: Deno.Kv,
  keyId: string,
  opts: TokenBucketOptions,
): Promise<TokenBucketResult> {
  if (opts.ratePerMin <= 0) {
    throw new Error(`ratePerMin must be > 0 (got ${opts.ratePerMin})`);
  }
  if (opts.burst < 1) {
    throw new Error(`burst must be >= 1 (got ${opts.burst})`);
  }
  const cost = opts.cost ?? 1;
  if (cost < 1) {
    throw new Error(`cost must be >= 1 (got ${cost})`);
  }

  const ratePerSec = opts.ratePerMin / 60;
  const nowMs = opts.now ? opts.now() : Date.now();
  const bucketKey: Deno.KvKey = ["tb", keyId];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const entry = await kv.get<TokenBucketState>(bucketKey);
    const prior = entry.value;

    // Refill relative to the last update (full bucket on first sight).
    let tokens: number;
    if (prior === null) {
      tokens = opts.burst;
    } else {
      const elapsedMs = Math.max(0, nowMs - prior.updated_ms);
      const refill = (elapsedMs / 1000) * ratePerSec;
      tokens = Math.min(opts.burst, prior.tokens + refill);
    }

    const allowed = tokens >= cost;
    const tokensAfter = allowed ? tokens - cost : tokens;
    const next: TokenBucketState = { tokens: tokensAfter, updated_ms: nowMs };

    const commit = await kv.atomic()
      .check(entry)
      .set(bucketKey, next)
      .commit();
    if (!commit.ok) continue;

    const nowSec = Math.floor(nowMs / 1000);
    const secondsToFull = ratePerSec > 0 ? Math.ceil((opts.burst - tokensAfter) / ratePerSec) : 0;
    const resetAt = nowSec + Math.max(0, secondsToFull);

    const retryAfterRaw = allowed ? 0 : (cost - tokensAfter) / ratePerSec;
    const retryAfter = Math.max(0, retryAfterRaw);

    return {
      allowed,
      limit: opts.burst,
      remaining: Math.max(0, Math.floor(tokensAfter)),
      reset_at: resetAt,
      retry_after: retryAfter,
    };
  }

  // CAS contention exceeded budget — fail open, same policy as the previous
  // limiter. The next request will reconverge.
  const nowSec = Math.floor(nowMs / 1000);
  return {
    allowed: true,
    limit: opts.burst,
    remaining: opts.burst,
    reset_at: nowSec,
    retry_after: 0,
  };
}
